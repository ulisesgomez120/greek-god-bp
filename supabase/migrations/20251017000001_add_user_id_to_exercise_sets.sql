-- Migration: add user_id to exercise_sets (nullable)
-- Purpose: add a denormalized user_id column to exercise_sets so queries can filter directly by user.
-- Note: column is nullable for a safe rollout. Backfill and trigger steps will be applied in subsequent migrations/changes.

BEGIN;

-- 1) Add nullable user_id column
ALTER TABLE public.exercise_sets
ADD COLUMN IF NOT EXISTS user_id uuid;

-- 2) Add indexes to support queries that filter by user_id and by planned_exercise_id + user_id
CREATE INDEX IF NOT EXISTS idx_exercise_sets_user_id ON public.exercise_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_sets_planned_exercise_id_user_id ON public.exercise_sets(planned_exercise_id, user_id);

COMMIT;

-- Post-migration notes (do not run automatically in this migration):
-- 1) Backfill existing rows from workout_sessions:
--    UPDATE public.exercise_sets es
--    SET user_id = ws.user_id
--    FROM public.workout_sessions ws
--    WHERE es.session_id = ws.id AND es.user_id IS NULL;
--
-- 2) Verify backfill:
--    SELECT COUNT(*) AS missing_user_id_count FROM public.exercise_sets WHERE user_id IS NULL;
--
-- 3) Optionally, create a DB trigger to auto-populate user_id on INSERT/UPDATE (recommended if multiple writers)
--    CREATE FUNCTION public.set_exercise_set_user_id() RETURNS trigger AS $$
--    BEGIN
--      IF NEW.user_id IS NULL AND NEW.session_id IS NOT NULL THEN
--        SELECT user_id INTO NEW.user_id FROM public.workout_sessions WHERE id = NEW.session_id;
--      END IF;
--      RETURN NEW;
--    END;
--    $$ LANGUAGE plpgsql;
--
--    CREATE TRIGGER trg_exercise_sets_set_user_id
--    BEFORE INSERT OR UPDATE ON public.exercise_sets
--    FOR EACH ROW EXECUTE FUNCTION public.set_exercise_set_user_id();
--
-- 4) After backfill and ensuring all writers populate user_id (or trigger is in place),
--    you can make the column NOT NULL and add a foreign key if desired:
--    ALTER TABLE public.exercise_sets ALTER COLUMN user_id SET NOT NULL;
--    ALTER TABLE public.exercise_sets
--      ADD CONSTRAINT fk_exercise_sets_user FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
