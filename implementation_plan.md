# Implementation Plan (Updated - Phase 4 actions applied)

## Summary of recent Phase 4 actions

Phase 4 cleanup has begun and several offline-related artifacts were archived and removed from the active codebase to complete the online-first migration begun in Phase 1-3.

Completed actions (Phase 4):

- Archived `src/services/offline.service.ts` to `src/archived/offline.service.ts` (preserves original stub/implementation).
- Overwrote `src/services/offline.service.ts` with a no-op `export {}` marker (file kept so imports don't break until callers are migrated).
- Archived `src/hooks/useWorkoutSync.ts` to `src/archived/useWorkoutSync.ts`.
- Overwrote `src/hooks/useWorkoutSync.ts` with a no-op `export {}` marker (to force callers to migrate to online-first APIs).
- Archived `supabase/functions/workout-sync/index.ts` to `supabase/functions/archived/workout-sync/index.ts`.
- Overwrote `supabase/functions/workout-sync/index.ts` with a no-op `export {}` marker to remove the active edge function.
- Confirmed there are no `offlineSlice` or `offlineMiddleware` artifacts in the repository (search returned no matches).

Rationale:

- Archiving preserves the original code in the repo for easy reference and rollback while removing active implementations that are no longer used.
- Replacing the originals with no-op modules forces any residual runtime imports to surface quickly at build or test time so they can be migrated.
- Keeping archived copies avoids reliance on git history for immediate reference and simplifies rollback for quick fixes if needed.

## Files (current status)

- src/services/offline.service.ts
  - Status: OVERWRITTEN -> now exports nothing. Archived at `src/archived/offline.service.ts`.
- src/hooks/useWorkoutSync.ts
  - Status: OVERWRITTEN -> now exports nothing. Archived at `src/archived/useWorkoutSync.ts`.
- supabase/functions/workout-sync/index.ts
  - Status: OVERWRITTEN -> now exports nothing. Archived at `supabase/functions/archived/workout-sync/index.ts`.
- src/store/offline/offlineSlice.ts
  - Status: Not present in codebase (no runtime file). Confirmed via repository search.
- src/middleware/offlineMiddleware.ts
  - Status: Not present in codebase (no runtime file). Confirmed via repository search.

## Next steps (remaining tasks)

1. Run full TypeScript validation:
   - `npx tsc --noEmit`
   - Fix any regressions (tsconfig adjustments may be needed for workspace and server-side archived files).
2. Run the manual smoke tests (recommended before final deletion of archived copies):
   - Start workout → Add sets → Complete workout (online)
   - Simulate network-offline scenarios and validate UI behavior & error messages
   - Verify WorkoutSummary retry behavior and loading states
3. Remove archived copies (optional final cleanup) once confident:
   - Delete `src/archived/offline.service.ts`
   - Delete `src/archived/useWorkoutSync.ts`
   - Delete `supabase/functions/archived/workout-sync/index.ts`
   - Or keep archives if you want in-repo references (team preference)
4. Update tests:
   - Remove or update any tests that referenced the offline API/hook/edge function
   - Add unit tests for loading & error states where appropriate
5. Final documentation:
   - Mark Phase 4 as complete in README or internal migration docs
   - Create a short migration note for contributors describing the removal (how to migrate callers, where archived copies are)

## Notes / Risk Mitigation

- Keep small, focused commits and run incremental `npx tsc --noEmit` after the next changes.
- Use the archived copies as a reference and not as runtime code.
- If a blocked caller remains (importing the deleted modules), `npx tsc --noEmit` will point it out. Migrate call sites to `workout.service` and `database.service` APIs and use component-level `isSubmitting` state where needed.

## Contact points for migration

- Primary service: `src/services/workout.service.ts` — use `startWorkout`, `addExerciseSet`, `completeWorkout` functions for server persistence.
- For DB-level implementation details: `src/services/database.service.ts`
- UI patterns: `SetLogger` accepts `isSubmitting`, `ExerciseCard.onSetComplete` returns a Promise, `WorkoutSummaryScreen` provides loading/retry UX.

---
