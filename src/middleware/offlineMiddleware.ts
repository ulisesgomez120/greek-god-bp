// ============================================================================
// OFFLINE MIDDLEWARE
// ============================================================================
// Offline queue management middleware for handling actions when offline,
// automatic synchronization when back online, and conflict resolution
// DEPRECATION NOTE: This middleware is retained for Phase 2 to preserve behavior.
// It will be removed in Phase 3 when the Redux offline slice is deleted and UI
// components are fully converted to online-first direct persistence.

import { Middleware } from "@reduxjs/toolkit";
import { logger } from "../utils/logger";
import { setNetworkStatus } from "../store/ui/uiSlice";
import { syncPendingWorkouts } from "../store/workout/workoutSlice";

// ============================================================================
// OFFLINE MIDDLEWARE
// ============================================================================

/**
 * Offline middleware that handles:
 * - Network status detection and updates
 * - Automatic sync when back online
 * - Offline queue management for workout data
 */
export const offlineMiddleware: Middleware = (store) => (next) => (action: any) => {
  const state = store.getState() as any;
  const { ui, workout } = state;

  // Actions that should be queued when offline
  const offlineQueueableActions = [
    "workout/startWorkout",
    "workout/completeWorkout",
    "workout/addExerciseSet",
    "progress/updatePersonalRecords",
  ];

  // Actions that trigger sync when online
  const syncTriggerActions = ["ui/setNetworkStatus"];

  // Check if this action should be queued when offline
  const shouldQueue = offlineQueueableActions.some(
    (pattern) =>
      action.type && action.type.includes(pattern.split("/")[0]) && action.type.includes(pattern.split("/")[1])
  );

  // Handle offline queueing
  if (shouldQueue && ui.networkStatus === "offline") {
    logger.info(
      "Queueing action for offline processing",
      {
        actionType: action.type,
        timestamp: new Date().toISOString(),
      },
      "offline"
    );

    // Continue with the action (it will be stored locally)
    const result = next(action);

    // Add success notification for offline actions
    if (action.type.includes("workout/")) {
      store.dispatch({
        type: "ui/showInfoNotification",
        payload: {
          title: "Saved Offline",
          message: "Your workout data has been saved locally and will sync when you're back online.",
          duration: 4000,
        },
      });
    }

    return result;
  }

  // Handle network status changes and trigger sync
  if (action.type === "ui/setNetworkStatus") {
    const result = next(action);

    // If coming back online, trigger sync
    if (action.payload === "online" && ui.networkStatus === "offline") {
      logger.info("Network back online, triggering sync", undefined, "offline");

      // Trigger workout sync if there are pending workouts
      if (workout.offline.pendingSessions.length > 0) {
        store.dispatch({
          type: "ui/showSyncStartedNotification",
        });

        // Dispatch sync action
        setTimeout(() => {
          store.dispatch(syncPendingWorkouts() as any);
        }, 1000); // Small delay to let UI update
      }
    }

    return result;
  }

  // Handle sync completion
  if (action.type === "workout/syncPendingWorkouts/fulfilled") {
    const result = next(action);

    const { syncedCount } = action.payload;

    if (syncedCount > 0) {
      store.dispatch({
        type: "ui/showSyncCompletedNotification",
        payload: { syncedCount },
      });

      logger.info("Sync completed successfully", { syncedCount }, "offline");
    }

    return result;
  }

  // Handle sync failures
  if (action.type === "workout/syncPendingWorkouts/rejected") {
    const result = next(action);

    store.dispatch({
      type: "ui/showSyncFailedNotification",
      payload: { error: action.payload || "Unknown sync error" },
    });

    logger.error("Sync failed", action.payload, "offline");

    return result;
  }

  // Continue with normal action processing
  return next(action);
};

// ============================================================================
// NETWORK DETECTION
// ============================================================================

/**
 * Initialize network status detection
 */
export function initializeNetworkDetection(store: any): void {
  logger.info("Initializing network detection", undefined, "offline");

  // Initial network status
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  store.dispatch(setNetworkStatus(isOnline ? "online" : "offline"));

  // Set up network event listeners
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("online", () => {
      logger.info("Network status changed to online", undefined, "offline");
      store.dispatch(setNetworkStatus("online"));
    });

    window.addEventListener("offline", () => {
      logger.info("Network status changed to offline", undefined, "offline");
      store.dispatch(setNetworkStatus("offline"));
    });
  }

  // Periodic connectivity check (every 30 seconds when offline)
  setInterval(() => {
    const currentState = store.getState() as any;
    const currentStatus = currentState.ui.networkStatus;

    if (currentStatus === "offline") {
      // Try to detect if we're actually back online
      checkConnectivity().then((isConnected) => {
        if (isConnected && currentStatus === "offline") {
          logger.info("Connectivity restored via periodic check", undefined, "offline");
          store.dispatch(setNetworkStatus("online"));
        }
      });
    }
  }, 30000);

  logger.info("Network detection initialized", undefined, "offline");
}

/**
 * Check actual connectivity by making a lightweight request
 */
async function checkConnectivity(): Promise<boolean> {
  try {
    // Try to fetch a small resource to test connectivity
    const response = await fetch("/favicon.ico", {
      method: "HEAD",
      cache: "no-cache",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    return response.ok;
  } catch (error) {
    logger.debug("Connectivity check failed", error, "offline");
    return false;
  }
}

// ============================================================================
// OFFLINE STORAGE MANAGEMENT
// ============================================================================

/**
 * Clean up old offline data
 */
export function cleanupOfflineData(store: any, maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
  const state = store.getState() as any;
  const { workout } = state;

  const cutoffTime = Date.now() - maxAge;
  const pendingSessions = workout.offline.pendingSessions || [];

  const validSessions = pendingSessions.filter((session: any) => {
    const sessionTime = new Date(session.createdAt).getTime();
    return sessionTime > cutoffTime;
  });

  const removedCount = pendingSessions.length - validSessions.length;

  if (removedCount > 0) {
    logger.info("Cleaned up old offline data", { removedCount }, "offline");

    // Update the store with cleaned data
    store.dispatch({
      type: "workout/setOfflineData",
      payload: { pendingSessions: validSessions },
    });
  }
}

/**
 * Get offline storage statistics
 */
export function getOfflineStats(store: any): OfflineStats {
  const state = store.getState() as any;
  const { workout, ui } = state;

  const pendingSessions = workout.offline.pendingSessions || [];
  const totalSessions = pendingSessions.length;

  const oldestSession =
    pendingSessions.length > 0 ? Math.min(...pendingSessions.map((s: any) => new Date(s.createdAt).getTime())) : null;

  const newestSession =
    pendingSessions.length > 0 ? Math.max(...pendingSessions.map((s: any) => new Date(s.createdAt).getTime())) : null;

  return {
    isOnline: ui.networkStatus === "online",
    pendingWorkouts: totalSessions,
    syncStatus: workout.offline.syncStatus,
    oldestPendingWorkout: oldestSession ? new Date(oldestSession).toISOString() : null,
    newestPendingWorkout: newestSession ? new Date(newestSession).toISOString() : null,
  };
}

interface OfflineStats {
  isOnline: boolean;
  pendingWorkouts: number;
  syncStatus: "idle" | "syncing" | "error";
  oldestPendingWorkout: string | null;
  newestPendingWorkout: string | null;
}

// ============================================================================
// CONFLICT RESOLUTION
// ============================================================================

/**
 * Handle sync conflicts when the same data exists both locally and on server
 */
export function resolveConflicts(localData: any[], serverData: any[]): ConflictResolution {
  const conflicts: DataConflict[] = [];
  const resolved: any[] = [];

  // Create maps for easier lookup
  const localMap = new Map(localData.map((item) => [item.id, item]));
  const serverMap = new Map(serverData.map((item) => [item.id, item]));

  // Check for conflicts
  for (const [id, localItem] of localMap) {
    const serverItem = serverMap.get(id);

    if (serverItem) {
      const localTime = new Date(localItem.updatedAt).getTime();
      const serverTime = new Date(serverItem.updatedAt).getTime();

      if (Math.abs(localTime - serverTime) > 1000) {
        // More than 1 second difference
        conflicts.push({
          id,
          localItem,
          serverItem,
          localTimestamp: localTime,
          serverTimestamp: serverTime,
        });
      } else {
        // No significant conflict, use server version
        resolved.push(serverItem);
      }
    } else {
      // Local item doesn't exist on server, keep local
      resolved.push(localItem);
    }
  }

  // Add server items that don't exist locally
  for (const [id, serverItem] of serverMap) {
    if (!localMap.has(id)) {
      resolved.push(serverItem);
    }
  }

  logger.info(
    "Conflict resolution completed",
    {
      totalConflicts: conflicts.length,
      resolvedItems: resolved.length,
    },
    "offline"
  );

  return {
    conflicts,
    resolved,
    strategy: "last-write-wins", // Could be configurable
  };
}

interface DataConflict {
  id: string;
  localItem: any;
  serverItem: any;
  localTimestamp: number;
  serverTimestamp: number;
}

interface ConflictResolution {
  conflicts: DataConflict[];
  resolved: any[];
  strategy: "last-write-wins" | "manual" | "merge";
}

/**
 * Apply conflict resolution strategy
 */
export function applyConflictResolution(
  conflicts: DataConflict[],
  strategy: ConflictResolution["strategy"] = "last-write-wins"
): any[] {
  const resolved: any[] = [];

  for (const conflict of conflicts) {
    switch (strategy) {
      case "last-write-wins":
        // Use the item with the most recent timestamp
        const winner = conflict.localTimestamp > conflict.serverTimestamp ? conflict.localItem : conflict.serverItem;
        resolved.push(winner);

        logger.info(
          "Conflict resolved using last-write-wins",
          {
            id: conflict.id,
            winner: conflict.localTimestamp > conflict.serverTimestamp ? "local" : "server",
          },
          "offline"
        );
        break;

      case "manual":
        // For manual resolution, we'd typically show UI to user
        // For now, default to server version
        resolved.push(conflict.serverItem);
        logger.warn(
          "Manual conflict resolution not implemented, using server version",
          {
            id: conflict.id,
          },
          "offline"
        );
        break;

      case "merge":
        // Attempt to merge the data (implementation depends on data structure)
        const merged = mergeConflictedData(conflict.localItem, conflict.serverItem);
        resolved.push(merged);
        logger.info(
          "Conflict resolved using merge strategy",
          {
            id: conflict.id,
          },
          "offline"
        );
        break;

      default:
        resolved.push(conflict.serverItem);
    }
  }

  return resolved;
}

/**
 * Merge conflicted data (basic implementation)
 */
function mergeConflictedData(localItem: any, serverItem: any): any {
  // Basic merge strategy - combine non-conflicting fields
  // In a real implementation, this would be more sophisticated
  return {
    ...serverItem, // Start with server data
    ...localItem, // Override with local changes
    updatedAt: new Date().toISOString(), // Mark as newly merged
    mergedAt: new Date().toISOString(),
    conflictResolved: true,
  };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize offline middleware and related functionality
 */
export function initializeOfflineMiddleware(store: any): void {
  logger.info("Initializing offline middleware", undefined, "offline");

  // Initialize network detection
  initializeNetworkDetection(store);

  // Set up periodic cleanup of old offline data (daily)
  setInterval(() => {
    cleanupOfflineData(store);
  }, 24 * 60 * 60 * 1000);

  // Initial cleanup
  cleanupOfflineData(store);

  logger.info("Offline middleware initialized", undefined, "offline");
}

export default offlineMiddleware;
