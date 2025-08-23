-- ============================================================================
-- Migration: Add user preferences & normalize privacy settings
-- Version: 20240116000011
-- Description: Adds `preferences` JSONB, normalizes privacy_settings JSONB into boolean columns,
--              migrates existing privacy settings, and adds helpful indexes. Does not drop the
--              old privacy_settings column; dropping should be done after verification.
-- ============================================================================

BEGIN;

-- 1) Add preferences column (default to common imperial defaults, can be changed later)
ALTER TABLE IF EXISTS user_profiles
ADD COLUMN IF NOT EXISTS preferences JSONB
  DEFAULT '{"units": {"weight": "lbs", "height": "ft_in", "distance": "miles"}}';

-- 2) Add normalized privacy boolean columns (keep defaults aligned with previous JSON defaults)
ALTER TABLE IF EXISTS user_profiles
  ADD COLUMN IF NOT EXISTS privacy_data_sharing BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS privacy_analytics BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS privacy_ai_coaching BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS privacy_workout_sharing BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS privacy_progress_sharing BOOLEAN DEFAULT FALSE;

-- 3) Migrate existing JSONB privacy_settings values into new columns where present
--    Use COALESCE to fall back to sensible defaults if a key is missing.
UPDATE user_profiles
SET
  privacy_data_sharing = COALESCE((privacy_settings ->> 'data_sharing')::boolean, privacy_data_sharing, false),
  privacy_analytics = COALESCE((privacy_settings ->> 'analytics')::boolean, privacy_analytics, true),
  privacy_ai_coaching = COALESCE((privacy_settings ->> 'ai_coaching')::boolean, privacy_ai_coaching, true),
  privacy_workout_sharing = COALESCE((privacy_settings ->> 'workout_sharing')::boolean, privacy_workout_sharing, false),
  privacy_progress_sharing = COALESCE((privacy_settings ->> 'progress_sharing')::boolean, privacy_progress_sharing, false)
WHERE privacy_settings IS NOT NULL;

-- 4) Data type improvement: use SMALLINT for height_cm (range is small; use only if current values fit)
--    NOTE: Only alter type if all existing non-null values fit within SMALLINT. SMALLINT max is 32767.
--    Heights are expected to be 0-300 so this is safe.
ALTER TABLE IF EXISTS user_profiles
  ALTER COLUMN height_cm TYPE SMALLINT USING height_cm::smallint;

-- 5) Add useful indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_preferences ON user_profiles USING GIN (preferences);
CREATE INDEX IF NOT EXISTS idx_user_profiles_privacy_analytics ON user_profiles (privacy_analytics) WHERE privacy_analytics = false;

-- 6) (Optional) Do not drop privacy_settings here — allow verification first. If desired, uncomment after validation:
-- ALTER TABLE user_profiles DROP COLUMN IF EXISTS privacy_settings;

COMMIT;
