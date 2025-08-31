-- Migration: 20250830000001_backfill_planned_exercise_id_for_sets.sql
-- Purpose: Add index and best-effort backfill of exercise_sets.planned_exercise_id.
-- IMPORTANT: Run in staging first. This migration only updates rows where a single
-- deterministic mapping exists between an exercise_set and a planned_exercise.
-- Ambiguous rows (multiple candidate planned_exercises for the same set) are left NULL.
-- Review the rows returned by the RETURNING clause before applying to production.

BEGIN;

-- 1) Create index to speed up queries that filter by planned_exercise_id
CREATE INDEX IF NOT EXISTS idx_exercise_sets_planned_exercise_id ON public.exercise_sets (planned_exercise_id);

-- 2) Best-effort backfill:
-- Logic:
--  - For each exercise_sets row (es) with NULL planned_exercise_id:
--    * Find planned_exercises (pe) where:
--        pe.session_id = workout_sessions.session_id
--        AND pe.exercise_id = es.exercise_id
--    * Only update es.planned_exercise_id when exactly one matching pe exists
-- This avoids guessing when there are multiple planned exercises in the same session for the same base exercise.

-- Create a CTE of candidate matches (may include >1 per set_id)
WITH candidate_matches AS (
  SELECT
    es.id AS set_id,
    pe.id AS planned_id
  FROM public.exercise_sets es
  JOIN public.workout_sessions ws
    ON ws.id = es.session_id
  JOIN public.planned_exercises pe
    ON pe.session_id = ws.session_id
    AND pe.exercise_id = es.exercise_id
  WHERE es.planned_exercise_id IS NULL
),

-- Keep only those candidate_matches where there is exactly one planned_id for the set_id
unique_matches AS (
  SELECT set_id, planned_id
  FROM (
    SELECT
      set_id,
      planned_id,
      count(*) OVER (PARTITION BY set_id) AS cnt
    FROM candidate_matches
  ) t
  WHERE cnt = 1
),

-- Perform the update for only the unique matches and return rows updated for review
updated AS (
  UPDATE public.exercise_sets es
  SET planned_exercise_id = um.planned_id
  FROM unique_matches um
  WHERE es.id = um.set_id
  RETURNING es.id AS exercise_set_id, es.session_id, es.exercise_id, es.planned_exercise_id
)

SELECT
  'NOTE: updated rows (exercise_set_id, session_id, exercise_id, planned_exercise_id)' AS info;
-- The results of the UPDATE ... RETURNING will be visible to whoever runs this migration
-- so they can inspect how many rows were updated and sample the changes.

COMMIT;

-- ROLLBACK / SAFETY NOTES:
-- Because this update is best-effort, a safe rollback requires knowledge of which rows were updated.
-- Recommended staging validation workflow:
--  1) Run this migration in staging and capture the rows returned by the RETURNING clause.
--  2) Validate a sample of updated rows against session and planned_exercises to ensure correctness.
--  3) If you must rollback in staging, run:
--       BEGIN;
--       UPDATE public.exercise_sets
--       SET planned_exercise_id = NULL
--       WHERE id IN (<list of exercise_set_ids returned by this migration>);
--       COMMIT;
--  4) Only after manual validation in staging should this migration be applied to production.
--  5) In production, capture the RETURNING rows to a safe backup (or export) before committing.
--  6) Do NOT attempt to force-match ambiguous rows; leave NULL to preserve correctness.

-- Additional optional heuristics (NOT applied by default):
--  - Use ordering fields (pe.order_in_session) vs set_number to attempt a match,
--    but only if the mapping is 1:1 and ordering is consistent. This increases risk,
--    so it's intentionally omitted from the automated update.

-- End of migration
