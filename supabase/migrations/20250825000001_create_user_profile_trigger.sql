-- ============================================================================
-- Create trigger to auto-create user_profiles when a new auth.users row is inserted
-- ============================================================================
-- Adds a safety-net so profiles are created even if the Edge Function/webhook
-- fails to process the auth event.
-- Timestamp: 20250825000001
-- ============================================================================
BEGIN;

-- Create function to auto-create user profiles when a user is inserted into auth.users
CREATE OR REPLACE FUNCTION public.create_user_profile_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  display_name TEXT;
  experience_level_text TEXT;
  user_meta JSONB;
BEGIN
  -- Attempt to read metadata from common fields used by Supabase/GoTrue
  user_meta := COALESCE(NEW.raw_user_meta_data, NEW.user_metadata, '{}'::jsonb);

  display_name := COALESCE(
    NULLIF(user_meta->>'display_name', ''),
    split_part(NEW.email, '@', 1)
  );

  experience_level_text := COALESCE(user_meta->>'experience_level', 'untrained');

  -- Only insert if a profile doesn't already exist for this user (safety)
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = NEW.id) THEN
    INSERT INTO public.user_profiles (
      id,
      email,
      display_name,
      experience_level,
      fitness_goals,
      created_at,
      updated_at,
      onboarding_completed
    )
    VALUES (
      NEW.id,
      NEW.email,
      display_name,
      experience_level_text::experience_level_enum,
      '{}'::text[],
      NOW(),
      NOW(),
      FALSE
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Another process may have created the profile concurrently; ignore
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error to server logs for visibility
    RAISE WARNING 'create_user_profile_on_signup error for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users AFTER INSERT
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_profile_on_signup();

COMMIT;
