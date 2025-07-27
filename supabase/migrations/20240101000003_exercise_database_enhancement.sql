-- ============================================================================
-- EXERCISE DATABASE ENHANCEMENT WITH FULL-TEXT SEARCH
-- ============================================================================
-- This migration enhances the exercise database with PostgreSQL full-text search,
-- autocomplete functionality, and advanced exercise categorization
-- Version: 20240101000003
-- Description: Full-text search, exercise variations, and search optimization

-- Enable necessary extensions for full-text search
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- ENHANCED EXERCISE CATEGORIZATION
-- ============================================================================

-- Add movement patterns for better exercise classification
CREATE TYPE movement_pattern_enum AS ENUM (
  'squat',
  'hinge',
  'lunge',
  'push',
  'pull',
  'carry',
  'rotation',
  'gait'
);

-- Add exercise complexity levels
CREATE TYPE complexity_enum AS ENUM (
  'basic',
  'intermediate', 
  'advanced',
  'expert'
);

-- Add exercise variations and relationships
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS movement_pattern movement_pattern_enum;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS complexity complexity_enum DEFAULT 'basic';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS parent_exercise_id UUID REFERENCES exercises(id);
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS variation_type TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS form_cues TEXT[] DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS common_mistakes TEXT[] DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS progression_exercises UUID[] DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS regression_exercises UUID[] DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS search_terms TEXT[] DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS popularity_score INTEGER DEFAULT 0;

-- ============================================================================
-- FULL-TEXT SEARCH IMPLEMENTATION
-- ============================================================================

-- Create custom text search configuration for fitness terms
CREATE TEXT SEARCH CONFIGURATION fitness_search (COPY = english);

-- Add fitness-specific dictionary for better search results
CREATE TEXT SEARCH DICTIONARY fitness_dict (
    TEMPLATE = simple,
    STOPWORDS = fitness_stopwords
);

-- Create stopwords file content (common fitness terms that shouldn't be ignored)
CREATE TABLE fitness_stopwords AS
SELECT unnest(ARRAY[
  'rep', 'reps', 'set', 'sets', 'weight', 'kg', 'lb', 'lbs',
  'muscle', 'muscles', 'exercise', 'workout', 'training',
  'upper', 'lower', 'body', 'full'
]) as word;

-- Function to generate search vector for exercises
CREATE OR REPLACE FUNCTION generate_exercise_search_vector(
  exercise_name TEXT,
  description TEXT,
  muscle_groups TEXT[],
  equipment TEXT[],
  search_terms TEXT[],
  form_cues TEXT[]
) RETURNS tsvector AS $$
BEGIN
  RETURN to_tsvector('fitness_search',
    COALESCE(exercise_name, '') || ' ' ||
    COALESCE(description, '') || ' ' ||
    COALESCE(array_to_string(muscle_groups, ' '), '') || ' ' ||
    COALESCE(array_to_string(equipment, ' '), '') || ' ' ||
    COALESCE(array_to_string(search_terms, ' '), '') || ' ' ||
    COALESCE(array_to_string(form_cues, ' '), '')
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_exercise_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := generate_exercise_search_vector(
    NEW.name,
    NEW.description,
    NEW.muscle_groups::TEXT[],
    NEW.equipment::TEXT[],
    NEW.search_terms,
    NEW.form_cues
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search vector
CREATE TRIGGER update_exercise_search_vector_trigger
  BEFORE INSERT OR UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION update_exercise_search_vector();

-- Update existing exercises with search vectors
UPDATE exercises SET search_vector = generate_exercise_search_vector(
  name,
  description,
  muscle_groups::TEXT[],
  equipment::TEXT[],
  search_terms,
  form_cues
);

-- ============================================================================
-- SEARCH FUNCTIONS AND PROCEDURES
-- ============================================================================

-- Advanced exercise search function with ranking
CREATE OR REPLACE FUNCTION search_exercises(
  search_query TEXT,
  muscle_group_filter muscle_group_enum[] DEFAULT NULL,
  equipment_filter equipment_enum[] DEFAULT NULL,
  difficulty_filter INTEGER[] DEFAULT NULL,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
) RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  muscle_groups muscle_group_enum[],
  primary_muscle muscle_group_enum,
  equipment equipment_enum[],
  difficulty INTEGER,
  is_compound BOOLEAN,
  movement_pattern movement_pattern_enum,
  complexity complexity_enum,
  search_rank REAL,
  popularity_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.description,
    e.muscle_groups,
    e.primary_muscle,
    e.equipment,
    e.difficulty,
    e.is_compound,
    e.movement_pattern,
    e.complexity,
    ts_rank_cd(e.search_vector, plainto_tsquery('fitness_search', search_query)) as search_rank,
    e.popularity_score
  FROM exercises e
  WHERE 
    (search_query IS NULL OR search_query = '' OR e.search_vector @@ plainto_tsquery('fitness_search', search_query))
    AND (muscle_group_filter IS NULL OR e.muscle_groups && muscle_group_filter)
    AND (equipment_filter IS NULL OR e.equipment && equipment_filter)
    AND (difficulty_filter IS NULL OR e.difficulty = ANY(difficulty_filter))
  ORDER BY 
    CASE WHEN search_query IS NOT NULL AND search_query != '' 
         THEN ts_rank_cd(e.search_vector, plainto_tsquery('fitness_search', search_query)) 
         ELSE 0 END DESC,
    e.popularity_score DESC,
    e.name ASC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Autocomplete function for exercise names
CREATE OR REPLACE FUNCTION autocomplete_exercises(
  partial_name TEXT,
  limit_count INTEGER DEFAULT 10
) RETURNS TABLE (
  id UUID,
  name TEXT,
  primary_muscle muscle_group_enum,
  popularity_score INTEGER,
  similarity REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.primary_muscle,
    e.popularity_score,
    similarity(e.name, partial_name) as similarity
  FROM exercises e
  WHERE 
    e.name ILIKE partial_name || '%'
    OR similarity(e.name, partial_name) > 0.3
    OR EXISTS (
      SELECT 1 FROM unnest(e.search_terms) as term 
      WHERE term ILIKE partial_name || '%'
    )
  ORDER BY 
    CASE WHEN e.name ILIKE partial_name || '%' THEN 1 ELSE 2 END,
    similarity(e.name, partial_name) DESC,
    e.popularity_score DESC,
    e.name ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get exercise variations and alternatives
CREATE OR REPLACE FUNCTION get_exercise_variations(
  exercise_id UUID
) RETURNS TABLE (
  id UUID,
  name TEXT,
  variation_type TEXT,
  difficulty INTEGER,
  complexity complexity_enum,
  relationship_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  -- Direct variations (children)
  SELECT 
    e.id,
    e.name,
    e.variation_type,
    e.difficulty,
    e.complexity,
    'variation'::TEXT as relationship_type
  FROM exercises e
  WHERE e.parent_exercise_id = exercise_id
  
  UNION ALL
  
  -- Progressions
  SELECT 
    e.id,
    e.name,
    e.variation_type,
    e.difficulty,
    e.complexity,
    'progression'::TEXT as relationship_type
  FROM exercises e, exercises base
  WHERE base.id = exercise_id
    AND e.id = ANY(base.progression_exercises)
  
  UNION ALL
  
  -- Regressions
  SELECT 
    e.id,
    e.name,
    e.variation_type,
    e.difficulty,
    e.complexity,
    'regression'::TEXT as relationship_type
  FROM exercises e, exercises base
  WHERE base.id = exercise_id
    AND e.id = ANY(base.regression_exercises)
  
  UNION ALL
  
  -- Alternatives (same muscle group, similar difficulty)
  SELECT 
    e.id,
    e.name,
    e.variation_type,
    e.difficulty,
    e.complexity,
    'alternative'::TEXT as relationship_type
  FROM exercises e, exercises base
  WHERE base.id = exercise_id
    AND e.id != exercise_id
    AND e.primary_muscle = base.primary_muscle
    AND ABS(e.difficulty - base.difficulty) <= 1
    AND e.movement_pattern = base.movement_pattern
  
  ORDER BY relationship_type, difficulty, name
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- EXERCISE ANALYTICS AND POPULARITY TRACKING
-- ============================================================================

-- Function to update exercise popularity based on usage
CREATE OR REPLACE FUNCTION update_exercise_popularity()
RETURNS void AS $$
BEGIN
  UPDATE exercises 
  SET popularity_score = subquery.usage_count
  FROM (
    SELECT 
      es.exercise_id,
      COUNT(DISTINCT es.session_id) as usage_count
    FROM exercise_sets es
    JOIN workout_sessions ws ON es.session_id = ws.id
    WHERE ws.created_at >= NOW() - INTERVAL '30 days'
      AND es.is_warmup = FALSE
    GROUP BY es.exercise_id
  ) as subquery
  WHERE exercises.id = subquery.exercise_id;
END;
$$ LANGUAGE plpgsql;

-- Schedule popularity updates (requires pg_cron extension)
SELECT cron.schedule('update-exercise-popularity', '0 4 * * *', 'SELECT update_exercise_popularity();');

-- ============================================================================
-- PERFORMANCE INDEXES FOR SEARCH
-- ============================================================================

-- GIN indexes for full-text search
CREATE INDEX CONCURRENTLY idx_exercises_search_vector ON exercises USING GIN(search_vector);
CREATE INDEX CONCURRENTLY idx_exercises_muscle_groups_gin ON exercises USING GIN(muscle_groups);
CREATE INDEX CONCURRENTLY idx_exercises_equipment_gin ON exercises USING GIN(equipment);
CREATE INDEX CONCURRENTLY idx_exercises_search_terms_gin ON exercises USING GIN(search_terms);

-- Trigram indexes for autocomplete
CREATE INDEX CONCURRENTLY idx_exercises_name_trgm ON exercises USING GIN(name gin_trgm_ops);

-- Composite indexes for filtered searches
CREATE INDEX CONCURRENTLY idx_exercises_muscle_difficulty ON exercises(primary_muscle, difficulty);
CREATE INDEX CONCURRENTLY idx_exercises_compound_difficulty ON exercises(is_compound, difficulty) WHERE is_compound = TRUE;
CREATE INDEX CONCURRENTLY idx_exercises_movement_pattern ON exercises(movement_pattern, complexity);

-- Popularity and ranking indexes
CREATE INDEX CONCURRENTLY idx_exercises_popularity ON exercises(popularity_score DESC, name);
CREATE INDEX CONCURRENTLY idx_exercises_parent_child ON exercises(parent_exercise_id) WHERE parent_exercise_id IS NOT NULL;

-- Partial indexes for common queries
CREATE INDEX CONCURRENTLY idx_exercises_beginner ON exercises(name, difficulty) WHERE difficulty <= 2;
CREATE INDEX CONCURRENTLY idx_exercises_compound ON exercises(name, primary_muscle) WHERE is_compound = TRUE;

-- ============================================================================
-- EXERCISE RECOMMENDATION SYSTEM
-- ============================================================================

-- Function to recommend exercises based on user history and preferences
CREATE OR REPLACE FUNCTION recommend_exercises(
  user_id UUID,
  target_muscle_groups muscle_group_enum[] DEFAULT NULL,
  exclude_recent_days INTEGER DEFAULT 7,
  limit_count INTEGER DEFAULT 10
) RETURNS TABLE (
  id UUID,
  name TEXT,
  primary_muscle muscle_group_enum,
  difficulty INTEGER,
  recommendation_score REAL,
  reason TEXT
) AS $$
DECLARE
  user_experience experience_level_enum;
  user_equipment TEXT[];
BEGIN
  -- Get user profile information
  SELECT experience_level, available_equipment 
  INTO user_experience, user_equipment
  FROM user_profiles 
  WHERE user_profiles.id = user_id;

  RETURN QUERY
  WITH user_recent_exercises AS (
    SELECT DISTINCT es.exercise_id
    FROM exercise_sets es
    JOIN workout_sessions ws ON es.session_id = ws.id
    WHERE ws.user_id = recommend_exercises.user_id
      AND ws.started_at >= NOW() - INTERVAL '1 day' * exclude_recent_days
  ),
  user_exercise_frequency AS (
    SELECT 
      es.exercise_id,
      COUNT(*) as frequency,
      AVG(es.rpe) as avg_rpe,
      MAX(ws.started_at) as last_performed
    FROM exercise_sets es
    JOIN workout_sessions ws ON es.session_id = ws.id
    WHERE ws.user_id = recommend_exercises.user_id
      AND es.is_warmup = FALSE
    GROUP BY es.exercise_id
  )
  SELECT 
    e.id,
    e.name,
    e.primary_muscle,
    e.difficulty,
    (
      -- Base popularity score
      (e.popularity_score / 100.0) * 0.3 +
      -- Experience level match
      CASE 
        WHEN user_experience = 'untrained' AND e.difficulty <= 2 THEN 0.4
        WHEN user_experience = 'beginner' AND e.difficulty <= 3 THEN 0.4
        WHEN user_experience = 'early_intermediate' AND e.difficulty <= 4 THEN 0.4
        WHEN user_experience = 'intermediate' THEN 0.4
        ELSE 0.1
      END +
      -- Equipment availability
      CASE 
        WHEN user_equipment IS NULL OR e.equipment <@ user_equipment::equipment_enum[] THEN 0.2
        ELSE 0.0
      END +
      -- Muscle group targeting
      CASE 
        WHEN target_muscle_groups IS NULL OR e.muscle_groups && target_muscle_groups THEN 0.1
        ELSE 0.0
      END
    ) as recommendation_score,
    CASE 
      WHEN ure.exercise_id IS NOT NULL THEN 'Recently performed'
      WHEN uef.frequency > 10 THEN 'Frequently performed'
      WHEN e.is_compound THEN 'Compound movement'
      WHEN e.popularity_score > 50 THEN 'Popular exercise'
      ELSE 'Good match for your level'
    END as reason
  FROM exercises e
  LEFT JOIN user_recent_exercises ure ON e.id = ure.exercise_id
  LEFT JOIN user_exercise_frequency uef ON e.id = uef.exercise_id
  WHERE 
    -- Exclude recently performed exercises
    ure.exercise_id IS NULL
    -- Match target muscle groups if specified
    AND (target_muscle_groups IS NULL OR e.muscle_groups && target_muscle_groups)
    -- Match user equipment if specified
    AND (user_equipment IS NULL OR e.equipment <@ user_equipment::equipment_enum[])
    -- Match experience level
    AND (
      (user_experience = 'untrained' AND e.difficulty <= 2) OR
      (user_experience = 'beginner' AND e.difficulty <= 3) OR
      (user_experience = 'early_intermediate' AND e.difficulty <= 4) OR
      (user_experience IN ('intermediate', 'advanced'))
    )
  ORDER BY recommendation_score DESC, e.popularity_score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- EXERCISE FORM AND SAFETY SYSTEM
-- ============================================================================

-- Table for exercise form checkpoints and safety notes
CREATE TABLE exercise_form_checkpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  checkpoint_order INTEGER NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('setup', 'eccentric', 'bottom', 'concentric', 'top')),
  description TEXT NOT NULL,
  safety_critical BOOLEAN DEFAULT FALSE,
  common_error TEXT,
  correction_cue TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for exercise contraindications and modifications
CREATE TABLE exercise_contraindications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  condition_type TEXT NOT NULL, -- 'injury', 'limitation', 'equipment'
  condition_description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('caution', 'avoid', 'modify')),
  modification_suggestion TEXT,
  alternative_exercise_id UUID REFERENCES exercises(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for form and safety tables
CREATE INDEX idx_form_checkpoints_exercise ON exercise_form_checkpoints(exercise_id, checkpoint_order);
CREATE INDEX idx_contraindications_exercise ON exercise_contraindications(exercise_id, severity);

-- ============================================================================
-- SEARCH ANALYTICS AND OPTIMIZATION
-- ============================================================================

-- Table to track search queries for optimization
CREATE TABLE exercise_search_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id),
  search_query TEXT NOT NULL,
  search_filters JSONB,
  results_count INTEGER NOT NULL,
  selected_exercise_id UUID REFERENCES exercises(id),
  search_duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to log search analytics
CREATE OR REPLACE FUNCTION log_exercise_search(
  p_user_id UUID,
  p_search_query TEXT,
  p_search_filters JSONB,
  p_results_count INTEGER,
  p_selected_exercise_id UUID DEFAULT NULL,
  p_search_duration_ms INTEGER DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO exercise_search_analytics (
    user_id, search_query, search_filters, results_count, 
    selected_exercise_id, search_duration_ms
  ) VALUES (
    p_user_id, p_search_query, p_search_filters, p_results_count,
    p_selected_exercise_id, p_search_duration_ms
  );
END;
$$ LANGUAGE plpgsql;

-- Index for search analytics
CREATE INDEX idx_search_analytics_query ON exercise_search_analytics(search_query, created_at);
CREATE INDEX idx_search_analytics_user ON exercise_search_analytics(user_id, created_at);

-- ============================================================================
-- ROW LEVEL SECURITY FOR NEW TABLES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE exercise_form_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_contraindications ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_search_analytics ENABLE ROW LEVEL SECURITY;

-- Public read access for form and safety data
CREATE POLICY "Anyone can view form checkpoints" ON exercise_form_checkpoints
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view contraindications" ON exercise_contraindications
  FOR SELECT USING (true);

-- Users can only view their own search analytics
CREATE POLICY "Users can view own search analytics" ON exercise_search_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own search analytics" ON exercise_search_analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- UTILITY VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for popular exercises by muscle group
CREATE VIEW popular_exercises_by_muscle AS
SELECT 
  primary_muscle,
  name,
  difficulty,
  popularity_score,
  is_compound,
  ROW_NUMBER() OVER (PARTITION BY primary_muscle ORDER BY popularity_score DESC) as rank
FROM exercises
WHERE popularity_score > 0
ORDER BY primary_muscle, popularity_score DESC;

-- View for exercise search with pre-computed rankings
CREATE MATERIALIZED VIEW exercise_search_cache AS
SELECT 
  e.id,
  e.name,
  e.description,
  e.muscle_groups,
  e.primary_muscle,
  e.equipment,
  e.difficulty,
  e.is_compound,
  e.movement_pattern,
  e.complexity,
  e.popularity_score,
  e.search_vector,
  -- Pre-compute common search terms for faster autocomplete
  ARRAY(
    SELECT DISTINCT unnest(
      string_to_array(lower(e.name), ' ') || 
      e.search_terms || 
      e.muscle_groups::TEXT[] ||
      e.equipment::TEXT[]
    )
  ) as all_search_terms
FROM exercises e;

-- Index on materialized view
CREATE UNIQUE INDEX idx_exercise_search_cache_id ON exercise_search_cache(id);
CREATE INDEX idx_exercise_search_cache_terms ON exercise_search_cache USING GIN(all_search_terms);

-- Refresh materialized view daily
SELECT cron.schedule('refresh-exercise-search-cache', '0 5 * * *', 'REFRESH MATERIALIZED VIEW exercise_search_cache;');

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN exercises.search_vector IS 'Full-text search vector for exercise names, descriptions, and metadata';
COMMENT ON COLUMN exercises.movement_pattern IS 'Primary movement pattern classification for exercise programming';
COMMENT ON COLUMN exercises.complexity IS 'Technical complexity level independent of strength requirements';
COMMENT ON COLUMN exercises.popularity_score IS 'Usage-based popularity score updated daily';
COMMENT ON COLUMN exercises.search_terms IS 'Additional search terms and synonyms for better discoverability';

COMMENT ON FUNCTION search_exercises IS 'Advanced exercise search with full-text search and filtering capabilities';
COMMENT ON FUNCTION autocomplete_exercises IS 'Provides autocomplete suggestions for exercise names with similarity matching';
COMMENT ON FUNCTION recommend_exercises IS 'Personalized exercise recommendations based on user profile and history';

COMMENT ON TABLE exercise_form_checkpoints IS 'Detailed form checkpoints for exercise safety and technique';
COMMENT ON TABLE exercise_contraindications IS 'Exercise contraindications and safety modifications';
COMMENT ON TABLE exercise_search_analytics IS 'Search query analytics for improving search functionality';

COMMENT ON MATERIALIZED VIEW exercise_search_cache IS 'Pre-computed exercise search data for improved performance';
