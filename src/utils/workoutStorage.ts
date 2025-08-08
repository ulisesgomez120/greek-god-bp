// ============================================================================
// WORKOUT STORAGE UTILITIES
// ============================================================================
// Local workout data storage utilities with compression, validation, and
// recovery mechanisms for offline-first functionality

import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "./logger";
import { STORAGE_KEYS, VALIDATION } from "../config/constants";
import type { WorkoutSession, ExerciseSet } from "../types";

// ============================================================================
// TYPES
// ============================================================================

export interface StoredWorkout {
  id: string;
  data: WorkoutSession;
  timestamp: number;
  checksum: string;
  compressed: boolean;
  version: string;
}

export interface WorkoutStorageStats {
  totalWorkouts: number;
  totalSize: number; // in bytes
  oldestWorkout: string | null;
  newestWorkout: string | null;
  corruptedWorkouts: string[];
}

export interface StorageValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// STORAGE UTILITIES
// ============================================================================

/**
 * Store workout session with validation and compression
 */
export async function storeWorkoutSession(workout: WorkoutSession): Promise<void> {
  try {
    // Validate workout data
    const validation = validateWorkoutData(workout);
    if (!validation.isValid) {
      throw new Error(`Invalid workout data: ${validation.errors.join(", ")}`);
    }

    // Compress if needed
    const workoutData = compressWorkoutData(workout);
    const compressed = JSON.stringify(workoutData).length < JSON.stringify(workout).length;

    // Generate checksum
    const checksum = generateChecksum(workoutData);

    const storedWorkout: StoredWorkout = {
      id: workout.id,
      data: workoutData,
      timestamp: Date.now(),
      checksum,
      compressed,
      version: "1.0",
    };

    // Store individual workout
    await AsyncStorage.setItem(`workout_${workout.id}`, JSON.stringify(storedWorkout));

    // Update workout index
    await updateWorkoutIndex(workout.id);

    logger.info(
      "Workout stored successfully",
      {
        workoutId: workout.id,
        compressed,
        size: JSON.stringify(storedWorkout).length,
      },
      "storage",
      workout.userId
    );
  } catch (error) {
    logger.error("Failed to store workout", error, "storage", workout.userId);
    throw error;
  }
}

/**
 * Retrieve workout session from storage
 */
export async function getWorkoutSession(workoutId: string): Promise<WorkoutSession | null> {
  try {
    const storedData = await AsyncStorage.getItem(`workout_${workoutId}`);
    if (!storedData) {
      return null;
    }

    const storedWorkout: StoredWorkout = JSON.parse(storedData);

    // Verify data integrity
    const isValid = verifyChecksum(storedWorkout.data, storedWorkout.checksum);
    if (!isValid) {
      logger.warn("Corrupted workout data detected", { workoutId }, "storage");
      await markWorkoutCorrupted(workoutId);
      return null;
    }

    // Decompress if needed
    const workoutData = storedWorkout.compressed ? decompressWorkoutData(storedWorkout.data) : storedWorkout.data;

    logger.debug("Retrieved workout from storage", { workoutId }, "storage");
    return workoutData;
  } catch (error) {
    logger.error("Failed to retrieve workout", error, "storage");
    return null;
  }
}

/**
 * Get all stored workout IDs
 */
export async function getAllWorkoutIds(): Promise<string[]> {
  try {
    const indexData = await AsyncStorage.getItem(STORAGE_KEYS.async.workoutCache);
    if (!indexData) {
      return [];
    }

    const index: string[] = JSON.parse(indexData);
    return index;
  } catch (error) {
    logger.error("Failed to get workout IDs", error, "storage");
    return [];
  }
}

/**
 * Get multiple workout sessions
 */
export async function getWorkoutSessions(workoutIds: string[]): Promise<WorkoutSession[]> {
  const workouts: WorkoutSession[] = [];

  for (const workoutId of workoutIds) {
    try {
      const workout = await getWorkoutSession(workoutId);
      if (workout) {
        workouts.push(workout);
      }
    } catch (error) {
      logger.error("Failed to retrieve workout in batch", error, "storage");
    }
  }

  return workouts;
}

/**
 * Remove workout from storage
 */
export async function removeWorkoutSession(workoutId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`workout_${workoutId}`);
    await removeFromWorkoutIndex(workoutId);

    logger.info("Workout removed from storage", { workoutId }, "storage");
  } catch (error) {
    logger.error("Failed to remove workout", error, "storage");
    throw error;
  }
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<WorkoutStorageStats> {
  try {
    const workoutIds = await getAllWorkoutIds();
    let totalSize = 0;
    let oldestTimestamp = Date.now();
    let newestTimestamp = 0;
    let oldestWorkout: string | null = null;
    let newestWorkout: string | null = null;
    const corruptedWorkouts: string[] = [];

    for (const workoutId of workoutIds) {
      try {
        const storedData = await AsyncStorage.getItem(`workout_${workoutId}`);
        if (storedData) {
          totalSize += storedData.length;

          const storedWorkout: StoredWorkout = JSON.parse(storedData);

          // Check for corruption
          const isValid = verifyChecksum(storedWorkout.data, storedWorkout.checksum);
          if (!isValid) {
            corruptedWorkouts.push(workoutId);
            continue;
          }

          // Track oldest and newest
          if (storedWorkout.timestamp < oldestTimestamp) {
            oldestTimestamp = storedWorkout.timestamp;
            oldestWorkout = workoutId;
          }
          if (storedWorkout.timestamp > newestTimestamp) {
            newestTimestamp = storedWorkout.timestamp;
            newestWorkout = workoutId;
          }
        }
      } catch (error) {
        logger.error("Error processing workout in stats", error, "storage");
        corruptedWorkouts.push(workoutId);
      }
    }

    return {
      totalWorkouts: workoutIds.length,
      totalSize,
      oldestWorkout,
      newestWorkout,
      corruptedWorkouts,
    };
  } catch (error) {
    logger.error("Failed to get storage stats", error, "storage");
    throw error;
  }
}

/**
 * Clean up corrupted and old workouts
 */
export async function cleanupStorage(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
  try {
    const workoutIds = await getAllWorkoutIds();
    const now = Date.now();
    let removedCount = 0;

    for (const workoutId of workoutIds) {
      try {
        const storedData = await AsyncStorage.getItem(`workout_${workoutId}`);
        if (!storedData) {
          await removeFromWorkoutIndex(workoutId);
          removedCount++;
          continue;
        }

        const storedWorkout: StoredWorkout = JSON.parse(storedData);

        // Remove if too old
        if (now - storedWorkout.timestamp > maxAge) {
          await removeWorkoutSession(workoutId);
          removedCount++;
          continue;
        }

        // Remove if corrupted
        const isValid = verifyChecksum(storedWorkout.data, storedWorkout.checksum);
        if (!isValid) {
          await removeWorkoutSession(workoutId);
          removedCount++;
          continue;
        }
      } catch (error) {
        logger.error("Error during cleanup", error, "storage");
        await removeWorkoutSession(workoutId);
        removedCount++;
      }
    }

    logger.info("Storage cleanup completed", { removedCount }, "storage");
    return removedCount;
  } catch (error) {
    logger.error("Storage cleanup failed", error, "storage");
    throw error;
  }
}

/**
 * Clear all workout data
 */
export async function clearAllWorkouts(): Promise<void> {
  try {
    const workoutIds = await getAllWorkoutIds();

    // Remove individual workouts
    for (const workoutId of workoutIds) {
      await AsyncStorage.removeItem(`workout_${workoutId}`);
    }

    // Clear index
    await AsyncStorage.removeItem(STORAGE_KEYS.async.workoutCache);

    logger.info("All workout data cleared", { count: workoutIds.length }, "storage");
  } catch (error) {
    logger.error("Failed to clear workout data", error, "storage");
    throw error;
  }
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate workout data structure and content
 */
function validateWorkoutData(workout: WorkoutSession): StorageValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

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
        errors.push(`Set ${index + 1}: Invalid reps (${set.reps})`);
      }

      if (set.weightKg && (set.weightKg < 0 || set.weightKg > VALIDATION.workout.maxWeight)) {
        errors.push(`Set ${index + 1}: Invalid weight (${set.weightKg}kg)`);
      }

      if (set.rpe && (set.rpe < 1 || set.rpe > 10)) {
        errors.push(`Set ${index + 1}: Invalid RPE (${set.rpe})`);
      }

      // Warnings for unusual values
      if (set.reps > 50) {
        warnings.push(`Set ${index + 1}: High rep count (${set.reps})`);
      }
      if (set.weightKg && set.weightKg > 500) {
        warnings.push(`Set ${index + 1}: Very high weight (${set.weightKg}kg)`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// COMPRESSION UTILITIES
// ============================================================================

/**
 * Compress workout data by removing null/undefined values and optimizing structure
 */
function compressWorkoutData(workout: WorkoutSession): WorkoutSession {
  const compressed: any = {};

  // Copy non-null/undefined values
  Object.entries(workout).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      if (key === "sets" && Array.isArray(value)) {
        compressed[key] = value.map((set) => {
          const compressedSet: any = {};
          Object.entries(set).forEach(([setKey, setValue]) => {
            if (setValue !== null && setValue !== undefined) {
              compressedSet[setKey] = setValue;
            }
          });
          return compressedSet;
        });
      } else {
        compressed[key] = value;
      }
    }
  });

  return compressed as WorkoutSession;
}

/**
 * Decompress workout data by restoring default values
 */
function decompressWorkoutData(workout: WorkoutSession): WorkoutSession {
  return {
    ...workout,
    sets: workout.sets?.map((set) => ({
      ...set,
      isWarmup: set.isWarmup ?? false,
      isFailure: set.isFailure ?? false,
    })),
  };
}

// ============================================================================
// CHECKSUM UTILITIES
// ============================================================================

/**
 * Generate simple checksum for data integrity
 */
function generateChecksum(data: any): string {
  const jsonString = JSON.stringify(data);
  let hash = 0;

  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return hash.toString(16);
}

/**
 * Verify data integrity using checksum
 */
function verifyChecksum(data: any, expectedChecksum: string): boolean {
  try {
    const actualChecksum = generateChecksum(data);
    return actualChecksum === expectedChecksum;
  } catch (error) {
    logger.error("Checksum verification failed", error, "storage");
    return false;
  }
}

// ============================================================================
// INDEX MANAGEMENT
// ============================================================================

/**
 * Update workout index with new workout ID
 */
async function updateWorkoutIndex(workoutId: string): Promise<void> {
  try {
    const indexData = await AsyncStorage.getItem(STORAGE_KEYS.async.workoutCache);
    const index: string[] = indexData ? JSON.parse(indexData) : [];

    if (!index.includes(workoutId)) {
      index.push(workoutId);
      await AsyncStorage.setItem(STORAGE_KEYS.async.workoutCache, JSON.stringify(index));
    }
  } catch (error) {
    logger.error("Failed to update workout index", error, "storage");
  }
}

/**
 * Remove workout ID from index
 */
async function removeFromWorkoutIndex(workoutId: string): Promise<void> {
  try {
    const indexData = await AsyncStorage.getItem(STORAGE_KEYS.async.workoutCache);
    if (indexData) {
      const index: string[] = JSON.parse(indexData);
      const filteredIndex = index.filter((id) => id !== workoutId);
      await AsyncStorage.setItem(STORAGE_KEYS.async.workoutCache, JSON.stringify(filteredIndex));
    }
  } catch (error) {
    logger.error("Failed to remove from workout index", error, "storage");
  }
}

/**
 * Mark workout as corrupted
 */
async function markWorkoutCorrupted(workoutId: string): Promise<void> {
  try {
    const corruptedKey = "corrupted_workouts";
    const corruptedData = await AsyncStorage.getItem(corruptedKey);
    const corruptedList: string[] = corruptedData ? JSON.parse(corruptedData) : [];

    if (!corruptedList.includes(workoutId)) {
      corruptedList.push(workoutId);
      await AsyncStorage.setItem(corruptedKey, JSON.stringify(corruptedList));
    }

    logger.warn("Workout marked as corrupted", { workoutId }, "storage");
  } catch (error) {
    logger.error("Failed to mark workout as corrupted", error, "storage");
  }
}

// ============================================================================
// EXPORT DEFAULT FUNCTIONS
// ============================================================================

export default {
  storeWorkoutSession,
  getWorkoutSession,
  getAllWorkoutIds,
  getWorkoutSessions,
  removeWorkoutSession,
  getStorageStats,
  cleanupStorage,
  clearAllWorkouts,
};
