// NOTE: useWorkoutSync (ARCHIVED - PHASE 4)
// Backup of src/hooks/useWorkoutSync.ts prior to deletion in Phase 4.
// Phase 3 converted this to a runtime-throwing stub to surface remaining call-sites.
// This archived copy preserves the file for reference before final removal.

// NOTE: useWorkoutSync has been removed in Phase 3.
// This file intentionally throws at runtime to surface any remaining call-sites
// so they can be migrated to online-first flows (use workoutService directly).
//
// Migration guidance:
// - Replace `const { startSync, ... } = useWorkoutSync()` with direct calls to
//   `workoutService` APIs and component-level submitting/loading state.
// - If you relied on notifications, call the uiSlice actions directly or use the
//   existing notification helpers.
//
// This file will be deleted in Phase 4 once all callers are migrated.

export function useWorkoutSync(): never {
  throw new Error(
    "useWorkoutSync has been removed. Migrate callers to use workoutService APIs and local submitting state."
  );
}

export default useWorkoutSync;
