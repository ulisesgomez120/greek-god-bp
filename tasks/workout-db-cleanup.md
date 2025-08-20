# Workout DB Cleanup & Refactor Task

## Summary

This task continues the DB cleanup and service refactor after the foreign-key issue was fixed. It consolidates next steps, describes the reasoning and verification steps, and provides an actionable checklist so a developer can complete the cleanup with minimal repo exploration.

## Context

- Root cause already fixed: UI used planned_exercises.id instead of planned_exercises.exercise_id when showing/logging session exercises. Fix applied in `src/services/workoutPlan.service.ts` (mapping now prefers `planned_exercise.exercise_id`).
- Defensive validation added in `src/services/workout.service.ts` to verify exercise existence before inserting exercise_sets.
- Diagnostics were created and used: `scripts/diagnose_exercise_id.mjs`, `scripts/check_planned_exercises.mjs`.
- E2E verification done: starting a workout and logging a set now inserts an `exercise_sets` row successfully.

## Goals

- Remove diagnostic noise and consolidate diagnostics (move to scripts/diagnostics or remove).
- Centralize transforms and DB helpers in `src/services/database.service.ts` / `src/types/transforms.ts`.
- Remove dead/offline-sync code remnants.
- Add optional exercise-existence validation (config flag).
- Tighten types and add unit/integration tests.
- Improve error handling and structured logging for DB failures.
- Run typecheck and tests; perform manual verification; prepare PR.

## High-level Implementation Order

1. Create a task file and update `implementation_plan.md` with the refined plan (this file + optional updates).
2. Remove or move diagnostic scripts and flush console.log debug lines.
3. Refactor transforms so mapping between snake_case and camelCase is centralized (use `src/types/transforms.ts` or a single transforms module).
4. Consolidate duplicate DB logic into `database.service.ts` (caching, common queries, payload normalization).
5. Remove offline sync remnants or migrate them to a clean `OfflineService` (no runtime break).
6. Add toggleable validation flag for `workoutService.addExerciseSet()` (enabled by default).
7. Improve error handling and create a standardized `DatabaseError` shape and structured logs.
8. Update types in `src/types/database.ts` and `src/types/transforms.ts`; run `tsc --noEmit` and fix issues.
9. Add unit tests for transform functions and the session mapping in `workoutPlan.service`.
10. Add an integration test for session load → log set → assert `exercise_sets` row created.
11. Manual QA across workout flows.
12. Final cleanup, update `implementation_plan.md`, and open PR.

## Detailed Checklist

- [x] Investigate database setup and identify issues
- [x] Analyze service layer redundancies
- [x] Identify root cause of FK constraint violation and fix mapping
- [x] Create comprehensive implementation plan
- [x] Implement mapping fix in `workoutPlanService`
- [x] Add exercise existence validation in `workoutService`
- [x] Add diagnostics scripts and run checks
- [x] Verify e2e set logging
- [x] Move or remove diagnostic scripts (place under `scripts/diagnostics/` if keeping)
  - [x] Delete or move `scripts/diagnose_exercise_id.mjs`
  - [x] Delete or move `scripts/check_planned_exercises.mjs`
  - [x] Remove temporary console.log debug statements scattered in services/UI
- [ ] Consolidate and refactor transforms (centralize snake_case <-> camelCase mapping)
  - [ ] Audit `src/types/transforms.ts` and expand/correct mappings
  - [ ] Ensure null/undefined values are handled consistently
  - [ ] Update all service calls to use centralized transforms
- [ ] Consolidate DatabaseService logic
  - [ ] Audit methods in `src/services/database.service.ts` vs duplicate logic in `workoutPlan.service` / `workout.service`
  - [ ] Extract common query helpers (e.g., normalized inserts, upserts, transaction helpers)
  - [ ] Centralize caching utilities (avoid duplicate caches)
- [ ] Remove offline sync remnants
  - [ ] Search for references to OfflineService, queue, AsyncStorage offline queue keys
  - [ ] Remove dead code and comments or migrate logic into a single `OfflineService` if reintroducing offline in future
  - [ ] Ensure no runtime regressions (run app or relevant tests)
- [ ] Add toggleable validation flag to `workoutService.addExerciseSet()`
  - [ ] Introduce a config option (e.g., env var or runtime config) `enableExerciseValidation: boolean` (default true)
  - [ ] Make validation run conditional on the flag
  - [ ] Add unit tests exercising both enabled and disabled states
- [ ] Standardize Database error handling and structured logs
  - [ ] Create `DatabaseError` type (include constraint, query, payload)
  - [ ] Make FK/constraint errors produce actionable messages
  - [ ] Log insert failures with structured payload (avoid leaking PII)
- [ ] Types & TypeScript check
  - [ ] Update types in `src/types/database.ts` and `src/types/transforms.ts`
  - [ ] Run `npx tsc --noEmit` (or project script) and fix all type errors/warnings
- [ ] Tests
  - [ ] Unit tests for transform functions (mapping correctness)
  - [ ] Unit tests for `workoutPlanService` session/exercise mapping
  - [ ] Integration test: session load -> log set -> verify `exercise_sets` row created (stub Supabase or run against a test DB)
- [ ] Manual QA
  - [ ] Start multiple workouts, across multiple sessions
  - [ ] Log sets across exercises and verify `exercise_sets` rows and aggregated metrics
  - [ ] Validate app metrics reporting (PRs, progress calculations)
- [ ] Final PR
  - [ ] Cleanup commit history (squash/compose meaningful commits)
  - [ ] Update `implementation_plan.md` (summary of changes and reasoning)
  - [ ] Add PR description with steps to test locally (typecheck, run tests, run integration test)
  - [ ] Open PR and link issue(s)

## Developer Notes / Commands

- Typecheck: npx tsc --noEmit
- Run unit tests: npm test (or yarn test) — confirm the repo's test script in package.json and adjust accordingly
- Local dev: npm run start or the project's usual dev command (check package.json)
- Running diagnostics (if kept): node --experimental-modules scripts/diagnostics/diagnose_exercise_id.mjs (ensure .env.local is available)
- Useful grep to find offline remnants: rg "OfflineService|offline queue|AsyncStorage.\*queue" -S
- Plan navigation commands (copy from plan if helpful):
  - Read Overview section:
    sed -n '/[Overview]/,/[Types]/p' implementation_plan.md | head -n 1 | cat
  - Read Types section:
    sed -n '/[Types]/,/[Files]/p' implementation_plan.md | head -n 1 | cat
  - Read Files section:
    sed -n '/[Files]/,/[Functions]/p' implementation_plan.md | head -n 1 | cat
  - Read Functions section:
    sed -n '/[Functions]/,/[Classes]/p' implementation_plan.md | head -n 1 | cat
  - Read Classes section:
    sed -n '/[Classes]/,/[Dependencies]/p' implementation_plan.md | head -n 1 | cat
  - Read Dependencies section:
    sed -n '/[Dependencies]/,/[Testing]/p' implementation_plan.md | head -n 1 | cat
  - Read Testing section:
    sed -n '/[Testing]/,/[Implementation Order]/p' implementation_plan.md | head -n 1 | cat
  - Read Implementation Order section:
    sed -n '/[Implementation Order]/,$p' implementation_plan.md | cat

## Testing Guidance

- For integration tests that touch the DB, prefer a dedicated test schema or a disposable local Supabase test instance. Seed data for `exercises`, `workout_plans`, `planned_exercises`, and `workout_sessions` minimally. The integration test should:
  1. Load a plan/session via `workoutPlanService.getWorkoutSession()`.
  2. Call `workoutService.addExerciseSet()` for a known exercise id.
  3. Assert the `exercise_sets` row exists and FK constraints didn't reject it.

## Acceptance Criteria

- No console.debug/log noise left in services or UI (only structured logs).
- Diagnostics scripts either moved to `scripts/diagnostics/` or removed.
- Transform functions are centralized and tested.
- DB service consolidations reduce duplicate logic and are covered by unit tests.
- Validation flag exists and defaults to enabled.
- `npx tsc --noEmit` passes.
- Unit & integration tests added and passing.
- Manual QA performed and documented in PR.
