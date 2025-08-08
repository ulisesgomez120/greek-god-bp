// ============================================================================
// WORKOUT SERVICE
// ============================================================================
// Comprehensive workout session management with offline support, data validation,
// and automatic recovery mechanisms

import { logger } from "../utils/logger";
import { offlineService } from "./offline.service";
import { authService } from "./auth.service";
import { createClient } from "@supabase/supabase-js";
import { ENV_CONFIG, WORKOUT_CONSTANTS, ERROR_MESSAGES, SUCCESS_MESSAGES } from "../config/constants";
import type {
  WorkoutSession,
  ExerciseSet,
  WorkoutPlan,
  Exercise,
  ProgressionRecommendation,
  ExperienceLevel,
} from "../types";
import type { Database } from "../types/database";

// ============================================================================
// TYPES
// ============================================================================

export interface WorkoutServiceConfig {
  enableOfflineMode: boolean;
  autoSave: boolean;
  autoSync: boolean;
  syncInterval: number; // in milliseconds
  maxRetries: number;
  retryDelay: number; // in milliseconds
}

export interface CreateWorkoutOptions {
  planId?: string;
  sessionId?: string;
  priority?: "low" | "medium" | "high";
  conflictResolution?: "client" | "server" | "merge" | "manual";
}

export interface WorkoutServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  offline?: boolean;
  syncPending?: boolean;
}

export interface WorkoutStats {
  totalVolume: number;
  averageRpe: number;
  duration: number;
  setCount: number;
  exerciseCount: number;
}

export interface SessionRecoveryData {
  workoutId: string;
  lastSavedAt: string;
  currentExercise: number;
  currentSet: number;
  completedSets: ExerciseSet[];
  canRecover: boolean;
}

// ============================================================================
// WORKOUT SERVICE CLASS
// ============================================================================

export class WorkoutService {
  private static instance: WorkoutService;
  private supabase = createClient<Database>(ENV_CONFIG.supabaseUrl, ENV_CONFIG.supabaseAnonKey);
  private config: WorkoutServiceConfig;
  private currentSession: WorkoutSession | null = null;
  private autoSaveTimer?: ReturnType<typeof setInterval>;
  private syncTimer?: ReturnType<typeof setInterval>;

  private constructor(config?: Partial<WorkoutServiceConfig>) {
    this.config = {
      enableOfflineMode: true,
      autoSave: true,
      autoSync: true,
      syncInterval: 30000, // 30 seconds
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      ...config,
    };

    if (this.config.autoSync) {
      this.startAutoSync();
    }
  }

  public static getInstance(config?: Partial<WorkoutServiceConfig>): WorkoutService {
    if (!WorkoutService.instance) {
      WorkoutService.instance = new WorkoutService(config);
    }
    return WorkoutService.instance;
  }

  // ============================================================================
  // WORKOUT SESSION MANAGEMENT
  // ============================================================================

  /**
   * Start a new workout session
   */
  async startWorkout(
    name: string,
    exercises: string[],
    options: CreateWorkoutOptions = {}
  ): Promise<WorkoutServiceResult<WorkoutSession>> {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        return {
          success: false,
          error: "User not authenticated",
        };
      }

      logger.info("Starting new workout", { name, exerciseCount: exercises.length }, "workout", user.id);

      // Create workout session
      const workout: WorkoutSession = {
        id: `workout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user.id,
        planId: options.planId,
        sessionId: options.sessionId,
        name,
        startedAt: new Date().toISOString(),
        syncStatus: "pending",
        offlineCreated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sets: [],
      };

      // Store offline immediately
      if (this.config.enableOfflineMode) {
        await offlineService.storeWorkoutOffline(
          workout,
          options.priority || "medium",
          options.conflictResolution || "merge"
        );
      }

      // Set as current session
      this.currentSession = workout;

      // Start auto-save if enabled
      if (this.config.autoSave) {
        this.startAutoSave();
      }

      logger.info("Workout started successfully", { workoutId: workout.id }, "workout", user.id);

      return {
        success: true,
        data: workout,
        offline: this.config.enableOfflineMode,
        syncPending: true,
      };
    } catch (error) {
      logger.error("Failed to start workout", error, "workout");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to start workout",
      };
    }
  }

  /**
   * Add exercise set to current workout
   */
  async addExerciseSet(setData: {
    exerciseId: string;
    weightKg?: number;
    reps: number;
    rpe?: number;
    isWarmup?: boolean;
    restSeconds?: number;
    notes?: string;
  }): Promise<WorkoutServiceResult<ExerciseSet>> {
    try {
      if (!this.currentSession) {
        return {
          success: false,
          error: "No active workout session",
        };
      }

      const user = await authService.getCurrentUser();
      if (!user) {
        return {
          success: false,
          error: "User not authenticated",
        };
      }

      // Get current set number for this exercise
      const existingSets = this.currentSession.sets?.filter((set) => set.exerciseId === setData.exerciseId) || [];

      const newSet: ExerciseSet = {
        id: `set_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId: this.currentSession.id,
        exerciseId: setData.exerciseId,
        setNumber: existingSets.length + 1,
        weightKg: setData.weightKg,
        reps: setData.reps,
        rpe: setData.rpe,
        isWarmup: setData.isWarmup || false,
        isFailure: false,
        restSeconds: setData.restSeconds,
        notes: setData.notes,
        createdAt: new Date().toISOString(),
      };

      // Add set to current session
      if (!this.currentSession.sets) {
        this.currentSession.sets = [];
      }
      this.currentSession.sets.push(newSet);

      // Update session timestamp
      this.currentSession.updatedAt = new Date().toISOString();

      // Store offline immediately
      if (this.config.enableOfflineMode) {
        await offlineService.storeWorkoutOffline(this.currentSession);
      }

      logger.info(
        "Exercise set added",
        {
          exerciseId: setData.exerciseId,
          setNumber: newSet.setNumber,
          weight: setData.weightKg,
          reps: setData.reps,
          rpe: setData.rpe,
        },
        "workout",
        user.id
      );

      return {
        success: true,
        data: newSet,
        offline: this.config.enableOfflineMode,
        syncPending: true,
      };
    } catch (error) {
      logger.error("Failed to add exercise set", error, "workout");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add exercise set",
      };
    }
  }

  /**
   * Complete current workout session
   */
  async completeWorkout(notes?: string): Promise<WorkoutServiceResult<WorkoutSession>> {
    try {
      if (!this.currentSession) {
        return {
          success: false,
          error: "No active workout session",
        };
      }

      const user = await authService.getCurrentUser();
      if (!user) {
        return {
          success: false,
          error: "User not authenticated",
        };
      }

      // Calculate workout stats
      const stats = this.calculateWorkoutStats(this.currentSession);

      // Complete the workout
      const completedWorkout: WorkoutSession = {
        ...this.currentSession,
        completedAt: new Date().toISOString(),
        durationMinutes: Math.round(
          (new Date().getTime() - new Date(this.currentSession.startedAt).getTime()) / (1000 * 60)
        ),
        notes,
        totalVolumeKg: stats.totalVolume,
        averageRpe: stats.averageRpe,
        syncStatus: "pending",
        updatedAt: new Date().toISOString(),
      };

      // Store offline
      if (this.config.enableOfflineMode) {
        await offlineService.storeWorkoutOffline(completedWorkout, "high"); // High priority for completed workouts
      }

      // Clear current session
      this.currentSession = null;
      this.stopAutoSave();

      logger.info(
        "Workout completed",
        {
          workoutId: completedWorkout.id,
          duration: completedWorkout.durationMinutes,
          volume: completedWorkout.totalVolumeKg,
          averageRpe: completedWorkout.averageRpe,
        },
        "workout",
        user.id
      );

      return {
        success: true,
        data: completedWorkout,
        offline: this.config.enableOfflineMode,
        syncPending: true,
      };
    } catch (error) {
      logger.error("Failed to complete workout", error, "workout");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to complete workout",
      };
    }
  }

  /**
   * Cancel current workout session
   */
  async cancelWorkout(): Promise<WorkoutServiceResult<void>> {
    try {
      if (!this.currentSession) {
        return {
          success: false,
          error: "No active workout session",
        };
      }

      const user = await authService.getCurrentUser();
      const workoutId = this.currentSession.id;

      // Remove from offline storage
      if (this.config.enableOfflineMode) {
        await offlineService.removeWorkoutOffline(workoutId);
      }

      // Clear current session
      this.currentSession = null;
      this.stopAutoSave();

      logger.info("Workout cancelled", { workoutId }, "workout", user?.id);

      return {
        success: true,
        offline: this.config.enableOfflineMode,
      };
    } catch (error) {
      logger.error("Failed to cancel workout", error, "workout");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to cancel workout",
      };
    }
  }

  // ============================================================================
  // SESSION RECOVERY
  // ============================================================================

  /**
   * Check for recoverable workout sessions
   */
  async checkForRecoverableSession(): Promise<SessionRecoveryData | null> {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        return null;
      }

      // Get pending workouts from offline storage
      const pendingWorkouts = await offlineService.getPendingWorkouts();

      // Find incomplete workouts (no completedAt)
      const incompleteWorkouts = pendingWorkouts.filter(
        (workout) => !workout.data.completedAt && workout.data.userId === user.id
      );

      if (incompleteWorkouts.length === 0) {
        return null;
      }

      // Get the most recent incomplete workout
      const latestIncomplete = incompleteWorkouts.sort((a, b) => b.timestamp - a.timestamp)[0];

      const workoutData = latestIncomplete.data as WorkoutSession;
      const sets = workoutData.sets || [];

      return {
        workoutId: workoutData.id,
        lastSavedAt: new Date(latestIncomplete.timestamp).toISOString(),
        currentExercise: 0, // Would need to calculate based on sets
        currentSet: sets.length,
        completedSets: sets,
        canRecover: true,
      };
    } catch (error) {
      logger.error("Failed to check for recoverable session", error, "workout");
      return null;
    }
  }

  /**
   * Recover a workout session
   */
  async recoverWorkoutSession(workoutId: string): Promise<WorkoutServiceResult<WorkoutSession>> {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        return {
          success: false,
          error: "User not authenticated",
        };
      }

      // Get workout from offline storage
      const workout = await offlineService.getWorkoutOffline(workoutId);
      if (!workout) {
        return {
          success: false,
          error: "Workout session not found",
        };
      }

      // Set as current session
      this.currentSession = workout;

      // Start auto-save
      if (this.config.autoSave) {
        this.startAutoSave();
      }

      logger.info("Workout session recovered", { workoutId }, "workout", user.id);

      return {
        success: true,
        data: workout,
        offline: this.config.enableOfflineMode,
        syncPending: true,
      };
    } catch (error) {
      logger.error("Failed to recover workout session", error, "workout");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to recover workout session",
      };
    }
  }

  // ============================================================================
  // WORKOUT STATISTICS
  // ============================================================================

  /**
   * Calculate workout statistics
   */
  private calculateWorkoutStats(workout: WorkoutSession): WorkoutStats {
    const sets = workout.sets || [];
    const workingSets = sets.filter((set) => !set.isWarmup);

    const totalVolume = workingSets.reduce((sum, set) => {
      return sum + (set.weightKg || 0) * set.reps;
    }, 0);

    const rpeValues = workingSets.filter((set) => set.rpe && set.rpe > 0).map((set) => set.rpe!);

    const averageRpe = rpeValues.length > 0 ? rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length : 0;

    const duration = workout.completedAt
      ? Math.round((new Date(workout.completedAt).getTime() - new Date(workout.startedAt).getTime()) / (1000 * 60))
      : 0;

    const exerciseIds = new Set(sets.map((set) => set.exerciseId));

    return {
      totalVolume: Math.round(totalVolume * 100) / 100, // Round to 2 decimal places
      averageRpe: Math.round(averageRpe * 10) / 10, // Round to 1 decimal place
      duration,
      setCount: sets.length,
      exerciseCount: exerciseIds.size,
    };
  }

  // ============================================================================
  // AUTO-SAVE FUNCTIONALITY
  // ============================================================================

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(async () => {
      if (this.currentSession && this.config.enableOfflineMode) {
        try {
          await offlineService.storeWorkoutOffline(this.currentSession);
          logger.debug("Auto-saved workout session", { workoutId: this.currentSession.id }, "workout");
        } catch (error) {
          logger.error("Auto-save failed", error, "workout");
        }
      }
    }, 10000); // Auto-save every 10 seconds
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  // ============================================================================
  // AUTO-SYNC FUNCTIONALITY
  // ============================================================================

  /**
   * Start auto-sync timer
   */
  private startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(async () => {
      await this.syncPendingWorkouts();
    }, this.config.syncInterval);
  }

  /**
   * Stop auto-sync timer
   */
  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  /**
   * Sync pending workouts with server
   */
  async syncPendingWorkouts(): Promise<WorkoutServiceResult<{ syncedCount: number; errorCount: number }>> {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        return {
          success: false,
          error: "User not authenticated",
        };
      }

      const pendingWorkouts = await offlineService.getPendingWorkouts();
      if (pendingWorkouts.length === 0) {
        return {
          success: true,
          data: { syncedCount: 0, errorCount: 0 },
        };
      }

      logger.info(`Syncing ${pendingWorkouts.length} pending workouts`, undefined, "workout", user.id);

      let syncedCount = 0;
      let errorCount = 0;

      for (const offlineWorkout of pendingWorkouts) {
        try {
          // Attempt to sync with server
          const { error } = await this.supabase
            .from("workout_sessions")
            .upsert(offlineWorkout.data, { onConflict: "id" });

          if (error) {
            throw error;
          }

          // Remove from offline storage on successful sync
          await offlineService.removeWorkoutOffline(offlineWorkout.id);
          syncedCount++;

          logger.debug("Workout synced successfully", { workoutId: offlineWorkout.id }, "workout", user.id);
        } catch (error) {
          errorCount++;
          logger.error("Failed to sync workout", error, "workout", user.id);
        }
      }

      logger.info("Sync completed", { syncedCount, errorCount }, "workout", user.id);

      return {
        success: true,
        data: { syncedCount, errorCount },
      };
    } catch (error) {
      logger.error("Failed to sync pending workouts", error, "workout");
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to sync workouts",
      };
    }
  }

  // ============================================================================
  // GETTERS AND STATE
  // ============================================================================

  /**
   * Get current workout session
   */
  getCurrentSession(): WorkoutSession | null {
    return this.currentSession;
  }

  /**
   * Check if there's an active workout
   */
  hasActiveWorkout(): boolean {
    return this.currentSession !== null;
  }

  /**
   * Get workout service configuration
   */
  getConfig(): WorkoutServiceConfig {
    return { ...this.config };
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<WorkoutServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart timers if needed
    if (this.config.autoSync) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }

    if (this.config.autoSave && this.currentSession) {
      this.startAutoSave();
    } else if (!this.config.autoSave) {
      this.stopAutoSave();
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Cleanup service resources
   */
  async cleanup(): Promise<void> {
    try {
      this.stopAutoSave();
      this.stopAutoSync();
      this.currentSession = null;

      logger.info("Workout service cleaned up", undefined, "workout");
    } catch (error) {
      logger.error("Failed to cleanup workout service", error, "workout");
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const workoutService = WorkoutService.getInstance();
export default workoutService;
