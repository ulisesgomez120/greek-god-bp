-- ============================================================================
-- Migration: Add use_metric column and drop preferences JSONB
-- Version: 20250822000001
-- Description: Adds `use_metric` boolean column, migrates existing values from
--              `preferences` JSONB (including legacy `units` shape), creates an
--              index, and drops the `preferences` column (dev-friendly).
-- ============================================================================
BEGIN;

-- 1) Add use_metric column (default false = imperial)
ALTER TABLE IF EXISTS user_profiles
  ADD COLUMN IF NOT EXISTS use_metric BOOLEAN DEFAULT FALSE;

-- 2) Migrate existing values from preferences JSONB
--    Priority:
--      1) preferences->'useMetric' (explicit boolean)
--      2) infer from preferences->'units' where weight == 'kg' AND height == 'cm'
--      3) leave existing use_metric (default) otherwise
UPDATE user_profiles
SET use_metric = COALESCE(
  -- explicit boolean stored in preferences.useMetric
  (preferences ->> 'useMetric')::boolean,
  -- try to infer from legacy units object (weight+height both metric => true)
  CASE
    WHEN (preferences -> 'units') IS NOT NULL THEN
      CASE
        WHEN (preferences -> 'units' ->> 'weight') = 'kg' AND (preferences -> 'units' ->> 'height') = 'cm' THEN TRUE
        ELSE FALSE
      END
    ELSE use_metric
  END
);

-- 3) Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_use_metric ON user_profiles (use_metric);

-- 4) Drop the preferences JSONB column (development environment - safe to drop)
ALTER TABLE IF EXISTS user_profiles
  DROP COLUMN IF EXISTS preferences;

COMMIT;
