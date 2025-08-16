-- Migration: 20240116000010_atomic_workout_sync.sql
-- Purpose: Add stored procedure to atomically replace exercise_sets for a workout session.
-- This function validates ownership and inserts the provided sets in a single function
-- so callers can avoid delete-then-insert race conditions.

BEGIN;

-- Ensure necessary extensions exist (pgcrypto typically available in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop if exists to make migration idempotent during development (safe guard)
DROP FUNCTION IF EXISTS replace_workout_sets(UUID, UUID, JSONB);

CREATE OR REPLACE FUNCTION replace_workout_sets(
  p_session_id UUID,
  p_user_id UUID,
  p_sets JSONB
) RETURNS JSONB AS $$
DECLARE
  set_item JSONB;
  inserted_count INTEGER := 0;
  rec RECORD;
BEGIN
  -- Validate session exists and belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM workout_sessions
    WHERE id = p_session_id
      AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found_or_unauthorized');
  END IF;

  -- Use transaction semantics provided by PL/pgSQL function execution
  -- Delete existing sets for the session
  DELETE FROM exercise_sets WHERE session_id = p_session_id;

  -- If no sets provided, return success with zero replaced
  IF p_sets IS NULL OR jsonb_array_length(p_sets) = 0 THEN
    RETURN jsonb_build_object('success', true, 'sets_replaced', 0);
  END IF;

  -- Iterate over JSONB array of sets and insert
  FOR set_item IN SELECT * FROM jsonb_array_elements(p_sets)
  LOOP
    -- Insert each set; use explicit column list and safe casts where appropriate
    INSERT INTO exercise_sets (
      id,
      session_id,
      exercise_id,
      set_number,
      weight_kg,
      reps,
      rpe,
      is_warmup,
      is_failure,
      rest_seconds,
      notes,
      form_rating,
      created_at
    ) VALUES (
      (set_item->>'id')::UUID,
      p_session_id,
      (set_item->>'exercise_id')::UUID,
      (set_item->>'set_number')::INTEGER,
      -- weight_kg can be null
      NULLIF(trim((set_item->>'weight_kg')::TEXT), '')::NUMERIC,
      (set_item->>'reps')::INTEGER,
      NULLIF((set_item->>'rpe'), '')::INTEGER,
      COALESCE((set_item->>'is_warmup')::BOOLEAN, false),
      COALESCE((set_item->>'is_failure')::BOOLEAN, false),
      NULLIF((set_item->>'rest_seconds'), '')::INTEGER,
      NULLIF(set_item->>'notes', ''),
      NULLIF((set_item->>'form_rating'), '')::INTEGER,
      COALESCE(
        (CASE WHEN (set_item->>'created_at') IS NOT NULL THEN (set_item->>'created_at')::TIMESTAMP WITH TIME ZONE ELSE NOW() END),
        NOW()
      )
    );

    inserted_count := inserted_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'sets_replaced', inserted_count);
EXCEPTION WHEN OTHERS THEN
  -- Any error will abort the function and the outer transaction will be rolled back.
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
