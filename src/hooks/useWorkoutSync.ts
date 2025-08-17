// ============================================================================
// USE WORKOUT SYNC HOOK
// ============================================================================
// Background sync hook with conflict resolution, retry logic, and network-aware
// synchronization strategies
// DEPRECATION NOTE: This hook is retained for backward compatibility during Phase 2.
// UI components should stop calling background sync and instead rely on direct
// persistence via workoutService with explicit user-visible loading states.
// Planned removal: Phase 4 — do not add new usages.

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppDispatch, useAppSelector } from "./redux";
import { useNetworkStatus } from "./useNetworkStatus";
import { workoutService } from "../services/workout.service";
import { offlineService, type SyncResult, type SyncConflict } from "../services/offline.service";
import { logger } from "../utils/logger";
import {
  showSyncStartedNotification,
  showSyncCompletedNotification,
  showSyncFailedNotification,
  showWarningNotification,
} from "../store/ui/uiSlice";
import { setSyncStatus } from "../store/workout/workoutSlice";

// ============================================================================
// TYPES
// ============================================================================

export interface SyncState {
  isActive: boolean;
  progress: number; // 0-100
  currentWorkout?: string;
  totalWorkouts: number;
  syncedCount: number;
  errorCount: number;
  conflictCount: number;
  lastSyncTime?: string;
  nextSyncTime?: string;
}

export interface SyncOptions {
  force?: boolean;
  priority?: "low" | "medium" | "high";
  maxRetries?: number;
  retryDelay?: number;
  batchSize?: number;
}

export interface ConflictResolution {
  workoutId: string;
  resolution: "client" | "server" | "merge" | "manual";
  mergeStrategy?: {
    keepClientSets?: boolean;
    keepServerNotes?: boolean;
    useLatestTimestamp?: boolean;
  };
}

export interface UseWorkoutSyncReturn {
  // State
  syncState: SyncState;
  conflicts: SyncConflict[];
  canSync: boolean;

  // Actions
  startSync: (options?: SyncOptions) => Promise<SyncResult>;
  stopSync: () => void;
  resolveConflict: (resolution: ConflictResolution) => Promise<void>;
  retryFailedSync: (workoutId?: string) => Promise<void>;

  // Configuration
  setSyncInterval: (interval: number) => void;
  enableAutoSync: (enabled: boolean) => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useWorkoutSync(): UseWorkoutSyncReturn {
  const dispatch = useAppDispatch();
  const { isConnected, isSlowConnection, connectionType } = useNetworkStatus();
  const workoutState = useAppSelector((state) => state.workout);

  // Local state
  const [syncState, setSyncState] = useState<SyncState>({
    isActive: false,
    progress: 0,
    totalWorkouts: 0,
    syncedCount: 0,
    errorCount: 0,
    conflictCount: 0,
  });

  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [syncInterval, setSyncIntervalState] = useState(30000); // 30 seconds

  // Refs for managing timers and state
  const syncTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isSyncingRef = useRef(false);
  const retryCountRef = useRef(new Map<string, number>());

  // ============================================================================
  // SYNC LOGIC
  // ============================================================================

  /**
   * Determine if sync should be performed based on network conditions
   */
  const canSync = useCallback((): boolean => {
    if (!isConnected) return false;

    // Allow sync on slow connections but with different strategy
    return true;
  }, [isConnected]);

  /**
   * Get sync strategy based on network conditions
   */
  const getSyncStrategy = useCallback(() => {
    if (!isConnected) {
      return { batchSize: 0, retryDelay: 5000, maxRetries: 0 };
    }

    if (isSlowConnection || connectionType === "cellular") {
      return { batchSize: 1, retryDelay: 2000, maxRetries: 2 };
    }

    return { batchSize: 5, retryDelay: 1000, maxRetries: 3 };
  }, [isConnected, isSlowConnection, connectionType]);

  /**
   * Start synchronization process
   */
  const startSync = useCallback(
    async (options: SyncOptions = {}): Promise<SyncResult> => {
      if (isSyncingRef.current) {
        logger.warn("Sync already in progress", undefined, "sync");
        return {
          success: false,
          syncedCount: 0,
          conflictCount: 0,
          errorCount: 0,
          conflicts: [],
          errors: [],
          syncTime: new Date().toISOString(),
        };
      }

      if (!canSync() && !options.force) {
        logger.warn("Cannot sync - network conditions not suitable", undefined, "sync");
        return {
          success: false,
          syncedCount: 0,
          conflictCount: 0,
          errorCount: 0,
          conflicts: [],
          errors: [],
          syncTime: new Date().toISOString(),
        };
      }

      try {
        isSyncingRef.current = true;

        // Get pending workouts
        const pendingWorkouts = await offlineService.getPendingWorkouts();

        if (pendingWorkouts.length === 0) {
          logger.info("No workouts to sync", undefined, "sync");
          return {
            success: true,
            syncedCount: 0,
            conflictCount: 0,
            errorCount: 0,
            conflicts: [],
            errors: [],
            syncTime: new Date().toISOString(),
          };
        }

        logger.info(`Starting sync of ${pendingWorkouts.length} workouts`, undefined, "sync");

        // Update state
        setSyncState((prev) => ({
          ...prev,
          isActive: true,
          progress: 0,
          totalWorkouts: pendingWorkouts.length,
          syncedCount: 0,
          errorCount: 0,
          conflictCount: 0,
        }));

        // Dispatch Redux actions
        dispatch(setSyncStatus("syncing"));
        // Use a plain action object to avoid TypeScript payload mismatch for the zero-arg notification.
        dispatch({ type: "ui/showSyncStartedNotification" });

        // Get sync strategy
        const strategy = getSyncStrategy();
        const batchSize = options.batchSize || strategy.batchSize;
        const maxRetries = options.maxRetries || strategy.maxRetries;
        const retryDelay = options.retryDelay || strategy.retryDelay;

        // Process workouts in batches
        const results: SyncResult = {
          success: true,
          syncedCount: 0,
          conflictCount: 0,
          errorCount: 0,
          conflicts: [],
          errors: [],
          syncTime: new Date().toISOString(),
        };

        for (let i = 0; i < pendingWorkouts.length; i += batchSize) {
          const batch = pendingWorkouts.slice(i, i + batchSize);

          for (const workout of batch) {
            try {
              // Update progress
              const progress = Math.round(((i + batch.indexOf(workout)) / pendingWorkouts.length) * 100);
              setSyncState((prev) => ({
                ...prev,
                progress,
                currentWorkout: workout.data.name,
              }));

              // Attempt to sync workout
              const syncResult = await syncSingleWorkout(workout, maxRetries, retryDelay);

              if (syncResult.success) {
                results.syncedCount++;
                await offlineService.removeWorkoutOffline(workout.id);
              } else if (syncResult.conflict) {
                results.conflictCount++;
                results.conflicts.push(syncResult.conflict);
              } else {
                results.errorCount++;
                results.errors.push({
                  workoutId: workout.id,
                  error: syncResult.error || "Unknown error",
                });
              }
            } catch (error) {
              logger.error("Batch sync error", error, "sync");
              results.errorCount++;
              results.errors.push({
                workoutId: workout.id,
                error: error instanceof Error ? error.message : "Sync failed",
              });
            }
          }

          // Small delay between batches to avoid overwhelming the server
          if (i + batchSize < pendingWorkouts.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        // Update final state
        setSyncState((prev) => ({
          ...prev,
          isActive: false,
          progress: 100,
          syncedCount: results.syncedCount,
          errorCount: results.errorCount,
          conflictCount: results.conflictCount,
          lastSyncTime: new Date().toISOString(),
        }));

        // Update conflicts state
        setConflicts(results.conflicts);

        // Dispatch completion notifications
        dispatch(setSyncStatus("idle"));

        if (results.errorCount > 0) {
          dispatch(
            showSyncFailedNotification({
              error: `${results.errorCount} workouts failed to sync`,
            })
          );
        } else {
          dispatch(
            showSyncCompletedNotification({
              syncedCount: results.syncedCount,
            })
          );
        }

        // Show conflict notification if needed
        if (results.conflictCount > 0) {
          dispatch(
            showWarningNotification({
              title: "Sync Conflicts Detected",
              message: `${results.conflictCount} workouts have conflicts that need resolution`,
              duration: 8000,
            })
          );
        }

        logger.info(
          "Sync completed",
          {
            syncedCount: results.syncedCount,
            errorCount: results.errorCount,
            conflictCount: results.conflictCount,
          },
          "sync"
        );

        return results;
      } catch (error) {
        logger.error("Sync process failed", error, "sync");

        setSyncState((prev) => ({
          ...prev,
          isActive: false,
          errorCount: prev.errorCount + 1,
        }));

        dispatch(setSyncStatus("error"));
        dispatch(
          showSyncFailedNotification({
            error: error instanceof Error ? error.message : "Sync failed",
          })
        );

        return {
          success: false,
          syncedCount: 0,
          conflictCount: 0,
          errorCount: 1,
          conflicts: [],
          errors: [{ workoutId: "unknown", error: error instanceof Error ? error.message : "Sync failed" }],
          syncTime: new Date().toISOString(),
        };
      } finally {
        isSyncingRef.current = false;
      }
    },
    [canSync, getSyncStrategy, dispatch]
  );

  /**
   * Sync a single workout with retry logic
   */
  const syncSingleWorkout = async (
    workout: any,
    maxRetries: number,
    retryDelay: number
  ): Promise<{ success: boolean; conflict?: SyncConflict; error?: string }> => {
    const workoutId = workout.id;
    let retryCount = retryCountRef.current.get(workoutId) || 0;

    while (retryCount <= maxRetries) {
      try {
        // Use workout service to sync
        const result = await workoutService.syncPendingWorkouts();

        if (result.success) {
          retryCountRef.current.delete(workoutId);
          return { success: true };
        } else {
          throw new Error(result.error || "Sync failed");
        }
      } catch (error) {
        retryCount++;
        retryCountRef.current.set(workoutId, retryCount);

        if (retryCount > maxRetries) {
          logger.error(`Max retries exceeded for workout ${workoutId}`, error, "sync");
          return {
            success: false,
            error: error instanceof Error ? error.message : "Max retries exceeded",
          };
        }

        logger.warn(`Sync retry ${retryCount}/${maxRetries} for workout ${workoutId}`, undefined, "sync");
        await new Promise((resolve) => setTimeout(resolve, retryDelay * retryCount));
      }
    }

    return { success: false, error: "Unexpected sync failure" };
  };

  /**
   * Stop current sync process
   */
  const stopSync = useCallback(() => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
    }

    isSyncingRef.current = false;

    setSyncState((prev) => ({
      ...prev,
      isActive: false,
    }));

    dispatch(setSyncStatus("idle"));
    logger.info("Sync stopped", undefined, "sync");
  }, [dispatch]);

  /**
   * Resolve a sync conflict
   */
  const resolveConflict = useCallback(
    async (resolution: ConflictResolution): Promise<void> => {
      try {
        logger.info(
          "Resolving sync conflict",
          {
            workoutId: resolution.workoutId,
            resolution: resolution.resolution,
          },
          "sync"
        );

        // Remove conflict from state
        setConflicts((prev) => prev.filter((c) => c.workoutId !== resolution.workoutId));

        // Handle resolution based on strategy
        switch (resolution.resolution) {
          case "client":
            // Keep client version, force sync
            await startSync({ force: true });
            break;

          case "server":
            // Accept server version, remove from offline storage
            await offlineService.removeWorkoutOffline(resolution.workoutId);
            break;

          case "merge":
            // Implement merge logic based on strategy
            // This would require more complex implementation
            logger.warn("Merge resolution not yet implemented", undefined, "sync");
            break;

          case "manual":
            // User will handle manually
            logger.info("Manual conflict resolution selected", undefined, "sync");
            break;
        }
      } catch (error) {
        logger.error("Failed to resolve conflict", error, "sync");
        throw error;
      }
    },
    [startSync]
  );

  /**
   * Retry failed sync for specific workout or all failed workouts
   */
  const retryFailedSync = useCallback(
    async (workoutId?: string): Promise<void> => {
      try {
        if (workoutId) {
          // Reset retry count for specific workout
          retryCountRef.current.delete(workoutId);
          logger.info("Retrying sync for specific workout", { workoutId }, "sync");
        } else {
          // Reset all retry counts
          retryCountRef.current.clear();
          logger.info("Retrying sync for all failed workouts", undefined, "sync");
        }

        await startSync({ force: true });
      } catch (error) {
        logger.error("Failed to retry sync", error, "sync");
        throw error;
      }
    },
    [startSync]
  );

  // ============================================================================
  // AUTO-SYNC MANAGEMENT
  // ============================================================================

  /**
   * Set sync interval
   */
  const setSyncInterval = useCallback((interval: number) => {
    setSyncIntervalState(interval);
    logger.info("Sync interval updated", { interval }, "sync");
  }, []);

  /**
   * Enable/disable auto-sync
   */
  const enableAutoSync = useCallback((enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    logger.info("Auto-sync toggled", { enabled }, "sync");
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * Auto-sync effect
   */
  useEffect(() => {
    if (!autoSyncEnabled || !canSync()) {
      return;
    }

    const scheduleNextSync = () => {
      syncTimerRef.current = setTimeout(async () => {
        if (canSync() && !isSyncingRef.current) {
          await startSync();
        }
        scheduleNextSync();
      }, syncInterval);

      // Update next sync time
      setSyncState((prev) => ({
        ...prev,
        nextSyncTime: new Date(Date.now() + syncInterval).toISOString(),
      }));
    };

    scheduleNextSync();

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, [autoSyncEnabled, canSync, startSync, syncInterval]);

  /**
   * Network status change effect
   */
  useEffect(() => {
    if (isConnected && workoutState.offline.pendingSessions.length > 0) {
      // Trigger sync when coming back online
      const timer = setTimeout(() => {
        if (autoSyncEnabled && !isSyncingRef.current) {
          startSync();
        }
      }, 2000); // Wait 2 seconds after coming online

      return () => clearTimeout(timer);
    }
  }, [isConnected, workoutState.offline.pendingSessions.length, autoSyncEnabled, startSync]);

  /**
   * Cleanup effect
   */
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  // ============================================================================
  // RETURN HOOK INTERFACE
  // ============================================================================

  return {
    // State
    syncState,
    conflicts,
    canSync: canSync(),

    // Actions
    startSync,
    stopSync,
    resolveConflict,
    retryFailedSync,

    // Configuration
    setSyncInterval,
    enableAutoSync,
  };
}

export default useWorkoutSync;
