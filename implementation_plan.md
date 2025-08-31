# Implementation Plan

[Overview]
Fix exercise history cross-contamination by making exercise history lookups program-specific: ensure logged sets are linked to the specific planned_exercise (planned_exercise_id) and make history queries filter by planned_exercise_id when available; provide a safe fallback for existing data without planned_exercise_id.

The app currently stores sets in `exercise_sets` with a reference to the base `exercises` entry but does not reliably attach the `planned_exercise_id` representing the plan/session template row that the user was following when they logged the set. Because history fetches (UI and analytics) filter only by `exercise_id`, users see sets from other programs/phases that used the same base exercise (e.g., "Back Squat"), causing confusing cross-contamination in ExerciseDetailScreen. This plan implements changes to types, transforms, service methods, UI callers, and a DB backfill migration to ensure the planned exercise context is captured and used for history queries. It minimizes user impact by using planned_exercise_id when available and falling back to exercise_id grouping when not.

[Types]  
Add plannedExerciseId to application and DB types; validations ensure it is set when context is available.

Detailed type definitions and changes:

- src/types/database.ts (DB types)
  - WorkoutExerciseSet (DB shape) additions:
    - planned_exercise_id: UUID | null
- src/types/index.ts or relevant app types (application-level types)
  - ExerciseSet (app shape) additions:
    - plannedExerciseId?: string | null
- Validation rules:
  - plannedExerciseId is optional on the DB column (existing schema supports it), but application code MUST set it when logging a set from a planned session.
  - When provided, plannedExerciseId must be a valid UUID string referencing `planned_exercises.id`.
  - History queries should prefer plannedExerciseId; if missing and the session is part of a plan, the app should attempt to resolve and backfill.

[Files]
Single sentence describing file modifications.  
Add and change files across services, transforms, UI, and a migration/backfill script.

Detailed breakdown:

- New files to be created:
  - supabase/migrations/20250830000001_backfill_planned_exercise_id_for_sets.sql — Purpose: Backfill `planned_exercise_id` on existing `exercise_sets` where possible and add an integrity helper index.
    - SQL actions:
      - Attempt to set `planned_exercise_id` by joining workout_sessions(session_id) -> workout_plan_sessions(id) and matching planned_exercises by (session_id, exercise_id, order_in_session) heuristics. Provide safe WHERE clauses and logging comments.
      - Add index on `exercise_sets(planned_exercise_id)` to support queries.
  - tests/services/exerciseHistory.spec.ts — Purpose: Unit tests for new history query behaviors and insert behavior (if test infra exists).
- Existing files to be modified:
  - src/services/workout.service.ts
    - add plannedExerciseId parameter handling in addExerciseSet()
    - pass plannedExerciseId into `databaseService.insertExerciseSets()` mapping
    - update getExerciseHistory(exerciseId, limit) -> getExerciseHistory(exerciseId, plannedExerciseId?, limit?)
      - New signature: async getExerciseHistory(exerciseId: string, plannedExerciseId?: string | null, limit: number = 6)
      - When plannedExerciseId present, filter by that column; otherwise fallback to current behavior.
  - src/services/database.service.ts
    - insertExerciseSets(): ensure transform includes planned_exercise_id mapping
      - Map `plannedExerciseId` -> `planned_exercise_id`
    - queryExerciseHistory(userId, exerciseId, limit) -> add optional plannedExerciseId parameter
      - New signature: async queryExerciseHistory(userId: string, exerciseId: string, limit: number = 6, plannedExerciseId?: string | null)
      - When plannedExerciseId is provided, query / join only rows where `exercise_sets.planned_exercise_id = plannedExerciseId`
      - Fallback: if plannedExerciseId missing, retain existing behavior (filter by exercise_id only)
  - src/services/progress.service.ts
    - update calls to databaseService.queryExerciseHistory(...) to optionally forward plannedExerciseId when caller has it; update signature of getExerciseHistory(userId, exerciseId) -> accept plannedExerciseId optional param and forward
  - src/types/transforms.ts
    - transformExerciseSetToDb(set) add mapping for `plannedExerciseId` => `planned_exercise_id`
    - transformExerciseSet(dbRow) add mapping for `planned_exercise_id` => `plannedExerciseId` in app object
  - src/screens/workout/ExerciseDetailScreen.tsx
    - Ensure the screen receives the `plannedExerciseId` for the planned exercise it is showing (from navigation params or workout plan state)
    - When logging a set, pass plannedExerciseId to workoutService.addExerciseSet
    - When fetching history, call workoutService.getExerciseHistory(exerciseId, plannedExerciseId, limit)
  - src/components/workout/SetLogger.tsx (or wherever addExerciseSet is called)
    - Update calls to workoutService.addExerciseSet to include plannedExerciseId when available
  - src/hooks/useProgressData.ts (if it calls ProgressService.getExerciseHistory)
    - Update to pass plannedExerciseId when present in hook inputs
- Files to be deleted or moved:
  - None.
- Configuration file updates:
  - None required, but update supabase migration list to include the new backfill migration. Add notes to project changelog.

[Functions]
Single sentence describing function modifications.  
Update service methods to accept plannedExerciseId and use it in DB queries; update transform helpers to map plannedExerciseId.

Detailed breakdown:

- New functions:
  - (migration-only) SQL function or procedure for best-effort backfill (name: backfill_planned_exercise_id_for_sets)
    - Path: supabase/migrations/20250830000001_backfill_planned_exercise_id_for_sets.sql
    - Purpose: Attempt to attach planned_exercise_id to exercise_sets where deterministically possible.
- Modified functions:
  - WorkoutService.addExerciseSet(setData)
    - File: src/services/workout.service.ts
    - Required changes:
      - Accept optional plannedExerciseId in the incoming setData payload.
      - When building appSet object passed to DatabaseService.insertExerciseSets, include plannedExerciseId.
      - When validating exercise existence, optionally validate plannedExerciseId exists in planned_exercises when provided.
      - Update logging to include plannedExerciseId.
    - New signature example:
      - async addExerciseSet(setData: { exerciseId: string; plannedExerciseId?: string; weightKg?: number; reps: number; ... })
  - WorkoutService.getExerciseHistory(exerciseId, plannedExerciseId?, limit?)
    - File: src/services/workout.service.ts
    - Required changes:
      - Update Supabase query to include `.eq('planned_exercise_id', plannedExerciseId)` when plannedExerciseId is provided.
      - Keep the existing defensive logic (skip rows that don't belong to user).
  - DatabaseService.insertExerciseSets(sets, options)
    - File: src/services/database.service.ts
    - Required changes:
      - Map `plannedExerciseId` -> `planned_exercise_id` when constructing dbSets.
      - Ensure .insert includes planned_exercise_id field.
  - DatabaseService.queryExerciseHistory(userId, exerciseId, limit, plannedExerciseId?)
    - File: src/services/database.service.ts
    - Required changes:
      - Add optional plannedExerciseId param and apply `.eq('exercise_sets.planned_exercise_id', plannedExerciseId)` when provided in the supabase query.
      - Keep existing transform and summary behavior.
  - Transform helpers:
    - transformExerciseSetToDb(set: ExerciseSet): ensure it includes `planned_exercise_id: set.plannedExerciseId || null`.
    - transformExerciseSet(dbRow): expose `plannedExerciseId: dbRow.planned_exercise_id || null`
  - ProgressService.getExerciseHistory(userId, exerciseId, plannedExerciseId?)
    - File: src/services/progress.service.ts
    - Forward plannedExerciseId to databaseService.queryExerciseHistory
- Removed functions:
  - None.

[Classes]
Single sentence describing class modifications.  
Update WorkoutService and DatabaseService classes to support plannedExerciseId flow and validation.

Detailed breakdown:

- Modified classes:
  - WorkoutService (src/services/workout.service.ts)
    - Changes:
      - add plannedExerciseId handling in addExerciseSet and getExerciseHistory
      - update TypeScript signatures for those methods
  - DatabaseService (src/services/database.service.ts)
    - Changes:
      - change insertExerciseSets and queryExerciseHistory signatures to accept and map plannedExerciseId
      - add cache invalidation on planned_exercise_id related keys (clearCache('exercise_sets') already exists; consider clearing by planned_exercise_id pattern)
- New classes:
  - None.
- Removed classes:
  - None.

[Dependencies]
Single sentence describing dependency modifications.  
No new external packages required.

Details:

- No new npm packages are required; changes are internal to TypeScript service layers and DB migrations.
- Ensure TypeScript types are updated and compiled; bump tsconfig if stricter checks required (not necessary by default).
- If tests are added and use a test runner not already present, add dev dependency (e.g., jest) — only if missing; check package.json before adding.

[Testing]
Single sentence describing testing approach.  
Add unit tests for transform helpers and service methods; add integration test for UI flow on ExerciseDetailScreen.

Test file requirements and validation strategies:

- tests/services/exerciseHistory.spec.ts
  - Unit tests:
    - transformExerciseSetToDb and transformExerciseSet correctly map plannedExerciseId
    - DatabaseService.insertExerciseSets constructs DB payload with planned_exercise_id when provided
    - DatabaseService.queryExerciseHistory filters by planned_exercise_id when provided (mock supabase client)
    - WorkoutService.addExerciseSet includes plannedExerciseId when calling DatabaseService
  - Integration tests (if infrastructure present):
    - Simulate creating a workout session for a planned_exercise and asserting that history fetched from ExerciseDetailScreen only returns sets for that planned_exercise.
    - Backfill migration test: validate migration sets planned_exercise_id for deterministically matchable rows and leaves ambiguous rows null.
- Manual QA steps:
  - Reproduce the issue: log sets under Upper/Lower Phase 2 Lower Body #2 for Back Squat; then open Full Body Phase 1 Full Body #1 Back Squat screen and verify history is empty (since no sets should exist for that planned_exercise).
  - Verify new sets logged while on a planned exercise show up only in that planned exercise's history.
  - Confirm analytics (ProgressService) continues to function when planned_exercise_id present or absent.
- Validation:
  - Add tests to ensure fallback behavior works: when planned_exercise_id is null, UI still shows relevant history but clearly indicates it's cross-program (optional).

[Implementation Order]
Single sentence describing the implementation sequence.  
Perform small, reversible changes in this order: update types and transforms, update service insert path, update UI callers, update history queries, add migration/backfill, add tests, and run QA.

Numbered steps:

1. Update Type Definitions and Transforms
   - Update src/types/database.ts and application-level types to include `plannedExerciseId`.
   - Update src/types/transforms.ts: transformExerciseSetToDb and transformExerciseSet mapping.
   - Run TypeScript compilation to find affected call sites.
2. Update DatabaseService
   - Change insertExerciseSets to map `planned_exercise_id`.
   - Change queryExerciseHistory to accept optional plannedExerciseId and apply filter when present.
   - Add index creation to new migration file (supabase/migrations/20250830000001_backfill_planned_exercise_id_for_sets.sql) and include backfill SQL (best-effort).
3. Update WorkoutService
   - Add plannedExerciseId to addExerciseSet() input shape and forward it to DatabaseService.insertExerciseSets.
   - Update getExerciseHistory() to accept optional plannedExerciseId and use it when calling Supabase (or forward to DatabaseService query function).
   - Add validation: when the current session has a plan/session context, include plannedExerciseId.
4. Update UI Callers
   - Modify src/screens/workout/ExerciseDetailScreen.tsx to supply plannedExerciseId where it shows a planned exercise (read from navigation params or resolved plan/session state).
   - Modify src/components/workout/SetLogger.tsx and any other callers to pass plannedExerciseId when logging sets.
   - Update hooks (e.g., src/hooks/useProgressData.ts) to pass plannedExerciseId into ProgressService.getExerciseHistory.
5. Add Migration & Backfill
   - Create supabase/migrations/20250830000001_backfill_planned_exercise_id_for_sets.sql to:
     - Add index on `exercise_sets.planned_exercise_id`
     - Attempt best-effort backfill using deterministic joins:
       - Join workout_sessions -> workout_plan_sessions -> planned_exercises by (workout_sessions.session_id = planned_exercises.session_id AND exercise_sets.exercise_id = planned_exercises.exercise_id AND planned_exercises.order_in_session = exercise_sets.set_number) where applicable
       - Backfill only when match is unique to avoid incorrect assignments
     - Provide comments in SQL and a safe rollback plan (record updated ids into a temporary table if desired).
   - Important: Run migration in staging and validate before production.
6. Add Tests
   - Implement unit tests for transforms and service methods.
   - Add one integration test for ExerciseDetailScreen history flow if test infra supports UI integration.
7. QA & Release
   - Run local tests and type checks.
   - Deploy migration to staging, validate backfill results.
   - Release to production after staging validation.
