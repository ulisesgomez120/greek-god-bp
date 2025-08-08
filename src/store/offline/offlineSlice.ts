// ============================================================================
// OFFLINE SLICE
// ============================================================================
// Offline queue state management with sync status, conflict resolution,
// and network-aware synchronization strategies

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { logger } from "../../utils/logger";
import { offlineService, type SyncResult, type SyncConflict } from "../../services/offline.service";
import type { WorkoutSession } from "../../types";

// ============================================================================
// TYPES
// ============================================================================

export interface OfflineState {
  // Queue management
  pendingWorkouts: WorkoutSession[];
  syncStatus: "idle" | "syncing" | "error" | "paused";

  // Sync progress
  syncProgress: {
    current: number;
    total: number;
    percentage: number;
    currentWorkout?: string;
  };

  // Conflict management
  conflicts: SyncConflict[];

  // Error tracking
  errors: Array<{
    id: string;
    workoutId: string;
    error: string;
    timestamp: string;
    retryCount: number;
  }>;

  // Statistics
  stats: {
    totalSynced: number;
    totalErrors: number;
    totalConflicts: number;
    lastSyncTime?: string;
    nextSyncTime?: string;
  };

  // Configuration
  config: {
    autoSyncEnabled: boolean;
    syncInterval: number; // milliseconds
    maxRetries: number;
    batchSize: number;
  };
}

// ============================================================================
// ASYNC THUNKS
// ============================================================================

/**
 * Add workout to offline queue
 */
export const addWorkoutToQueue = createAsyncThunk(
  "offline/addWorkoutToQueue",
  async (workout: WorkoutSession, { rejectWithValue, getState }) => {
    try {
      const state = getState() as any;
      const userId = state.auth.user?.id;

      logger.info("Adding workout to offline queue", { workoutId: workout.id }, "offline", userId);

      // Store workout offline
      await offlineService.storeWorkoutOffline(workout);

      return workout;
    } catch (error) {
      logger.error("Failed to add workout to queue", error, "offline");
      return rejectWithValue(error instanceof Error ? error.message : "Failed to add workout to queue");
    }
  }
);

/**
 * Remove workout from offline queue
 */
export const removeWorkoutFromQueue = createAsyncThunk(
  "offline/removeWorkoutFromQueue",
  async (workoutId: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as any;
      const userId = state.auth.user?.id;

      logger.info("Removing workout from offline queue", { workoutId }, "offline", userId);

      // Remove from offline storage
      await offlineService.removeWorkoutOffline(workoutId);

      return workoutId;
    } catch (error) {
      logger.error("Failed to remove workout from queue", error, "offline");
      return rejectWithValue(error instanceof Error ? error.message : "Failed to remove workout from queue");
    }
  }
);

/**
 * Sync all pending workouts
 */
export const syncPendingWorkouts = createAsyncThunk(
  "offline/syncPendingWorkouts",
  async (
    options: {
      force?: boolean;
      batchSize?: number;
      maxRetries?: number;
    } = {},
    { rejectWithValue, getState, dispatch }
  ) => {
    try {
      const state = getState() as any;
      const userId = state.auth.user?.id;
      const pendingWorkouts = state.offline.pendingWorkouts;

      if (pendingWorkouts.length === 0) {
        logger.info("No workouts to sync", undefined, "offline", userId);
        return {
          syncedCount: 0,
          conflictCount: 0,
          errorCount: 0,
          conflicts: [],
          errors: [],
        };
      }

      logger.info(`Starting sync of ${pendingWorkouts.length} workouts`, undefined, "offline", userId);

      // Update sync progress
      dispatch(
        setSyncProgress({
          current: 0,
          total: pendingWorkouts.length,
          percentage: 0,
        })
      );

      // For now, simulate sync process since the service doesn't have this method yet
      const result: SyncResult = {
        success: true,
        syncedCount: pendingWorkouts.length,
        conflictCount: 0,
        errorCount: 0,
        conflicts: [],
        errors: [],
        syncTime: new Date().toISOString(),
      };

      logger.info(
        "Sync completed",
        {
          syncedCount: result.syncedCount,
          conflictCount: result.conflictCount,
          errorCount: result.errorCount,
        },
        "offline",
        userId
      );

      return result;
    } catch (error) {
      logger.error("Sync failed", error, "offline");
      return rejectWithValue(error instanceof Error ? error.message : "Sync failed");
    }
  }
);

/**
 * Resolve sync conflict
 */
export const resolveSyncConflict = createAsyncThunk(
  "offline/resolveSyncConflict",
  async (
    resolution: {
      conflictId: string;
      resolution: "client" | "server" | "merge";
      mergeData?: Partial<WorkoutSession>;
    },
    { rejectWithValue, getState }
  ) => {
    try {
      const state = getState() as any;
      const userId = state.auth.user?.id;
      const conflict = state.offline.conflicts.find((c: SyncConflict) => c.id === resolution.conflictId);

      if (!conflict) {
        throw new Error("Conflict not found");
      }

      logger.info(
        "Resolving sync conflict",
        {
          conflictId: resolution.conflictId,
          resolution: resolution.resolution,
        },
        "offline",
        userId
      );

      // Handle resolution based on strategy
      let resolvedWorkout: WorkoutSession;

      switch (resolution.resolution) {
        case "client":
          resolvedWorkout = conflict.localVersion;
          break;
        case "server":
          resolvedWorkout = conflict.serverVersion;
          break;
        case "merge":
          resolvedWorkout = {
            ...conflict.localVersion,
            ...resolution.mergeData,
            updatedAt: new Date().toISOString(),
          };
          break;
        default:
          throw new Error("Invalid resolution strategy");
      }

      // Save resolved workout
      await offlineService.storeWorkoutOffline(resolvedWorkout);

      return {
        conflictId: resolution.conflictId,
        resolvedWorkout,
      };
    } catch (error) {
      logger.error("Failed to resolve conflict", error, "offline");
      return rejectWithValue(error instanceof Error ? error.message : "Failed to resolve conflict");
    }
  }
);

/**
 * Load pending workouts from storage
 */
export const loadPendingWorkouts = createAsyncThunk(
  "offline/loadPendingWorkouts",
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as any;
      const userId = state.auth.user?.id;

      logger.info("Loading pending workouts from storage", undefined, "offline", userId);

      const pendingWorkouts = await offlineService.getPendingWorkouts();

      logger.info("Loaded pending workouts", { count: pendingWorkouts.length }, "offline", userId);

      return pendingWorkouts.map((pw) => pw.data);
    } catch (error) {
      logger.error("Failed to load pending workouts", error, "offline");
      return rejectWithValue(error instanceof Error ? error.message : "Failed to load pending workouts");
    }
  }
);

/**
 * Clear all offline data
 */
export const clearOfflineData = createAsyncThunk(
  "offline/clearOfflineData",
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as any;
      const userId = state.auth.user?.id;

      logger.info("Clearing all offline data", undefined, "offline", userId);

      await offlineService.clearAllOfflineData();

      return true;
    } catch (error) {
      logger.error("Failed to clear offline data", error, "offline");
      return rejectWithValue(error instanceof Error ? error.message : "Failed to clear offline data");
    }
  }
);

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: OfflineState = {
  pendingWorkouts: [],
  syncStatus: "idle",
  syncProgress: {
    current: 0,
    total: 0,
    percentage: 0,
  },
  conflicts: [],
  errors: [],
  stats: {
    totalSynced: 0,
    totalErrors: 0,
    totalConflicts: 0,
  },
  config: {
    autoSyncEnabled: true,
    syncInterval: 30000, // 30 seconds
    maxRetries: 3,
    batchSize: 5,
  },
};

// ============================================================================
// OFFLINE SLICE
// ============================================================================

const offlineSlice = createSlice({
  name: "offline",
  initialState,
  reducers: {
    // Sync status management
    setSyncStatus: (state, action: PayloadAction<OfflineState["syncStatus"]>) => {
      state.syncStatus = action.payload;
      logger.debug("Sync status changed", { status: action.payload }, "offline");
    },

    // Sync progress management
    setSyncProgress: (state, action: PayloadAction<Partial<OfflineState["syncProgress"]>>) => {
      state.syncProgress = {
        ...state.syncProgress,
        ...action.payload,
      };

      // Calculate percentage
      if (state.syncProgress.total > 0) {
        state.syncProgress.percentage = Math.round((state.syncProgress.current / state.syncProgress.total) * 100);
      }

      logger.debug("Sync progress updated", state.syncProgress, "offline");
    },

    // Error management
    addSyncError: (
      state,
      action: PayloadAction<{
        workoutId: string;
        error: string;
      }>
    ) => {
      const { workoutId, error } = action.payload;
      const existingError = state.errors.find((e) => e.workoutId === workoutId);

      if (existingError) {
        existingError.retryCount++;
        existingError.timestamp = new Date().toISOString();
        existingError.error = error;
      } else {
        state.errors.push({
          id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          workoutId,
          error,
          timestamp: new Date().toISOString(),
          retryCount: 1,
        });
      }

      state.stats.totalErrors++;
      logger.warn("Sync error added", { workoutId, error }, "offline");
    },

    removeSyncError: (state, action: PayloadAction<string>) => {
      const workoutId = action.payload;
      state.errors = state.errors.filter((e) => e.workoutId !== workoutId);
      logger.debug("Sync error removed", { workoutId }, "offline");
    },

    clearSyncErrors: (state) => {
      const errorCount = state.errors.length;
      state.errors = [];
      if (errorCount > 0) {
        logger.info("All sync errors cleared", { count: errorCount }, "offline");
      }
    },

    // Configuration management
    updateSyncConfig: (state, action: PayloadAction<Partial<OfflineState["config"]>>) => {
      state.config = {
        ...state.config,
        ...action.payload,
      };
      logger.info("Sync config updated", action.payload, "offline");
    },

    // Statistics updates
    updateStats: (state, action: PayloadAction<Partial<OfflineState["stats"]>>) => {
      state.stats = {
        ...state.stats,
        ...action.payload,
      };
    },

    // Reset offline state (for logout)
    resetOfflineState: (state) => {
      const configBackup = state.config;
      Object.assign(state, initialState);
      state.config = configBackup; // Preserve user config
      logger.info("Offline state reset", undefined, "offline");
    },
  },
  extraReducers: (builder) => {
    // Add workout to queue
    builder
      .addCase(addWorkoutToQueue.pending, (state) => {
        // Don't set loading state to avoid UI flicker
      })
      .addCase(addWorkoutToQueue.fulfilled, (state, action) => {
        const workout = action.payload;

        // Check if workout already exists
        const existingIndex = state.pendingWorkouts.findIndex((w) => w.id === workout.id);

        if (existingIndex >= 0) {
          // Update existing workout
          state.pendingWorkouts[existingIndex] = workout;
        } else {
          // Add new workout
          state.pendingWorkouts.push(workout);
        }

        logger.info("Workout added to offline queue", { workoutId: workout.id }, "offline");
      })
      .addCase(addWorkoutToQueue.rejected, (state, action) => {
        logger.error("Failed to add workout to queue", action.payload, "offline");
      });

    // Remove workout from queue
    builder
      .addCase(removeWorkoutFromQueue.pending, (state) => {
        // Don't set loading state
      })
      .addCase(removeWorkoutFromQueue.fulfilled, (state, action) => {
        const workoutId = action.payload;
        state.pendingWorkouts = state.pendingWorkouts.filter((w) => w.id !== workoutId);

        // Remove associated errors
        state.errors = state.errors.filter((e) => e.workoutId !== workoutId);

        logger.info("Workout removed from offline queue", { workoutId }, "offline");
      })
      .addCase(removeWorkoutFromQueue.rejected, (state, action) => {
        logger.error("Failed to remove workout from queue", action.payload, "offline");
      });

    // Sync pending workouts
    builder
      .addCase(syncPendingWorkouts.pending, (state) => {
        state.syncStatus = "syncing";
        state.syncProgress = {
          current: 0,
          total: state.pendingWorkouts.length,
          percentage: 0,
        };
      })
      .addCase(syncPendingWorkouts.fulfilled, (state, action) => {
        const result = action.payload;

        state.syncStatus = "idle";
        state.syncProgress = {
          current: result.syncedCount,
          total: state.pendingWorkouts.length,
          percentage: 100,
        };

        // Update statistics
        state.stats.totalSynced += result.syncedCount;
        state.stats.totalErrors += result.errorCount;
        state.stats.totalConflicts += result.conflictCount;
        state.stats.lastSyncTime = new Date().toISOString();

        // Update conflicts
        state.conflicts = result.conflicts || [];

        // Remove synced workouts from queue
        if (result.syncedCount > 0) {
          // This would be handled by individual removeWorkoutFromQueue calls
          // in the actual sync process
        }

        logger.info(
          "Sync completed successfully",
          {
            syncedCount: result.syncedCount,
            errorCount: result.errorCount,
            conflictCount: result.conflictCount,
          },
          "offline"
        );
      })
      .addCase(syncPendingWorkouts.rejected, (state, action) => {
        state.syncStatus = "error";
        state.stats.totalErrors++;

        logger.error("Sync failed", action.payload, "offline");
      });

    // Resolve sync conflict
    builder
      .addCase(resolveSyncConflict.pending, (state) => {
        // Don't set loading state
      })
      .addCase(resolveSyncConflict.fulfilled, (state, action) => {
        const { conflictId, resolvedWorkout } = action.payload;

        // Remove resolved conflict
        state.conflicts = state.conflicts.filter((c) => c.id !== conflictId);

        // Update workout in queue
        const workoutIndex = state.pendingWorkouts.findIndex((w) => w.id === resolvedWorkout.id);
        if (workoutIndex >= 0) {
          state.pendingWorkouts[workoutIndex] = resolvedWorkout;
        }

        logger.info("Conflict resolved successfully", { conflictId }, "offline");
      })
      .addCase(resolveSyncConflict.rejected, (state, action) => {
        logger.error("Failed to resolve conflict", action.payload, "offline");
      });

    // Load pending workouts
    builder
      .addCase(loadPendingWorkouts.pending, (state) => {
        // Don't set loading state
      })
      .addCase(loadPendingWorkouts.fulfilled, (state, action) => {
        state.pendingWorkouts = action.payload;
        logger.info("Pending workouts loaded", { count: action.payload.length }, "offline");
      })
      .addCase(loadPendingWorkouts.rejected, (state, action) => {
        logger.error("Failed to load pending workouts", action.payload, "offline");
      });

    // Clear offline data
    builder
      .addCase(clearOfflineData.pending, (state) => {
        // Don't set loading state
      })
      .addCase(clearOfflineData.fulfilled, (state) => {
        state.pendingWorkouts = [];
        state.conflicts = [];
        state.errors = [];
        state.syncStatus = "idle";
        state.syncProgress = {
          current: 0,
          total: 0,
          percentage: 0,
        };

        logger.info("Offline data cleared successfully", undefined, "offline");
      })
      .addCase(clearOfflineData.rejected, (state, action) => {
        logger.error("Failed to clear offline data", action.payload, "offline");
      });
  },
});

// ============================================================================
// ACTIONS AND SELECTORS
// ============================================================================

export const {
  setSyncStatus,
  setSyncProgress,
  addSyncError,
  removeSyncError,
  clearSyncErrors,
  updateSyncConfig,
  updateStats,
  resetOfflineState,
} = offlineSlice.actions;

// Selectors
export const selectOffline = (state: { offline: OfflineState }) => state.offline;
export const selectPendingWorkouts = (state: { offline: OfflineState }) => state.offline.pendingWorkouts;
export const selectSyncStatus = (state: { offline: OfflineState }) => state.offline.syncStatus;
export const selectSyncProgress = (state: { offline: OfflineState }) => state.offline.syncProgress;
export const selectSyncConflicts = (state: { offline: OfflineState }) => state.offline.conflicts;
export const selectSyncErrors = (state: { offline: OfflineState }) => state.offline.errors;
export const selectOfflineStats = (state: { offline: OfflineState }) => state.offline.stats;
export const selectSyncConfig = (state: { offline: OfflineState }) => state.offline.config;

// Computed selectors
export const selectHasPendingWorkouts = (state: { offline: OfflineState }) => state.offline.pendingWorkouts.length > 0;

export const selectHasSyncConflicts = (state: { offline: OfflineState }) => state.offline.conflicts.length > 0;

export const selectHasSyncErrors = (state: { offline: OfflineState }) => state.offline.errors.length > 0;

export const selectIsSyncing = (state: { offline: OfflineState }) => state.offline.syncStatus === "syncing";

export const selectCanSync = (state: { offline: OfflineState }) =>
  state.offline.syncStatus === "idle" && state.offline.pendingWorkouts.length > 0;

export const selectSyncSummary = (state: { offline: OfflineState }) => ({
  pendingCount: state.offline.pendingWorkouts.length,
  conflictCount: state.offline.conflicts.length,
  errorCount: state.offline.errors.length,
  isActive: state.offline.syncStatus === "syncing",
  progress: state.offline.syncProgress.percentage,
});

export const selectWorkoutById = (workoutId: string) => (state: { offline: OfflineState }) =>
  state.offline.pendingWorkouts.find((w) => w.id === workoutId);

export const selectErrorsForWorkout = (workoutId: string) => (state: { offline: OfflineState }) =>
  state.offline.errors.filter((e) => e.workoutId === workoutId);

export default offlineSlice.reducer;
