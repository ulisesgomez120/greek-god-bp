-- ============================================================================
-- TRAINSMART DATABASE SCHEMA - INITIAL MIGRATION
-- ============================================================================
-- This migration creates the core database schema for TrainSmart
-- Version: 20240101000001
-- Description: Initial schema with user profiles, workouts, exercises, and auth

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS AND TYPES
-- ============================================================================

-- User experience levels for progression tracking
CREATE TYPE experience_level_enum AS ENUM (
  'untrained',
  'beginner', 
  'early_intermediate',
  'intermediate',
  'advanced'
);

-- Gender options
CREATE TYPE gender_enum AS ENUM (
  'male',
  'female', 
  'other',
  'prefer_not_to_say'
);

-- Muscle groups for exercise categorization
CREATE TYPE muscle_group_enum AS ENUM (
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
  'core'
);

-- Equipment types
CREATE TYPE equipment_enum AS ENUM (
  'barbell',
  'dumbbell',
  'kettlebell',
  'cable',
  'machine',
  'bodyweight',
  'resistance_band',
  'plate'
);

-- Workout plan types
CREATE TYPE plan_type_enum AS ENUM (
  'full_body',
  'upper_lower',
  'body_part_split',
  'custom'
);

-- Sync status for offline functionality
CREATE TYPE sync_status_enum AS ENUM (
  'synced',
  'pending',
  'conflict'
);

-- Subscription status
CREATE TYPE subscription_status_enum AS ENUM (
  'active',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'past_due',
  'trialing',
  'unpaid'
);

-- Subscription intervals
CREATE TYPE subscription_interval_enum AS ENUM (
  'month',
  'year'
);

-- User roles
CREATE TYPE user_role_enum AS ENUM (
  'user',
  'premium',
  'coach',
  'admin'
);

-- ============================================================================
-- USER MANAGEMENT TABLES
-- ============================================================================

-- Extended user profiles (extends Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  height_cm INTEGER CHECK (height_cm > 0 AND height_cm < 300),
  weight_kg DECIMAL(5,2) CHECK (weight_kg > 0 AND weight_kg < 1000),
  birth_date DATE,
  gender gender_enum,
  experience_level experience_level_enum NOT NULL DEFAULT 'untrained',
  fitness_goals TEXT[] DEFAULT '{}',
  available_equipment TEXT[] DEFAULT '{}',
  privacy_settings JSONB DEFAULT '{"data_sharing": false, "analytics": true, "ai_coaching": true}',
  role user_role_enum DEFAULT 'user',
  stripe_customer_id TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- EXERCISE DATABASE
-- ============================================================================

-- Exercise definitions
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  instructions JSONB, -- Step-by-step instructions array
  muscle_groups muscle_group_enum[] NOT NULL,
  primary_muscle muscle_group_enum NOT NULL,
  equipment equipment_enum[] NOT NULL,
  difficulty INTEGER CHECK (difficulty >= 1 AND difficulty <= 5) DEFAULT 2,
  is_compound BOOLEAN DEFAULT FALSE,
  alternatives UUID[], -- References to alternative exercises
  demo_video_url TEXT,
  form_cues TEXT[], -- Array of form cues
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- WORKOUT PLANS AND SESSIONS
-- ============================================================================

-- Workout plans (templates)
CREATE TABLE workout_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  type plan_type_enum NOT NULL,
  frequency_per_week INTEGER CHECK (frequency_per_week >= 1 AND frequency_per_week <= 7),
  duration_weeks INTEGER CHECK (duration_weeks > 0),
  difficulty INTEGER CHECK (difficulty >= 1 AND difficulty <= 5),
  target_experience experience_level_enum[] NOT NULL,
  created_by UUID REFERENCES user_profiles(id),
  is_template BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workout plan sessions (individual workouts within a plan)
CREATE TABLE workout_plan_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  day_number INTEGER NOT NULL CHECK (day_number > 0),
  week_number INTEGER DEFAULT 1 CHECK (week_number > 0),
  estimated_duration_minutes INTEGER CHECK (estimated_duration_minutes > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Planned exercises (exercises within a workout plan session)
CREATE TABLE planned_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES workout_plan_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  order_in_session INTEGER NOT NULL CHECK (order_in_session > 0),
  target_sets INTEGER NOT NULL CHECK (target_sets > 0),
  target_reps_min INTEGER CHECK (target_reps_min > 0),
  target_reps_max INTEGER CHECK (target_reps_max >= target_reps_min),
  target_rpe INTEGER CHECK (target_rpe >= 1 AND target_rpe <= 10),
  rest_seconds INTEGER CHECK (rest_seconds >= 0),
  notes TEXT,
  progression_scheme JSONB, -- Specific progression rules for this exercise
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- USER WORKOUT TRACKING
-- ============================================================================

-- User workout sessions (actual workouts performed)
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES workout_plans(id),
  session_id UUID REFERENCES workout_plan_sessions(id),
  name TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  total_volume_kg DECIMAL(10,2),
  average_rpe DECIMAL(3,1),
  notes TEXT,
  sync_status sync_status_enum DEFAULT 'synced',
  offline_created BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exercise sets (individual sets performed)
CREATE TABLE exercise_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  planned_exercise_id UUID REFERENCES planned_exercises(id),
  set_number INTEGER NOT NULL CHECK (set_number > 0),
  weight_kg DECIMAL(6,2) CHECK (weight_kg >= 0),
  reps INTEGER CHECK (reps >= 0),
  rpe INTEGER CHECK (rpe >= 1 AND rpe <= 10),
  is_warmup BOOLEAN DEFAULT FALSE,
  is_failure BOOLEAN DEFAULT FALSE,
  rest_seconds INTEGER CHECK (rest_seconds >= 0),
  notes TEXT,
  form_rating INTEGER CHECK (form_rating >= 1 AND form_rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- SUBSCRIPTION MANAGEMENT
-- ============================================================================

-- Subscription plans
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  interval subscription_interval_enum NOT NULL,
  stripe_price_id TEXT UNIQUE NOT NULL,
  features JSONB NOT NULL DEFAULT '[]',
  max_ai_queries INTEGER DEFAULT 0, -- -1 for unlimited
  max_custom_workouts INTEGER DEFAULT 0, -- -1 for unlimited
  max_clients INTEGER DEFAULT 0, -- 0 for non-coach plans
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  status subscription_status_enum NOT NULL,
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- User profiles indexes
CREATE INDEX idx_user_profiles_experience ON user_profiles(experience_level);
CREATE INDEX idx_user_profiles_stripe ON user_profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Exercise indexes
CREATE INDEX idx_exercises_muscle_groups ON exercises USING GIN(muscle_groups);
CREATE INDEX idx_exercises_equipment ON exercises USING GIN(equipment);
CREATE INDEX idx_exercises_difficulty ON exercises(difficulty);

-- Workout sessions indexes
CREATE INDEX idx_workout_sessions_user_date ON workout_sessions(user_id, started_at DESC);
CREATE INDEX idx_workout_sessions_plan ON workout_sessions(plan_id) WHERE plan_id IS NOT NULL;
CREATE INDEX idx_workout_sessions_sync_status ON workout_sessions(sync_status) WHERE sync_status != 'synced';

-- Exercise sets indexes
CREATE INDEX idx_exercise_sets_session ON exercise_sets(session_id, set_number);
CREATE INDEX idx_exercise_sets_exercise ON exercise_sets(exercise_id, created_at DESC) WHERE is_warmup = FALSE;
CREATE INDEX idx_exercise_sets_performance ON exercise_sets(exercise_id, weight_kg DESC, reps DESC) WHERE is_warmup = FALSE;

-- Subscription indexes
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Workout sessions policies
CREATE POLICY "Users can view own workout sessions" ON workout_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workout sessions" ON workout_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workout sessions" ON workout_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workout sessions" ON workout_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Exercise sets policies
CREATE POLICY "Users can view own exercise sets" ON exercise_sets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workout_sessions ws 
      WHERE ws.id = exercise_sets.session_id 
      AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own exercise sets" ON exercise_sets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_sessions ws 
      WHERE ws.id = exercise_sets.session_id 
      AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own exercise sets" ON exercise_sets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workout_sessions ws 
      WHERE ws.id = exercise_sets.session_id 
      AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own exercise sets" ON exercise_sets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workout_sessions ws 
      WHERE ws.id = exercise_sets.session_id 
      AND ws.user_id = auth.uid()
    )
  );

-- Subscription policies
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Public read access for exercises and workout plans
CREATE POLICY "Anyone can view exercises" ON exercises
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view public workout plans" ON workout_plans
  FOR SELECT USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "Anyone can view workout plan sessions" ON workout_plan_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workout_plans wp 
      WHERE wp.id = workout_plan_sessions.plan_id 
      AND (wp.is_public = true OR wp.created_by = auth.uid())
    )
  );

CREATE POLICY "Anyone can view planned exercises" ON planned_exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workout_plan_sessions wps
      JOIN workout_plans wp ON wp.id = wps.plan_id
      WHERE wps.id = planned_exercises.session_id 
      AND (wp.is_public = true OR wp.created_by = auth.uid())
    )
  );

-- Public read access for subscription plans
CREATE POLICY "Anyone can view active subscription plans" ON subscription_plans
  FOR SELECT USING (is_active = true);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exercises_updated_at 
  BEFORE UPDATE ON exercises 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workout_plans_updated_at 
  BEFORE UPDATE ON workout_plans 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workout_sessions_updated_at 
  BEFORE UPDATE ON workout_sessions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at 
  BEFORE UPDATE ON subscriptions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to calculate one rep max using Epley formula
CREATE OR REPLACE FUNCTION calculate_one_rep_max(weight DECIMAL, reps INTEGER)
RETURNS DECIMAL AS $$
BEGIN
  IF reps = 1 THEN
    RETURN weight;
  END IF;
  
  -- Epley formula: 1RM = weight * (1 + reps/30)
  RETURN ROUND(weight * (1 + reps::DECIMAL / 30), 2);
END;
$$ LANGUAGE plpgsql;

-- Function to get user's current subscription status
CREATE OR REPLACE FUNCTION get_user_subscription_status(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  sub_status TEXT;
BEGIN
  SELECT status INTO sub_status
  FROM subscriptions
  WHERE user_id = user_uuid
    AND status = 'active'
    AND current_period_end > NOW()
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(sub_status, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has active subscription with specific features
CREATE OR REPLACE FUNCTION user_has_feature_access(user_uuid UUID, required_features TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
  user_features TEXT[];
BEGIN
  SELECT sp.features INTO user_features
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.user_id = user_uuid
    AND s.status = 'active'
    AND s.current_period_end > NOW()
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- If no active subscription, return false
  IF user_features IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if user has all required features
  RETURN user_features @> required_features;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE user_profiles IS 'Extended user profiles with fitness-specific data';
COMMENT ON TABLE exercises IS 'Exercise database with form cues and muscle group targeting';
COMMENT ON TABLE workout_sessions IS 'User workout sessions with offline sync support';
COMMENT ON TABLE exercise_sets IS 'Individual sets performed during workouts with RPE tracking';
COMMENT ON TABLE subscriptions IS 'User subscription management with Stripe integration';

COMMENT ON COLUMN user_profiles.experience_level IS 'User experience level for progression algorithm';
COMMENT ON COLUMN exercise_sets.rpe IS 'Rate of Perceived Exertion (1-10 scale)';
COMMENT ON COLUMN workout_sessions.sync_status IS 'Offline synchronization status';
