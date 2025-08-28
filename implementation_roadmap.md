# TrainSmart Implementation Roadmap

Purpose: a prioritized, timeboxed roadmap of concrete tasks to bring the repository fully in-line with the online-first architecture, remove legacy offline artifacts, finish Progress and AI work, add monitoring, and verify via testing and staging. Each task includes exact file targets, suggested commands, estimated effort, and rollback notes.

Prerequisites:

- You have a working staging Supabase project and service role key.
- Local environment variables set (see context/tech-specification.md → ENV variables).
- CI secrets for Supabase, OpenAI, Stripe, and optionally Sentry.

Owner: engineering (single developer or small squad). Break work into 1–3 day tickets.

SUMMARY (ordered priorities)

1. Low-risk docs + config changes (docs, types, constants)
2. Monitoring integration (Sentry)
3. Code cleanup (remove/archived offline hooks, fix imports)
4. Migration: mark & remove offline DB columns (staged migration)
5. Edge function & server checks (remove assumptions about offline fields)
6. Progress UI + analytics wiring
7. AI cost constants validation + tests
8. End-to-end testing + CI updates
9. Release to staging → monitor → production

Estimated total effort: 5–12 developer days depending on QA time and edge-case fixes.

---

PHASE 0 — QUICK SAFETY & REFERENCE TASKS (0.5 day)

- Goal: create reproducible checks and make a safe documentation snapshot.
- Tasks:
  1. Commit updated tech-spec and implementation_plan (done).
  2. Create a small script to find deprecated imports:
     - File: `scripts/check-deprecated-imports.sh`
     - Command (one-liner):
       grep -R --line-number --hidden -E "useWorkoutSync|useNetworkStatus" src || true
     - Run locally: `bash scripts/check-deprecated-imports.sh`
  3. Add README note that migrations must run on staging first.
- Estimated time: 0.5 day
- Rollback: N/A (non-destructive)

Commands:

- git checkout -b chore/roadmap
- echo 'grep -R ...' > scripts/check-deprecated-imports.sh && chmod +x scripts/check-deprecated-imports.sh
- bash scripts/check-deprecated-imports.sh

---

PHASE 1 — DOCUMENTATION, TYPES & CONFIG CONSOLIDATION (0.5–1 day)

- Goal: finalize canonical docs and ensure types & constants reflect online-first design.
- Tasks:
  1. Confirm `context/tech-specification.md` is updated (path: `context/tech-specification.md`) — done.
  2. Update TypeScript types to deprecate/remove offline fields:
     - Files:
       - `src/types/database.ts`
       - `src/types/index.ts` (or project root types files)
       - `src/types/profile.ts` (confirm consistency)
     - Changes:
       - Mark `offline_created?: boolean | null` as deprecated (add comment) or remove.
       - Mark `sync_status?: 'synced' | ...` deprecated or remove.
       - Add explicit `createdAt`, `updatedAt` fields string.
  3. Confirm constants:
     - File: `src/config/constants.ts`
     - Ensure `FEATURE_FLAGS.enableOfflineSync = false` and document `STORAGE_KEYS.async.lastSyncTime` as deprecated.
     - Validate `AI_CONSTANTS.models` and `costPerToken` entries are present and flagged for review.
- Estimated time: 0.5–1 day
- Commands:
  - Run type-check: `npm run type-check`
  - Run grep for offline references: `bash scripts/check-deprecated-imports.sh`
- Rollback: revert commits; changes are code-level adjustments.

Deliverable example edits (developer task):

- Add comments like:
  // DEPRECATED: offline_created retained for migration. Remove in migration 202508XX.

---

PHASE 2 — MONITORING (Sentry) (0.5 day)

- Goal: Add Sentry to capture runtime errors in staging + production.
- Tasks:
  1. Add package:
     - Preferred for Expo managed: `@sentry/expo`
     - Alternative for bare: `@sentry/react-native`
     - Update package.json and run `npm ci`
  2. Create `src/lib/sentry.ts`:
     - Exports `initSentry()` which reads `ENV_CONFIG.sentryDsn` and initializes Sentry only if present.
     - Hook into `App.tsx` startup (guarded by DEV/PROD flag).
  3. Add Sentry release tagging on CI builds (optional).
- Estimated time: 0.5 day
- Commands:
  - npm install --save @sentry/expo
  - Add import and call in `App.tsx`:
    import { initSentry } from "@/lib/sentry";
    initSentry();
- Rollback: remove package + revert App.tsx changes.

---

PHASE 3 — CODE CLEANUP & ARCHIVE (0.5–1 day)

- Goal: Remove runtime references to removed offline hooks, archive code.
- Tasks:
  1. Find imports:
     - `bash scripts/check-deprecated-imports.sh` (created in Phase 0)
     - Manually verify callers and replace:
       - Replace `useNetworkStatus` imports with direct error handling patterns or remove.
       - Remove references to `useWorkoutSync`.
  2. Move archived implementations to `src/archived/` (already some exist).
  3. Add eslint rule or comment to mark archived folder ignored by bundler.
- Files to update:
  - Any file that imports `useNetworkStatus` or `useWorkoutSync` (likely none at runtime).
- Estimated time: 0.5–1 day
- Commands:
  - git mv src/hooks/useNetworkStatus.ts src/archived/
  - git mv src/hooks/useWorkoutSync.ts src/archived/
  - npm run lint && fix imports
- Rollback: move files back from `src/archived/`.

---

PHASE 4 — SAFE DATABASE MIGRATION (1–2 days)

- Goal: Remove legacy offline columns with zero-data-loss approach.
- Strategy:
  1. Non-destructive migration (staging):
     - Add migration `supabase/migrations/202508XX_remove_offline_columns.sql` (initial step):
       - UPDATE workout_sessions SET sync_status = 'synced' WHERE sync_status IS NULL;
       - UPDATE workout_sessions SET offline_created = false WHERE offline_created IS NULL;
       - ALTER TABLE workout_sessions ALTER COLUMN sync_status SET DEFAULT 'synced'; -- optional
       - Add an entry to `schema_migrations` with rollback_sql that sets to NULL (or other safe rollback)
  2. Run code scanning to ensure no runtime references to these columns.
  3. After staging validation (>= 1 week or after smoke tests), create follow-up migration to DROP columns:
     ALTER TABLE workout_sessions DROP COLUMN offline_created;
     ALTER TABLE workout_sessions DROP COLUMN sync_status;
- Files to create:
  - `supabase/migrations/202508XX_remove_offline_columns.sql`
- Estimated time: 1–2 days (includes staging validation)
- Commands:
  - `supabase db push` or run SQL via Supabase CLI / psql on staging
  - Verify: `SELECT COUNT(*) FROM workout_sessions WHERE sync_status IS NULL;`
- Rollback:
  - The initial migration is non-destructive.
  - The drop migration must include rollback SQL that adds columns back (with appropriate defaults).

---

PHASE 5 — EDGE FUNCTIONS & SERVER VALIDATION (0.5–1 day)

- Goal: Verify edge functions do not rely on deprecated fields and add resilience.
- Tasks:
  1. Audit `supabase/functions/*` for usage of `sync_status` or `offline_created`:
     - Files: `supabase/functions/progression-engine/index.ts`, `supabase/functions/ai-progression/*`, and others.
  2. Update comments and logic:
     - If checks exist for non-synced rows, rework to use server-side authoritative state (e.g., `completed_at` presence).
  3. Add logging and defensive retries for OpenAI calls and downstream network failures.
- Estimated time: 0.5–1 day
- Commands:
  - grep -R "sync_status" supabase/functions || true
  - supabase functions deploy <function-name> --project-ref $SUPABASE_PROJECT_REF
- Rollback: revert function code + redeploy previous version.

---

PHASE 6 — PROGRESS UI & ANALYTICS (1–3 days)

- Goal: Complete Progress dashboard and analytics integration; remove TempFeatureGate placeholders.
- Tasks:
  1. Confirm API endpoints and shape returned by progress analytics (server-side views or edge functions).
     - If missing, implement or expose server queries (Edge Function or REST).
     - Suggested: `GET /workouts/analytics?timeframe=quarter`
  2. Update `src/hooks/useProgressData.ts` to call the API and map response to expected frontend types.
  3. Update `src/screens/progress/*` components to consume real data, remove placeholder messages.
  4. Add unit tests for `useProgressData` and components.
- Files to update:
  - `src/hooks/useProgressData.ts`
  - `src/screens/progress/ProgressDashboard.tsx`
  - `src/components/progress/*`
- Estimated time: 1–3 days
- Commands:
  - Run storybook or locally run app to verify charts
  - npm run test (after adding unit tests)
- Rollback: feature-flag gating to disable updated UI if issues found.

---

PHASE 7 — AI COST VALIDATION & TESTS (1 day)

- Goal: Verify AI constants and build tests for ai.service & progression-engine.
- Tasks:
  1. Validate `AI_CONSTANTS.models` and `costPerToken` against current public pricing or internal cost model.
  2. Add unit tests:
     - `src/__tests__/ai.service.test.ts` mocking fetch responses for OpenAI.
     - `supabase/functions` progression-engine: unit/integration tests (local).
  3. Add CI job to run AI-related unit tests.
- Estimated time: 1 day
- Commands:
  - jest unit tests: `npm run test`
  - run mock server for OpenAI tests (use nock or msw)
- Rollback: revert changed constants + tests (non-destructive).

---

PHASE 8 — CI / E2E & STAGING VERIFICATION (1–2 days)

- Goal: Ensure CI runs full set of checks and E2E smoke tests pass on staging.
- Tasks:
  1. Update GitHub Actions to:
     - Run `npm ci`, `npm run type-check`, `npm run lint`, `npm run test:ci`.
     - Deploy edge functions to staging on successful tests.
  2. Add E2E Detox smoke test (minimal flow: signup -> login -> start workout -> add set -> complete workout).
  3. Run tests against staging Supabase and monitor Sentry for runtime errors.
- Estimated time: 1–2 days (including CI iterations)
- Commands:
  - `npx detox test --configuration ios.sim.release`
  - GitHub Actions pull request runs

---

PHASE 9 — RELEASE & MONITOR (0.5–1 day)

- Goal: Deploy to production once staging smoke tests are green.
- Tasks:
  1. Deploy edge functions and web build.
  2. Monitor Sentry and Supabase logs for errors for 24–48 hours.
  3. If issues: rollback via previous edge function versions or DB rollback if necessary.
- Estimated time: 0.5–1 day

---

APPENDIX — DEV COMMANDS, EXAMPLES & SAFE CHECKS

1. Find deprecated offline imports (quick):

   - bash scripts/check-deprecated-imports.sh
   - git grep -n "sync_status\|offline_created" || true

2. Run type-check:

   - npm run type-check

3. Run unit tests:

   - npm run test

4. Deploy edge functions:

   - supabase functions deploy <function> --project-ref $SUPABASE_PROJECT_REF

5. Apply non-destructive staging migration (example):
   - Create `supabase/migrations/20250801_mark_offline_columns.sql` with:
     ```
     ALTER TABLE public.workout_sessions
       ALTER COLUMN sync_status SET DEFAULT 'synced';
     UPDATE public.workout_sessions SET sync_status='synced' WHERE sync_status IS NULL;
     UPDATE public.workout_sessions SET offline_created = false WHERE offline_created IS NULL;
     -- Insert schema_migrations entry with rollback_sql that sets these values to NULL if needed.
     ```
   - Apply on staging first.

---

TASK_PROGRESS (current roadmap items):

- [x] Documentation and tech-spec update (context/tech-specification.md)
- [x] Implementation plan created (implementation_plan.md)
- [ ] Create scripts/check-deprecated-imports.sh and run checks
- [ ] Update TypeScript types to deprecate offline fields
- [ ] Add Sentry integration and initialize in App startup
- [ ] Remove runtime imports of deprecated hooks (archive files)
- [ ] Create safe DB migration (mark columns then drop)
- [ ] Audit & update Edge Functions
- [ ] Finish Progress UI wiring to analytics endpoints
- [ ] Validate AI constants and add tests
- [ ] CI updates + E2E tests on staging
- [ ] Production release and monitoring

---

Next steps I can perform for you now (choose which to run automatically):

- Create `implementation_roadmap.md` (this file) — done.
- Create `scripts/check-deprecated-imports.sh` and run it to list remaining imports.
- Create the initial safe migration SQL file `supabase/migrations/20250801_mark_offline_columns.sql` (non-destructive).
- Add `src/lib/sentry.ts` and patch `App.tsx` to call initializer (behind flag).

Reply with which of the "Next steps I can perform for you now" you want me to execute (you may pick multiple — I will perform them one at a time and ask for confirmation after each).
