# Implementation Plan

[Overview]
Make `planned_exercise_id` a required-first-class filter for all historical/progress queries so history, charts, and personal records only show sets tied to the specific planned exercise instance.

The app currently saves sets with `planned_exercise_id`, but most history/progress queries fall back to filtering by `exercise_id` only. That causes unrelated sets for the same exercise (different planned contexts) to be mixed in progress views. This plan removes all backward-compatibility fallbacks and requires callers to pass `planned_exercise_id` when querying exercise history, strength progression, volume progression, and personal records. It updates service signatures, UI components, and adds a small DB index to ensure query performance. The change is scoped to the progress/history path and is backwards-incompatible by design (as requested).

[Types]  
Require plannedExerciseId in relevant service signatures and strengthen transforms to surface the field.

- Add / modify type fields (application types)
  - src/types/index.ts (or relevant central types file)
    - ExerciseSet: ensure `plannedExerciseId: string` is present (not optional) for set types returned by DB for logged sets used by history flows.
  - src/types/transforms.ts
    - transformExerciseSet(dbSet: DbExerciseSet): ExerciseSet — ensure it returns `plannedExerciseId: string` (throw or assert if null).
  - ProgressService / DatabaseService method signatures (TypeScript)
    - getExerciseHistory(userId: string, exerciseId: string, plannedExerciseId: string): Promise<...>
    - queryExerciseHistory(userId: string, exerciseId: string, plannedExerciseId: string, limit?: number): Promise<...>
    - queryStrengthProgression(userId: string, exerciseId: string, plannedExerciseId: string, timeframe?: "..."): Promise<...>
    - queryVolumeProgression(userId: string, exerciseId: string, plannedExerciseId: string, timeframe?: "..."): Promise<...>
    - queryPersonalRecords(userId: string, plannedExerciseId: string, exerciseId?: string, limit?: number): Promise<...>
  - Validation rules:
    - At runtime validate that `plannedExerciseId` is a non-empty UUID string; if missing, throw an error (no fallback).
    - Where transforms currently set `plannedExerciseId = dbSet.planned_exercise_id || undefined`, change to require presence or throw a clear error when used in history paths.

[Files]
Update service, UI components, transforms, and (optionally) add a DB migration for index.

- New files to create

  - supabase/migrations/20250826000001_index_exercise_sets_planned_exercise_id.sql
    - Purpose: Add an index on (planned_exercise_id, exercise_id, created_at) to optimize inner join/filtering for history queries.
    - Content: CREATE INDEX idx_exercise_sets_planned_exercise ON exercise_sets (planned_exercise_id, exercise_id, created_at DESC) WHERE is_warmup = FALSE;
  - tests/progress/ (integration/unit test files)
    - tests/progress/queryExerciseHistory.spec.ts
    - tests/progress/queryPersonalRecords.spec.ts

- Existing files to be modified (exact changes)

  - src/types/transforms.ts
    - transformExerciseSet: change `plannedExerciseId: dbSet.planned_exercise_id || undefined` to `plannedExerciseId: dbSet.planned_exercise_id` and surface an error if null when used in history flows (or add a strict transform used by DatabaseService.history methods).
    - Add a strict transform helper: `transformExerciseSetStrict` used only by history functions (throws if `planned_exercise_id` missing).
  - src/services/database.service.ts
    - queryExerciseHistory: make `plannedExerciseId` required parameter (remove fallback branch).
    - queryStrengthProgression: add `plannedExerciseId` filter to the query to restrict to planned_exercise_id.
    - queryVolumeProgression: add `plannedExerciseId` filtering when exerciseId is provided (or require plannedExerciseId when exerciseId specified).
    - queryPersonalRecords: require plannedExerciseId (or add overload) and filter by `planned_exercise_id`.
    - getProgressMetrics / other helpers that currently accept only exerciseId: update signatures if they surface exercise-specific metrics (make them require plannedExerciseId or add new method `getProgressMetricsByPlannedExercise`).
  - src/services/progress.service.ts
    - getExerciseHistory: make `plannedExerciseId` required argument and call databaseService.queryExerciseHistory with it.
    - getStrengthProgression / getVolumeProgression / getPersonalRecords: update to require plannedExerciseId where appropriate.
  - src/components/progress/ProgressChart.tsx
    - Update data fetching to include plannedExerciseId. If the component receives an exercise context from navigation props, ensure it also receives plannedExerciseId (from plan/session context).
    - Update prop types to require `plannedExerciseId`.
  - src/components/progress/PersonalRecords.tsx
    - Ensure calls to ProgressService.getPersonalRecords pass plannedExerciseId (or call narrower API).
  - src/screens/progress/WorkoutHistory.tsx
    - If it supports filters per planned exercise, wire filter controls to include plannedExerciseId and pass it to ProgressService.getWorkoutHistory / getExerciseHistory calls.
  - src/screens/progress/StrengthCharts.tsx
    - Require plannedExerciseId and pass to ProgressService.getStrengthProgression.
  - src/screens/progress/ProgressDashboard.tsx
    - For any exercise-specific widgets, require plannedExerciseId and pass through to ProgressService calls.
  - src/components/workout/SetLogger.tsx (caller side)
    - Ensure any onSetComplete handlers (ExerciseDetailScreen or parent) persist sets with plannedExerciseId (investigation shows this is already being saved; verify payload contains `plannedExerciseId`).
  - src/hooks/useProgressData.ts
    - Update hooks to accept and forward plannedExerciseId where applicable.
  - src/store/progress/progressSlice.ts
    - Update action payload shapes for loading exercise history/strength progression to include plannedExerciseId as required.
  - supabase/seed.sql (if tests need seeded planned_exercise rows) - add example seed data for planned_exercises linking planned_exercise_id to workout_plan_sessions.

- Files to be deleted or moved

  - Remove any internal comments or helper fallbacks that explicitly check `planned_exercise_id` and then fallback to `exercise_id`. No deletions of core code required; only remove fallback branches.

- Configuration file updates
  - package.json scripts: add test scripts if missing (e.g., "test:unit" / "test:integration") and ensure test runner configured to run new tests.
  - tsconfig.json: ensure tests paths included if needed.

[Functions]
All function signatures and implementations that previously allowed missing plannedExerciseId must be updated. No fallback behavior allowed.

- New functions

  - transformExerciseSetStrict(dbSet: DbExerciseSet): ExerciseSet — file: src/types/transforms.ts — purpose: strict transform that throws if planned_exercise_id is null/undefined. Used only in history/analytics queries.
  - databaseService.getProgressMetricsByPlannedExercise(userId: string, plannedExerciseId: string): Promise<ProgressMetrics> — file: src/services/database.service.ts — purpose: metrics scoped to the planned exercise (optional helper).

- Modified functions (exact name, file path, required changes)

  - queryExerciseHistory(userId: string, exerciseId: string, plannedExerciseId: string, limit: number = 6) — src/services/database.service.ts
    - Make `plannedExerciseId` required. Remove else fallback. Validate parameter (non-empty UUID). Query must include `.eq("exercise_sets.planned_exercise_id", plannedExerciseId)` and `.eq("exercise_sets.exercise_id", exerciseId)` as currently exists but with forced use.
    - Use strict transform for sets (transformExerciseSetStrict) to ensure plannedExerciseId is present in returned sets.
  - queryStrengthProgression(userId: string, exerciseId: string, plannedExerciseId: string, timeframe: "...") — src/services/database.service.ts
    - Add `.eq("planned_exercise_id", plannedExerciseId)` to the exercise_sets query and require parameter.
  - queryVolumeProgression(userId: string, exerciseId?: string, plannedExerciseId?: string, timeframe: "...") — src/services/database.service.ts
    - Decide: For per-exercise volume progression require plannedExerciseId when exerciseId provided; otherwise for global session volume (no exerciseId) keep behavior unchanged. Implementation: if exerciseId is provided, require plannedExerciseId; throw if missing.
  - queryPersonalRecords(userId: string, plannedExerciseId: string, exerciseId?: string, limit: number = 50) — src/services/database.service.ts
    - Adjust query to add `.eq("planned_exercise_id", plannedExerciseId)` on exercise_sets and require plannedExerciseId.
  - ProgressService.getExerciseHistory(userId: string, exerciseId: string, plannedExerciseId: string) — src/services/progress.service.ts
    - Require plannedExerciseId and forward to databaseService.queryExerciseHistory.
  - ProgressService.getStrengthProgression(userId: string, exerciseId: string, plannedExerciseId: string, timeframe?: "...") — src/services/progress.service.ts
    - Require plannedExerciseId.
  - ProgressService.getVolumeProgression(userId: string, exerciseId?: string, plannedExerciseId?: string, timeframe?: "...") — src/services/progress.service.ts
    - Mirror database rules: throw if exerciseId provided but plannedExerciseId missing.
  - Any store action creators or thunk names that load exercise history: ensure their payloads include plannedExerciseId and update reducers accordingly (src/store/progress/\*).

- Removed functions
  - Remove any internal helper method that performed fallback-to-exercise-id behavior (explicit fallback branch in queryExerciseHistory). If the code extracted such fallback into a separate helper, remove that helper or mark deprecated and delete.

[Classes]
No large class additions. Update DatabaseService and ProgressService method signatures as described.

- Modified classes

  - DatabaseService (src/services/database.service.ts)
    - Update method signatures and internal queries to require plannedExerciseId where applicable.
    - Add stricter transforms and input validation. Add index usage hint via migration file (not mandatory code).
  - ProgressService (src/services/progress.service.ts)
    - Update all relevant methods to accept plannedExerciseId and to throw when missing.

- New classes

  - None required.

- Removed classes
  - None required.

[Dependencies]
No major new runtime dependencies required. Add or update dev/test dependencies.

- Single sentence: Add a small DB migration and add tests; no new production packages required.
- Dev/test packages:
  - If project uses Jest (or vitest), ensure test runner is available; add "@testing-library/react-native" or similar to test components if not present.
  - No new production NPM packages are required.

[Testing]
All changes will be covered by new unit and integration tests; update existing tests.

- Single sentence: Add tests that assert that all history/progress methods require `planned_exercise_id` and properly filter sets.

- Test file requirements:

  - tests/progress/queryExerciseHistory.spec.ts
    - Unit test: call databaseService.queryExerciseHistory with missing plannedExerciseId -> expect thrown error.
    - Integration-style test (mock DB): return rows where planned_exercise_id mismatches and assert that results are empty.
    - Test that sets returned include `plannedExerciseId` and that PRs/metrics only consider sets for that plannedExerciseId.
  - tests/progress/progressServiceIntegration.spec.ts
    - Simulate typical UI call chains: SetLogger -> insertExerciseSets -> ProgressService.getExerciseHistory -> expect only sets for plannedExerciseId.
  - UI-level smoke tests:
    - ProgressChart & StrengthCharts should be tested to ensure they call service with plannedExerciseId.
  - Update any existing tests that relied on old fallback behavior to be strict or be rewritten.

- Validation & manual QA:
  - Use the seed data in supabase/seed.sql to create a planned_exercise and multiple sets with different planned_exercise_id values to verify filtering.
  - Manual verification steps included in README/test steps.

[Implementation Order]
Apply changes in a sequence that minimizes breakage and ensures compile-time errors guide UI updates.

- Single sentence: Update backend/service layers first, then update callers (ProgressService, hooks, stores), then update UI, add DB index, and finish with tests and QA.

1. Add DB migration to index `planned_exercise_id` (supabase/migrations/20250826000001_index_exercise_sets_planned_exercise_id.sql).
2. Update `src/types/transforms.ts`:
   - Add `transformExerciseSetStrict` and update transforms to surface plannedExerciseId as required for history paths.
3. Update `src/services/database.service.ts`:
   - Make `plannedExerciseId` required on `queryExerciseHistory`, `queryStrengthProgression`, `queryPersonalRecords` and any other exercise-scoped functions. Remove fallback branches — throw if missing.
   - Use `transformExerciseSetStrict` in history flows.
4. Update `src/services/progress.service.ts` to require `plannedExerciseId` in public API methods and forward them to DatabaseService.
5. Update store/actions (src/store/progress/\*) and hooks (src/hooks/useProgressData.ts) to include plannedExerciseId in action payloads and hook parameters.
6. Update UI components:
   - src/components/progress/ProgressChart.tsx
   - src/components/progress/PersonalRecords.tsx
   - src/screens/progress/WorkoutHistory.tsx
   - src/screens/progress/StrengthCharts.tsx
   - src/screens/progress/ProgressDashboard.tsx
     These should be modified to require and pass plannedExerciseId from navigation or context; compile-time errors will guide places that need plannedExerciseId added.
7. Update exercise logging path verification:
   - Confirm sets are persisted including `planned_exercise_id` (no code change if already correct). Add console/logging where needed to validate.
8. Create and run unit/integration tests; update seed.sql for test data to include planned exercises and sets with different planned_exercise_id.
9. Manual QA: verify history pages, charts, and personal records show only sets for the specific plannedExerciseId and that non-matching sets are excluded.
10. Remove any leftover fallback code and cleanup.

Notes and Edge Cases

- This is a backward-incompatible change: callers must supply plannedExerciseId. To avoid runtime crashes, compile-time TypeScript checking will surface required arg changes; ensure all callers are updated in the same PR (service -> store -> hooks -> UI).
- If some legacy areas legitimately need history across planned exercises (rare), add an explicit administrative API endpoint (out of scope) rather than implicit fallback.
- Ensure RLS policies and supabase row-level-security continue to allow the joined queries; the schema already supports `planned_exercise_id` in exercise_sets.
- Performance: the added index will mitigate query performance regressions when filtering by planned_exercise_id.
