# Implementation Plan

[Overview]
Remove all Stripe dependencies and references from the TrainSmart codebase (client, types, state, services, and database migrations), replace them with neutral subscription fields (plan IDs, status, payment metadata placeholders) and prepare a database migration to drop Stripe-specific columns and indexes. This keeps subscription behavior intact while removing Stripe-specific coupling so the mobile app can use platform-appropriate billing later.

The scope covers: (1) removing the Stripe React Native package and package.json entry, (2) cleaning TypeScript types and Redux slices/services to remove stripe-specific fields, and (3) adding a Supabase migration to drop Stripe columns and indexes and keep the DB schema consistent. I will not replace Stripe with a payment provider in this task — instead the code will retain generic subscription fields (planId, status, amountCents, payment metadata) so mobile billing (IAP) can be integrated later without Stripe artifact cleanup.

This implementation is needed because Stripe is not supported in the target mobile environment and the existing codebase contains Stripe artifacts in types, migrations and mock implementations. Removing those references avoids build-time and runtime issues and simplifies future integration with platform billing APIs.

[Types]  
Remove Stripe-specific fields from the app's TypeScript types and replace them with neutral fields where appropriate.

Detailed type definitions and required changes:

- src/types/profile.ts

  - Remove: `stripeCustomerId?: string;`
  - Keep: `onboardingCompleted: boolean;`
  - Validation: no runtime validation required (compile-time only change). Update any factory/transform helpers that set stripeCustomerId.

- src/types/index.ts

  - Remove or rename fields:
    - Remove: `stripePublishableKey`
    - Remove: `stripePaymentIntentId`
    - Remove: `stripeSubscriptionId`
    - Remove: `stripeCustomerId`
    - Remove: `stripePriceId`
  - Add / Keep neutral fields:
    - `amountCents: number` (kept if used)
    - `paymentMetadata?: Record<string, unknown>` as a placeholder if needed.
  - Update any union/enums that referenced Stripe-specific fields to rely on subscription `status` and `planId`.

- src/types/transforms.ts

  - Remove references to `stripeSubscriptionId` and `stripeCustomerId` in mapping functions; map DB columns to neutral fields (e.g., `subscriptionId`, `customerId` if still generic).
  - Ensure functions that transform DB rows still provide `id`, `planId`, `status`, `interval`, `amountCents` where used.

- src/types/environment.ts

  - Remove `stripePublishableKey?: string` from environment type in favor of no client-side Stripe keys.

- src/types/database.ts
  - Where DB table types mention `stripe_*` columns, update to either optional generic names or keep them until DB migration runs — but code-level types should stop referencing `stripe_*`.
  - Add comments in the type definitions indicating that DB columns will be removed by a migration.

Validation rules:

- Types are compile-time only. Update callers to remove usage of removed fields or add safe guards (optional chaining) while refactoring code.

[Files]
Single sentence describing file modifications.

Detailed breakdown:

- New files to be created:

  - supabase/migrations/20250912000000_remove_stripe_columns.sql — migration that drops stripe columns and related indexes safely (uses IF EXISTS / PG conditional statements).
  - docs/stripe-removal-notes.md — (optional) brief notes describing the removal and decisions for future billing integration.

- Existing files to be modified:

  - package.json
    - Remove dependency: `@stripe/stripe-react-native`
    - Update `expo.install.exclude` only if `stripe` was listed (not present in current file).
  - src/store/subscription/subscriptionSlice.ts
    - Remove any fields specifically named `stripeSubscriptionId`, `stripeCustomerId`, `stripePriceId` from mock plan objects and Subscription objects.
    - Replace creation of mock subscription objects to not use `stripe_*` fields; use `id`, `planId`, and `customerId` (optional neutral name) or leave customerId null.
    - Remove logic that compares `stripeSubscriptionId` in reducers (e.g., updateSubscriptionStatus).
    - Ensure selectors and computed selectors use `subscription.id` or `subscription.planId` and not stripe ids.
  - src/store/auth/authSlice.ts
    - Remove `stripeCustomerId` from user state shape and any setters that set it from profile data.
  - src/services/profile.service.ts
    - Remove mapping for `stripe_customer_id` to user profile objects. If the DB still contains the column until migration, read it but don't expose it on client objects (or map to deprecated field with a comment). Ideally remove mapping entirely.
  - src/config/constants.ts
    - Remove export/usage of `stripePublishableKey`. If tests or build read it from extra, ensure defaults removed.
  - src/types/\* (see [Types] section)
    - Update files: `transforms.ts`, `profile.ts`, `index.ts`, `environment.ts`, `database.ts` — remove Stripe fields and update interfaces accordingly.
  - supabase/migrations/\*
    - Add new migration file to drop columns and indexes; do not modify existing migrations in-place.

- Files to be deleted or moved:

  - Do not delete any app code files (components, slices) entirely — only remove Stripe fields. The Stripe package directory in node_modules will be removed by npm install after package.json change; no code-level deletion required. Do not delete historical migration files.

- Configuration file updates:
  - .env.example: no Stripe vars present; no change required.
  - app.config.ts: remove references if any (currently none).
  - package-lock.json: will be regenerated after `npm install`; include a note to run `npm install` or `pnpm install` depending on workflow.

[Functions]
Single sentence describing function modifications.

Detailed breakdown:

- New functions:

  - None required for this task. DB migration will handle schema changes.

- Modified functions:

  - In src/store/subscription/subscriptionSlice.ts:
    - createSubscription (signature unchanged)
      - Remove populating `stripeSubscriptionId` and `stripeCustomerId` in the mock subscription object.
      - Ensure returned Subscription object contains: `id`, `userId`, `planId`, `status`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `createdAt`, `updatedAt`.
    - updateSubscriptionStatus reducer:
      - Change comparison from `state.currentSubscription.stripeSubscriptionId === subscriptionId` to `state.currentSubscription.id === subscriptionId`.
  - In src/services/profile.service.ts:
    - Functions that build user profile objects (e.g., mapping DB rows) — remove `stripe_customer_id` mapping.
  - In src/store/auth/authSlice.ts:
    - Any reducers or thunks that set `stripeCustomerId` on the user state — remove or guard.
  - In src/config/constants.ts:
    - Remove `stripePublishableKey` export and any functions that reference it.
  - In other transformation utilities (src/types/transforms.ts, src/lib/supabase.ts if used):
    - Remove or update functions that reference stripe IDs.

- Removed functions:
  - None removed outright. Small helper functions solely for Stripe (if found later) should be removed — none discovered in the UI code so far.

[Classes]
Single sentence describing class modifications.

Detailed breakdown:

- New classes:

  - None.

- Modified classes:

  - None — changes are in types and functions rather than class-based components.

- Removed classes:
  - None.

[Dependencies]
Single sentence describing dependency modifications.

Details:

- Remove dependency:
  - `@stripe/stripe-react-native` (version previously "0.45.0") from `package.json`.
- No other package changes required in this task.
- After editing package.json, run `npm install` (or `pnpm install` / `yarn install` per your workflow) to remove the package from node_modules and update package-lock.json.
- Note: Dist build artifacts (dist/) may reference Stripe if a previous web build included it; remove or rebuild web assets where necessary.

[Testing]
Single sentence describing testing approach.

Test file requirements, existing test modifications, and validation strategies:

- Unit / compile-time tests:
  - Run `npm run type-check` and `npm run lint` to catch type and lint issues after changes.
  - Run `npm test` (Jest) to ensure no test regressions.
- Manual verification:
  - Build app (expo start) and run in emulator to confirm no runtime errors from removed fields.
  - Walk through subscription flows in the UI to ensure they still behave using planId/status without referencing Stripe IDs.
- Database verification:
  - Run Supabase migration locally and ensure schema updates apply cleanly; verify that app queries still work (update any server-side functions if they referenced stripe columns).
- Rollback plan:
  - Keep backup of original migration files and package.json. If problems arise, revert the changesets.

[Implementation Order]
Single sentence describing the implementation sequence.

Numbered steps showing the logical order of changes to minimize conflicts and ensure successful integration:

1. Create implementation_plan.md (this file) and commit it to repo (if desired).
2. Remove `@stripe/stripe-react-native` from `package.json`. Commit change.
3. Run `npm install` to update node_modules and package-lock.json. Commit package-lock.json.
4. Update TypeScript types:
   - Edit `src/types/profile.ts`, `src/types/index.ts`, `src/types/transforms.ts`, `src/types/environment.ts`, `src/types/database.ts`.
   - Run `npm run type-check` and fix any compilation errors.
5. Update state and services:
   - Edit `src/store/subscription/subscriptionSlice.ts` to remove stripe fields and update logic to use `id` and `planId`.
   - Edit `src/store/auth/authSlice.ts` to remove `stripeCustomerId`.
   - Edit `src/services/profile.service.ts` to remove mapping of `stripe_customer_id`.
   - Edit `src/config/constants.ts` to remove `stripePublishableKey`.
   - Run `npm run type-check` and `npm run lint`, fix errors.
6. Add DB migration file:
   - Create `supabase/migrations/20250912000000_remove_stripe_columns.sql` with safe IF EXISTS checks to drop `stripe_*` columns and related indexes.
   - Commit migration.
7. Run DB migration locally against your dev Supabase instance; verify no queries break.
8. Run full test suite and smoke-test the app in emulator.
9. Push commits and create a PR for review.

Notes and edge cases:

- If any backend functions (Supabase edge functions) or server code outside this repo reference `stripe_*` columns or keys, coordinate removal with backend changes; do not drop DB columns before backend stops writing them.
- Migration SQL must be safe for production: use conditional checks (IF EXISTS) and update functions that reference dropped columns.
- Keep a temporary compatibility migration if third-party code still expects stripe columns: consider leaving columns for a cycle and marking them deprecated in code before dropping them.
