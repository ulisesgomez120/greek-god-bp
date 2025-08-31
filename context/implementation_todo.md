# Implementation Todo: planned_exercise_id history fix

Summary:
Goal: Ensure ExerciseDetailScreen shows only history for the specific planned_exercise (program/phase/session instance). Ensure exercise_sets.planned_exercise_id is populated when possible, and history queries filter by planned_exercise_id when provided.

High-level steps:

- Update types & transforms to include plannedExerciseId mapping
- Ensure insert path maps plannedExerciseId -> planned_exercise_id
- Ensure history queries accept plannedExerciseId and filter by it
- Propagate plannedExerciseId through workoutService and UI callers
- Create a safe backfill migration for existing rows (best-effort only)
- Add tests and QA checklist
- Run migration in staging, validate, then release

Checklist

- [ ] Step 1: Update Type Definitions and transform helpers to include `plannedExerciseId` mapping

  - Files to modify:
    - src/types/transforms.ts (transformExerciseSetToDb, transformExerciseSet, transformWorkoutSessionWithSets)
    - src/types/database.ts / src/types/index.ts (if there are DB shapes that need plannedExerciseId)
  - Tasks:
    - Add plannedExerciseId to front-end types where missing
    - Map plannedExerciseId <-> planned_exercise_id in all transforms
    - Add unit tests for transform mapping

- [ ] Step 2: Update DatabaseService methods (insertExerciseSets, queryExerciseHistory)

  - Files to modify:
    - src/services/database.service.ts
  - Tasks:
    - Update insertExerciseSets to accept plannedExerciseId in the payload and persist planned_exercise_id
    - Update queryExerciseHistory signature to accept optional plannedExerciseId and apply an additional WHERE planned_exercise_id = $x when provided
    - Keep default behavior unchanged when plannedExerciseId is null (fall back to exercise_id-only behavior)
    - Add unit tests for query filtering

- [ ] Step 3: Update WorkoutService.addExerciseSet and getExerciseHistory

  - Files to modify:
    - src/services/workout.service.ts
  - Tasks:
    - Accept plannedExerciseId in addExerciseSet (from UI) and include it in the set payload passed to databaseService.insertExerciseSets
    - Accept plannedExerciseId in getExerciseHistory and pass it to databaseService.queryExerciseHistory
    - Validate plannedExerciseId when provided (e.g., confirm it belongs to the user's plan/session if that check exists in service layer; if not possible, perform light validation or log)
    - Add unit tests

- [ ] Step 4: Update UI callers (ExerciseDetailScreen, SetLogger, hooks) to supply plannedExerciseId

  - Files to modify:
    - src/screens/workout/ExerciseDetailScreen.tsx
    - src/components/workout/SetLogger.tsx
    - src/hooks/useProgressData.ts
    - Any other callers that log sets or fetch history
  - Tasks:
    - Where the UI is showing a planned exercise instance, pass plannedExerciseId into workoutService.getExerciseHistory and workoutService.addExerciseSet
    - When in a freeform / ad-hoc workout (no plan), do not pass plannedExerciseId so behavior remains unchanged
    - Update types for component props where necessary
    - Add integration test / manual QA steps

- [ ] Step 5: Create migration supabase/migrations/20250830000001_backfill_planned_exercise_id_for_sets.sql

  - Migration contents (high level):
    - CREATE INDEX IF NOT EXISTS idx_exercise_sets_planned_exercise_id ON exercise_sets(planned_exercise_id);
    - Best-effort UPDATE to set planned_exercise_id using deterministic heuristics:
      - Join exercise_sets -> workout_sessions -> workout_plan_sessions -> planned_exercises where there is a unique match based on session id and exercise_id and optional ordering heuristics
      - Only update rows where the join yields exactly one distinct planned_exercise.id (to avoid ambiguous updates)
    - All updates logged/validated in SQL (use WITH ... RETURNING for review)
    - No attempt to populate rows where match is ambiguous; leave them NULL
  - Safety:
    - Migration should be applied in staging first, with checks that row counts updated are expected
    - Provide rollback SQL (logically revert the updates or snapshot before running)

- [ ] Step 6: Add unit/integration tests

  - Targets:
    - transform unit tests (plannedExerciseId mapping)
    - database.service tests for insertExerciseSets mapping and queryExerciseHistory filtering
    - workout.service tests for propagation
    - UI-level integration test or snapshot verifying ExerciseDetailScreen history displays only planned-exercise-specific history when plannedExerciseId provided
  - Files:
    - tests/unit/... (follow existing test conventions)

- [ ] Step 7: Run staging migration, validate backfill, run tests and QA checklist

  - Tasks:
    - Deploy migration to staging
    - Run validation queries:
      - Count of rows updated vs expected
      - Spot-check sample sessions & sets
      - Ensure no ambiguous updates occurred
    - Run test suite and manual QA steps

- [ ] Step 8: Release migration and client changes to production
  - Tasks:
    - Coordinate rollout with release window
    - Monitor errors and metrics post-release

Implementation notes and constraints

- Preserve backward compatibility: if plannedExerciseId is not present, history queries should still return exercise_id-based history (existing behavior).
- When the UI cannot determine plannedExerciseId (freeform workout), do not set planned_exercise_id.
- Any migration or DB operation that executes network or production changes must receive explicit approval before execution.
- For ambiguous backfill matches, prefer leaving planned_exercise_id NULL.
- Logging / telemetry should be added where helpful to observe frequency of missing plannedExerciseId writes.

Developer checklist for code edits

- [ ] Update transforms.ts
- [ ] Update database.service.ts
- [ ] Update workout.service.ts
- [ ] Update UI components/hooks
- [ ] Add migration file under supabase/migrations/
- [ ] Add tests
- [ ] Run linters/formatters
- [ ] Create PR with description of changes + migration notes

References

- Implementation plan: implementation_plan.md
- Files of interest (repo root):
  - src/services/workout.service.ts
  - src/services/database.service.ts
  - src/types/transforms.ts
  - src/screens/workout/ExerciseDetailScreen.tsx
  - src/components/workout/SetLogger.tsx
  - src/hooks/useProgressData.ts
  - supabase/migrations/
