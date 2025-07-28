-- ============================================================================
-- PROGRESS TRACKING SYSTEM WITH COMPREHENSIVE ANALYTICS
-- ============================================================================
-- This migration creates comprehensive progress analytics tables with body
-- composition tracking, strength progression, and goal achievement systems
-- Version: 20240101000005
-- Description: Progress analytics, body composition, goals, and benchmarking

-- ============================================================================
-- BODY COMPOSITION AND MEASUREMENTS
-- ============================================================================

-- Body composition tracking
CREATE TABLE body_measurements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  measurement_date DATE NOT NULL,
  weight_kg DECIMAL(5,2) CHECK (weight_kg > 0 AND weight_kg < 1000),
  body_fat_percentage DECIMAL(4,1) CHECK (body_fat_percentage >= 0 AND body_fat_percentage <= 100),
  muscle_mass_kg DECIMAL(5,2) CHECK (muscle_mass_kg >= 0),
  bone_mass_kg DECIMAL(4,2) CHECK (bone_mass_kg >= 0),
  water_percentage DECIMAL(4,1) CHECK (water_percentage >= 0 AND water_percentage <= 100),
  visceral_fat_rating INTEGER CHECK (visceral_fat_rating >= 1 AND visceral_fat_rating <= 30),
  metabolic_age INTEGER CHECK (metabolic_age > 0 AND metabolic_age < 150),
  
  -- Circumference measurements (in cm)
  chest_cm DECIMAL(5,2) CHECK (chest_cm > 0),
  waist_cm DECIMAL(5,2) CHECK (waist_cm > 0),
  hips_cm DECIMAL(5,2) CHECK (hips_cm > 0),
  neck_cm DECIMAL(5,2) CHECK (neck_cm > 0),
  bicep_left_cm DECIMAL(4,2) CHECK (bicep_left_cm > 0),
  bicep_right_cm DECIMAL(4,2) CHECK (bicep_right_cm > 0),
  thigh_left_cm DECIMAL(5,2) CHECK (thigh_left_cm > 0),
  thigh_right_cm DECIMAL(5,2) CHECK (thigh_right_cm > 0),
  forearm_left_cm DECIMAL(4,2) CHECK (forearm_left_cm > 0),
  forearm_right_cm DECIMAL(4,2) CHECK (forearm_right_cm > 0),
  calf_left_cm DECIMAL(4,2) CHECK (calf_left_cm > 0),
  calf_right_cm DECIMAL(4,2) CHECK (calf_right_cm > 0),
  
  -- Measurement context
  measurement_method TEXT, -- 'scale', 'dexa', 'bod_pod', 'manual'
  measurement_conditions JSONB DEFAULT '{}', -- time of day, fasted state, etc.
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, measurement_date)
);

-- ============================================================================
-- STRENGTH BENCHMARKS AND STANDARDS
-- ============================================================================

-- Strength standards for benchmarking
CREATE TABLE strength_standards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  gender gender_enum NOT NULL,
  bodyweight_kg_min DECIMAL(5,2) NOT NULL,
  bodyweight_kg_max DECIMAL(5,2) NOT NULL,
  experience_level experience_level_enum NOT NULL,
  standard_1rm_kg DECIMAL(6,2) NOT NULL,
  percentile INTEGER CHECK (percentile >= 1 AND percentile <= 100),
  data_source TEXT, -- 'strength_level', 'symmetric_strength', 'internal'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User strength benchmarks
CREATE TABLE user_strength_benchmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  benchmark_date DATE NOT NULL,
  tested_1rm_kg DECIMAL(6,2) NOT NULL,
  estimated_1rm_kg DECIMAL(6,2), -- From rep max calculation
  bodyweight_kg DECIMAL(5,2) NOT NULL,
  wilks_score DECIMAL(6,2), -- Wilks coefficient score
  strength_level TEXT, -- 'untrained', 'novice', 'intermediate', 'advanced', 'elite'
  percentile_rank INTEGER CHECK (percentile_rank >= 1 AND percentile_rank <= 100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, exercise_id, benchmark_date)
);

-- ============================================================================
-- GOAL TRACKING SYSTEM
-- ============================================================================

-- User fitness goals
CREATE TABLE fitness_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL CHECK (goal_type IN (
    'strength', 'weight_loss', 'weight_gain', 'muscle_gain', 'endurance',
    'body_composition', 'performance', 'habit', 'custom'
  )),
  title TEXT NOT NULL,
  description TEXT,
  
  -- Goal specifics
  target_value DECIMAL(10,2),
  current_value DECIMAL(10,2),
  unit TEXT, -- 'kg', 'lbs', '%', 'reps', 'minutes', etc.
  
  -- Timeline
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  target_date DATE,
  completed_date DATE,
  
  -- Goal configuration
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 5),
  category TEXT, -- 'short_term', 'medium_term', 'long_term'
  
  -- Progress tracking
  progress_percentage DECIMAL(5,2) DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  last_updated_value DECIMAL(10,2),
  last_updated_date DATE,
  
  -- Related entities
  exercise_id UUID REFERENCES exercises(id), -- For strength goals
  measurement_type TEXT, -- For body composition goals
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Goal milestones and checkpoints
CREATE TABLE goal_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES fitness_goals(id) ON DELETE CASCADE,
  milestone_name TEXT NOT NULL,
  target_value DECIMAL(10,2) NOT NULL,
  target_date DATE,
  achieved_date DATE,
  achieved_value DECIMAL(10,2),
  is_achieved BOOLEAN DEFAULT FALSE,
  reward_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PROGRESS ANALYTICS AND METRICS
-- ============================================================================

-- Comprehensive progress metrics
CREATE TABLE progress_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN (
    'strength', 'volume', 'frequency', 'consistency', 'body_composition',
    'performance', 'recovery', 'motivation'
  )),
  
  -- Metric values
  primary_value DECIMAL(10,2) NOT NULL,
  secondary_value DECIMAL(10,2),
  tertiary_value DECIMAL(10,2),
  
  -- Context and metadata
  metric_name TEXT NOT NULL,
  unit TEXT,
  calculation_method TEXT,
  data_points_used INTEGER,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  -- Trend analysis
  trend_direction TEXT CHECK (trend_direction IN ('improving', 'declining', 'stable', 'volatile')),
  trend_strength DECIMAL(3,2) CHECK (trend_strength >= 0 AND trend_strength <= 1),
  
  -- Comparison metrics
  previous_period_value DECIMAL(10,2),
  percentage_change DECIMAL(6,2),
  percentile_rank INTEGER CHECK (percentile_rank >= 1 AND percentile_rank <= 100),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, metric_date, metric_type, metric_name)
);

-- ============================================================================
-- ACHIEVEMENT AND BADGE SYSTEM
-- ============================================================================

-- Achievement definitions
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'strength', 'consistency', 'volume', 'milestone', 'social', 'special'
  )),
  
  -- Achievement criteria
  criteria JSONB NOT NULL, -- Conditions that must be met
  points INTEGER DEFAULT 0 CHECK (points >= 0),
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  
  -- Visual representation
  icon_name TEXT,
  badge_color TEXT,
  
  -- Availability
  is_active BOOLEAN DEFAULT TRUE,
  is_hidden BOOLEAN DEFAULT FALSE, -- Hidden until unlocked
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User achievements
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id),
  earned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  progress_value DECIMAL(10,2), -- Value when achievement was earned
  context_data JSONB, -- Additional context about how it was earned
  is_featured BOOLEAN DEFAULT FALSE, -- User can feature favorite achievements
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- ============================================================================
-- PERFORMANCE COMPARISON AND BENCHMARKING
-- ============================================================================

-- Performance comparison groups
CREATE TABLE performance_comparison_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL, -- Age range, experience level, gender, etc.
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User performance rankings
CREATE MATERIALIZED VIEW user_performance_rankings AS
WITH user_stats AS (
  SELECT 
    up.id as user_id,
    up.experience_level,
    up.gender,
    EXTRACT(YEAR FROM AGE(up.birth_date)) as age,
    
    -- Strength metrics (last 30 days)
    AVG(CASE WHEN es.set_type = 'working' THEN calculate_one_rep_max(es.weight_kg, es.reps) END) as avg_estimated_1rm,
    MAX(CASE WHEN es.set_type = 'working' THEN calculate_one_rep_max(es.weight_kg, es.reps) END) as max_estimated_1rm,
    
    -- Volume metrics
    AVG(ws.total_volume_kg) as avg_weekly_volume,
    COUNT(DISTINCT ws.id) as workouts_per_month,
    
    -- Consistency metrics
    COUNT(DISTINCT DATE_TRUNC('week', ws.started_at)) as active_weeks,
    AVG(ws.workout_quality_score) as avg_quality_score,
    
    -- Exercise variety
    COUNT(DISTINCT es.exercise_id) as unique_exercises
    
  FROM user_profiles up
  LEFT JOIN workout_sessions ws ON up.id = ws.user_id 
    AND ws.started_at >= NOW() - INTERVAL '30 days'
    AND ws.completed_at IS NOT NULL
  LEFT JOIN exercise_sets es ON ws.id = es.session_id 
    AND es.is_warmup = FALSE
  GROUP BY up.id, up.experience_level, up.gender, up.birth_date
),
rankings AS (
  SELECT 
    *,
    -- Overall rankings
    PERCENT_RANK() OVER (ORDER BY avg_estimated_1rm) as strength_percentile,
    PERCENT_RANK() OVER (ORDER BY avg_weekly_volume) as volume_percentile,
    PERCENT_RANK() OVER (ORDER BY workouts_per_month) as frequency_percentile,
    PERCENT_RANK() OVER (ORDER BY avg_quality_score) as quality_percentile,
    
    -- Experience level rankings
    PERCENT_RANK() OVER (PARTITION BY experience_level ORDER BY avg_estimated_1rm) as strength_percentile_by_level,
    PERCENT_RANK() OVER (PARTITION BY experience_level ORDER BY avg_weekly_volume) as volume_percentile_by_level,
    
    -- Age group rankings (10-year brackets)
    PERCENT_RANK() OVER (PARTITION BY (age / 10) * 10 ORDER BY avg_estimated_1rm) as strength_percentile_by_age,
    
    -- Gender rankings
    PERCENT_RANK() OVER (PARTITION BY gender ORDER BY avg_estimated_1rm) as strength_percentile_by_gender
    
  FROM user_stats
  WHERE avg_estimated_1rm IS NOT NULL
)
SELECT 
  user_id,
  experience_level,
  gender,
  age,
  
  -- Raw metrics
  avg_estimated_1rm,
  max_estimated_1rm,
  avg_weekly_volume,
  workouts_per_month,
  active_weeks,
  avg_quality_score,
  unique_exercises,
  
  -- Percentile rankings (0-1 scale)
  ROUND(strength_percentile * 100) as strength_percentile,
  ROUND(volume_percentile * 100) as volume_percentile,
  ROUND(frequency_percentile * 100) as frequency_percentile,
  ROUND(quality_percentile * 100) as quality_percentile,
  ROUND(strength_percentile_by_level * 100) as strength_percentile_by_level,
  ROUND(volume_percentile_by_level * 100) as volume_percentile_by_level,
  ROUND(strength_percentile_by_age * 100) as strength_percentile_by_age,
  ROUND(strength_percentile_by_gender * 100) as strength_percentile_by_gender,
  
  -- Overall performance score (weighted average)
  ROUND((
    strength_percentile * 0.3 +
    volume_percentile * 0.2 +
    frequency_percentile * 0.2 +
    quality_percentile * 0.2 +
    (unique_exercises / 50.0) * 0.1 -- Exercise variety bonus
  ) * 100) as overall_performance_score

FROM rankings;

-- Index for performance rankings
CREATE UNIQUE INDEX idx_user_performance_rankings_user ON user_performance_rankings(user_id);
CREATE INDEX idx_user_performance_rankings_score ON user_performance_rankings(overall_performance_score DESC);

-- ============================================================================
-- PROGRESS CALCULATION FUNCTIONS
-- ============================================================================

-- Function to calculate comprehensive progress metrics
CREATE OR REPLACE FUNCTION calculate_user_progress_metrics(
  p_user_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  strength_progress JSONB;
  volume_progress JSONB;
  consistency_metrics JSONB;
  body_composition_progress JSONB;
  goal_progress JSONB;
  overall_progress JSONB;
BEGIN
  -- Calculate strength progress
  SELECT jsonb_build_object(
    'total_exercises_tracked', COUNT(DISTINCT es.exercise_id),
    'avg_estimated_1rm', ROUND(AVG(calculate_one_rep_max(es.weight_kg, es.reps))::NUMERIC, 2),
    'max_estimated_1rm', ROUND(MAX(calculate_one_rep_max(es.weight_kg, es.reps))::NUMERIC, 2),
    'strength_gain_percentage', CASE 
      WHEN LAG(AVG(calculate_one_rep_max(es.weight_kg, es.reps))) OVER () IS NOT NULL THEN
        ROUND(((AVG(calculate_one_rep_max(es.weight_kg, es.reps)) - 
               LAG(AVG(calculate_one_rep_max(es.weight_kg, es.reps))) OVER ()) /
               LAG(AVG(calculate_one_rep_max(es.weight_kg, es.reps))) OVER () * 100)::NUMERIC, 2)
      ELSE NULL
    END
  ) INTO strength_progress
  FROM exercise_sets es
  JOIN workout_sessions ws ON es.session_id = ws.id
  WHERE ws.user_id = p_user_id
    AND ws.started_at BETWEEN p_start_date AND p_end_date
    AND es.is_warmup = FALSE
    AND es.set_type = 'working'
    AND es.weight_kg > 0
    AND es.reps > 0;

  -- Calculate volume progress
  SELECT jsonb_build_object(
    'total_workouts', COUNT(*),
    'total_volume_kg', ROUND(COALESCE(SUM(ws.total_volume_kg), 0)::NUMERIC, 2),
    'avg_workout_volume', ROUND(COALESCE(AVG(ws.total_volume_kg), 0)::NUMERIC, 2),
    'avg_workout_duration', ROUND(COALESCE(AVG(ws.duration_minutes), 0)::NUMERIC, 1),
    'avg_rpe', ROUND(COALESCE(AVG(ws.average_rpe), 0)::NUMERIC, 1)
  ) INTO volume_progress
  FROM workout_sessions ws
  WHERE ws.user_id = p_user_id
    AND ws.started_at BETWEEN p_start_date AND p_end_date
    AND ws.completed_at IS NOT NULL;

  -- Calculate consistency metrics
  SELECT jsonb_build_object(
    'workout_frequency_per_week', ROUND((COUNT(*)::DECIMAL / GREATEST(1, EXTRACT(DAYS FROM (p_end_date - p_start_date)) / 7))::NUMERIC, 2),
    'active_days', COUNT(DISTINCT DATE(ws.started_at)),
    'longest_streak_days', 0, -- Would need more complex calculation
    'consistency_score', ROUND(COALESCE(AVG(ws.workout_quality_score), 0)::NUMERIC, 1)
  ) INTO consistency_metrics
  FROM workout_sessions ws
  WHERE ws.user_id = p_user_id
    AND ws.started_at BETWEEN p_start_date AND p_end_date
    AND ws.completed_at IS NOT NULL;

  -- Calculate body composition progress
  SELECT jsonb_build_object(
    'measurements_taken', COUNT(*),
    'weight_change_kg', CASE 
      WHEN COUNT(*) >= 2 THEN 
        ROUND((LAST_VALUE(weight_kg) OVER (ORDER BY measurement_date ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) - 
               FIRST_VALUE(weight_kg) OVER (ORDER BY measurement_date ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING))::NUMERIC, 2)
      ELSE NULL
    END,
    'body_fat_change_percentage', CASE 
      WHEN COUNT(*) >= 2 THEN 
        ROUND((LAST_VALUE(body_fat_percentage) OVER (ORDER BY measurement_date ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) - 
               FIRST_VALUE(body_fat_percentage) OVER (ORDER BY measurement_date ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING))::NUMERIC, 1)
      ELSE NULL
    END
  ) INTO body_composition_progress
  FROM body_measurements bm
  WHERE bm.user_id = p_user_id
    AND bm.measurement_date BETWEEN p_start_date AND p_end_date;

  -- Calculate goal progress
  SELECT jsonb_build_object(
    'active_goals', COUNT(CASE WHEN is_active THEN 1 END),
    'completed_goals', COUNT(CASE WHEN completed_date IS NOT NULL THEN 1 END),
    'avg_progress_percentage', ROUND(COALESCE(AVG(progress_percentage), 0)::NUMERIC, 1),
    'goals_on_track', COUNT(CASE WHEN progress_percentage >= 50 AND target_date >= CURRENT_DATE THEN 1 END)
  ) INTO goal_progress
  FROM fitness_goals fg
  WHERE fg.user_id = p_user_id;

  -- Combine all progress metrics
  overall_progress := jsonb_build_object(
    'period_start', p_start_date,
    'period_end', p_end_date,
    'strength_progress', strength_progress,
    'volume_progress', volume_progress,
    'consistency_metrics', consistency_metrics,
    'body_composition_progress', body_composition_progress,
    'goal_progress', goal_progress,
    'calculated_at', NOW()
  );

  RETURN overall_progress;
END;
$$ LANGUAGE plpgsql;

-- Function to update goal progress based on recent data
CREATE OR REPLACE FUNCTION update_goal_progress(p_goal_id UUID) RETURNS BOOLEAN AS $$
DECLARE
  goal_record RECORD;
  current_value DECIMAL(10,2);
  progress_pct DECIMAL(5,2);
BEGIN
  -- Get goal details
  SELECT * INTO goal_record FROM fitness_goals WHERE id = p_goal_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Calculate current value based on goal type
  CASE goal_record.goal_type
    WHEN 'strength' THEN
      -- Get latest 1RM for the exercise
      SELECT MAX(calculate_one_rep_max(es.weight_kg, es.reps)) INTO current_value
      FROM exercise_sets es
      JOIN workout_sessions ws ON es.session_id = ws.id
      WHERE ws.user_id = goal_record.user_id
        AND es.exercise_id = goal_record.exercise_id
        AND es.is_warmup = FALSE
        AND es.set_type = 'working'
        AND ws.started_at >= goal_record.start_date
        AND ws.completed_at IS NOT NULL;
    
    WHEN 'weight_loss', 'weight_gain' THEN
      -- Get latest weight measurement
      SELECT weight_kg INTO current_value
      FROM body_measurements
      WHERE user_id = goal_record.user_id
        AND measurement_date >= goal_record.start_date
      ORDER BY measurement_date DESC
      LIMIT 1;
    
    WHEN 'body_composition' THEN
      -- Get latest body composition measurement
      CASE goal_record.measurement_type
        WHEN 'body_fat' THEN
          SELECT body_fat_percentage INTO current_value
          FROM body_measurements
          WHERE user_id = goal_record.user_id
            AND measurement_date >= goal_record.start_date
          ORDER BY measurement_date DESC
          LIMIT 1;
        ELSE
          current_value := goal_record.current_value; -- Keep existing value
      END CASE;
    
    ELSE
      current_value := goal_record.current_value; -- Keep existing value for other goal types
  END CASE;

  -- Calculate progress percentage
  IF goal_record.target_value IS NOT NULL AND current_value IS NOT NULL THEN
    progress_pct := LEAST(100, GREATEST(0, 
      ((current_value - COALESCE(goal_record.current_value, 0)) / 
       (goal_record.target_value - COALESCE(goal_record.current_value, 0))) * 100
    ));
  ELSE
    progress_pct := goal_record.progress_percentage; -- Keep existing progress
  END IF;

  -- Update goal
  UPDATE fitness_goals 
  SET 
    current_value = COALESCE(current_value, goal_record.current_value),
    progress_percentage = progress_pct,
    last_updated_value = current_value,
    last_updated_date = CURRENT_DATE,
    completed_date = CASE 
      WHEN progress_pct >= 100 AND completed_date IS NULL THEN CURRENT_DATE
      ELSE completed_date
    END,
    updated_at = NOW()
  WHERE id = p_goal_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ACHIEVEMENT CHECKING FUNCTIONS
-- ============================================================================

-- Function to check and award achievements
CREATE OR REPLACE FUNCTION check_user_achievements(p_user_id UUID) RETURNS INTEGER AS $$
DECLARE
  achievement_record RECORD;
  user_data JSONB;
  criteria_met BOOLEAN;
  achievements_awarded INTEGER := 0;
BEGIN
  -- Get user data for achievement checking
  user_data := calculate_user_progress_metrics(p_user_id);

  -- Loop through all active achievements
  FOR achievement_record IN 
    SELECT * FROM achievements WHERE is_active = TRUE
  LOOP
    -- Skip if user already has this achievement
    IF EXISTS (
      SELECT 1 FROM user_achievements 
      WHERE user_id = p_user_id AND achievement_id = achievement_record.id
    ) THEN
      CONTINUE;
    END IF;

    -- Check if criteria are met (simplified example)
    criteria_met := FALSE;
    
    -- Example criteria checking (would be expanded based on actual criteria)
    CASE achievement_record.category
      WHEN 'strength' THEN
        -- Example: "Bench Press 100kg"
        IF (user_data->'strength_progress'->>'max_estimated_1rm')::DECIMAL >= 100 THEN
          criteria_met := TRUE;
        END IF;
      
      WHEN 'consistency' THEN
        -- Example: "Complete 10 workouts in a month"
        IF (user_data->'volume_progress'->>'total_workouts')::INTEGER >= 10 THEN
          criteria_met := TRUE;
        END IF;
      
      WHEN 'volume' THEN
        -- Example: "Lift 10,000kg total volume"
        IF (user_data->'volume_progress'->>'total_volume_kg')::DECIMAL >= 10000 THEN
          criteria_met := TRUE;
        END IF;
    END CASE;

    -- Award achievement if criteria met
    IF criteria_met THEN
      INSERT INTO user_achievements (user_id, achievement_id, progress_value)
      VALUES (p_user_id, achievement_record.id, 
              (user_data->'strength_progress'->>'max_estimated_1rm')::DECIMAL);
      
      achievements_awarded := achievements_awarded + 1;
    END IF;
  END LOOP;

  RETURN achievements_awarded;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Body measurements indexes
CREATE INDEX idx_body_measurements_user_date ON body_measurements(user_id, measurement_date DESC);
CREATE INDEX idx_body_measurements_weight ON body_measurements(user_id, weight_kg, measurement_date) WHERE weight_kg IS NOT NULL;

-- Strength standards indexes
CREATE INDEX idx_strength_standards_exercise_gender ON strength_standards(exercise_id, gender, experience_level);
CREATE INDEX idx_strength_standards_bodyweight ON strength_standards(exercise_id, bodyweight_kg_min, bodyweight_kg_max);

-- User benchmarks indexes
CREATE INDEX idx_user_benchmarks_user_exercise ON user_strength_benchmarks(user_id, exercise_id, benchmark_date DESC);
CREATE INDEX idx_user_benchmarks_strength_level ON user_strength_benchmarks(strength_level, wilks_score DESC);

-- Goals indexes
CREATE INDEX idx_fitness_goals_user_active ON fitness_goals(user_id, is_active, target_date) WHERE is_active = TRUE;
CREATE INDEX idx_fitness_goals_type_priority ON fitness_goals(goal_type, priority, target_date);
CREATE INDEX idx_fitness_goals_progress ON fitness_goals(progress_percentage DESC, target_date);

-- Milestones indexes
CREATE INDEX idx_goal_milestones_goal_target ON goal_milestones(goal_id, target_date, is_achieved);

-- Progress metrics indexes
CREATE INDEX idx_progress_metrics_user_date ON progress_metrics(user_id, metric_date DESC, metric_type);
CREATE INDEX idx_progress_metrics_type_value ON progress_metrics(metric_type, primary_value DESC, metric_date);

-- Achievements indexes
CREATE INDEX idx_achievements_category_rarity ON achievements(category, rarity, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_user_achievements_user_date ON user_achievements(user_id, earned_date DESC);
CREATE INDEX idx_user_achievements_featured ON user_achievements(user_id, is_featured) WHERE is_featured = TRUE;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE strength_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_strength_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitness_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_comparison_groups ENABLE ROW LEVEL SECURITY;

-- Body measurements policies
CREATE POLICY "Users can view own measurements" ON body_measurements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own measurements" ON body_measurements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own measurements" ON body_measurements
  FOR UPDATE USING (auth.uid() = user_id);

-- Strength standards policies (public read)
CREATE POLICY "Anyone can view strength standards" ON strength_standards
  FOR SELECT USING (true);

-- User benchmarks policies
CREATE POLICY "Users can view own benchmarks" ON user_strength_benchmarks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own benchmarks" ON user_strength_benchmarks
  FOR ALL USING (auth.uid() = user_id);

-- Goals policies
CREATE POLICY "Users can view own goals" ON fitness_goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own goals" ON fitness_goals
  FOR ALL USING (auth.uid() = user_id);

-- Goal milestones policies
CREATE POLICY "Users can view own goal milestones" ON goal_milestones
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fitness_goals fg 
      WHERE fg.id = goal_milestones.goal_id 
      AND fg.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own goal milestones" ON goal_milestones
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM fitness_goals fg 
      WHERE fg.id = goal_milestones.goal_id 
      AND fg.user_id = auth.uid()
    )
  );

-- Progress metrics policies
CREATE POLICY "Users can view own progress metrics" ON progress_metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert progress metrics" ON progress_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Achievements policies (public read for definitions)
CREATE POLICY "Anyone can view achievements" ON achievements
  FOR SELECT USING (is_active = TRUE);

-- User achievements policies
CREATE POLICY "Users can view own achievements" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements" ON user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Performance comparison groups policies (public read)
CREATE POLICY "Anyone can view comparison groups" ON performance_comparison_groups
  FOR SELECT USING (is_active = TRUE);

-- ============================================================================
-- AUTOMATED MAINTENANCE AND UPDATES
-- ============================================================================

-- Refresh performance rankings daily
-- Only schedule if pg_cron extension is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('refresh-performance-rankings', '0 7 * * *', 'REFRESH MATERIALIZED VIEW user_performance_rankings;');
  END IF;
END $$;

-- Update goal progress daily
-- Only schedule if pg_cron extension is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('update-goal-progress', '0 8 * * *', 
      'SELECT update_goal_progress(id) FROM fitness_goals WHERE is_active = TRUE;');
  END IF;
END $$;

-- Check achievements weekly
-- Only schedule if pg_cron extension is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('check-achievements', '0 9 * * 1', 
      'SELECT check_user_achievements(id) FROM user_profiles;');
  END IF;
END $$;

-- Clean up old progress metrics (keep 2 years)
-- Only schedule if pg_cron extension is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('cleanup-progress-metrics', '0 2 * * 0', 
      'DELETE FROM progress_metrics WHERE created_at < NOW() - INTERVAL ''2 years'';');
  END IF;
END $$;

-- ============================================================================
-- UTILITY VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for user progress dashboard
CREATE VIEW user_progress_dashboard AS
SELECT 
  up.id as user_id,
  up.display_name,
  up.experience_level,
  
  -- Recent body measurements
  bm.weight_kg as current_weight,
  bm.body_fat_percentage as current_body_fat,
  bm.measurement_date as last_measurement_date,
  
  -- Active goals summary
  fg_summary.active_goals,
  fg_summary.avg_progress,
  fg_summary.goals_completed_this_month,
  
  -- Recent achievements
  ua_summary.total_achievements,
  ua_summary.recent_achievements,
  
  -- Performance ranking
  upr.overall_performance_score,
  upr.strength_percentile,
  upr.volume_percentile,
  
  -- Workout consistency (last 30 days)
  ws_summary.workouts_last_30_days,
  ws_summary.avg_quality_score

FROM user_profiles up

-- Latest body measurements
LEFT JOIN LATERAL (
  SELECT * FROM body_measurements 
  WHERE user_id = up.id 
  ORDER BY measurement_date DESC 
  LIMIT 1
) bm ON true

-- Goals summary
LEFT JOIN LATERAL (
  SELECT 
    COUNT(CASE WHEN is_active THEN 1 END) as active_goals,
    ROUND(AVG(CASE WHEN is_active THEN progress_percentage END), 1) as avg_progress,
    COUNT(CASE WHEN completed_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as goals_completed_this_month
  FROM fitness_goals 
  WHERE user_id = up.id
) fg_summary ON true

-- Achievements summary
LEFT JOIN LATERAL (
  SELECT 
    COUNT(*) as total_achievements,
    COUNT(CASE WHEN earned_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as recent_achievements
  FROM user_achievements 
  WHERE user_id = up.id
) ua_summary ON true

-- Performance rankings
LEFT JOIN user_performance_rankings upr ON up.id = upr.user_id

-- Workout summary (last 30 days)
LEFT JOIN LATERAL (
  SELECT 
    COUNT(*) as workouts_last_30_days,
    ROUND(AVG(workout_quality_score), 1) as avg_quality_score
  FROM workout_sessions 
  WHERE user_id = up.id 
    AND started_at >= CURRENT_DATE - INTERVAL '30 days'
    AND completed_at IS NOT NULL
) ws_summary ON true;

-- View for strength progression trends
CREATE VIEW strength_progression_trends AS
SELECT 
  up.id as user_id,
  up.display_name,
  e.name as exercise_name,
  e.primary_muscle,
  
  -- Current strength metrics
  current_stats.current_1rm,
  current_stats.current_volume,
  current_stats.sessions_count,
  
  -- 3-month progression
  COALESCE(current_stats.current_1rm - three_month_stats.avg_1rm, 0) as strength_gain_3m,
  CASE 
    WHEN three_month_stats.avg_1rm > 0 THEN 
      ROUND(((current_stats.current_1rm - three_month_stats.avg_1rm) / three_month_stats.avg_1rm * 100)::NUMERIC, 2)
    ELSE NULL
  END as strength_gain_percentage_3m,
  
  -- 6-month progression
  COALESCE(current_stats.current_1rm - six_month_stats.avg_1rm, 0) as strength_gain_6m,
  CASE 
    WHEN six_month_stats.avg_1rm > 0 THEN 
      ROUND(((current_stats.current_1rm - six_month_stats.avg_1rm) / six_month_stats.avg_1rm * 100)::NUMERIC, 2)
    ELSE NULL
  END as strength_gain_percentage_6m,
  
  -- Trend analysis
  CASE 
    WHEN current_stats.current_1rm > COALESCE(three_month_stats.avg_1rm, 0) THEN 'improving'
    WHEN current_stats.current_1rm < COALESCE(three_month_stats.avg_1rm, 0) THEN 'declining'
    ELSE 'stable'
  END as trend_direction

FROM user_profiles up
CROSS JOIN exercises e

-- Current strength stats (last 30 days)
LEFT JOIN LATERAL (
  SELECT 
    MAX(calculate_one_rep_max(es.weight_kg, es.reps)) as current_1rm,
    SUM(es.weight_kg * es.reps) as current_volume,
    COUNT(DISTINCT ws.id) as sessions_count
  FROM exercise_sets es
  JOIN workout_sessions ws ON es.session_id = ws.id
  WHERE ws.user_id = up.id
    AND es.exercise_id = e.id
    AND es.is_warmup = FALSE
    AND es.set_type = 'working'
    AND ws.started_at >= CURRENT_DATE - INTERVAL '30 days'
    AND ws.completed_at IS NOT NULL
) current_stats ON true

-- 3-month historical stats
LEFT JOIN LATERAL (
  SELECT 
    AVG(calculate_one_rep_max(es.weight_kg, es.reps)) as avg_1rm
  FROM exercise_sets es
  JOIN workout_sessions ws ON es.session_id = ws.id
  WHERE ws.user_id = up.id
    AND es.exercise_id = e.id
    AND es.is_warmup = FALSE
    AND es.set_type = 'working'
    AND ws.started_at BETWEEN CURRENT_DATE - INTERVAL '4 months' AND CURRENT_DATE - INTERVAL '3 months'
    AND ws.completed_at IS NOT NULL
) three_month_stats ON true

-- 6-month historical stats
LEFT JOIN LATERAL (
  SELECT 
    AVG(calculate_one_rep_max(es.weight_kg, es.reps)) as avg_1rm
  FROM exercise_sets es
  JOIN workout_sessions ws ON es.session_id = ws.id
  WHERE ws.user_id = up.id
    AND es.exercise_id = e.id
    AND es.is_warmup = FALSE
    AND es.set_type = 'working'
    AND ws.started_at BETWEEN CURRENT_DATE - INTERVAL '7 months' AND CURRENT_DATE - INTERVAL '6 months'
    AND ws.completed_at IS NOT NULL
) six_month_stats ON true

WHERE current_stats.current_1rm IS NOT NULL;

-- ============================================================================
-- SAMPLE ACHIEVEMENT DATA
-- ============================================================================

-- Insert sample achievements
INSERT INTO achievements (name, description, category, criteria, points, rarity, icon_name, badge_color) VALUES
('First Workout', 'Complete your first workout', 'milestone', '{"workouts_completed": 1}', 10, 'common', 'trophy', '#bronze'),
('Consistency Champion', 'Complete 10 workouts in 30 days', 'consistency', '{"workouts_in_30_days": 10}', 50, 'uncommon', 'calendar-check', '#silver'),
('Strength Milestone', 'Achieve 100kg total in any exercise', 'strength', '{"max_1rm": 100}', 100, 'rare', 'dumbbell', '#gold'),
('Volume Warrior', 'Lift 10,000kg total volume in a month', 'volume', '{"monthly_volume_kg": 10000}', 75, 'uncommon', 'weight', '#silver'),
('Perfect Form', 'Complete 50 sets with 5-star technique rating', 'special', '{"perfect_technique_sets": 50}', 150, 'epic', 'star', '#purple'),
('Goal Crusher', 'Complete 5 fitness goals', 'milestone', '{"goals_completed": 5}', 200, 'rare', 'target', '#gold'),
('Dedication', 'Maintain a 30-day workout streak', 'consistency', '{"workout_streak_days": 30}', 300, 'epic', 'fire', '#purple'),
('Beast Mode', 'Achieve 200kg total in any exercise', 'strength', '{"max_1rm": 200}', 500, 'legendary', 'crown', '#diamond');

-- Insert sample strength standards (simplified examples)
INSERT INTO strength_standards (exercise_id, gender, bodyweight_kg_min, bodyweight_kg_max, experience_level, standard_1rm_kg, percentile, data_source) 
SELECT 
  e.id,
  'male'::gender_enum,
  70.0,
  80.0,
  'beginner'::experience_level_enum,
  CASE 
    WHEN e.name = 'Back Squat' THEN 80.0
    WHEN e.name = 'Barbell Bench Press' THEN 70.0
    WHEN e.name = 'Deadlift' THEN 100.0
    WHEN e.name = 'Overhead Press' THEN 45.0
    ELSE 50.0
  END,
  50,
  'internal'
FROM exercises e 
WHERE e.name IN ('Back Squat', 'Barbell Bench Press', 'Deadlift', 'Overhead Press')
LIMIT 20; -- Prevent too many inserts

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE body_measurements IS 'Comprehensive body composition and circumference measurements';
COMMENT ON TABLE strength_standards IS 'Strength standards for benchmarking user performance';
COMMENT ON TABLE user_strength_benchmarks IS 'User-specific strength benchmarks and testing results';
COMMENT ON TABLE fitness_goals IS 'User fitness goals with progress tracking and milestone management';
COMMENT ON TABLE goal_milestones IS 'Intermediate milestones and checkpoints for fitness goals';
COMMENT ON TABLE progress_metrics IS 'Comprehensive progress metrics and analytics data';
COMMENT ON TABLE achievements IS 'Achievement definitions with criteria and visual representation';
COMMENT ON TABLE user_achievements IS 'User-earned achievements with context and featured status';

COMMENT ON FUNCTION calculate_user_progress_metrics IS 'Comprehensive progress calculation across all fitness metrics';
COMMENT ON FUNCTION update_goal_progress IS 'Automated goal progress updates based on recent workout data';
COMMENT ON FUNCTION check_user_achievements IS 'Achievement checking and awarding system';

COMMENT ON MATERIALIZED VIEW user_performance_rankings IS 'User performance rankings and percentile comparisons';
COMMENT ON VIEW user_progress_dashboard IS 'Comprehensive user progress dashboard data';
COMMENT ON VIEW strength_progression_trends IS 'Strength progression trends and analysis over time';
