-- ============================================================================
-- ADVANCED AI SYSTEM WITH CONVERSATION MANAGEMENT AND COACHING
-- ============================================================================
-- This migration enhances the AI system with advanced conversation management,
-- coaching algorithms, and intelligent workout recommendations
-- Version: 20240101000007
-- Description: Advanced AI coaching, conversation management, and intelligent recommendations

-- ============================================================================
-- AI COACHING ALGORITHMS AND MODELS
-- ============================================================================

-- AI model configurations
CREATE TABLE ai_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_name TEXT NOT NULL UNIQUE,
  model_version TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google', 'custom')),
  model_type TEXT NOT NULL CHECK (model_type IN ('chat', 'completion', 'embedding', 'fine_tuned')),
  
  -- Model capabilities
  max_tokens INTEGER NOT NULL,
  supports_functions BOOLEAN DEFAULT FALSE,
  supports_streaming BOOLEAN DEFAULT FALSE,
  context_window INTEGER NOT NULL,
  
  -- Pricing and limits
  cost_per_1k_input_tokens DECIMAL(8,6) NOT NULL,
  cost_per_1k_output_tokens DECIMAL(8,6) NOT NULL,
  rate_limit_requests_per_minute INTEGER,
  
  -- Configuration
  default_temperature DECIMAL(3,2) DEFAULT 0.7,
  default_max_tokens INTEGER,
  system_prompt TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI coaching contexts and specializations
CREATE TABLE ai_coaching_contexts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  context_key TEXT NOT NULL UNIQUE,
  context_name TEXT NOT NULL,
  description TEXT,
  
  -- Context configuration
  system_prompt TEXT NOT NULL,
  suggested_model_id UUID REFERENCES ai_models(id),
  max_conversation_length INTEGER DEFAULT 20,
  
  -- Coaching parameters
  coaching_style TEXT CHECK (coaching_style IN ('supportive', 'challenging', 'analytical', 'motivational')),
  expertise_areas TEXT[] DEFAULT '{}', -- 'strength', 'cardio', 'nutrition', 'recovery'
  
  -- Usage settings
  requires_subscription BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ENHANCED CONVERSATION MANAGEMENT
-- ============================================================================

-- Conversation sessions with enhanced metadata
CREATE TABLE ai_conversation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  context_id UUID REFERENCES ai_coaching_contexts(id),
  
  -- Session metadata
  session_title TEXT,
  session_type TEXT CHECK (session_type IN ('coaching', 'planning', 'analysis', 'support', 'general')),
  
  -- Conversation state
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  message_count INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  total_cost DECIMAL(8,4) DEFAULT 0,
  
  -- Context and personalization
  user_context JSONB DEFAULT '{}', -- Current user state, goals, preferences
  conversation_summary TEXT,
  key_insights TEXT[],
  action_items TEXT[],
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced conversation messages with rich metadata
ALTER TABLE ai_conversations DROP CONSTRAINT IF EXISTS ai_conversations_message_type_check;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES ai_conversation_sessions(id) ON DELETE CASCADE;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES ai_models(id);
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS message_role TEXT CHECK (message_role IN ('system', 'user', 'assistant', 'function'));
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS function_call JSONB;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS function_response JSONB;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS message_metadata JSONB DEFAULT '{}';
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2);
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3,2);

-- Update existing message_type constraint
ALTER TABLE ai_conversations ADD CONSTRAINT ai_conversations_message_type_check 
  CHECK (message_type IN ('user_query', 'ai_response', 'system_message', 'function_call', 'function_response'));

-- ============================================================================
-- AI COACHING RECOMMENDATIONS AND INSIGHTS
-- ============================================================================

-- AI-generated workout recommendations
CREATE TABLE ai_workout_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES ai_conversation_sessions(id),
  
  -- Recommendation metadata
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN (
    'next_workout', 'exercise_substitution', 'progression_adjustment', 
    'recovery_suggestion', 'program_modification', 'goal_alignment'
  )),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Recommendation content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reasoning TEXT, -- AI's explanation for the recommendation
  
  -- Actionable data
  recommended_exercises JSONB, -- Exercise IDs and parameters
  recommended_parameters JSONB, -- Sets, reps, weights, etc.
  alternative_options JSONB, -- Alternative recommendations
  
  -- Context and timing
  based_on_data JSONB, -- What data influenced this recommendation
  valid_until DATE,
  
  -- User interaction
  user_feedback TEXT CHECK (user_feedback IN ('accepted', 'rejected', 'modified', 'pending')),
  user_notes TEXT,
  applied_at TIMESTAMP WITH TIME ZONE,
  
  -- AI metadata
  model_id UUID REFERENCES ai_models(id),
  confidence_score DECIMAL(3,2),
  tokens_used INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI-generated insights and analysis
CREATE TABLE ai_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES ai_conversation_sessions(id),
  
  -- Insight classification
  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'progress_analysis', 'pattern_recognition', 'goal_assessment',
    'performance_trend', 'recovery_analysis', 'form_feedback',
    'motivation_boost', 'plateau_identification'
  )),
  category TEXT NOT NULL CHECK (category IN ('strength', 'endurance', 'recovery', 'motivation', 'technique', 'planning')),
  
  -- Insight content
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  detailed_analysis TEXT,
  key_findings TEXT[],
  
  -- Supporting data
  data_sources TEXT[], -- What data was analyzed
  time_period_analyzed JSONB, -- Date ranges, workout counts, etc.
  statistical_significance DECIMAL(3,2),
  
  -- Actionability
  actionable_recommendations TEXT[],
  suggested_next_steps TEXT[],
  
  -- User engagement
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
  user_feedback TEXT,
  is_bookmarked BOOLEAN DEFAULT FALSE,
  
  -- AI metadata
  model_id UUID REFERENCES ai_models(id),
  confidence_score DECIMAL(3,2),
  tokens_used INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- AI LEARNING AND PERSONALIZATION
-- ============================================================================

-- User AI preferences and learning
CREATE TABLE user_ai_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  -- Communication preferences
  preferred_coaching_style TEXT CHECK (preferred_coaching_style IN ('supportive', 'challenging', 'analytical', 'motivational')),
  communication_frequency TEXT CHECK (communication_frequency IN ('minimal', 'moderate', 'frequent', 'intensive')),
  preferred_response_length TEXT CHECK (preferred_response_length IN ('brief', 'moderate', 'detailed', 'comprehensive')),
  
  -- Content preferences
  focus_areas TEXT[] DEFAULT '{}', -- Areas user wants AI to focus on
  avoid_topics TEXT[] DEFAULT '{}', -- Topics to avoid
  preferred_examples TEXT CHECK (preferred_examples IN ('personal', 'general', 'scientific', 'motivational')),
  
  -- Interaction preferences
  enable_proactive_suggestions BOOLEAN DEFAULT TRUE,
  enable_progress_celebrations BOOLEAN DEFAULT TRUE,
  enable_form_reminders BOOLEAN DEFAULT TRUE,
  enable_recovery_suggestions BOOLEAN DEFAULT TRUE,
  
  -- Learning and adaptation
  learning_style TEXT CHECK (learning_style IN ('visual', 'analytical', 'practical', 'social')),
  feedback_sensitivity TEXT CHECK (feedback_sensitivity IN ('direct', 'gentle', 'balanced', 'encouraging')),
  
  -- Privacy and data usage
  allow_data_analysis BOOLEAN DEFAULT TRUE,
  allow_pattern_recognition BOOLEAN DEFAULT TRUE,
  allow_predictive_insights BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- AI learning from user interactions
CREATE TABLE ai_learning_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES ai_conversation_sessions(id),
  
  -- Learning event
  event_type TEXT NOT NULL CHECK (event_type IN (
    'recommendation_feedback', 'conversation_rating', 'insight_engagement',
    'preference_update', 'behavior_pattern', 'goal_achievement'
  )),
  
  -- Event data
  event_data JSONB NOT NULL,
  user_response JSONB,
  outcome TEXT CHECK (outcome IN ('positive', 'negative', 'neutral', 'mixed')),
  
  -- Learning context
  context_factors JSONB, -- Time of day, workout state, mood, etc.
  
  -- Model improvement
  contributes_to_training BOOLEAN DEFAULT TRUE,
  data_quality_score DECIMAL(3,2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- AI PERFORMANCE AND MONITORING
-- ============================================================================

-- AI model performance tracking
CREATE TABLE ai_model_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  
  -- Usage metrics
  total_requests INTEGER DEFAULT 0,
  total_tokens_input INTEGER DEFAULT 0,
  total_tokens_output INTEGER DEFAULT 0,
  total_cost DECIMAL(10,4) DEFAULT 0,
  
  -- Performance metrics
  average_response_time_ms INTEGER,
  success_rate DECIMAL(5,2),
  error_rate DECIMAL(5,2),
  timeout_rate DECIMAL(5,2),
  
  -- Quality metrics
  average_user_rating DECIMAL(3,2),
  recommendation_acceptance_rate DECIMAL(5,2),
  conversation_completion_rate DECIMAL(5,2),
  
  -- Efficiency metrics
  cost_per_successful_interaction DECIMAL(8,4),
  tokens_per_interaction DECIMAL(8,2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(model_id, metric_date)
);

-- AI system alerts and monitoring
CREATE TABLE ai_system_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'high_error_rate', 'cost_threshold_exceeded', 'performance_degradation',
    'unusual_usage_pattern', 'model_unavailable', 'rate_limit_exceeded'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  
  -- Alert details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  affected_component TEXT,
  
  -- Alert data
  alert_data JSONB,
  threshold_value DECIMAL(10,4),
  current_value DECIMAL(10,4),
  
  -- Resolution
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'suppressed')),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- AI FUNCTIONS AND ALGORITHMS
-- ============================================================================

-- Function to get personalized AI coaching context
CREATE OR REPLACE FUNCTION get_ai_coaching_context(
  p_user_id UUID,
  p_context_key TEXT DEFAULT 'general_coaching'
) RETURNS JSONB AS $$
DECLARE
  user_data RECORD;
  recent_workouts JSONB;
  progress_data JSONB;
  preferences RECORD;
  context JSONB;
BEGIN
  -- Get user profile and preferences
  SELECT up.*, uap.* INTO user_data
  FROM user_profiles up
  LEFT JOIN user_ai_preferences uap ON up.id = uap.user_id
  WHERE up.id = p_user_id;

  -- Get recent workout data
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', ws.started_at,
      'name', ws.name,
      'duration', ws.duration_minutes,
      'volume', ws.total_volume_kg,
      'rpe', ws.average_rpe,
      'quality_score', ws.workout_quality_score
    )
  ) INTO recent_workouts
  FROM workout_sessions ws
  WHERE ws.user_id = p_user_id
    AND ws.completed_at IS NOT NULL
    AND ws.started_at >= NOW() - INTERVAL '14 days'
  ORDER BY ws.started_at DESC
  LIMIT 10;

  -- Get progress metrics
  progress_data := calculate_user_progress_metrics(p_user_id);

  -- Build comprehensive context
  context := jsonb_build_object(
    'user_profile', jsonb_build_object(
      'experience_level', user_data.experience_level,
      'fitness_goals', user_data.fitness_goals,
      'available_equipment', user_data.available_equipment,
      'age_group', CASE 
        WHEN EXTRACT(YEAR FROM AGE(user_data.birth_date)) < 25 THEN 'young_adult'
        WHEN EXTRACT(YEAR FROM AGE(user_data.birth_date)) < 40 THEN 'adult'
        WHEN EXTRACT(YEAR FROM AGE(user_data.birth_date)) < 55 THEN 'middle_aged'
        ELSE 'senior'
      END
    ),
    'ai_preferences', jsonb_build_object(
      'coaching_style', COALESCE(user_data.preferred_coaching_style, 'supportive'),
      'communication_frequency', COALESCE(user_data.communication_frequency, 'moderate'),
      'response_length', COALESCE(user_data.preferred_response_length, 'moderate'),
      'focus_areas', COALESCE(user_data.focus_areas, '{}')
    ),
    'recent_activity', jsonb_build_object(
      'workouts', COALESCE(recent_workouts, '[]'::jsonb),
      'workout_frequency', (
        SELECT COUNT(*) FROM workout_sessions 
        WHERE user_id = p_user_id 
        AND started_at >= NOW() - INTERVAL '7 days'
        AND completed_at IS NOT NULL
      )
    ),
    'progress_metrics', progress_data,
    'context_timestamp', NOW()
  );

  RETURN context;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate AI workout recommendations
CREATE OR REPLACE FUNCTION generate_ai_workout_recommendation(
  p_user_id UUID,
  p_recommendation_type TEXT DEFAULT 'next_workout'
) RETURNS UUID AS $$
DECLARE
  user_context JSONB;
  recommendation_id UUID;
  recommendation_data JSONB;
BEGIN
  -- Get user context
  user_context := get_ai_coaching_context(p_user_id);

  -- Generate recommendation based on type and context
  CASE p_recommendation_type
    WHEN 'next_workout' THEN
      recommendation_data := jsonb_build_object(
        'title', 'Recommended Next Workout',
        'description', 'Based on your recent training and recovery status',
        'reasoning', 'Analysis of your recent workout patterns suggests focusing on...',
        'recommended_exercises', '[]'::jsonb,
        'recommended_parameters', jsonb_build_object(
          'estimated_duration', 60,
          'target_rpe', 7,
          'focus_areas', ARRAY['strength', 'technique']
        )
      );
    
    WHEN 'progression_adjustment' THEN
      recommendation_data := jsonb_build_object(
        'title', 'Progression Adjustment Recommended',
        'description', 'Time to adjust your training progression',
        'reasoning', 'Your recent performance indicates readiness for progression',
        'recommended_parameters', jsonb_build_object(
          'weight_increase_percentage', 5,
          'rep_adjustment', 0,
          'set_adjustment', 0
        )
      );
    
    ELSE
      recommendation_data := jsonb_build_object(
        'title', 'General Recommendation',
        'description', 'AI-generated training suggestion',
        'reasoning', 'Based on your current training status'
      );
  END CASE;

  -- Insert recommendation
  INSERT INTO ai_workout_recommendations (
    user_id, recommendation_type, title, description, reasoning,
    recommended_parameters, based_on_data, confidence_score
  ) VALUES (
    p_user_id, p_recommendation_type,
    recommendation_data->>'title',
    recommendation_data->>'description', 
    recommendation_data->>'reasoning',
    recommendation_data->'recommended_parameters',
    user_context,
    0.85 -- Default confidence score
  ) RETURNING id INTO recommendation_id;

  RETURN recommendation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track AI conversation metrics
CREATE OR REPLACE FUNCTION update_conversation_metrics(
  p_session_id UUID,
  p_tokens_used INTEGER,
  p_cost DECIMAL(8,4)
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE ai_conversation_sessions
  SET 
    message_count = message_count + 1,
    total_tokens_used = total_tokens_used + p_tokens_used,
    total_cost = total_cost + p_cost,
    last_message_at = NOW(),
    updated_at = NOW()
  WHERE id = p_session_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- AI models indexes
CREATE INDEX idx_ai_models_active ON ai_models(is_active, is_default);
CREATE INDEX idx_ai_models_provider_type ON ai_models(provider, model_type) WHERE is_active = TRUE;

-- AI coaching contexts indexes
CREATE INDEX idx_ai_coaching_contexts_key ON ai_coaching_contexts(context_key) WHERE is_active = TRUE;
CREATE INDEX idx_ai_coaching_contexts_style ON ai_coaching_contexts(coaching_style, is_active);

-- Conversation sessions indexes
CREATE INDEX idx_ai_conversation_sessions_user ON ai_conversation_sessions(user_id, started_at DESC);
CREATE INDEX idx_ai_conversation_sessions_status ON ai_conversation_sessions(status, last_message_at DESC);
CREATE INDEX idx_ai_conversation_sessions_context ON ai_conversation_sessions(context_id, started_at DESC);

-- Enhanced conversation messages indexes
CREATE INDEX idx_ai_conversations_session ON ai_conversations(session_id, created_at);
CREATE INDEX idx_ai_conversations_role ON ai_conversations(message_role, created_at);

-- Workout recommendations indexes
CREATE INDEX idx_ai_workout_recommendations_user ON ai_workout_recommendations(user_id, created_at DESC);
CREATE INDEX idx_ai_workout_recommendations_type ON ai_workout_recommendations(recommendation_type, priority);
CREATE INDEX idx_ai_workout_recommendations_feedback ON ai_workout_recommendations(user_feedback, created_at);

-- AI insights indexes
CREATE INDEX idx_ai_insights_user_type ON ai_insights(user_id, insight_type, created_at DESC);
CREATE INDEX idx_ai_insights_category ON ai_insights(category, created_at DESC);
CREATE INDEX idx_ai_insights_bookmarked ON ai_insights(user_id, is_bookmarked) WHERE is_bookmarked = TRUE;

-- User preferences indexes
CREATE INDEX idx_user_ai_preferences_style ON user_ai_preferences(preferred_coaching_style);

-- AI learning data indexes
CREATE INDEX idx_ai_learning_data_user_event ON ai_learning_data(user_id, event_type, created_at DESC);
CREATE INDEX idx_ai_learning_data_outcome ON ai_learning_data(outcome, created_at DESC);

-- Performance tracking indexes
CREATE INDEX idx_ai_model_performance_model_date ON ai_model_performance(model_id, metric_date DESC);
CREATE INDEX idx_ai_model_performance_date ON ai_model_performance(metric_date DESC);

-- System alerts indexes
CREATE INDEX idx_ai_system_alerts_status_severity ON ai_system_alerts(status, severity, created_at DESC);
CREATE INDEX idx_ai_system_alerts_type ON ai_system_alerts(alert_type, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_coaching_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_workout_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ai_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_learning_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_system_alerts ENABLE ROW LEVEL SECURITY;

-- AI models policies (public read for active models)
CREATE POLICY "Anyone can view active AI models" ON ai_models
  FOR SELECT USING (is_active = TRUE);

-- AI coaching contexts policies (public read for active contexts)
CREATE POLICY "Anyone can view active coaching contexts" ON ai_coaching_contexts
  FOR SELECT USING (is_active = TRUE);

-- Conversation sessions policies
CREATE POLICY "Users can view own conversation sessions" ON ai_conversation_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own conversation sessions" ON ai_conversation_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Workout recommendations policies
CREATE POLICY "Users can view own workout recommendations" ON ai_workout_recommendations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own workout recommendations" ON ai_workout_recommendations
  FOR UPDATE USING (auth.uid() = user_id);

-- AI insights policies
CREATE POLICY "Users can view own AI insights" ON ai_insights
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own AI insights" ON ai_insights
  FOR UPDATE USING (auth.uid() = user_id);

-- User AI preferences policies
CREATE POLICY "Users can view own AI preferences" ON user_ai_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own AI preferences" ON user_ai_preferences
  FOR ALL USING (auth.uid() = user_id);

-- AI learning data policies
CREATE POLICY "Users can view own AI learning data" ON ai_learning_data
  FOR SELECT USING (auth.uid() = user_id);

-- AI model performance policies (admin only)
CREATE POLICY "Admins can view AI model performance" ON ai_model_performance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- System alerts policies (admin only)
CREATE POLICY "Admins can view AI system alerts" ON ai_system_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- SAMPLE DATA AND CONFIGURATION
-- ============================================================================

-- Insert default AI models
INSERT INTO ai_models (model_name, model_version, provider, model_type, max_tokens, context_window, cost_per_1k_input_tokens, cost_per_1k_output_tokens, is_default) VALUES
('gpt-4o', '2024-05-13', 'openai', 'chat', 4096, 128000, 0.005000, 0.015000, TRUE),
('gpt-4o-mini', '2024-07-18', 'openai', 'chat', 16384, 128000, 0.000150, 0.000600, FALSE),
('claude-3-5-sonnet', '20241022', 'anthropic', 'chat', 8192, 200000, 0.003000, 0.015000, FALSE);

-- Insert AI coaching contexts
INSERT INTO ai_coaching_contexts (context_key, context_name, description, system_prompt, coaching_style, expertise_areas) VALUES
(
  'general_coaching',
  'General Fitness Coaching',
  'General purpose fitness coaching and guidance',
  'You are an expert fitness coach with years of experience helping people achieve their fitness goals. Provide personalized, evidence-based advice while being supportive and motivational. Always consider the user''s experience level, goals, and current situation.',
  'supportive',
  ARRAY['strength', 'cardio', 'recovery', 'motivation']
),
(
  'strength_specialist',
  'Strength Training Specialist',
  'Specialized coaching for strength and powerlifting',
  'You are a strength training specialist with expertise in powerlifting, Olympic lifting, and general strength development. Focus on progressive overload, proper form, and evidence-based training methodologies.',
  'analytical',
  ARRAY['strength', 'powerlifting', 'technique']
),
(
  'progress_analyst',
  'Progress Analysis Expert',
  'Detailed analysis of training progress and performance',
  'You are a data-driven fitness analyst who excels at interpreting workout data, identifying patterns, and providing actionable insights for improvement. Use statistical analysis and evidence-based recommendations.',
  'analytical',
  ARRAY['analytics', 'progress', 'data_analysis']
),
(
  'motivational_coach',
  'Motivational Coach',
  'Focused on motivation, mindset, and adherence',
  'You are a motivational fitness coach who specializes in helping people stay consistent, overcome obstacles, and maintain a positive mindset. Focus on encouragement, goal-setting, and building sustainable habits.',
  'motivational',
  ARRAY['motivation', 'habits', 'mindset']
);

-- ============================================================================
-- AUTOMATED MAINTENANCE AND CLEANUP
-- ============================================================================

-- Function to clean up old conversation data
CREATE OR REPLACE FUNCTION cleanup_old_ai_data() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Archive old completed conversations (older than 6 months)
  UPDATE ai_conversation_sessions 
  SET status = 'archived'
  WHERE status = 'completed' 
    AND completed_at < NOW() - INTERVAL '6 months';

  -- Delete old learning data (older than 2 years)
  DELETE FROM ai_learning_data 
  WHERE created_at < NOW() - INTERVAL '2 years';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Delete old model performance data (older than 1 year)
  DELETE FROM ai_model_performance 
  WHERE metric_date < CURRENT_DATE - INTERVAL '1 year';

  -- Delete resolved alerts older than 3 months
  DELETE FROM ai_system_alerts 
  WHERE status = 'resolved' 
    AND resolved_at < NOW() - INTERVAL '3 months';

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup to run monthly
-- Only schedule if pg_cron extension is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('cleanup-ai-data', '0 3 1 * *', 'SELECT cleanup_old_ai_data();');
  END IF;
END $$;

-- ============================================================================
-- UTILITY VIEWS
-- ============================================================================

-- View for AI usage analytics
CREATE VIEW ai_usage_analytics AS
SELECT 
  DATE_TRUNC('day', acs.started_at) as date,
  COUNT(DISTINCT acs.user_id) as unique_users,
  COUNT(acs.id) as total_sessions,
  AVG(acs.message_count) as avg_messages_per_session,
  SUM(acs.total_tokens_used) as total_tokens,
  SUM(acs.total_cost) as total_cost,
  AVG(acs.total_cost) as avg_cost_per_session
FROM ai_conversation_sessions acs
WHERE acs.started_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', acs.started_at)
ORDER BY date DESC;

-- View for AI recommendation effectiveness
CREATE VIEW ai_recommendation_effectiveness AS
SELECT 
  awr.recommendation_type,
  COUNT(*) as total_recommendations,
  COUNT(CASE WHEN awr.user_feedback = 'accepted' THEN 1 END) as accepted_count,
  COUNT(CASE WHEN awr.user_feedback = 'rejected' THEN 1 END) as rejected_count,
  ROUND(
    COUNT(CASE WHEN awr.user_feedback = 'accepted' THEN 1 END)::DECIMAL / 
    NULLIF(COUNT(CASE WHEN awr.user_feedback IS NOT NULL THEN 1 END), 0) * 100, 
    2
  ) as acceptance_rate_percentage,
  AVG(awr.confidence_score) as avg_confidence_score
FROM ai_workout_recommendations awr
WHERE awr.created_at >= NOW() - INTERVAL '30 days'
GROUP BY awr.recommendation_type
ORDER BY acceptance_rate_percentage DESC;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE ai_models IS 'AI model configurations with pricing and capability information';
COMMENT ON TABLE ai_coaching_contexts IS 'Different AI coaching contexts and specializations';
COMMENT ON TABLE ai_conversation_sessions IS 'Enhanced conversation sessions with rich metadata and state management';
COMMENT ON TABLE ai_workout_recommendations IS 'AI-generated workout recommendations with user feedback tracking';
COMMENT ON TABLE ai_insights IS 'AI-generated insights and analysis with user engagement metrics';
COMMENT ON TABLE user_ai_preferences IS 'User preferences for AI interactions and personalization';
COMMENT ON TABLE ai_learning_data IS 'Data collected for AI model improvement and personalization';
COMMENT ON TABLE ai_model_performance IS 'Performance metrics and monitoring for AI models';
COMMENT ON TABLE ai_system_alerts IS 'System alerts and monitoring for AI infrastructure';

COMMENT ON FUNCTION get_ai_coaching_context IS 'Get personalized AI coaching context for user interactions';
COMMENT ON FUNCTION generate_ai_workout_recommendation IS 'Generate AI-powered workout recommendations based on user data';
COMMENT ON FUNCTION update_conversation_metrics IS 'Update conversation session metrics and costs';
COMMENT ON FUNCTION cleanup_old_ai_data IS 'Clean up old AI conversation and learning data';

COMMENT ON VIEW ai_usage_analytics IS 'Daily AI usage analytics and metrics';
COMMENT ON VIEW ai_recommendation_effectiveness IS 'AI recommendation acceptance and effectiveness metrics';
