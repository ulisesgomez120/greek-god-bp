-- Add an index to speed up history/progression queries scoped by planned_exercise_id
-- Created: 2025-08-26
-- Purpose: improve performance for queries that filter by planned_exercise_id, exercise_id, and created_at DESC
CREATE INDEX IF NOT EXISTS idx_exercise_sets_planned_exercise
  ON exercise_sets (planned_exercise_id, exercise_id, created_at DESC)
  WHERE is_warmup = FALSE;
