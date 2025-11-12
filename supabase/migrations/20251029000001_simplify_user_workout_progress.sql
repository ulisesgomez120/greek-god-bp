-- Migration: simplify user_workout_progress
-- Purpose: remove legacy last_completed_session_id column and reset user_workout_progress table
-- Date: 2025-10-29

BEGIN;

-- Safety: drop the old column if it exists
ALTER TABLE IF EXISTS public.user_workout_progress
  DROP COLUMN IF EXISTS last_completed_session_id;

-- Truncate progress table so we start fresh (safe because no production users are using this feature)
TRUNCATE TABLE public.user_workout_progress RESTART IDENTITY CASCADE;

COMMIT;
