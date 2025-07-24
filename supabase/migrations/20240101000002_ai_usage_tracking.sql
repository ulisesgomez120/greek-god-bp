-- ============================================================================
-- AI USAGE TRACKING AND COACHING INFRASTRUCTURE
-- ============================================================================
-- This migration adds AI coaching features with usage tracking and cost optimization
-- Version: 20240101000002
-- Description: AI usage tracking, conversations, and monthly reviews

-- ============================================================================
-- AI USAGE TRACKING
-- ============================================================================

-- AI usage tracking for cost optimization
CREATE TABLE ai_usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  query_type TEXT NOT NULL,
  query_text TEXT,
  response_text TEXT,
  tokens_used INTEGER NOT NULL CHECK (tokens_used > 0),
  estimated_cost DECIMAL(8,6) NOT NULL CHECK (estimated_cost >= 0),
  model_used TEXT NOT NULL,
  response_time_ms INTEGER CHECK (response_time_ms > 0),
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
  user_feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monthly AI usage summary for quick budget checks
CREATE TABLE monthly_ai_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  month_year DATE NOT NULL, -- First day of the month
  total_queries INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost DECIMAL(8,2) DEFAULT 0,
  budget_limit DECIMAL(8,2) DEFAULT 1.00, -- $1 default limit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

-- ============================================================================
-- AI CONVERSATIONS AND REVIEWS
-- ============================================================================

-- AI conversation history
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL, -- Groups related messages
  message_type TEXT NOT NULL CHECK (message_type IN ('user_query', 'ai_response', 'system_message')),
  content TEXT NOT NULL,
  context_data JSONB, -- Relevant workout data, user stats, etc.
  tokens_used INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monthly AI-generated progress reviews
CREATE TABLE monthly_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  review_month DATE NOT NULL, -- First day of the month
  workout_count INTEGER NOT NULL DEFAULT 0,
  total_volume_kg DECIMAL(12,2) DEFAULT 0,
  average_rpe DECIMAL(3,1),
  strength_gains JSONB, -- Exercise-specific strength improvements
  goal_progress JSONB, -- Progress toward user's stated goals
  recommendations TEXT,
  achievements TEXT[],
  areas_for_improvement TEXT[],
  next_month_focus TEXT,
  ai_generated_at TIMESTAMP WITH TIME ZONE,
  tokens_used INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, review_month)
);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- AI usage tracking indexes
CREATE INDEX idx_ai_usage_user_month ON ai_usage_tracking(user_id, DATE_TRUNC('month', created_at));
CREATE INDEX idx_ai_usage_cost ON ai_usage_tracking(estimated_cost DESC);
CREATE INDEX idx_ai_usage_model ON ai_usage_tracking(model_used);

-- Monthly usage indexes
CREATE INDEX idx_monthly_ai_usage_user ON monthly_ai_usage(user_id, month_year DESC);
CREATE INDEX idx_monthly_ai_usage_cost ON monthly_ai_usage(total_cost DESC);

-- Conversation indexes
CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id, conversation_id, created_at);
CREATE INDEX idx_ai_conversations_type ON ai_conversations(message_type);

-- Monthly reviews indexes
CREATE INDEX idx_monthly_reviews_user ON monthly_reviews(user_id, review_month DESC);
CREATE INDEX idx_monthly_reviews_generated ON monthly_reviews(ai_generated_at) WHERE ai_generated_at IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on AI tables
ALTER TABLE ai_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reviews ENABLE ROW LEVEL SECURITY;

-- AI usage tracking policies
CREATE POLICY "Users can view own AI usage" ON ai_usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert AI usage" ON ai_usage_tracking
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Monthly AI usage policies
CREATE POLICY "Users can view own monthly usage" ON monthly_ai_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage monthly usage" ON monthly_ai_usage
  FOR ALL USING (auth.uid() = user_id);

-- AI conversations policies
CREATE POLICY "Users can view own conversations" ON ai_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" ON ai_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Monthly reviews policies
CREATE POLICY "Users can view own reviews" ON monthly_reviews
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage reviews" ON monthly_reviews
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Function to update monthly usage summary
CREATE OR REPLACE FUNCTION update_monthly_ai_usage()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO monthly_ai_usage (user_id, month_year, total_queries, total_tokens, total_cost)
  VALUES (
    NEW.user_id,
    DATE_TRUNC('month', NEW.created_at)::DATE,
    1,
    NEW.tokens_used,
    NEW.estimated_cost
  )
  ON CONFLICT (user_id, month_year)
  DO UPDATE SET
    total_queries = monthly_ai_usage.total_queries + 1,
    total_tokens = monthly_ai_usage.total_tokens + NEW.tokens_used,
    total_cost = monthly_ai_usage.total_cost + NEW.estimated_cost,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update monthly usage when AI usage is tracked
CREATE TRIGGER update_monthly_usage_trigger
  AFTER INSERT ON ai_usage_tracking
  FOR EACH ROW EXECUTE FUNCTION update_monthly_ai_usage();

-- Function to check if user is within AI budget
CREATE OR REPLACE FUNCTION check_ai_budget(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  current_month DATE;
  usage_record RECORD;
  result JSONB;
BEGIN
  current_month := DATE_TRUNC('month', NOW())::DATE;
  
  SELECT * INTO usage_record
  FROM monthly_ai_usage
  WHERE user_id = user_uuid AND month_year = current_month;
  
  IF usage_record IS NULL THEN
    -- No usage this month yet
    result := jsonb_build_object(
      'within_budget', true,
      'remaining_budget', 1.00,
      'total_cost', 0,
      'total_queries', 0
    );
  ELSE
    result := jsonb_build_object(
      'within_budget', usage_record.total_cost < usage_record.budget_limit,
      'remaining_budget', usage_record.budget_limit - usage_record.total_cost,
      'total_cost', usage_record.total_cost,
      'total_queries', usage_record.total_queries,
      'budget_limit', usage_record.budget_limit
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's AI conversation count for current month
CREATE OR REPLACE FUNCTION get_monthly_conversation_count(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  conversation_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT conversation_id) INTO conversation_count
  FROM ai_conversations
  WHERE user_id = user_uuid
    AND created_at >= DATE_TRUNC('month', NOW())
    AND message_type = 'user_query';
  
  RETURN COALESCE(conversation_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate monthly review data
CREATE OR REPLACE FUNCTION generate_monthly_review_data(user_uuid UUID, target_month DATE)
RETURNS JSONB AS $$
DECLARE
  review_data JSONB;
  workout_stats RECORD;
  strength_data JSONB;
  volume_data JSONB;
BEGIN
  -- Get workout statistics for the month
  SELECT 
    COUNT(*) as workout_count,
    COALESCE(SUM(total_volume_kg), 0) as total_volume,
    COALESCE(AVG(average_rpe), 0) as avg_rpe,
    COALESCE(AVG(duration_minutes), 0) as avg_duration
  INTO workout_stats
  FROM workout_sessions
  WHERE user_id = user_uuid
    AND started_at >= target_month
    AND started_at < (target_month + INTERVAL '1 month')
    AND completed_at IS NOT NULL;

  -- Get strength progression data
  SELECT jsonb_object_agg(
    e.name,
    jsonb_build_object(
      'max_weight', MAX(es.weight_kg),
      'max_reps', MAX(es.reps),
      'estimated_1rm', MAX(calculate_one_rep_max(es.weight_kg, es.reps)),
      'total_sets', COUNT(*)
    )
  ) INTO strength_data
  FROM exercise_sets es
  JOIN exercises e ON e.id = es.exercise_id
  JOIN workout_sessions ws ON ws.id = es.session_id
  WHERE ws.user_id = user_uuid
    AND ws.started_at >= target_month
    AND ws.started_at < (target_month + INTERVAL '1 month')
    AND es.is_warmup = FALSE
  GROUP BY e.id, e.name;

  -- Build comprehensive review data
  review_data := jsonb_build_object(
    'workout_count', workout_stats.workout_count,
    'total_volume_kg', workout_stats.total_volume,
    'average_rpe', ROUND(workout_stats.avg_rpe, 1),
    'average_duration_minutes', ROUND(workout_stats.avg_duration, 0),
    'strength_gains', COALESCE(strength_data, '{}'::jsonb),
    'consistency_score', CASE 
      WHEN workout_stats.workout_count >= 12 THEN 'excellent'
      WHEN workout_stats.workout_count >= 8 THEN 'good'
      WHEN workout_stats.workout_count >= 4 THEN 'fair'
      ELSE 'needs_improvement'
    END
  );

  RETURN review_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================================

-- Enable realtime for AI conversations (for live chat)
ALTER PUBLICATION supabase_realtime ADD TABLE ai_conversations;

-- Enable realtime for monthly usage (for budget tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE monthly_ai_usage;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE ai_usage_tracking IS 'Tracks AI API usage for cost optimization and analytics';
COMMENT ON TABLE monthly_ai_usage IS 'Monthly summary of AI usage for budget enforcement';
COMMENT ON TABLE ai_conversations IS 'AI coaching conversation history with context';
COMMENT ON TABLE monthly_reviews IS 'AI-generated monthly progress reviews for premium users';

COMMENT ON COLUMN ai_usage_tracking.estimated_cost IS 'Estimated cost in USD for the API call';
COMMENT ON COLUMN monthly_ai_usage.budget_limit IS 'Monthly budget limit in USD (default $1.00)';
COMMENT ON COLUMN ai_conversations.context_data IS 'Workout data and user context for AI responses';
COMMENT ON COLUMN monthly_reviews.strength_gains IS 'JSON object with exercise-specific improvements';
