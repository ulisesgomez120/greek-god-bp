-- ============================================================================
-- WORKOUT SYSTEM ENHANCEMENT WITH ADVANCED ANALYTICS
-- ============================================================================
-- This migration enhances the workout system with advanced analytics,
-- materialized views for performance, and progressive overload algorithms
-- Version: 20240101000004
-- Description: Workout analytics, performance tracking, and algorithm improvements

-- ============================================================================
-- ENHANCED WORKOUT TRACKING
-- ============================================================================

-- Add advanced workout metrics
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS workout_quality_score DECIMAL(3,1);
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS estimated_calories_burned INTEGER;
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS heart_rate_avg INTEGER;
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS heart_rate_max INTEGER;
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS perceived_difficulty INTEGER CHECK (perceived_difficulty >= 1 AND perceived_difficulty <= 10);
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS environment_factors JSONB DEFAULT '{}';
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS workout_tags TEXT[] DEFAULT '{}';

-- Add set-level enhancements
ALTER TABLE exercise_sets ADD COLUMN IF NOT EXISTS tempo TEXT; -- e.g., "3-1-2-1" (eccentric-pause-concentric-pause)
ALTER TABLE exercise_sets ADD COLUMN IF NOT EXISTS range_of_motion TEXT CHECK (range_of_motion IN ('full', 'partial', 'extended'));
ALTER TABLE exercise_sets ADD COLUMN IF NOT EXISTS technique_rating INTEGER CHECK (technique_rating >= 1 AND technique_rating <= 5);
ALTER TABLE exercise_sets ADD COLUMN IF NOT EXISTS effort_level INTEGER CHECK (effort_level >= 1 AND effort_level <= 10);
ALTER TABLE exercise_sets ADD COLUMN IF NOT EXISTS rest_quality TEXT CHECK (rest_quality IN ('poor', 'fair', 'good', 'excellent'));
ALTER TABLE exercise_sets ADD COLUMN IF NOT EXISTS set_type TEXT DEFAULT 'working' CHECK (set_type IN ('warmup', 'working', 'drop', 'cluster', 'rest_pause', 'failure'));

-- ============================================================================
-- WORKOUT TEMPLATES AND CUSTOMIZATION
-- ============================================================================

-- Enhanced workout plan templates
CREATE TABLE workout_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES user_profiles(id),
  template_type TEXT NOT NULL CHECK (template_type IN ('system', 'user', 'coach', 'community')),
  target_experience experience_level_enum[] NOT NULL,
  estimated_duration_minutes INTEGER CHECK (estimated_duration_minutes > 0),
  difficulty_rating DECIMAL(2,1) CHECK (difficulty_rating >= 1.0 AND difficulty_rating <= 5.0),
  muscle_focus muscle_group_enum[] DEFAULT '{}',
  equipment_required equipment_enum[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  rating_avg DECIMAL(2,1) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workout template exercises with advanced programming
CREATE TABLE workout_template_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  order_in_workout INTEGER NOT NULL CHECK (order_in_workout > 0),
  superset_group INTEGER, -- NULL for regular sets, number for superset grouping
  exercise_type TEXT DEFAULT 'main' CHECK (exercise_type IN ('warmup', 'main', 'accessory', 'cooldown')),
  
  -- Set and rep programming
  target_sets INTEGER NOT NULL CHECK (target_sets > 0),
  rep_range_min INTEGER CHECK (rep_range_min > 0),
  rep_range_max INTEGER CHECK (rep_range_max >= rep_range_min),
  rpe_target INTEGER CHECK (rpe_target >= 1 AND rpe_target <= 10),
  rest_seconds INTEGER CHECK (rest_seconds >= 0),
  
  -- Advanced programming
  intensity_percentage DECIMAL(4,1), -- % of 1RM
  tempo_prescription TEXT, -- e.g., "3-1-2-1"
  range_of_motion_notes TEXT,
  technique_focus TEXT[],
  progression_scheme JSONB,
  
  -- Conditional logic
  conditions JSONB, -- When to include this exercise
  alternatives UUID[], -- Alternative exercises
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User workout customizations
CREATE TABLE user_workout_customizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES workout_templates(id),
  customization_data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, template_id)
);

-- ============================================================================
-- PROGRESSIVE OVERLOAD ALGORITHM ENHANCEMENT
-- ============================================================================

-- Progressive overload tracking
CREATE TABLE progressive_overload_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  progression_date DATE NOT NULL,
  progression_type TEXT NOT NULL CHECK (progression_type IN ('weight', 'reps', 'sets', 'density', 'range_of_motion')),
  previous_value DECIMAL(8,2),
  new_value DECIMAL(8,2),
  percentage_increase DECIMAL(5,2),
  trigger_reason TEXT, -- What triggered the progression
  user_feedback TEXT,
  success_rating INTEGER CHECK (success_rating >= 1 AND success_rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Advanced progression algorithm function
CREATE OR REPLACE FUNCTION calculate_progressive_overload(
  p_user_id UUID,
  p_exercise_id UUID,
  p_recent_sessions INTEGER DEFAULT 3
) RETURNS JSONB AS $$
DECLARE
  user_experience experience_level_enum;
  recent_sets RECORD;
  progression_recommendation JSONB;
  avg_rpe DECIMAL(3,1);
  consistency_score DECIMAL(3,2);
  volume_trend TEXT;
  strength_trend TEXT;
BEGIN
  -- Get user experience level
  SELECT experience_level INTO user_experience
  FROM user_profiles WHERE id = p_user_id;

  -- Analyze recent performance
  SELECT 
    AVG(es.rpe) as avg_rpe,
    AVG(es.weight_kg) as avg_weight,
    AVG(es.reps) as avg_reps,
    COUNT(DISTINCT ws.id) as session_count,
    MAX(es.weight_kg) as max_weight,
    MAX(es.reps) as max_reps,
    STDDEV(es.rpe) as rpe_consistency
  INTO recent_sets
  FROM exercise_sets es
  JOIN workout_sessions ws ON es.session_id = ws.id
  WHERE ws.user_id = p_user_id
    AND es.exercise_id = p_exercise_id
    AND es.is_warmup = FALSE
    AND es.set_type = 'working'
    AND ws.completed_at >= NOW() - INTERVAL '2 weeks'
  ORDER BY ws.started_at DESC
  LIMIT p_recent_sessions * 5; -- Approximate sets per session

  -- Calculate progression recommendation
  IF recent_sets.session_count >= 2 THEN
    avg_rpe := recent_sets.avg_rpe;
    consistency_score := CASE 
      WHEN recent_sets.rpe_consistency <= 0.5 THEN 1.0
      WHEN recent_sets.rpe_consistency <= 1.0 THEN 0.8
      WHEN recent_sets.rpe_consistency <= 1.5 THEN 0.6
      ELSE 0.4
    END;

    -- Determine progression based on experience level and RPE
    progression_recommendation := CASE
      -- Untrained: Aggressive progression when RPE < 7
      WHEN user_experience = 'untrained' AND avg_rpe < 7.0 THEN
        jsonb_build_object(
          'should_progress', true,
          'progression_type', 'weight',
          'increase_percentage', 10.0,
          'reason', 'RPE below target - ready for weight increase',
          'confidence', consistency_score
        )
      
      -- Beginner: Moderate progression when RPE < 7.5
      WHEN user_experience = 'beginner' AND avg_rpe < 7.5 THEN
        jsonb_build_object(
          'should_progress', true,
          'progression_type', 'weight',
          'increase_percentage', 5.0,
          'reason', 'Consistent performance - time to progress',
          'confidence', consistency_score
        )
      
      -- Early Intermediate: Conservative progression when RPE < 8
      WHEN user_experience = 'early_intermediate' AND avg_rpe < 8.0 THEN
        jsonb_build_object(
          'should_progress', true,
          'progression_type', CASE WHEN recent_sets.avg_reps >= 12 THEN 'weight' ELSE 'reps' END,
          'increase_percentage', 2.5,
          'reason', 'RPE indicates readiness for progression',
          'confidence', consistency_score
        )
      
      -- Intermediate+: Very conservative, focus on volume first
      WHEN user_experience IN ('intermediate', 'advanced') AND avg_rpe < 8.5 THEN
        jsonb_build_object(
          'should_progress', true,
          'progression_type', CASE WHEN recent_sets.avg_reps >= 15 THEN 'weight' ELSE 'reps' END,
          'increase_percentage', 1.25,
          'reason', 'Advanced trainee - gradual progression recommended',
          'confidence', consistency_score
        )
      
      -- RPE too high - maintain or deload
      WHEN avg_rpe >= 9.0 THEN
        jsonb_build_object(
          'should_progress', false,
          'progression_type', 'maintain',
          'increase_percentage', 0.0,
          'reason', 'RPE too high - focus on technique and recovery',
          'confidence', consistency_score,
          'deload_recommended', true
        )
      
      -- Default: maintain current load
      ELSE
        jsonb_build_object(
          'should_progress', false,
          'progression_type', 'maintain',
          'increase_percentage', 0.0,
          'reason', 'Continue with current load',
          'confidence', consistency_score
        )
    END;
  ELSE
    -- Insufficient data
    progression_recommendation := jsonb_build_object(
      'should_progress', false,
      'progression_type', 'insufficient_data',
      'increase_percentage', 0.0,
      'reason', 'Need more workout data for progression analysis',
      'confidence', 0.0
    );
  END IF;

  RETURN progression_recommendation;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- WORKOUT ANALYTICS AND PERFORMANCE TRACKING
-- ============================================================================

-- Materialized view for workout performance analytics
CREATE MATERIALIZED VIEW workout_performance_analytics AS
SELECT 
  ws.user_id,
  DATE_TRUNC('week', ws.started_at) as week_start,
  COUNT(*) as workouts_completed,
  AVG(ws.duration_minutes) as avg_duration,
  AVG(ws.total_volume_kg) as avg_volume,
  AVG(ws.average_rpe) as avg_rpe,
  AVG(ws.workout_quality_score) as avg_quality_score,
  SUM(ws.total_volume_kg) as total_weekly_volume,
  
  -- Exercise variety metrics
  COUNT(DISTINCT es.exercise_id) as unique_exercises,
  
  -- Consistency metrics
  COUNT(*) / 7.0 as workout_frequency,
  
  -- Progressive overload indicators
  AVG(CASE WHEN es.set_type = 'working' THEN es.weight_kg END) as avg_working_weight,
  MAX(CASE WHEN es.set_type = 'working' THEN es.weight_kg END) as max_working_weight,
  
  -- Recovery indicators
  AVG(CASE WHEN es.rest_quality IS NOT NULL THEN 
    CASE es.rest_quality 
      WHEN 'excellent' THEN 4
      WHEN 'good' THEN 3
      WHEN 'fair' THEN 2
      WHEN 'poor' THEN 1
    END
  END) as avg_rest_quality_score

FROM workout_sessions ws
LEFT JOIN exercise_sets es ON ws.id = es.session_id
WHERE ws.completed_at IS NOT NULL
  AND ws.started_at >= NOW() - INTERVAL '12 weeks'
GROUP BY ws.user_id, DATE_TRUNC('week', ws.started_at);

-- Index for performance analytics
CREATE UNIQUE INDEX idx_workout_performance_analytics_user_week 
ON workout_performance_analytics(user_id, week_start);

-- Refresh analytics weekly
SELECT cron.schedule('refresh-workout-analytics', '0 6 * * 1', 'REFRESH MATERIALIZED VIEW workout_performance_analytics;');

-- ============================================================================
-- STRENGTH PROGRESSION TRACKING
-- ============================================================================

-- Materialized view for strength progression analysis
CREATE MATERIALIZED VIEW strength_progression_analytics AS
WITH exercise_maxes AS (
  SELECT 
    ws.user_id,
    es.exercise_id,
    e.name as exercise_name,
    e.primary_muscle,
    DATE_TRUNC('month', ws.started_at) as month_start,
    MAX(calculate_one_rep_max(es.weight_kg, es.reps)) as estimated_1rm,
    MAX(es.weight_kg) as max_weight,
    MAX(es.reps) as max_reps,
    AVG(es.rpe) as avg_rpe,
    COUNT(*) as total_sets
  FROM workout_sessions ws
  JOIN exercise_sets es ON ws.id = es.session_id
  JOIN exercises e ON es.exercise_id = e.id
  WHERE ws.completed_at IS NOT NULL
    AND es.is_warmup = FALSE
    AND es.set_type = 'working'
    AND es.weight_kg > 0
    AND es.reps > 0
    AND ws.started_at >= NOW() - INTERVAL '12 months'
  GROUP BY ws.user_id, es.exercise_id, e.name, e.primary_muscle, DATE_TRUNC('month', ws.started_at)
),
progression_changes AS (
  SELECT 
    *,
    LAG(estimated_1rm) OVER (PARTITION BY user_id, exercise_id ORDER BY month_start) as prev_1rm,
    LAG(max_weight) OVER (PARTITION BY user_id, exercise_id ORDER BY month_start) as prev_max_weight
  FROM exercise_maxes
)
SELECT 
  user_id,
  exercise_id,
  exercise_name,
  primary_muscle,
  month_start,
  estimated_1rm,
  max_weight,
  max_reps,
  avg_rpe,
  total_sets,
  prev_1rm,
  prev_max_weight,
  CASE 
    WHEN prev_1rm IS NOT NULL THEN 
      ROUND(((estimated_1rm - prev_1rm) / prev_1rm * 100)::NUMERIC, 2)
    ELSE NULL 
  END as strength_gain_percentage,
  CASE 
    WHEN prev_max_weight IS NOT NULL THEN 
      ROUND((max_weight - prev_max_weight)::NUMERIC, 2)
    ELSE NULL 
  END as weight_progression_kg
FROM progression_changes;

-- Index for strength progression analytics
CREATE INDEX idx_strength_progression_user_exercise 
ON strength_progression_analytics(user_id, exercise_id, month_start);

CREATE INDEX idx_strength_progression_muscle_group 
ON strength_progression_analytics(user_id, primary_muscle, month_start);

-- ============================================================================
-- WORKOUT RECOMMENDATION ENGINE
-- ============================================================================

-- Function to recommend next workout based on user history and recovery
CREATE OR REPLACE FUNCTION recommend_next_workout(
  p_user_id UUID,
  p_days_since_last INTEGER DEFAULT 1
) RETURNS JSONB AS $$
DECLARE
  user_profile RECORD;
  last_workout RECORD;
  muscle_fatigue JSONB;
  recommendation JSONB;
BEGIN
  -- Get user profile
  SELECT * INTO user_profile
  FROM user_profiles WHERE id = p_user_id;

  -- Get last workout details
  SELECT 
    ws.*,
    array_agg(DISTINCT e.primary_muscle) as muscles_trained
  INTO last_workout
  FROM workout_sessions ws
  JOIN exercise_sets es ON ws.id = es.session_id
  JOIN exercises e ON es.exercise_id = e.id
  WHERE ws.user_id = p_user_id
    AND ws.completed_at IS NOT NULL
  GROUP BY ws.id
  ORDER BY ws.started_at DESC
  LIMIT 1;

  -- Calculate muscle fatigue based on recent training
  SELECT jsonb_object_agg(
    muscle_group,
    fatigue_score
  ) INTO muscle_fatigue
  FROM (
    SELECT 
      e.primary_muscle as muscle_group,
      CASE 
        WHEN MAX(ws.started_at) >= NOW() - INTERVAL '1 day' THEN 0.9
        WHEN MAX(ws.started_at) >= NOW() - INTERVAL '2 days' THEN 0.6
        WHEN MAX(ws.started_at) >= NOW() - INTERVAL '3 days' THEN 0.3
        ELSE 0.1
      END as fatigue_score
    FROM workout_sessions ws
    JOIN exercise_sets es ON ws.id = es.session_id
    JOIN exercises e ON es.exercise_id = e.id
    WHERE ws.user_id = p_user_id
      AND ws.completed_at IS NOT NULL
      AND ws.started_at >= NOW() - INTERVAL '7 days'
      AND es.is_warmup = FALSE
    GROUP BY e.primary_muscle
  ) muscle_fatigue_calc;

  -- Generate recommendation
  recommendation := jsonb_build_object(
    'recommended_workout_type', 
    CASE 
      WHEN p_days_since_last >= 3 THEN 'full_body'
      WHEN last_workout.muscles_trained @> ARRAY['chest', 'shoulders', 'triceps']::muscle_group_enum[] THEN 'lower_body'
      WHEN last_workout.muscles_trained @> ARRAY['quadriceps', 'hamstrings', 'glutes']::muscle_group_enum[] THEN 'upper_body'
      ELSE 'full_body'
    END,
    'muscle_fatigue', muscle_fatigue,
    'recovery_recommendation',
    CASE 
      WHEN p_days_since_last = 1 THEN 'light_intensity'
      WHEN p_days_since_last = 2 THEN 'moderate_intensity'
      ELSE 'normal_intensity'
    END,
    'suggested_duration_minutes',
    CASE user_profile.experience_level
      WHEN 'untrained' THEN 45
      WHEN 'beginner' THEN 60
      WHEN 'early_intermediate' THEN 75
      ELSE 90
    END
  );

  RETURN recommendation;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- WORKOUT QUALITY SCORING SYSTEM
-- ============================================================================

-- Function to calculate workout quality score
CREATE OR REPLACE FUNCTION calculate_workout_quality_score(
  p_session_id UUID
) RETURNS DECIMAL(3,1) AS $$
DECLARE
  quality_metrics RECORD;
  quality_score DECIMAL(3,1);
BEGIN
  -- Gather quality metrics
  SELECT 
    COUNT(*) as total_sets,
    COUNT(CASE WHEN es.rpe IS NOT NULL THEN 1 END) as sets_with_rpe,
    AVG(es.rpe) as avg_rpe,
    STDDEV(es.rpe) as rpe_consistency,
    COUNT(CASE WHEN es.technique_rating >= 4 THEN 1 END) as good_technique_sets,
    COUNT(CASE WHEN es.rest_quality IN ('good', 'excellent') THEN 1 END) as good_rest_sets,
    COUNT(DISTINCT es.exercise_id) as unique_exercises,
    ws.duration_minutes,
    ws.total_volume_kg
  INTO quality_metrics
  FROM workout_sessions ws
  JOIN exercise_sets es ON ws.id = es.session_id
  WHERE ws.id = p_session_id
    AND es.is_warmup = FALSE
  GROUP BY ws.id, ws.duration_minutes, ws.total_volume_kg;

  -- Calculate quality score (0-10 scale)
  quality_score := (
    -- RPE tracking completeness (0-2 points)
    LEAST(2.0, (quality_metrics.sets_with_rpe::DECIMAL / quality_metrics.total_sets) * 2.0) +
    
    -- RPE consistency (0-2 points) - lower standard deviation is better
    CASE 
      WHEN quality_metrics.rpe_consistency <= 0.5 THEN 2.0
      WHEN quality_metrics.rpe_consistency <= 1.0 THEN 1.5
      WHEN quality_metrics.rpe_consistency <= 1.5 THEN 1.0
      ELSE 0.5
    END +
    
    -- Technique quality (0-2 points)
    LEAST(2.0, (quality_metrics.good_technique_sets::DECIMAL / quality_metrics.total_sets) * 2.0) +
    
    -- Rest quality (0-2 points)
    LEAST(2.0, (quality_metrics.good_rest_sets::DECIMAL / quality_metrics.total_sets) * 2.0) +
    
    -- Exercise variety (0-1 point)
    LEAST(1.0, quality_metrics.unique_exercises::DECIMAL / 5.0) +
    
    -- Duration appropriateness (0-1 point)
    CASE 
      WHEN quality_metrics.duration_minutes BETWEEN 30 AND 120 THEN 1.0
      WHEN quality_metrics.duration_minutes BETWEEN 20 AND 150 THEN 0.5
      ELSE 0.0
    END
  );

  RETURN LEAST(10.0, quality_score);
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate quality score
CREATE OR REPLACE FUNCTION update_workout_quality_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if workout is completed
  IF NEW.completed_at IS NOT NULL AND (OLD.completed_at IS NULL OR OLD.completed_at != NEW.completed_at) THEN
    NEW.workout_quality_score := calculate_workout_quality_score(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workout_quality_score_trigger
  BEFORE UPDATE ON workout_sessions
  FOR EACH ROW EXECUTE FUNCTION update_workout_quality_score();

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Workout templates indexes
CREATE INDEX idx_workout_templates_type_experience ON workout_templates(template_type, target_experience);
CREATE INDEX idx_workout_templates_public_featured ON workout_templates(is_public, is_featured) WHERE is_public = TRUE;
CREATE INDEX idx_workout_templates_usage ON workout_templates(usage_count DESC, rating_avg DESC);

-- Template exercises indexes
CREATE INDEX idx_template_exercises_template_order ON workout_template_exercises(template_id, order_in_workout);
CREATE INDEX idx_template_exercises_superset ON workout_template_exercises(template_id, superset_group) WHERE superset_group IS NOT NULL;

-- Progressive overload indexes
CREATE INDEX idx_progressive_overload_user_exercise ON progressive_overload_records(user_id, exercise_id, progression_date DESC);
CREATE INDEX idx_progressive_overload_date ON progressive_overload_records(progression_date DESC);

-- Workout customizations indexes
CREATE INDEX idx_workout_customizations_user_active ON user_workout_customizations(user_id, is_active) WHERE is_active = TRUE;

-- Enhanced workout session indexes
CREATE INDEX idx_workout_sessions_quality ON workout_sessions(user_id, workout_quality_score DESC) WHERE workout_quality_score IS NOT NULL;
CREATE INDEX idx_workout_sessions_tags ON workout_sessions USING GIN(workout_tags) WHERE array_length(workout_tags, 1) > 0;

-- Enhanced exercise sets indexes
CREATE INDEX idx_exercise_sets_technique ON exercise_sets(technique_rating, created_at) WHERE technique_rating IS NOT NULL;
CREATE INDEX idx_exercise_sets_set_type ON exercise_sets(session_id, set_type, set_number);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_workout_customizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE progressive_overload_records ENABLE ROW LEVEL SECURITY;

-- Workout templates policies
CREATE POLICY "Anyone can view public templates" ON workout_templates
  FOR SELECT USING (is_public = TRUE OR created_by = auth.uid());

CREATE POLICY "Users can create own templates" ON workout_templates
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own templates" ON workout_templates
  FOR UPDATE USING (created_by = auth.uid());

-- Template exercises policies
CREATE POLICY "Anyone can view public template exercises" ON workout_template_exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workout_templates wt 
      WHERE wt.id = workout_template_exercises.template_id 
      AND (wt.is_public = TRUE OR wt.created_by = auth.uid())
    )
  );

CREATE POLICY "Users can manage own template exercises" ON workout_template_exercises
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workout_templates wt 
      WHERE wt.id = workout_template_exercises.template_id 
      AND wt.created_by = auth.uid()
    )
  );

-- User customizations policies
CREATE POLICY "Users can view own customizations" ON user_workout_customizations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own customizations" ON user_workout_customizations
  FOR ALL USING (auth.uid() = user_id);

-- Progressive overload policies
CREATE POLICY "Users can view own progression records" ON progressive_overload_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert progression records" ON progressive_overload_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- UTILITY VIEWS
-- ============================================================================

-- View for user workout statistics
CREATE VIEW user_workout_statistics AS
SELECT 
  up.id as user_id,
  up.display_name,
  up.experience_level,
  COUNT(ws.id) as total_workouts,
  COUNT(CASE WHEN ws.completed_at IS NOT NULL THEN 1 END) as completed_workouts,
  AVG(ws.duration_minutes) as avg_workout_duration,
  AVG(ws.total_volume_kg) as avg_workout_volume,
  AVG(ws.average_rpe) as avg_workout_rpe,
  AVG(ws.workout_quality_score) as avg_quality_score,
  MAX(ws.started_at) as last_workout_date,
  COUNT(DISTINCT es.exercise_id) as unique_exercises_performed,
  
  -- Consistency metrics
  CASE 
    WHEN COUNT(ws.id) = 0 THEN 0
    ELSE COUNT(ws.id)::DECIMAL / GREATEST(1, EXTRACT(DAYS FROM (MAX(ws.started_at) - MIN(ws.started_at))))
  END as workout_frequency_per_day

FROM user_profiles up
LEFT JOIN workout_sessions ws ON up.id = ws.user_id
LEFT JOIN exercise_sets es ON ws.id = es.session_id AND es.is_warmup = FALSE
WHERE ws.started_at >= NOW() - INTERVAL '90 days' OR ws.started_at IS NULL
GROUP BY up.id, up.display_name, up.experience_level;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE workout_templates IS 'Enhanced workout plan templates with advanced programming features';
COMMENT ON TABLE workout_template_exercises IS 'Detailed exercise programming within workout templates';
COMMENT ON TABLE user_workout_customizations IS 'User-specific customizations to workout templates';
COMMENT ON TABLE progressive_overload_records IS 'Tracking of progressive overload implementations and outcomes';

COMMENT ON FUNCTION calculate_progressive_overload IS 'Advanced algorithm for determining progressive overload recommendations';
COMMENT ON FUNCTION recommend_next_workout IS 'Intelligent workout recommendation based on training history and recovery';
COMMENT ON FUNCTION calculate_workout_quality_score IS 'Comprehensive workout quality assessment algorithm';

COMMENT ON MATERIALIZED VIEW workout_performance_analytics IS 'Weekly workout performance metrics for trend analysis';
COMMENT ON MATERIALIZED VIEW strength_progression_analytics IS 'Monthly strength progression tracking and analysis';

COMMENT ON VIEW user_workout_statistics IS 'Comprehensive user workout statistics and consistency metrics';
