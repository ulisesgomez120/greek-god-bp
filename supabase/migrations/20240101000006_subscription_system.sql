-- ============================================================================
-- ENHANCED SUBSCRIPTION SYSTEM WITH BILLING AND FEATURE MANAGEMENT
-- ============================================================================
-- This migration enhances the subscription system with advanced billing features,
-- usage tracking, feature flags, and subscription analytics
-- Version: 20240101000006
-- Description: Enhanced subscription management, billing, and feature access control

-- ============================================================================
-- SUBSCRIPTION FEATURE FLAGS AND LIMITS
-- ============================================================================

-- Feature access control table
CREATE TABLE subscription_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_key TEXT NOT NULL UNIQUE,
  feature_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('core', 'ai', 'analytics', 'social', 'premium')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plan feature mappings with limits
CREATE TABLE plan_feature_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES subscription_features(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT TRUE,
  usage_limit INTEGER, -- NULL for unlimited, 0 for disabled, positive for limit
  reset_period TEXT CHECK (reset_period IN ('daily', 'weekly', 'monthly', 'yearly', 'lifetime')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(plan_id, feature_id)
);

-- User feature usage tracking
CREATE TABLE user_feature_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES subscription_features(id) ON DELETE CASCADE,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  reset_at TIMESTAMP WITH TIME ZONE,
  period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, feature_id, period_start)
);

-- ============================================================================
-- BILLING AND PAYMENT TRACKING
-- ============================================================================

-- Payment history
CREATE TABLE payment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_invoice_id TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled', 'refunded')),
  payment_method TEXT, -- 'card', 'bank_transfer', etc.
  failure_reason TEXT,
  refund_amount_cents INTEGER DEFAULT 0,
  refunded_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Billing addresses
CREATE TABLE billing_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT FALSE,
  company_name TEXT,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state_province TEXT,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL,
  tax_id TEXT, -- VAT number, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription usage analytics
CREATE TABLE subscription_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  
  -- Usage metrics
  workouts_logged INTEGER DEFAULT 0,
  ai_queries_used INTEGER DEFAULT 0,
  custom_workouts_created INTEGER DEFAULT 0,
  data_exports INTEGER DEFAULT 0,
  
  -- Engagement metrics
  days_active INTEGER DEFAULT 0,
  features_used TEXT[] DEFAULT '{}',
  session_duration_minutes INTEGER DEFAULT 0,
  
  -- Value metrics
  estimated_value_delivered DECIMAL(8,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(subscription_id, metric_date)
);

-- ============================================================================
-- SUBSCRIPTION LIFECYCLE MANAGEMENT
-- ============================================================================

-- Subscription change requests
CREATE TABLE subscription_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  current_subscription_id UUID REFERENCES subscriptions(id),
  target_plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  change_type TEXT NOT NULL CHECK (change_type IN ('upgrade', 'downgrade', 'cancel', 'reactivate')),
  
  -- Change details
  effective_date DATE,
  proration_amount_cents INTEGER,
  reason TEXT,
  user_feedback TEXT,
  
  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'canceled')),
  processed_at TIMESTAMP WITH TIME ZONE,
  stripe_subscription_schedule_id TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription pause/resume tracking
CREATE TABLE subscription_pauses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  pause_start_date DATE NOT NULL,
  pause_end_date DATE,
  reason TEXT,
  auto_resume BOOLEAN DEFAULT TRUE,
  
  -- Billing adjustments
  billing_cycle_anchor DATE,
  prorated_amount_cents INTEGER,
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resumed', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PROMOTIONAL AND DISCOUNT SYSTEM
-- ============================================================================

-- Discount codes and promotions
CREATE TABLE discount_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Discount configuration
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_trial')),
  discount_value INTEGER NOT NULL, -- Percentage (1-100) or cents
  currency TEXT DEFAULT 'usd',
  
  -- Validity and limits
  valid_from DATE NOT NULL,
  valid_until DATE,
  max_uses INTEGER, -- NULL for unlimited
  max_uses_per_user INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  
  -- Applicable plans
  applicable_plan_ids UUID[] DEFAULT '{}',
  new_customers_only BOOLEAN DEFAULT FALSE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Discount code usage tracking
CREATE TABLE discount_code_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  discount_code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  
  -- Usage details
  discount_amount_cents INTEGER NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Stripe integration
  stripe_coupon_id TEXT,
  stripe_promotion_code_id TEXT,
  
  UNIQUE(discount_code_id, user_id, subscription_id)
);

-- ============================================================================
-- SUBSCRIPTION FUNCTIONS
-- ============================================================================

-- Function to check feature access with usage limits
CREATE OR REPLACE FUNCTION check_feature_access(
  p_user_id UUID,
  p_feature_key TEXT
) RETURNS JSONB AS $$
DECLARE
  user_subscription RECORD;
  feature_record RECORD;
  plan_limit RECORD;
  current_usage INTEGER;
  result JSONB;
BEGIN
  -- Get user's active subscription
  SELECT s.*, sp.* INTO user_subscription
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND s.current_period_end > NOW()
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Get feature details
  SELECT * INTO feature_record
  FROM subscription_features
  WHERE feature_key = p_feature_key AND is_active = TRUE;

  IF feature_record IS NULL THEN
    RETURN jsonb_build_object(
      'has_access', false,
      'reason', 'feature_not_found'
    );
  END IF;

  -- If no active subscription, deny access to premium features
  IF user_subscription IS NULL THEN
    RETURN jsonb_build_object(
      'has_access', false,
      'reason', 'no_active_subscription',
      'feature_name', feature_record.feature_name
    );
  END IF;

  -- Get plan feature limits
  SELECT * INTO plan_limit
  FROM plan_feature_limits pfl
  WHERE pfl.plan_id = user_subscription.plan_id
    AND pfl.feature_id = feature_record.id;

  -- If feature not in plan, deny access
  IF plan_limit IS NULL OR plan_limit.is_enabled = FALSE THEN
    RETURN jsonb_build_object(
      'has_access', false,
      'reason', 'feature_not_in_plan',
      'feature_name', feature_record.feature_name,
      'plan_name', user_subscription.name
    );
  END IF;

  -- If unlimited usage, grant access
  IF plan_limit.usage_limit IS NULL THEN
    RETURN jsonb_build_object(
      'has_access', true,
      'unlimited', true,
      'feature_name', feature_record.feature_name
    );
  END IF;

  -- Check current usage against limit
  SELECT COALESCE(usage_count, 0) INTO current_usage
  FROM user_feature_usage
  WHERE user_id = p_user_id
    AND feature_id = feature_record.id
    AND (
      (plan_limit.reset_period = 'monthly' AND period_start >= DATE_TRUNC('month', NOW())) OR
      (plan_limit.reset_period = 'daily' AND period_start >= DATE_TRUNC('day', NOW())) OR
      (plan_limit.reset_period = 'weekly' AND period_start >= DATE_TRUNC('week', NOW())) OR
      (plan_limit.reset_period = 'yearly' AND period_start >= DATE_TRUNC('year', NOW())) OR
      (plan_limit.reset_period = 'lifetime')
    );

  -- Build result
  result := jsonb_build_object(
    'has_access', current_usage < plan_limit.usage_limit,
    'feature_name', feature_record.feature_name,
    'current_usage', current_usage,
    'usage_limit', plan_limit.usage_limit,
    'reset_period', plan_limit.reset_period,
    'remaining_usage', GREATEST(0, plan_limit.usage_limit - current_usage)
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track feature usage
CREATE OR REPLACE FUNCTION track_feature_usage(
  p_user_id UUID,
  p_feature_key TEXT,
  p_usage_count INTEGER DEFAULT 1
) RETURNS BOOLEAN AS $$
DECLARE
  feature_record RECORD;
  plan_limit RECORD;
  period_start_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get feature details
  SELECT * INTO feature_record
  FROM subscription_features
  WHERE feature_key = p_feature_key AND is_active = TRUE;

  IF feature_record IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get plan feature limits
  SELECT pfl.*, sp.name as plan_name INTO plan_limit
  FROM plan_feature_limits pfl
  JOIN subscription_plans sp ON pfl.plan_id = sp.id
  JOIN subscriptions s ON s.plan_id = sp.id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND s.current_period_end > NOW()
    AND pfl.feature_id = feature_record.id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF plan_limit IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Determine period start based on reset period
  CASE plan_limit.reset_period
    WHEN 'daily' THEN period_start_date := DATE_TRUNC('day', NOW());
    WHEN 'weekly' THEN period_start_date := DATE_TRUNC('week', NOW());
    WHEN 'monthly' THEN period_start_date := DATE_TRUNC('month', NOW());
    WHEN 'yearly' THEN period_start_date := DATE_TRUNC('year', NOW());
    ELSE period_start_date := '1970-01-01'::TIMESTAMP WITH TIME ZONE; -- Lifetime
  END CASE;

  -- Insert or update usage record
  INSERT INTO user_feature_usage (
    user_id, feature_id, usage_count, last_used_at, period_start
  ) VALUES (
    p_user_id, feature_record.id, p_usage_count, NOW(), period_start_date
  )
  ON CONFLICT (user_id, feature_id, period_start)
  DO UPDATE SET
    usage_count = user_feature_usage.usage_count + p_usage_count,
    last_used_at = NOW(),
    updated_at = NOW();

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate subscription metrics
CREATE OR REPLACE FUNCTION calculate_subscription_metrics(
  p_date_from DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_date_to DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  metrics JSONB;
  mrr DECIMAL(10,2);
  churn_rate DECIMAL(5,2);
  ltv DECIMAL(10,2);
BEGIN
  -- Calculate Monthly Recurring Revenue (MRR)
  SELECT COALESCE(SUM(
    CASE sp.interval
      WHEN 'month' THEN sp.price_cents / 100.0
      WHEN 'year' THEN sp.price_cents / 100.0 / 12.0
    END
  ), 0) INTO mrr
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.status = 'active'
    AND s.current_period_end > NOW();

  -- Calculate churn rate (simplified)
  SELECT COALESCE(
    (COUNT(CASE WHEN s.canceled_at BETWEEN p_date_from AND p_date_to THEN 1 END)::DECIMAL /
     NULLIF(COUNT(CASE WHEN s.created_at < p_date_from THEN 1 END), 0)) * 100,
    0
  ) INTO churn_rate
  FROM subscriptions s;

  -- Calculate average LTV (simplified)
  SELECT COALESCE(AVG(
    CASE sp.interval
      WHEN 'month' THEN sp.price_cents / 100.0 * 12 -- Assume 12 month average
      WHEN 'year' THEN sp.price_cents / 100.0 * 2   -- Assume 2 year average
    END
  ), 0) INTO ltv
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.status IN ('active', 'canceled');

  -- Build metrics object
  metrics := jsonb_build_object(
    'mrr', mrr,
    'churn_rate_percentage', churn_rate,
    'average_ltv', ltv,
    'calculated_at', NOW(),
    'period_from', p_date_from,
    'period_to', p_date_to
  );

  RETURN metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Subscription features indexes
CREATE INDEX idx_subscription_features_key ON subscription_features(feature_key) WHERE is_active = TRUE;
CREATE INDEX idx_subscription_features_category ON subscription_features(category, is_active);

-- Plan feature limits indexes
CREATE INDEX idx_plan_feature_limits_plan ON plan_feature_limits(plan_id, is_enabled);
CREATE INDEX idx_plan_feature_limits_feature ON plan_feature_limits(feature_id, is_enabled);

-- User feature usage indexes
CREATE INDEX idx_user_feature_usage_user_period ON user_feature_usage(user_id, period_start DESC);
CREATE INDEX idx_user_feature_usage_feature_period ON user_feature_usage(feature_id, period_start DESC);

-- Payment history indexes
CREATE INDEX idx_payment_history_user_date ON payment_history(user_id, created_at DESC);
CREATE INDEX idx_payment_history_status ON payment_history(status, created_at DESC);
CREATE INDEX idx_payment_history_stripe ON payment_history(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

-- Billing addresses indexes
CREATE INDEX idx_billing_addresses_user_default ON billing_addresses(user_id, is_default);

-- Subscription analytics indexes
CREATE INDEX idx_subscription_analytics_sub_date ON subscription_analytics(subscription_id, metric_date DESC);
CREATE INDEX idx_subscription_analytics_date ON subscription_analytics(metric_date DESC);

-- Subscription changes indexes
CREATE INDEX idx_subscription_changes_user_status ON subscription_changes(user_id, status, created_at DESC);
CREATE INDEX idx_subscription_changes_effective_date ON subscription_changes(effective_date) WHERE status = 'pending';

-- Discount codes indexes
CREATE INDEX idx_discount_codes_code ON discount_codes(code) WHERE is_active = TRUE;
CREATE INDEX idx_discount_codes_validity ON discount_codes(valid_from, valid_until) WHERE is_active = TRUE;

-- Discount usage indexes
CREATE INDEX idx_discount_usage_user ON discount_code_usage(user_id, applied_at DESC);
CREATE INDEX idx_discount_usage_code ON discount_code_usage(discount_code_id, applied_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE subscription_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_feature_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feature_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_pauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_code_usage ENABLE ROW LEVEL SECURITY;

-- Subscription features policies (public read for active features)
CREATE POLICY "Anyone can view active subscription features" ON subscription_features
  FOR SELECT USING (is_active = TRUE);

-- Plan feature limits policies (public read)
CREATE POLICY "Anyone can view plan feature limits" ON plan_feature_limits
  FOR SELECT USING (true);

-- User feature usage policies
CREATE POLICY "Users can view own feature usage" ON user_feature_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage user feature usage" ON user_feature_usage
  FOR ALL USING (auth.uid() = user_id);

-- Payment history policies
CREATE POLICY "Users can view own payment history" ON payment_history
  FOR SELECT USING (auth.uid() = user_id);

-- Billing addresses policies
CREATE POLICY "Users can view own billing addresses" ON billing_addresses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own billing addresses" ON billing_addresses
  FOR ALL USING (auth.uid() = user_id);

-- Subscription analytics policies (admin only for now)
CREATE POLICY "Admins can view subscription analytics" ON subscription_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Subscription changes policies
CREATE POLICY "Users can view own subscription changes" ON subscription_changes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subscription changes" ON subscription_changes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Subscription pauses policies
CREATE POLICY "Users can view own subscription pauses" ON subscription_pauses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM subscriptions s 
      WHERE s.id = subscription_pauses.subscription_id 
      AND s.user_id = auth.uid()
    )
  );

-- Discount codes policies (public read for active codes)
CREATE POLICY "Anyone can view active discount codes" ON discount_codes
  FOR SELECT USING (is_active = TRUE AND valid_from <= CURRENT_DATE AND (valid_until IS NULL OR valid_until >= CURRENT_DATE));

-- Discount usage policies
CREATE POLICY "Users can view own discount usage" ON discount_code_usage
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS AND AUTOMATION
-- ============================================================================

-- Trigger to update billing address default status
CREATE OR REPLACE FUNCTION update_billing_address_default()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting as default, unset other defaults for this user
  IF NEW.is_default = TRUE THEN
    UPDATE billing_addresses 
    SET is_default = FALSE 
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_billing_address_default_trigger
  BEFORE INSERT OR UPDATE ON billing_addresses
  FOR EACH ROW EXECUTE FUNCTION update_billing_address_default();

-- Trigger to update discount code usage count
CREATE OR REPLACE FUNCTION update_discount_code_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE discount_codes 
  SET current_uses = current_uses + 1
  WHERE id = NEW.discount_code_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_discount_code_usage_count_trigger
  AFTER INSERT ON discount_code_usage
  FOR EACH ROW EXECUTE FUNCTION update_discount_code_usage_count();

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Insert core subscription features
INSERT INTO subscription_features (feature_key, feature_name, description, category) VALUES
('unlimited_workouts', 'Unlimited Workout Logging', 'Log unlimited workout sessions', 'core'),
('ai_coaching', 'AI Coaching', 'Access to AI-powered workout coaching', 'ai'),
('ai_monthly_reviews', 'Monthly AI Reviews', 'AI-generated monthly progress reviews', 'ai'),
('custom_programs', 'Custom Program Builder', 'Create and customize workout programs', 'premium'),
('advanced_analytics', 'Advanced Analytics', 'Detailed progress analytics and insights', 'analytics'),
('data_export', 'Data Export', 'Export workout data in various formats', 'premium'),
('priority_support', 'Priority Support', 'Priority customer support', 'premium'),
('beta_features', 'Beta Features', 'Early access to new features', 'premium');

-- Create default subscription plans if they don't exist
DO $$
BEGIN
  -- Insert Free plan if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Free') THEN
    INSERT INTO subscription_plans (name, description, price_cents, interval, stripe_price_id, features, is_active, sort_order)
    VALUES ('Free', 'Free plan with basic features', 0, 'month', 'price_free', '["unlimited_workouts", "basic_analytics"]', TRUE, 1);
  END IF;

  -- Insert Premium Monthly plan if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Premium Monthly') THEN
    INSERT INTO subscription_plans (name, description, price_cents, interval, stripe_price_id, features, is_active, sort_order)
    VALUES ('Premium Monthly', 'Premium monthly subscription', 999, 'month', 'price_premium_monthly', '["unlimited_workouts", "ai_coaching", "advanced_analytics", "custom_programs"]', TRUE, 2);
  END IF;

  -- Insert Premium Yearly plan if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Premium Yearly') THEN
    INSERT INTO subscription_plans (name, description, price_cents, interval, stripe_price_id, features, is_active, sort_order)
    VALUES ('Premium Yearly', 'Premium yearly subscription', 9999, 'year', 'price_premium_yearly', '["unlimited_workouts", "ai_coaching", "advanced_analytics", "custom_programs", "priority_support"]', TRUE, 3);
  END IF;
END $$;

-- Set up feature limits for existing plans
DO $$
DECLARE
  free_plan_id UUID;
  premium_monthly_id UUID;
  premium_yearly_id UUID;
  feature_record RECORD;
BEGIN
  -- Get plan IDs
  SELECT id INTO free_plan_id FROM subscription_plans WHERE name = 'Free';
  SELECT id INTO premium_monthly_id FROM subscription_plans WHERE name = 'Premium Monthly';
  SELECT id INTO premium_yearly_id FROM subscription_plans WHERE name = 'Premium Yearly';

  -- Only proceed if we have valid plan IDs
  IF free_plan_id IS NOT NULL AND premium_monthly_id IS NOT NULL AND premium_yearly_id IS NOT NULL THEN
    -- Set up Free plan limits
    FOR feature_record IN SELECT * FROM subscription_features LOOP
      INSERT INTO plan_feature_limits (plan_id, feature_id, is_enabled, usage_limit, reset_period) VALUES
      (free_plan_id, feature_record.id, 
       CASE feature_record.feature_key
         WHEN 'unlimited_workouts' THEN TRUE
         WHEN 'ai_coaching' THEN TRUE
         ELSE FALSE
       END,
       CASE feature_record.feature_key
         WHEN 'unlimited_workouts' THEN NULL -- Unlimited
         WHEN 'ai_coaching' THEN 2 -- 2 per month
         ELSE 0 -- Disabled
       END,
       CASE feature_record.feature_key
         WHEN 'ai_coaching' THEN 'monthly'
         ELSE 'lifetime'
       END
      ) ON CONFLICT (plan_id, feature_id) DO NOTHING;
    END LOOP;

    -- Set up Premium plan limits (both monthly and yearly)
    FOR feature_record IN SELECT * FROM subscription_features LOOP
      -- Premium Monthly
      INSERT INTO plan_feature_limits (plan_id, feature_id, is_enabled, usage_limit, reset_period) VALUES
      (premium_monthly_id, feature_record.id, TRUE, NULL, 'lifetime')
      ON CONFLICT (plan_id, feature_id) DO NOTHING;
      
      -- Premium Yearly
      INSERT INTO plan_feature_limits (plan_id, feature_id, is_enabled, usage_limit, reset_period) VALUES
      (premium_yearly_id, feature_record.id, TRUE, NULL, 'lifetime')
      ON CONFLICT (plan_id, feature_id) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- ============================================================================
-- UTILITY VIEWS
-- ============================================================================

-- View for subscription revenue analytics
CREATE VIEW subscription_revenue_analytics AS
SELECT 
  DATE_TRUNC('month', s.created_at) as month,
  sp.name as plan_name,
  sp.interval,
  COUNT(*) as new_subscriptions,
  COUNT(CASE WHEN s.status = 'active' THEN 1 END) as active_subscriptions,
  SUM(CASE WHEN s.status = 'active' THEN sp.price_cents END) / 100.0 as monthly_revenue,
  AVG(sp.price_cents) / 100.0 as average_price
FROM subscriptions s
JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE s.created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', s.created_at), sp.id, sp.name, sp.interval
ORDER BY month DESC, plan_name;

-- View for feature usage analytics
CREATE VIEW feature_usage_analytics AS
SELECT 
  sf.feature_name,
  sf.category,
  COUNT(DISTINCT ufu.user_id) as unique_users,
  SUM(ufu.usage_count) as total_usage,
  AVG(ufu.usage_count) as avg_usage_per_user,
  MAX(ufu.last_used_at) as last_used
FROM subscription_features sf
LEFT JOIN user_feature_usage ufu ON sf.id = ufu.feature_id
WHERE sf.is_active = TRUE
  AND ufu.period_start >= DATE_TRUNC('month', NOW())
GROUP BY sf.id, sf.feature_name, sf.category
ORDER BY total_usage DESC;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE subscription_features IS 'Feature definitions for subscription plans with access control';
COMMENT ON TABLE plan_feature_limits IS 'Feature limits and access control for each subscription plan';
COMMENT ON TABLE user_feature_usage IS 'Tracking of user feature usage against plan limits';
COMMENT ON TABLE payment_history IS 'Complete payment and billing history with Stripe integration';
COMMENT ON TABLE billing_addresses IS 'User billing addresses for subscription management';
COMMENT ON TABLE subscription_analytics IS 'Daily subscription usage and engagement metrics';
COMMENT ON TABLE subscription_changes IS 'Subscription upgrade/downgrade/cancellation requests';
COMMENT ON TABLE discount_codes IS 'Promotional discount codes and coupon management';

COMMENT ON FUNCTION check_feature_access IS 'Comprehensive feature access checking with usage limits';
COMMENT ON FUNCTION track_feature_usage IS 'Track and increment user feature usage counters';
COMMENT ON FUNCTION calculate_subscription_metrics IS 'Calculate key subscription business metrics';

COMMENT ON VIEW subscription_revenue_analytics IS 'Monthly subscription revenue and growth analytics';
COMMENT ON VIEW feature_usage_analytics IS 'Feature adoption and usage analytics across all users';
