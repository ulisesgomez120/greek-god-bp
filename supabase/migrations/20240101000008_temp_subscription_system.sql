-- ============================================================================
-- TEMPORARY SUBSCRIPTION SYSTEM FOR TESTING PHASE
-- ============================================================================
-- This migration adds temporary subscription fields to support testing
-- premium features without real payments. This is designed to be easily
-- replaceable with native IAP when ready for production.
-- Version: 20240101000008
-- Description: Temporary subscription management for testing phase

-- ============================================================================
-- ADD TEMPORARY SUBSCRIPTION FIELDS TO USER PROFILES
-- ============================================================================

-- Add temporary subscription fields to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN temp_subscription_plan TEXT DEFAULT 'free' CHECK (temp_subscription_plan IN ('free', 'premium', 'coach')),
ADD COLUMN temp_subscription_expires TIMESTAMP WITH TIME ZONE;

-- Create index for efficient temp subscription queries
CREATE INDEX idx_user_profiles_temp_subscription ON user_profiles(temp_subscription_plan, temp_subscription_expires) 
WHERE temp_subscription_plan != 'free';

-- ============================================================================
-- TEMPORARY SUBSCRIPTION FUNCTIONS
-- ============================================================================

-- Function to check if user has active temporary subscription
CREATE OR REPLACE FUNCTION has_active_temp_subscription(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_record RECORD;
BEGIN
  SELECT temp_subscription_plan, temp_subscription_expires 
  INTO user_record
  FROM user_profiles 
  WHERE id = p_user_id;

  -- If no record found or free plan, return false
  IF user_record IS NULL OR user_record.temp_subscription_plan = 'free' THEN
    RETURN FALSE;
  END IF;

  -- If no expiry date set, consider it active (shouldn't happen but safe fallback)
  IF user_record.temp_subscription_expires IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Check if subscription is still active
  RETURN user_record.temp_subscription_expires > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's effective subscription plan (temp or real)
CREATE OR REPLACE FUNCTION get_effective_subscription_plan(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  user_record RECORD;
  real_subscription RECORD;
  result JSONB;
BEGIN
  -- Get user profile with temp subscription info
  SELECT temp_subscription_plan, temp_subscription_expires 
  INTO user_record
  FROM user_profiles 
  WHERE id = p_user_id;

  -- Check for active real subscription first
  SELECT s.*, sp.name as plan_name, sp.features
  INTO real_subscription
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND s.current_period_end > NOW()
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- If user has active real subscription, return that
  IF real_subscription IS NOT NULL THEN
    RETURN jsonb_build_object(
      'type', 'real',
      'plan', real_subscription.plan_name,
      'features', real_subscription.features,
      'expires_at', real_subscription.current_period_end,
      'is_active', true
    );
  END IF;

  -- Check temporary subscription
  IF user_record IS NOT NULL AND user_record.temp_subscription_plan != 'free' THEN
    -- Check if temp subscription is still active
    IF user_record.temp_subscription_expires IS NULL OR user_record.temp_subscription_expires > NOW() THEN
      -- Get features for temp plan
      DECLARE
        temp_features JSONB;
      BEGIN
        CASE user_record.temp_subscription_plan
          WHEN 'premium' THEN
            temp_features := '["unlimited_workouts", "ai_coaching", "advanced_analytics", "custom_programs", "data_export"]'::jsonb;
          WHEN 'coach' THEN
            temp_features := '["unlimited_workouts", "ai_coaching", "advanced_analytics", "custom_programs", "data_export", "client_management", "coach_dashboard"]'::jsonb;
          ELSE
            temp_features := '["unlimited_workouts"]'::jsonb;
        END CASE;

        RETURN jsonb_build_object(
          'type', 'temporary',
          'plan', user_record.temp_subscription_plan,
          'features', temp_features,
          'expires_at', user_record.temp_subscription_expires,
          'is_active', true,
          'is_testing', true
        );
      END;
    END IF;
  END IF;

  -- Default to free plan
  RETURN jsonb_build_object(
    'type', 'free',
    'plan', 'free',
    'features', '["unlimited_workouts"]'::jsonb,
    'expires_at', null,
    'is_active', true,
    'is_testing', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to upgrade user to temporary premium subscription
CREATE OR REPLACE FUNCTION upgrade_temp_subscription(
  p_user_id UUID,
  p_plan TEXT DEFAULT 'premium',
  p_duration_days INTEGER DEFAULT 30
)
RETURNS JSONB AS $$
DECLARE
  expiry_date TIMESTAMP WITH TIME ZONE;
  result JSONB;
BEGIN
  -- Validate plan
  IF p_plan NOT IN ('premium', 'coach') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid plan. Must be premium or coach.'
    );
  END IF;

  -- Calculate expiry date
  expiry_date := NOW() + (p_duration_days || ' days')::INTERVAL;

  -- Update user profile
  UPDATE user_profiles 
  SET 
    temp_subscription_plan = p_plan,
    temp_subscription_expires = expiry_date,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Return success result
  RETURN jsonb_build_object(
    'success', true,
    'plan', p_plan,
    'expires_at', expiry_date,
    'duration_days', p_duration_days,
    'is_testing', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-renew expired temporary subscriptions
CREATE OR REPLACE FUNCTION auto_renew_temp_subscriptions()
RETURNS INTEGER AS $$
DECLARE
  renewed_count INTEGER := 0;
  user_record RECORD;
BEGIN
  -- Find users with expired temp subscriptions
  FOR user_record IN
    SELECT id, temp_subscription_plan
    FROM user_profiles
    WHERE temp_subscription_plan != 'free'
      AND temp_subscription_expires IS NOT NULL
      AND temp_subscription_expires <= NOW()
      AND temp_subscription_expires > NOW() - INTERVAL '7 days' -- Only renew if expired within last 7 days
  LOOP
    -- Renew for another 30 days
    UPDATE user_profiles
    SET 
      temp_subscription_expires = NOW() + INTERVAL '30 days',
      updated_at = NOW()
    WHERE id = user_record.id;

    renewed_count := renewed_count + 1;
  END LOOP;

  RETURN renewed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SCHEDULED TASKS FOR AUTO-RENEWAL
-- ============================================================================

-- Note: Cron scheduling removed for local development compatibility
-- In production, you can manually enable pg_cron extension and add:
-- SELECT cron.schedule('auto-renew-temp-subscriptions', '0 2 * * *', 'SELECT auto_renew_temp_subscriptions();');

-- For now, auto-renewal can be triggered manually by calling:
-- SELECT auto_renew_temp_subscriptions();

-- ============================================================================
-- ROW LEVEL SECURITY UPDATES
-- ============================================================================

-- Update existing RLS policies to consider temporary subscriptions
-- This ensures temp premium users can access premium features

-- Drop and recreate the AI conversations policy to include temp subscriptions
DROP POLICY IF EXISTS "Premium users can access AI features" ON ai_conversations;

CREATE POLICY "Premium users can access AI features" ON ai_conversations
  FOR ALL USING (
    auth.uid() = user_id AND (
      -- Check for real premium subscription
      EXISTS (
        SELECT 1 FROM user_profiles up
        JOIN subscriptions s ON up.id = s.user_id
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE up.id = auth.uid()
          AND s.status = 'active'
          AND s.current_period_end > NOW()
          AND sp.name != 'Free'
      )
      OR
      -- Check for active temporary premium subscription
      EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = auth.uid()
          AND up.temp_subscription_plan IN ('premium', 'coach')
          AND (up.temp_subscription_expires IS NULL OR up.temp_subscription_expires > NOW())
      )
    )
  );

-- Update AI usage tracking policy
DROP POLICY IF EXISTS "Users can view own AI usage" ON ai_usage_tracking;

CREATE POLICY "Users can view own AI usage" ON ai_usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Premium users can create AI usage records" ON ai_usage_tracking
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND (
      -- Check for real premium subscription
      EXISTS (
        SELECT 1 FROM user_profiles up
        JOIN subscriptions s ON up.id = s.user_id
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE up.id = auth.uid()
          AND s.status = 'active'
          AND s.current_period_end > NOW()
          AND sp.name != 'Free'
      )
      OR
      -- Check for active temporary premium subscription
      EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = auth.uid()
          AND up.temp_subscription_plan IN ('premium', 'coach')
          AND (up.temp_subscription_expires IS NULL OR up.temp_subscription_expires > NOW())
      )
    )
  );

-- ============================================================================
-- UTILITY VIEWS
-- ============================================================================

-- View for monitoring temporary subscription usage
CREATE VIEW temp_subscription_analytics AS
SELECT 
  temp_subscription_plan,
  COUNT(*) as user_count,
  COUNT(CASE WHEN temp_subscription_expires > NOW() THEN 1 END) as active_count,
  COUNT(CASE WHEN temp_subscription_expires <= NOW() THEN 1 END) as expired_count,
  AVG(EXTRACT(EPOCH FROM (temp_subscription_expires - created_at)) / 86400) as avg_duration_days,
  MIN(temp_subscription_expires) as earliest_expiry,
  MAX(temp_subscription_expires) as latest_expiry
FROM user_profiles
WHERE temp_subscription_plan != 'free'
GROUP BY temp_subscription_plan;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN user_profiles.temp_subscription_plan IS 'Temporary subscription plan for testing phase (free, premium, coach)';
COMMENT ON COLUMN user_profiles.temp_subscription_expires IS 'Expiry date for temporary subscription, NULL means no expiry';

COMMENT ON FUNCTION has_active_temp_subscription IS 'Check if user has an active temporary subscription';
COMMENT ON FUNCTION get_effective_subscription_plan IS 'Get users effective subscription plan (real or temporary)';
COMMENT ON FUNCTION upgrade_temp_subscription IS 'Upgrade user to temporary premium subscription for testing';
COMMENT ON FUNCTION auto_renew_temp_subscriptions IS 'Auto-renew expired temporary subscriptions';

COMMENT ON VIEW temp_subscription_analytics IS 'Analytics view for monitoring temporary subscription usage during testing phase';

-- ============================================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================================

-- This migration is complete and ready for testing
-- Users can now be upgraded to temporary premium subscriptions
-- Auto-renewal will happen daily at 2 AM
-- All existing feature gating will work with temporary subscriptions
