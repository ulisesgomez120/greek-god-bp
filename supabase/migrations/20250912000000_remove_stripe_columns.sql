-- Migration: Remove Stripe-specific columns and indexes
-- Generated: 2025-09-12
-- Purpose: Safely remove Stripe columns and related indexes from the database.
-- IMPORTANT: Run against a development / staging database first and ensure no server-side
-- code references these columns before running in production.

BEGIN;

-- Drop known indexes that reference stripe columns (safe if they don't exist)
DROP INDEX IF EXISTS idx_payment_history_stripe;
DROP INDEX IF EXISTS idx_user_profiles_stripe;
DROP INDEX IF EXISTS idx_subscriptions_stripe;
DROP INDEX IF EXISTS idx_subscriptions_stripe_subscription_id;
DROP INDEX IF EXISTS idx_user_profiles_stripe_customer_id;
DROP INDEX IF EXISTS idx_payment_history_stripe_payment_intent_id;

-- Remove Stripe columns from tables (use IF EXISTS to be idempotent)
ALTER TABLE IF EXISTS public.subscription_plans DROP COLUMN IF EXISTS stripe_price_id;
ALTER TABLE IF EXISTS public.subscription_plans DROP COLUMN IF EXISTS stripe_coupon_id;
ALTER TABLE IF EXISTS public.subscription_plans DROP COLUMN IF EXISTS stripe_promotion_code_id;

ALTER TABLE IF EXISTS public.subscriptions DROP COLUMN IF EXISTS stripe_subscription_id;
ALTER TABLE IF EXISTS public.subscriptions DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE IF EXISTS public.subscriptions DROP COLUMN IF EXISTS stripe_subscription_schedule_id;

ALTER TABLE IF EXISTS public.user_profiles DROP COLUMN IF EXISTS stripe_customer_id;

ALTER TABLE IF EXISTS public.payment_history DROP COLUMN IF EXISTS stripe_payment_intent_id;
ALTER TABLE IF EXISTS public.payment_history DROP COLUMN IF EXISTS stripe_invoice_id;
ALTER TABLE IF EXISTS public.payment_history DROP COLUMN IF EXISTS stripe_subscription_schedule_id;

-- If you have functions, views, or triggers that reference these columns, they must be updated
-- or dropped before this migration. Check for those references and update accordingly.
-- Example checks you may want to run before applying in production:
--   SELECT proname FROM pg_proc WHERE prosrc ILIKE '%stripe_%';
--   SELECT table_name, column_name FROM information_schema.columns WHERE column_name ILIKE '%stripe_%';

COMMIT;
