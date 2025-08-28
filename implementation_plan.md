# Implementation Plan

[Overview]
Update the TrainSmart technical specification and produce a targeted implementation roadmap that aligns the repository with the current online-first architecture and removes leftover offline-first artifacts.

This document captures the outcome of a codebase audit and prescribes precise changes, additions, and cleanup tasks so another developer can implement them with minimal additional discovery. Scope includes: updating the canonical tech-spec (context/tech-specification.md) to reflect the current implementation; aligning dependency and configuration files; removing or migrating leftover offline-first code paths and DB fields; updating AI and progress sections to match implemented behaviors; generating migration SQL and small edge-function or service changes where necessary; and creating a separate implementation roadmap document for staged execution. The approach balances low-risk cleanups, required schema migrations, and feature work (progress UI, AI alignment, Sentry integration) and orders tasks to minimize breaks for active features (auth, profile, workouts).

[Types]  
Single sentence describing the type system changes.
Remove or reduce offline-related fields in type definitions and add explicit types for server-only fields (e.g., server-generated timestamps) and for updated service responses.

Detailed type definitions, interfaces, enums, or data structures with complete specifications.

- Update src/types/database.ts and src/types/index.ts (or equivalent):
  - Remove or mark deprecated:
    - workout_sessions.offline_created?: boolean | null (deprecated). If retained for migration, mark as deprecated in types with comment.
    - workout_sessions.sync_status?: 'synced' | 'pending' | 'conflict' — if you intend to remove the column, update types to no longer require it.
  - Add/clarify:
    - WorkoutSession (frontend shape)
      - id: string (UUID)
      - userId: string
      - planId?: string
      - sessionId?: string
      - name: string
      - startedAt: string (ISO)
      - completedAt?: string (ISO)
      - durationMinutes?: number
      - totalVolumeKg?: number
      - averageRpe?: number
      - notes?: string
      - sets: ExerciseSet[]
      - createdAt: string
      - updatedAt: string
    - ExerciseSet
      - id: string
      - sessionId: string
      - exerciseId: string
      - setNumber: number
      - weightKg?: number
      - reps: number
      - rpe?: number
      - isWarmup: boolean
      - isFailure?: boolean
      - restSeconds?: number
      - notes?: string
      - createdAt: string
  - AI types:
    - AIProgressionRequest/Response: ensure tokensUsed, cost, processingTimeMs fields exist and documented
  - Auth tokens:
    - Tokens storage shape used by tokenManager (accessToken, refreshToken, expiresAt)

[Files]  
Single sentence describing file modifications.
Create new documentation/artifacts and modify a small set of runtime files, constants, and DB migration files to reflect online-first behavior and clean up legacy offline-first artifacts.

Detailed breakdown:

- New files to be created
  - implementation_roadmap.md (root) — a prioritized, timeboxed roadmap with ticket-like steps and estimated effort.
  - supabase/migrations/202508XX_remove_offline_columns.sql — migration to drop `offline_created` and `sync_status` (or set nullable + default) and update comments. (exact date-version to match repo migration conventions)
  - docs/changes/tech-spec-update-changelog.md — short log of changes to tech-spec for auditability.
  - scripts/check-deprecated-imports.sh — small grep helper to report runtime imports referencing removed hooks (optional).
- Existing files to be modified (exact changes)
  - context/tech-specification.md — update architecture description to "Online-First", remove offline-first claims, adjust sync diagrams and sections for real-time + direct API usage, mark offline-first elements as deprecated and list migration steps.
  - implementation_plan.md — (this file) add to repo root.
  - src/config/constants.ts — update FEATURE_FLAGS: set enableOfflineSync:false (already false), add a DEPRECATION note for offline constants and storage keys lastSyncTime/workout_cache usage if not used.
  - src/lib/supabase.ts — confirm comments and runtime behaviour (SecureStore adapter) and add a short comment linking to migration tasks if RLS changes needed.
  - src/hooks/\*:
    - Remove references or imports to useWorkoutSync and useNetworkStatus across codebase (replace with direct calls or remove).
    - Move archived implementations under src/archived/ (already some exist) and remove runtime exports.
  - src/services/database.service.ts — ensure methods are prepared for direct online-first usage; add retry/backoff comments if desired.
  - supabase/functions/\* — add small compatibility notes to functions that assumed offline sync; add server-side migration code if they reference `sync_status` or `offline_created`.
  - package.json — add Sentry package (@sentry/react-native or equivalent) and ensure devDependencies align; add a new script: "lint:fix-deprecated": "eslint --rule ... " (optional).
- Files to be deleted or moved
  - Delete or archive (move to src/archived/) any runtime hooks that were removed but still imported: src/hooks/useNetworkStatus.ts, src/hooks/useWorkoutSync.ts (already removed), and any other remnants.
- Configuration file updates
  - app.config.ts / src/config/constants.ts: ensure openaiApiKey is stored but not leaked; ensure env var names consistent (EXPO_PUBLIC_SUPABASE_URL vs EXPO_PUBLIC_SUPABASE_URL in constants).
  - Update README or docs to state required env variables: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, OPENAI_API_KEY, STRIPE keys, SENTRY_DSN.

[Functions]  
Single sentence describing function modifications.
Add small migration utilities and update edge functions plus client-side service functions to drop offline fallback behavior while preserving safe failure modes for network errors.

Detailed breakdown:

- New functions (name, signature, file path, purpose)
  - drop_offline_columns_migration() — script to generate SQL or run migration file: supabase/migrations/202508XX_remove_offline_columns.sql
  - scanDeprecatedImports(rootPath: string): string[] — scripts/check-deprecated-imports.sh to list files importing deleted hooks.
  - addSentryInit(dsn?: string) — src/lib/sentry.ts to initialize Sentry in app startup if SENTRY_DSN present.
- Modified functions (exact name, file path, required changes)
  - supabase/functions/progression-engine/index.ts
    - Update comments if function expects `sync_status` values. If it uses them, adapt to read not rely on pending/conflict; or ensure migration mirrors previous semantics.
  - src/services/workout.service.ts
    - Already online-first; keep but add explicit error classification for network vs server errors so UI shows appropriate messages (retry vs fail).
  - src/lib/supabase.ts
    - Keep monitorConnectionStatus but simplify it to a lightweight healthcheck (it already does). Remove any offline-sync triggers if present.
  - src/services/ai.service.ts
    - Confirm model selection and cost calculations align with current AI constants. Add safe fallback text when OpenAI unreachable; log and use generateFallbackProgression().
- Removed functions (name, file path, reason, migration strategy)
  - Any offline-sync queue processors (archived) — remove from runtime; if required for rollback, keep archived copy in src/archived/.

[Classes]  
Single sentence describing class modifications.
Prefer small service modules (function exports) over heavy singletons, but preserve reader-friendly singletons for developer ergonomics; remove obsolete sync manager classes.

Detailed breakdown:

- New classes
  - SentryManager (src/lib/sentry.ts) — initialize/flush Sentry on app lifecycle events.
  - MigrationRunner (scripts/migrations.ts) — small utility to run local SQL against supabase if developer wants to test migrations locally (optional).
- Modified classes
  - WorkoutService (src/services/workout.service.ts) — document as online-first and add explicit type annotations for retry/circuit-breaker parameters; add an optional "persistLocallyIfOffline" flag (default: false) if future offline features required.
- Removed classes
  - OfflineSyncManager (if present in archived code) — archived, remove runtime usage.

[Dependencies]  
Single sentence describing dependency modifications.
Add Sentry for monitoring; verify OpenAI client usage (native fetch vs SDK), and ensure no leftover offline sync libraries are required — keep dependencies minimal and aligned with Expo SDK.

Details of new packages, version changes, and integration requirements.

- Add:
  - @sentry/react-native (or @sentry/expo depending on preference) — pinned to a recent stable version compatible with Expo SDK 53.
    - Integration points: init in App.tsx via src/lib/sentry.ts; add EXPO config SENTRY_DSN env variable (already referenced).
- Check:
  - Supabase version is current (^2.45.4) — OK.
  - expo-secure-store present — used for token storage — OK.
  - DevDependencies: detox present — leave in devDependencies if E2E tests planned.
- Remove (no immediate removal required):
  - No runtime offline libs must be removed, but remove or archive any custom local DB libs if unused.

[Testing]  
Single sentence describing testing approach.
Add unit tests for services (auth, workout, ai), integration tests for edge functions, and an end-to-end verification for critical user flows (login -> start workout -> log set -> complete workout).

Test file requirements, existing test modifications, and validation strategies.

- Tests to add:
  - Unit tests: src/**tests**/workout.service.test.ts (mock supabase client responses)
  - Unit tests: src/**tests**/ai.service.test.ts (stub fetch responses for OpenAI)
  - Integration tests: scripts/test-edge-functions.md with curl examples or jest + supabase client for local testing
  - E2E: update Detox config if necessary and provide a smoke E2E that verifies auth + workout flows
- CI:
  - Update GitHub Actions to run type-check, lint, unit tests, and optionally integration tests against staging Supabase instance (use secret credentials).
- Validation:
  - Safety-first: run DB migrations on staging; keep rollback SQL in schema_migrations table.

[Implementation Order]  
Single sentence describing the implementation sequence.
Apply changes incrementally: first safe documentation and configuration edits, next dependency and monitoring integration, then schema migrations and server function updates, followed by UI and service changes, and finally testing and deployment.

Numbered steps showing the logical order of changes to minimize conflicts and ensure successful integration.

1. Documentation updates (non-destructive):
   - Update context/tech-specification.md to reflect online-first design and current component statuses (auth, profile, workout implemented; progress and AI partially outdated).
   - Add implementation_roadmap.md (high-level tasks and estimates).
2. Dependency & config:
   - Add Sentry package and create src/lib/sentry.ts; wire SENTRY_DSN in app startup (App.tsx) behind a feature flag.
   - Verify ENV variable names and app.config.ts extra fields; update README with required envs.
3. Small runtime fixes & cleanups:
   - Replace any residual imports referencing removed hooks with noop or updated service calls.
   - Move removed files into src/archived and ensure no runtime import paths point to them (run scripts/check-deprecated-imports.sh).
4. Database migration planning:
   - Create supabase/migrations/202508XX_remove_offline_columns.sql with safe operations:
     - If data not needed: ALTER TABLE DROP COLUMN offline_created; ALTER TABLE DROP COLUMN sync_status;
     - If safety preferred: CREATE migration that sets default 'synced' where NULL then mark column deprecated and drop in subsequent release.
   - Add rollback SQL to schema_migrations table entry.
5. Edge function and server updates:
   - Review supabase functions for references to offline fields; patch to rely on server state and update comments.
6. AI & Progress work:
   - Update ai.service model selection comments (ensure model IDs match OpenAI availability) and refine cost calculations if needed.
   - Implement a small unit-test suite for ai.service and progression-engine.
   - Update Progress UI components (ProgressDashboard) to replace placeholder text with working API calls and defensive failure UI.
7. Testing:
   - Run unit tests and run migrations against a staging DB.
   - Run E2E smoke tests confirming: signup/login -> create workout -> log set -> complete workout -> view progress.
8. Release & monitoring:
   - Deploy to staging; monitor Sentry and logs; run smoke tests; if all green, schedule production release.
9. Cleanup:
   - Remove archived files after one release cycle and update changelog/docs.
