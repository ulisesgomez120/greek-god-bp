// OFFLINE SERVICE (ARCHIVED - PHASE 4)
// Backup of src/services/offline.service.ts prior to deletion in Phase 4.
// This file was archived to preserve history in-repo before final removal.
// Original behavior: comprehensive offline storage and synchronization.
// Phase 3 converted this to a stub; Phase 4 removes it entirely.

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
