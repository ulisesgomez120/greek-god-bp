// OFFLINE SERVICE (REMOVED - PHASE 3)
// This file used to implement comprehensive offline storage and synchronization.
// Phase 3 removes client-side offline sync. To avoid breaking imports while
// callers are migrated, we provide a lightweight stub that exposes the same
// surface but will throw if any method is invoked. This makes remaining call
// sites fail fast so they can be updated to online-first flows.
//
// Once callers are migrated, this file should be deleted entirely in Phase 4.

export class OfflineServiceStub {
  private constructor() {}

  static async storeWorkoutOffline(): Promise<void> {
    throw new Error(
      "OfflineService.storeWorkoutOffline has been removed. Migrate to online-first APIs (workoutService/databaseService) instead."
    );
  }

  static async getPendingWorkouts(): Promise<any[]> {
    // Return empty list as fallback to avoid undefined checks in caller code paths
    return [];
  }

  static async removeWorkoutOffline(): Promise<void> {
    throw new Error("OfflineService.removeWorkoutOffline has been removed. Migrate to online-first APIs instead.");
  }

  static async clearAllOfflineData(): Promise<void> {
    // No-op fallback
    return;
  }
}

export const offlineService = {
  storeWorkoutOffline: OfflineServiceStub.storeWorkoutOffline,
  getPendingWorkouts: OfflineServiceStub.getPendingWorkouts,
  removeWorkoutOffline: OfflineServiceStub.removeWorkoutOffline,
  clearAllOfflineData: OfflineServiceStub.clearAllOfflineData,
};

export default offlineService;
