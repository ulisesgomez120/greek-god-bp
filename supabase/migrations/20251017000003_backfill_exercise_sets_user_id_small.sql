-- Migration: backfill exercise_sets.user_id for small tables (~400 rows)
-- Purpose: simple, single-statement backfill suitable for small datasets.
-- Run this after the migration that added the user_id column (20251017000001_add_user_id_to_exercise_sets.sql).
-- NOTE: This is intended for small tables; it performs a single UPDATE and a verification SELECT.

BEGIN;

-- Backfill user_id from workout_sessions for any exercise_sets missing user_id
UPDATE public.exercise_sets es
SET user_id = ws.user_id
FROM public.workout_sessions ws
WHERE es.session_id = ws.id
  AND es.user_id IS NULL;

-- Verification: count any remaining rows missing user_id (expected 0)
SELECT COUNT(*) AS missing_user_id_count FROM public.exercise_sets WHERE user_id IS NULL;

COMMIT;

-- Post-run notes:
-- 1) Inspect the result of the verification SELECT; if missing_user_id_count > 0, investigate rows with NULL session_id or sessions without user_id.
-- 2) After confirming successful backfill, decide whether to:
--    - add a DB trigger to auto-populate user_id on new inserts, or
--    - update application insert paths to include user_id on new records.
-- 3) Once application writes and/or trigger are in place and you are confident all new rows will contain user_id, consider making the column NOT NULL and adding an FK constraint.
