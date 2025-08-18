# Implementation Plan

## [Overview]

Convert TrainSmart from offline-first/sync architecture to direct online database operations to reduce costs and complexity.

This implementation removes the complex offline synchronization system that includes background polling, conflict resolution, and expensive edge function calls. The current system uses OfflineService for local storage, WorkoutService for sync management, and multiple Redux slices for state coordination. By converting to direct Supabase operations, we eliminate the need for constant polling intervals, reduce edge function costs, and simplify the codebase while maintaining data reliability through Supabase's built-in features.

## [Types]

Modify existing workout-related types to remove offline/sync properties and add loading states.

```typescript
// Remove from WorkoutSession type
interface WorkoutSession {
  // Remove these properties:
  // syncStatus: "pending" | "synced" | "conflict";
  // offlineCreated: boolean;

  // Keep existing properties and add:
  isLoading?: boolean;
  lastSaved?: string;
}

// Remove from ExerciseSet type
interface ExerciseSet {
  // Remove offline-specific properties
  // Keep all existing properties
}

// New simplified service result type
interface DirectServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  isLoading?: boolean;
}

// Remove these types entirely:
// - OfflineWorkout
// - OfflineWorkoutData
// - SyncResult
// - SyncConflict
// - All offline-related Redux state types
```

## [Files]

Remove offline infrastructure files and modify workout flow files to use direct database operations.

Files that are targeted for deletion or conversion (status noted below):

- `src/services/offline.service.ts` - Complete offline storage system (planned removal; keep until Phase 4 validation)
- `src/hooks/useWorkoutSync.ts` - Background sync hook (marked for removal in Phase 4; compatibility fixes applied)
- `src/store/offline/offlineSlice.ts` - Offline Redux state management (removed from store config; file deletion pending verification)
- `src/middleware/offlineMiddleware.ts` - Offline Redux middleware (removed from store config; file deletion pending verification)
- `src/components/workout/SyncIndicator.tsx` - Converted to online-first informational component (updated)
- `supabase/functions/workout-sync/index.ts` - Server-side sync edge function (candidate for removal; keep until server behavior validated)

Files modified (high level):

- `src/services/workout.service.ts` - Replaced offline operations with direct Supabase calls (implemented)
- `src/services/database.service.ts` - Remove offline queue delegation (planned)
- `src/screens/workout/ExerciseDetailScreen.tsx` - Removed sync calls, added loading states (implemented)
- `src/store/workout/workoutSlice.ts` - Remove sync-related actions and state (planned)
- `src/store/index.ts` - Removed offline slice from store configuration (implemented)
- `src/utils/storage.ts` - Remove offline queue utilities (planned)
- `src/middleware/authMiddleware.ts` - Removed sync-related middleware actions and fixed types (updated)
- `src/components/workout/SyncIndicator.tsx` - Converted to an online-first informational component (implemented)
- `src/components/workout/SetLogger.tsx` - Accepts `isSubmitting` prop for external control (implemented)
- `src/components/workout/ExerciseCard.tsx` - `onSetComplete` updated to return a Promise (implemented)
- `src/screens/workout/WorkoutSummaryScreen.tsx` - Rewritten to use server-driven loading/retry (implemented)
- `tsconfig.json` - Simplified to fix TypeScript checks (updated)

**Note:** Files are being retained until server behavior and end-to-end flows are validated. Where removal is safe it's been removed from runtime (store configuration / import removal), but actual file deletion is deferred to Phase 4 in most cases to keep rollback simple.

## [Functions]

Replace offline storage and sync functions with direct database operations.

**New Functions (conceptual):**

- `createWorkoutSession(workout: WorkoutSession): Promise<DirectServiceResult<WorkoutSession>>` in `src/services/workout.service.ts`
- `addSetToWorkout(sessionId: string, setData: ExerciseSetFormData): Promise<DirectServiceResult<ExerciseSet>>` in `src/services/workout.service.ts`
- `updateWorkoutSession(sessionId: string, updates: Partial<WorkoutSession>): Promise<DirectServiceResult<WorkoutSession>>` in `src/services/workout.service.ts`
- `completeWorkoutSession(sessionId: string, notes?: string): Promise<DirectServiceResult<WorkoutSession>>` in `src/services/workout.service.ts`

**Modified / Implemented Functions:**

- `startWorkout()` in `src/services/workout.service.ts` - now creates a workout session directly in Supabase (implemented)
- `addExerciseSet()` in `src/services/workout.service.ts` - inserts sets directly in Supabase (implemented)
- `completeWorkout()` in `src/services/workout.service.ts` - updates session directly in Supabase (implemented)
- `handleSetComplete()` in `src/screens/workout/ExerciseDetailScreen.tsx` - removed immediate sync call and added submitting/loading state (implemented)

**Compatibility Stubs / Notes:**

- `syncPendingWorkouts()` is retained as a no-op compatibility stub in `workout.service.ts` to avoid breaking existing callers; slated for removal in Phase 4.
- `useWorkoutSync` hook remains in the codebase with deprecation comments and minor type fixes; scheduled for removal in Phase 4.

## [Classes]

Remove OfflineService class and simplify WorkoutService class.

**Removed Classes (planned):**

- `OfflineService` class in `src/services/offline.service.ts` - Complete removal planned for Phase 4 after validation

**Modified Classes (implemented where noted):**

- `WorkoutService` class in `src/services/workout.service.ts`:
  - `offlineService` dependency removed where possible (done in core methods)
  - Sync-related methods removed or kept as compatibility stubs
  - Constructor simplified (sync timers removed)
  - Direct Supabase operations used for CRUD on workout sessions and sets (done)
  - Loading states and error handling added to public methods (partially done; screen-level loading controls applied)

## [Dependencies]

No new dependencies required. Remove offline-related imports over phases.

- Removed imports and usage of offline slice from the store configuration.
- Removed useWorkoutSync imports from UI components where applicable (in progress).
- Kept server-side sync edge function until server behavior validated.

## [Testing]

Update tests to reflect online-first behavior.

**Test File Updates Needed:**

- Remove offline-related test cases
- Update workout service tests to mock direct Supabase operations
- Add tests for loading states and failure scenarios
- Run full TypeScript check and fix remaining issues

**Current recommendation:** run `npx tsc --noEmit` after local environment tsconfig adjustments, then run manual smoke tests for workout flows (log set, complete workout, recover session).

## [Implementation Order and Phases]

Implement changes in phases to minimize disruption and ensure data integrity.

1. **Phase 1: Modify WorkoutService for Direct Operations** (COMPLETED)

   - Update `startWorkout()` to create workout session directly in Supabase — done
   - Update `addExerciseSet()` to insert sets directly in Supabase — done
   - Update `completeWorkout()` to update session directly in Supabase — done
   - Add loading states and error handling — done (component-level)
   - Remove offline storage calls but keep compatibility stubs — done

2. **Phase 2: Update UI Components** (LARGELY COMPLETED)

   - Modify `ExerciseDetailScreen.tsx` to handle loading states — done
   - Update `SetLogger.tsx` to accept `isSubmitting` prop and avoid duplicate submissions — done
   - Update `ExerciseCard.tsx` to make `onSetComplete` async and return a Promise — done
   - Replace `SyncIndicator` usages with online-first variant — done (component converted)
   - Remove `useWorkoutSync` and `syncPendingWorkouts` calls from UI components — in progress (removed from major screens; remaining references documented)
   - Rewrite `WorkoutSummaryScreen.tsx` to load session data and show loading/error/retry states — done

3. **Phase 3: Clean Up Redux State** (IN PROGRESS / NEXT)

   - Remove offline slice from store configuration — done (imports removed)
   - Delete or archive `src/store/offline/offlineSlice.ts` after ensuring no runtime references — pending
   - Remove sync-related actions from workout slice and UI selectors — pending
   - Remove `offlineMiddleware` usage and references — marked for deletion (file present for now)
   - Update components that still reference offline slice to use graceful fallbacks (keep selectors until Phase 4) — ongoing

4. **Phase 4: Remove Offline Infrastructure** (FUTURE)

   - Delete `OfflineService` and related storage utilities
   - Remove `useWorkoutSync` hook and related tests
   - Remove server-side sync edge function(s) only after production validation
   - Final clean-up of imports and types

5. **Phase 5: Testing and Optimization**
   - Full type-check and fix remaining TS issues
   - Run integration/manual smoke tests for workout flows
   - Add or update unit/integration tests
   - Update documentation and developer guides

---

## [Progress]

Current status (updated to reflect recent work):

- [x] Phase 1.1: Update startWorkout() for direct Supabase operations — src/services/workout.service.ts updated
- [x] Phase 1.2: Update addExerciseSet() for direct Supabase operations — src/services/workout.service.ts updated
- [x] Phase 1.3: Update completeWorkout() for direct Supabase operations — src/services/workout.service.ts updated
- [x] Phase 1.4: Add proper loading states and error handling — src/screens/workout/ExerciseDetailScreen.tsx updated (isSubmitting state)
- [x] Phase 1.5: Remove offline storage calls from WorkoutService — offline calls removed, compatibility sync stub retained
- [ ] Phase 1.6: Test Phase 1 changes and verify functionality (typecheck & runtime tests)
- [x] Phase 2.1: Modify UI components to use online-first patterns (SetLogger, ExerciseCard, ExerciseDetail) — updated
- [x] Phase 2.2: Replace SyncIndicator with online-first informational component — src/components/workout/SyncIndicator.tsx updated
- [x] Phase 2.3: Remove sync calls from main screens (ExerciseDetail done; ExerciseList & WorkoutSummary updated) — mostly done
- [x] Phase 2.4: Update WorkoutSummaryScreen to use loading/retry states — src/screens/workout/WorkoutSummaryScreen.tsx updated
- [x] Phase 2.5: Remove offline slice references from store configuration — src/store/index.ts updated
- [x] Phase 2.6: Remove offline middleware from runtime config (file still present, marked for Phase 3/4 deletion)
- [x] Phase 2.7: Fix TypeScript errors (useWorkoutSync useRef, authMiddleware setTimeout, WorkoutNavigator component types) — fixed
- [ ] Phase 3.1: Remove remaining offlineService usages and migrate to online-first
- [ ] Phase 3.2: Clean up remaining Redux offline references (slices, selectors)
- [ ] Phase 3.3: Test workout flows to ensure online-first behavior works correctly
- [ ] Phase 4.1: Delete offline.service.ts, useWorkoutSync.ts, and offline middleware (after Phase 3 validation)
- [ ] Phase 5: Full typecheck, tests, and documentation updates

---

## [Next Task — Phase 3: Redux & Remaining Offline Removal]

Goal: Remove remaining offline references and prepare the codebase for final cleanup in Phase 4.

Scope:

- Find and remove any remaining imports/usages of `offline.service`, `offlineSlice`, `offlineMiddleware`, and `useWorkoutSync` across the codebase.
- Update `src/services/database.service.ts` to remove offline queue delegation if present.
- Update any components that still reference offline selectors to use the new workout slice or fallbacks.
- Remove or update tests referencing offline functionality.
- Create a migration checklist and run `npx tsc --noEmit` and a manual smoke test of workout flows.

Files to inspect and update (initial list):

- src/services/database.service.ts
- src/store/workout/workoutSlice.ts
- src/store/offline/offlineSlice.ts
- src/middleware/offlineMiddleware.ts
- src/hooks/useWorkoutSync.ts
- src/screens/workout/ExerciseListScreen.tsx
- src/screens/workout/WorkoutSummaryScreen.tsx (verify all sync calls removed)
- src/screens/workout/ExerciseDetailScreen.tsx (already updated; re-verify)
- src/components/workout/SyncIndicator.tsx (verify graceful fallback)
- src/components/workout/SetLogger.tsx (verify `isSubmitting` wiring from all call sites)

Phase 3 Checklist:

- [ ] Search repository and remove leftover offline imports/usages
- [ ] Update remaining components to accept/loading states where necessary
- [ ] Delete / archive `src/store/offline/offlineSlice.ts` (after verifying no references)
- [ ] Delete `src/middleware/offlineMiddleware.ts` and adjust middleware chain
- [ ] Run `npx tsc --noEmit` and fix any TS regressions
- [ ] Run manual smoke test for workout flows and document issues

If you want, I can start Phase 3 now and:

- Create a dedicated task with the checklist above
- Begin by searching for remaining usages of `syncPendingWorkouts`, `useWorkoutSync`, and `offlineSlice` and produce an inventory
- Then make targeted edits (one at a time, with confirmations)

---

## [How to start a new task with context]

If you want me or another implementation agent to continue working on the next steps, create a new task that includes the relevant context and the path to this plan file. Example (what I will do when you ask me to "start the next task"):

1. Reference the plan document

   - Use: `implementation_plan.md` in repo root

2. Provide the minimal instruction and desired phase, for example:

   - "Start Phase 3: remove remaining offlineService usages and clean up Redux offline references. Use implementation_plan.md as the source of truth."

3. If you want me to create a new automated task entry, I can create it now. I will include:
   - Task description summarizing the phase and files
   - Task progress checklist
   - Plan document navigation commands (so the implementer can read sections quickly)

Example new_task payload I will create when you ask me to start:

```xml
<new_task>
<context>
Start Phase 3: Remove remaining offlineService usages and migrate to online-first.

task_progress:
- [ ] Find remaining references to offlineSlice, offline.service, and useWorkoutSync
- [ ] Update database.service to remove queue delegation
- [ ] Run typecheck and manual smoke test
- [ ] Delete offline slice and middleware after validation
</context>
</new_task>
```

---

## [Notes & Recommendations]

- Keep the compatibility stub `syncPendingWorkouts()` in `workout.service.ts` until all references are removed; it reduces risk during staged migration.
- Run incremental type-checks (`npx tsc --noEmit`) after each major change to catch TS regressions early.
- Manual smoke tests should cover:
  - Start workout, add sets, and complete workout (online)
  - Error during set save (simulate network down)
  - Retry flow for WorkoutSummary and recovery flow
- After Phase 3 verification, proceed with Phase 4 deletions and then run full test suite.
