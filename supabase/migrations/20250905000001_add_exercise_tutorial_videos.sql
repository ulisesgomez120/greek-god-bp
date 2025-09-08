-- Migration: add exercise_tutorial_videos table
-- Created: 2025-09-05
-- Purpose: Store YouTube tutorial links for exercises. RLS: SELECT for authenticated users; INSERT/UPDATE/DELETE restricted to admins.

BEGIN;

-- Create table
CREATE TABLE IF NOT EXISTS public.exercise_tutorial_videos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  created_by uuid NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for lookups by exercise
CREATE INDEX IF NOT EXISTS idx_exercise_tutorial_videos_exercise_id ON public.exercise_tutorial_videos (exercise_id);



-- Enable Row Level Security
ALTER TABLE public.exercise_tutorial_videos ENABLE ROW LEVEL SECURITY;

-- Policy: allow authenticated users to SELECT
CREATE POLICY "Authenticated users can select exercise tutorial videos"
  ON public.exercise_tutorial_videos
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Policy: allow admins to INSERT/UPDATE/DELETE
CREATE POLICY "Admins manage exercise tutorial videos"
  ON public.exercise_tutorial_videos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'admin'
    )
  );

COMMENT ON TABLE public.exercise_tutorial_videos IS 'Exercise tutorial videos for mapping YouTube tutorials to exercises. Readable by authenticated users; writable by admins only.';

COMMIT;
