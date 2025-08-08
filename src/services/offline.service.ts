// ============================================================================
// OFFLINE SERVICE
// ============================================================================
// Comprehensive offline storage and synchronization manager that extends
// the existing storage utilities with workout-specific functionality

import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "../utils/logger";
import {
  getAsyncItem,
  setAsyncItem,
  removeAsyncItem,
  getOfflineQueue,
  addToOfflineQueue as baseAddToOfflineQueue,
  removeFromOfflineQueue,
  updateSyncAttempt,
  type OfflineWorkout,
} from "../utils/storage";
import { STORAGE_KEYS, WORKOUT_CONSTANTS, VALIDATION } from "../config/constants";
import type { WorkoutSession, ExerciseSet } from "../types";

// ============================================================================
// TYPES
// ============================================================================

export interface OfflineWorkoutData extends OfflineWorkout {
  priority: "low" | "medium" | "high";
  conflictResolution: "client" | "server" | "merge" | "manual";
  dataIntegrity: {
    checksum: string;
    version: string;
    compressed: boolean;
  };
  metadata: {
    deviceId: string;
    appVersion: string;
    createdOffline: boolean;
    lastModified: number;
  };
}

export interface SyncConflict {
  id: string;
  workoutId: string;
  localVersion: WorkoutSession;
  serverVersion: WorkoutSession;
  conflictType: "timestamp" | "data" | "deletion";
  resolutionStrategy: "client" | "server" | "merge" | "manual";
  conflictFields: string[];
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  conflictCount: number;
  errorCount: number;
  conflicts: SyncConflict[];
  errors: Array<{ workoutId: string; error: string }>;
  syncTime: string;
}

export interface StorageHealthReport {
  totalWorkouts: number;
  pendingSync: number;
  storageUsed: number; // in bytes
  oldestWorkout: string | null;
  corruptedWorkouts: string[];
  recommendations: string[];
}

// ============================================================================
// OFFLINE SERVICE CLASS
// ============================================================================

export class OfflineService {
  private static instance: OfflineService;
  private readonly STORAGE_PREFIX = "trainsmart_offline_";
  private readonly MAX_STORAGE_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly MAX_WORKOUT_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
  private readonly COMPRESSION_THRESHOLD = 1024; // 1KB

  private constructor() {}

  public static getInstance(): OfflineService {
    if (!OfflineService.instance) {
      OfflineService.instance = new OfflineService();
    }
    return OfflineService.instance;
  }

  // ============================================================================
  // WORKOUT STORAGE METHODS
  // ============================================================================

  /**
   * Store workout session with enhanced metadata and compression
   */
  async storeWorkoutOffline(
    workout: WorkoutSession,
    priority: "low" | "medium" | "high" = "medium",
    conflictResolution: "client" | "server" | "merge" | "manual" = "merge"
  ): Promise<void> {
    try {
      logger.info("Storing workout offline", { workoutId: workout.id, priority }, "offline", workout.userId);

      // Validate workout data
      const validationResult = this.validateWorkoutData(workout);
      if (!validationResult.isValid) {
        throw new Error(`Invalid workout data: ${validationResult.errors.join(", ")}`);
      }

      // Compress workout data if needed
      const workoutData = await this.compressWorkoutData(workout);

      // Generate checksum for data integrity
      const checksum = await this.generateChecksum(workoutData);

      // Create enhanced offline workout entry
      const offlineWorkout: OfflineWorkoutData = {
        id: workout.id,
        data: workoutData,
        timestamp: Date.now(),
        syncAttempts: 0,
        priority,
        conflictResolution,
        dataIntegrity: {
          checksum,
          version: "1.0",
          compressed: JSON.stringify(workoutData).length > this.COMPRESSION_THRESHOLD,
        },
        metadata: {
          deviceId: await this.getDeviceId(),
          appVersion: require("../../package.json").version,
          createdOffline: workout.offlineCreated || false,
          lastModified: Date.now(),
        },
      };

      // Store in enhanced offline queue
      await this.addToEnhancedOfflineQueue(offlineWorkout);

      // Store individual workout for quick access
      await setAsyncItem(`${this.STORAGE_PREFIX}workout_${workout.id}`, offlineWorkout);

      // Update storage statistics
      await this.updateStorageStats();

      logger.info(
        "Workout stored offline successfully",
        {
          workoutId: workout.id,
          compressed: offlineWorkout.dataIntegrity.compressed,
        },
        "offline",
        workout.userId
      );
    } catch (error) {
      logger.error("Failed to store workout offline", error, "offline", workout.userId);
      throw error;
    }
  }

  /**
   * Retrieve workout from offline storage
   */
  async getWorkoutOffline(workoutId: string): Promise<WorkoutSession | null> {
    try {
      const offlineWorkout = await getAsyncItem<OfflineWorkoutData>(`${this.STORAGE_PREFIX}workout_${workoutId}`);

      if (!offlineWorkout) {
        return null;
      }

      // Verify data integrity
      const isValid = await this.verifyDataIntegrity(offlineWorkout);
      if (!isValid) {
        logger.warn("Corrupted workout data detected", { workoutId }, "offline");
        await this.markWorkoutCorrupted(workoutId);
        return null;
      }

      // Decompress if needed
      const workoutData = await this.decompressWorkoutData(
        offlineWorkout.data,
        offlineWorkout.dataIntegrity.compressed
      );

      logger.debug("Retrieved workout from offline storage", { workoutId }, "offline");
      return workoutData;
    } catch (error) {
      logger.error("Failed to retrieve workout from offline storage", error, "offline");
      return null;
    }
  }

  /**
   * Get all pending workouts for sync
   */
  async getPendingWorkouts(): Promise<OfflineWorkoutData[]> {
    try {
      const queue = await this.getEnhancedOfflineQueue();

      // Sort by priority and timestamp
      return queue.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];

        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return a.timestamp - b.timestamp; // Older first
      });
    } catch (error) {
      logger.error("Failed to get pending workouts", error, "offline");
      return [];
    }
  }

  /**
   * Remove workout from offline storage
   */
  async removeWorkoutOffline(workoutId: string): Promise<void> {
    try {
      await removeAsyncItem(`${this.STORAGE_PREFIX}workout_${workoutId}`);
      await removeFromOfflineQueue(workoutId);
      await this.updateStorageStats();

      logger.info("Workout removed from offline storage", { workoutId }, "offline");
    } catch (error) {
      logger.error("Failed to remove workout from offline storage", error, "offline");
      throw error;
    }
  }

  // ============================================================================
  // DATA INTEGRITY METHODS
  // ============================================================================

  /**
   * Validate workout data structure and content
   */
  private validateWorkoutData(workout: WorkoutSession): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!workout.id) errors.push("Missing workout ID");
    if (!workout.userId) errors.push("Missing user ID");
    if (!workout.name) errors.push("Missing workout name");
    if (!workout.startedAt) errors.push("Missing start time");

    // Validate dates
    if (workout.startedAt && isNaN(new Date(workout.startedAt).getTime())) {
      errors.push("Invalid start date");
    }
    if (workout.completedAt && isNaN(new Date(workout.completedAt).getTime())) {
      errors.push("Invalid completion date");
    }

    // Validate sets if present
    if (workout.sets) {
      workout.sets.forEach((set, index) => {
        if (!set.id) errors.push(`Set ${index + 1}: Missing set ID`);
        if (!set.exerciseId) errors.push(`Set ${index + 1}: Missing exercise ID`);
        if (set.reps < 0 || set.reps > VALIDATION.workout.maxReps) {
          errors.push(`Set ${index + 1}: Invalid reps`);
        }
        if (set.weightKg && (set.weightKg < 0 || set.weightKg > VALIDATION.workout.maxWeight)) {
          errors.push(`Set ${index + 1}: Invalid weight`);
        }
        if (set.rpe && (set.rpe < 1 || set.rpe > 10)) {
          errors.push(`Set ${index + 1}: Invalid RPE`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate checksum for data integrity verification
   */
  private async generateChecksum(data: any): Promise<string> {
    const jsonString = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(jsonString);

    // Simple hash function for checksum
    let hash = 0;
    for (let i = 0; i < dataBuffer.length; i++) {
      const char = dataBuffer[i];
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(16);
  }

  /**
   * Verify data integrity using checksum
   */
  private async verifyDataIntegrity(offlineWorkout: OfflineWorkoutData): Promise<boolean> {
    try {
      const currentChecksum = await this.generateChecksum(offlineWorkout.data);
      return currentChecksum === offlineWorkout.dataIntegrity.checksum;
    } catch (error) {
      logger.error("Failed to verify data integrity", error, "offline");
      return false;
    }
  }

  // ============================================================================
  // COMPRESSION METHODS
  // ============================================================================

  /**
   * Compress workout data if it exceeds threshold
   */
  private async compressWorkoutData(workout: WorkoutSession): Promise<WorkoutSession> {
    const jsonString = JSON.stringify(workout);

    if (jsonString.length <= this.COMPRESSION_THRESHOLD) {
      return workout; // No compression needed
    }

    // Simple compression: remove unnecessary whitespace and optimize structure
    const optimized = {
      ...workout,
      // Remove null/undefined values
      sets: workout.sets?.map((set) => {
        const optimizedSet: any = {};
        Object.entries(set).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            optimizedSet[key] = value;
          }
        });
        return optimizedSet;
      }),
    };

    // Remove null/undefined values from main object
    const compressed: any = {};
    Object.entries(optimized).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        compressed[key] = value;
      }
    });

    return compressed as WorkoutSession;
  }

  /**
   * Decompress workout data
   */
  private async decompressWorkoutData(data: WorkoutSession, isCompressed: boolean): Promise<WorkoutSession> {
    if (!isCompressed) {
      return data;
    }

    // Restore default values for optional fields
    return {
      ...data,
      sets: data.sets?.map((set) => ({
        ...set,
        isWarmup: set.isWarmup ?? false,
        isFailure: set.isFailure ?? false,
      })),
    };
  }

  // ============================================================================
  // STORAGE MANAGEMENT METHODS
  // ============================================================================

  /**
   * Get enhanced offline queue with metadata
   */
  private async getEnhancedOfflineQueue(): Promise<OfflineWorkoutData[]> {
    try {
      const queue = await getAsyncItem<OfflineWorkoutData[]>(`${this.STORAGE_PREFIX}enhanced_queue`);
      return queue || [];
    } catch (error) {
      logger.error("Failed to get enhanced offline queue", error, "offline");
      return [];
    }
  }

  /**
   * Add workout to enhanced offline queue
   */
  private async addToEnhancedOfflineQueue(workout: OfflineWorkoutData): Promise<void> {
    try {
      const queue = await this.getEnhancedOfflineQueue();

      // Remove existing entry if present
      const filteredQueue = queue.filter((w) => w.id !== workout.id);

      // Add new entry
      filteredQueue.push(workout);

      await setAsyncItem(`${this.STORAGE_PREFIX}enhanced_queue`, filteredQueue);

      // Also add to base queue for backward compatibility
      await baseAddToOfflineQueue({
        id: workout.id,
        data: workout.data,
      });
    } catch (error) {
      logger.error("Failed to add workout to enhanced offline queue", error, "offline");
      throw error;
    }
  }

  /**
   * Update storage statistics
   */
  private async updateStorageStats(): Promise<void> {
    try {
      const queue = await this.getEnhancedOfflineQueue();
      const stats = {
        totalWorkouts: queue.length,
        pendingSync: queue.filter((w) => w.syncAttempts === 0).length,
        lastUpdated: Date.now(),
      };

      await setAsyncItem(`${this.STORAGE_PREFIX}stats`, stats);
    } catch (error) {
      logger.error("Failed to update storage stats", error, "offline");
    }
  }

  /**
   * Perform storage cleanup
   */
  async performStorageCleanup(): Promise<void> {
    try {
      logger.info("Starting storage cleanup", undefined, "offline");

      const queue = await this.getEnhancedOfflineQueue();
      const now = Date.now();

      // Remove old workouts
      const validWorkouts = queue.filter((workout) => {
        const age = now - workout.timestamp;
        return age <= this.MAX_WORKOUT_AGE;
      });

      // Remove corrupted workouts
      const healthyWorkouts = [];
      for (const workout of validWorkouts) {
        const isValid = await this.verifyDataIntegrity(workout);
        if (isValid) {
          healthyWorkouts.push(workout);
        } else {
          logger.warn("Removing corrupted workout during cleanup", { workoutId: workout.id }, "offline");
          await removeAsyncItem(`${this.STORAGE_PREFIX}workout_${workout.id}`);
        }
      }

      // Update queue
      await setAsyncItem(`${this.STORAGE_PREFIX}enhanced_queue`, healthyWorkouts);

      // Update stats
      await this.updateStorageStats();

      const removedCount = queue.length - healthyWorkouts.length;
      logger.info("Storage cleanup completed", { removedCount, remaining: healthyWorkouts.length }, "offline");
    } catch (error) {
      logger.error("Storage cleanup failed", error, "offline");
      throw error;
    }
  }

  /**
   * Get storage health report
   */
  async getStorageHealthReport(): Promise<StorageHealthReport> {
    try {
      const queue = await this.getEnhancedOfflineQueue();
      const corruptedWorkouts: string[] = [];
      let storageUsed = 0;

      // Check each workout for corruption and calculate storage usage
      for (const workout of queue) {
        const isValid = await this.verifyDataIntegrity(workout);
        if (!isValid) {
          corruptedWorkouts.push(workout.id);
        }

        storageUsed += JSON.stringify(workout).length;
      }

      const oldestWorkout =
        queue.length > 0
          ? queue.reduce((oldest, current) => (current.timestamp < oldest.timestamp ? current : oldest)).id
          : null;

      const recommendations: string[] = [];

      if (corruptedWorkouts.length > 0) {
        recommendations.push(`${corruptedWorkouts.length} corrupted workouts found - consider cleanup`);
      }

      if (storageUsed > this.MAX_STORAGE_SIZE * 0.8) {
        recommendations.push("Storage usage high - consider cleanup");
      }

      if (queue.length > 100) {
        recommendations.push("Large number of pending workouts - check sync status");
      }

      return {
        totalWorkouts: queue.length,
        pendingSync: queue.filter((w) => w.syncAttempts === 0).length,
        storageUsed,
        oldestWorkout,
        corruptedWorkouts,
        recommendations,
      };
    } catch (error) {
      logger.error("Failed to generate storage health report", error, "offline");
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get device ID for tracking
   */
  private async getDeviceId(): Promise<string> {
    try {
      let deviceId = await getAsyncItem<string>("device_id");

      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await setAsyncItem("device_id", deviceId);
      }

      return deviceId;
    } catch (error) {
      logger.error("Failed to get device ID", error, "offline");
      return `fallback_${Date.now()}`;
    }
  }

  /**
   * Mark workout as corrupted
   */
  private async markWorkoutCorrupted(workoutId: string): Promise<void> {
    try {
      const corruptedList = (await getAsyncItem<string[]>(`${this.STORAGE_PREFIX}corrupted`)) || [];

      if (!corruptedList.includes(workoutId)) {
        corruptedList.push(workoutId);
        await setAsyncItem(`${this.STORAGE_PREFIX}corrupted`, corruptedList);
      }

      logger.warn("Workout marked as corrupted", { workoutId }, "offline");
    } catch (error) {
      logger.error("Failed to mark workout as corrupted", error, "offline");
    }
  }

  /**
   * Clear all offline data (for logout or reset)
   */
  async clearAllOfflineData(): Promise<void> {
    try {
      logger.info("Clearing all offline data", undefined, "offline");

      const queue = await this.getEnhancedOfflineQueue();

      // Remove individual workout files
      for (const workout of queue) {
        await removeAsyncItem(`${this.STORAGE_PREFIX}workout_${workout.id}`);
      }

      // Remove queue and stats
      await removeAsyncItem(`${this.STORAGE_PREFIX}enhanced_queue`);
      await removeAsyncItem(`${this.STORAGE_PREFIX}stats`);
      await removeAsyncItem(`${this.STORAGE_PREFIX}corrupted`);

      // Clear base offline queue for backward compatibility
      await setAsyncItem(STORAGE_KEYS.async.offlineWorkouts, []);

      logger.info("All offline data cleared", undefined, "offline");
    } catch (error) {
      logger.error("Failed to clear offline data", error, "offline");
      throw error;
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const offlineService = OfflineService.getInstance();
export default offlineService;
