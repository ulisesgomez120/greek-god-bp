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

**Files to Delete:**

- `src/services/offline.service.ts` - Complete offline storage system
- `src/hooks/useWorkoutSync.ts` - Background sync hook
- `src/store/offline/offlineSlice.ts` - Offline Redux state management
- `src/middleware/offlineMiddleware.ts` - Offline Redux middleware
- `src/components/workout/SyncIndicator.tsx` - Sync status UI component (updated to online-first variant instead of delete)
- `supabase/functions/workout-sync/index.ts` - Server-side sync edge function (candidate for removal; keep until server behavior validated)

**Files to Modify:**

- `src/services/workout.service.ts` - Replace offline operations with direct Supabase calls (updated)
- `src/services/database.service.ts` - Remove offline queue delegation
- `src/screens/workout/ExerciseDetailScreen.tsx` - Remove sync calls, add loading states (updated)
- `src/store/workout/workoutSlice.ts` - Remove sync-related actions and state (planned)
- `src/store/index.ts` - Remove offline slice from store configuration (planned)
- `src/utils/storage.ts` - Remove offline queue utilities (planned)
- `src/middleware/authMiddleware.ts` - Remove sync-related middleware actions (planned)
- `src/components/workout/SyncIndicator.tsx` - Converted to an online-first informational component (updated)

**Configuration Updates:**

- Update `src/config/constants.ts` to remove offline-related constants
- Modify any import statements that reference deleted or migrated files

## [Functions]

Replace offline storage and sync functions with direct database operations.

**New Functions:**

- `createWorkoutSession(workout: WorkoutSession): Promise<DirectServiceResult<WorkoutSession>>` in `src/services/workout.service.ts` (conceptual)
- `addSetToWorkout(sessionId: string, setData: ExerciseSetFormData): Promise<DirectServiceResult<ExerciseSet>>` in `src/services/workout.service.ts` (conceptual)
- `updateWorkoutSession(sessionId: string, updates: Partial<WorkoutSession>): Promise<DirectServiceResult<WorkoutSession>>` in `src/services/workout.service.ts` (conceptual)
- `completeWorkoutSession(sessionId: string, notes?: string): Promise<DirectServiceResult<WorkoutSession>>` in `src/services/workout.service.ts` (conceptual)

**Modified Functions:**

- `startWorkout()` in `src/services/workout.service.ts` - Remove offline storage, add direct Supabase insert (implemented)
- `addExerciseSet()` in `src/services/workout.service.ts` - Remove offline storage, add direct Supabase insert (implemented)
- `completeWorkout()` in `src/services/workout.service.ts` - Remove offline storage, add direct Supabase update (implemented)
- `handleSetComplete()` in `src/screens/workout/ExerciseDetailScreen.tsx` - Remove immediate sync call and add submitting/loading state (implemented)

**Removed Functions:**

- All functions in `src/services/offline.service.ts` (planned removal)
- `syncPendingWorkouts()` from `src/services/workout.service.ts` (retained a no-op compatibility stub)
- All sync-related Redux thunks in `src/store/offline/offlineSlice.ts` (planned removal)
- All sync-related functions in `src/hooks/useWorkoutSync.ts` (planned removal)

## [Classes]

Remove OfflineService class and simplify WorkoutService class.

**Removed Classes:**

- `OfflineService` class in `src/services/offline.service.ts` - Complete removal including singleton pattern (planned)

**Modified Classes:**

- `WorkoutService` class in `src/services/workout.service.ts`:
  - Remove `offlineService` dependency (done)
  - Remove sync-related methods where appropriate (kept compatibility stub)
  - Remove offline configuration options (kept but can be removed later)
  - Simplify constructor to remove sync configuration over time
  - Replace offline storage calls with direct Supabase operations (done)
  - Add proper loading states and error handling for direct operations (partially done)

## [Dependencies]

No new dependencies required; remove offline-related imports.

Remove imports of:

- `src/services/offline.service.ts` from all files (in-progress)
- `src/hooks/useWorkoutSync.ts` from components (in-progress)
- `src/store/offline/offlineSlice.ts` from store configuration (planned)
- Any offline-related utility imports

Update existing Supabase client usage to handle direct operations with proper error handling and loading states.

## [Testing]

Update existing tests to remove offline scenarios and add direct operation tests.

**Test File Updates:**

- Remove any tests related to offline functionality
- Update workout service tests to test direct database operations
- Add tests for loading states and error handling in direct operations
- Update component tests to remove sync-related UI testing

**New Test Scenarios:**

- Direct workout creation with network errors
- Exercise set logging with immediate database persistence
- Workout completion with proper state updates
- Error handling for failed database operations

## [Implementation Order]

Implement changes in phases to minimize disruption and ensure data integrity.

1. **Phase 1: Modify WorkoutService for Direct Operations**

   - Update `startWorkout()` to create workout session directly in Supabase (completed)
   - Update `addExerciseSet()` to insert sets directly in Supabase (completed)
   - Update `completeWorkout()` to update session directly in Supabase (completed)
   - Add proper loading states and error handling (ExerciseDetailScreen updated)
   - Remove offline storage calls but keep sync methods temporarily (completed: offline calls removed from WorkoutService; sync stub kept)

2. **Phase 2: Update UI Components**

   - Modify `ExerciseDetailScreen.tsx` to handle loading states (completed)
   - Remove sync calls and sync status indicators from other screens (in progress)
   - Add proper error handling and retry mechanisms
   - Update other workout-related screens similarly

3. **Phase 3: Clean Up Redux State**

   - Remove offline slice from store configuration
   - Remove sync-related actions from workout slice
   - Update components to use simplified state structure
   - Remove sync-related middleware

4. **Phase 4: Remove Offline Infrastructure**

   - Delete `OfflineService` and related files
   - Remove `useWorkoutSync` hook
   - Delete sync-related edge functions after server validation
   - Clean up imports and unused utilities

5. **Phase 5: Testing and Optimization**
   - Test all workout flows with direct operations
   - Add proper error handling and user feedback
   - Optimize database queries and caching
   - Update documentation and remove offline references

---

## [Progress]

Current status (updates based on implemented changes):

- [x] Phase 1.1: Update startWorkout() for direct Supabase operations — src/services/workout.service.ts updated
- [x] Phase 1.2: Update addExerciseSet() for direct Supabase operations — src/services/workout.service.ts updated
- [x] Phase 1.3: Update completeWorkout() for direct Supabase operations — src/services/workout.service.ts updated
- [x] Phase 1.4: Add proper loading states and error handling — src/screens/workout/ExerciseDetailScreen.tsx updated (isSubmitting state)
- [x] Phase 1.5: Remove offline storage calls from WorkoutService — offline calls removed, compatibility sync stub retained
- [ ] Phase 1.6: Test Phase 1 changes and verify functionality (typecheck & runtime tests)
- [ ] Phase 2: Update additional UI components to remove/replace sync indicators — src/components/workout/SyncIndicator.tsx converted to online-first (partial)
- [ ] Phase 3: Clean up Redux state and remove offline slice
- [ ] Phase 4: Remove offline infrastructure files (deletions pending validation)
- [ ] Phase 5: Final testing and optimization

Files modified in Phase 1 (reference):

- src/services/workout.service.ts
- src/screens/workout/ExerciseDetailScreen.tsx
- src/components/workout/SyncIndicator.tsx

Notes:

- TypeScript full check was skipped per instruction (tsc reported tsconfig setting issue). Recommend running `npx tsc --noEmit` after adjusting tsconfig or in your environment once you are ready.
- I retained a compatibility `syncPendingWorkouts` stub to avoid breaking callers until the Redux cleanup is performed.
- Server-side edge function `supabase/functions/workout-sync/index.ts` is still present and should be removed only after confirming server-side behaviour/clients.

---

## How to start a new task with context

If you want me or another implementation agent to continue working on the next steps, create a new task that includes the relevant context and the path to this plan file. Example (what I will do when you ask me to "start the next task"):

1. Reference the plan document

   - Use: `implementation_plan.md` in repo root

2. Provide the minimal instruction and desired phase, for example:

   - "Start Phase 2: convert UI to online-first (remove sync calls from remaining components). Use implementation_plan.md as the source of truth."

3. If you want me to create a new automated task entry (so it appears in the workflow), I can create it now. I will include:
   - Task description summarizing the phase and files
   - Task progress checklist
   - Plan document navigation commands (so the implementer can read sections quickly)

Example new_task payload I will create when you ask me to start (I can run this for you):

```xml
<new_task>
<context>
[Short description]
Refer to @implementation_plan.md for full plan.

[Task Progress]
task_progress Items:
- [ ] Phase 2.1: Remove useWorkoutSync imports from all components
- [ ] Phase 2.2: Replace SyncIndicator with online-first variant
- [ ] Phase 2.3: Remove immediate sync calls from screens
- [ ] Phase 2.4: Run typecheck and smoke-test UI flows
</context>
</new_task>
```

If you want me to start Phase 2 now, tell me "Start Phase 2" and I will create the task and begin making the changes. Alternatively, tell me which specific step to start next (e.g., "remove offline slice from the Redux store" or "update remaining UI screens to drop sync calls").
