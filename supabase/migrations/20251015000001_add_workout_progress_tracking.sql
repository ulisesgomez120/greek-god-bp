-- Migration: Add user_workout_progress table, add phase_repetitions to workout_plan_sessions, drop deprecated week_number
-- Timestamp: 2025-10-15

-- 1) Create user_workout_progress table to track per-user program progress
CREATE TABLE IF NOT EXISTS public.user_workout_progress (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.workout_plans(id) ON DELETE CASCADE,
  current_phase_number integer NOT NULL DEFAULT 1 CHECK (current_phase_number > 0),
  current_repetition integer NOT NULL DEFAULT 1 CHECK (current_repetition > 0),
  current_day_number integer NOT NULL DEFAULT 1 CHECK (current_day_number > 0),
  last_completed_session_id uuid NULL REFERENCES public.workout_plan_sessions(id),
  last_workout_session_id uuid NULL REFERENCES public.workout_sessions(id),
  completed_at timestamp with time zone NULL,
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_workout_progress_user_plan_unique UNIQUE (user_id, plan_id)
);

-- 2) Add phase_repetitions to workout_plan_sessions to support variable repetitions per phase
ALTER TABLE public.workout_plan_sessions
  ADD COLUMN IF NOT EXISTS phase_repetitions integer NOT NULL DEFAULT 4 CHECK (phase_repetitions > 0);

-- 3) Drop deprecated week_number column if present
ALTER TABLE public.workout_plan_sessions
  DROP COLUMN IF EXISTS week_number;

-- 4) Create index for fast lookup by user & plan
CREATE INDEX IF NOT EXISTS idx_user_workout_progress_user_plan ON public.user_workout_progress(user_id, plan_id);

-- 5) Documentation comments
COMMENT ON TABLE public.user_workout_progress IS 'Tracks a user''s current position within a workout plan (phase, repetition, and day).';
COMMENT ON COLUMN public.workout_plan_sessions.phase_repetitions IS 'Number of repetitions (cycles/weeks) recommended for the phase that this session belongs to.';

-- Notes:
-- - This migration intentionally keeps a default of 4 for phase_repetitions to match legacy behavior for existing rows.
-- - After deployment, consider running a one-off backfill to set phase_repetitions per-phase if different values are desired.
