// ============================================================================
// WORKOUT SERVICE (online-first, Phase 2)
// ============================================================================
// Workout session management simplified for online-first flow.
// Removed auto-save / auto-sync timers, debounced sync, and event-driven sync.
// These features were removed in Phase 2 as requested and will not be kept
// for backwards compatibility. Remaining methods perform direct server calls
// and provide optimistic UI behavior where appropriate.

import { logger } from "../utils/logger";
import { authService } from "./auth.service";
import supabase from "@/lib/supabase";
import { databaseService } from "./database.service";
import { transformWorkoutSessionWithSets } from "@/types/transforms";
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
  maxRetries: number;
  retryDelay: number; // in milliseconds
  enableExerciseValidation?: boolean; // when true, validate exercise exists before inserting sets (default: true)
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
  private supabase = supabase;
  private config: WorkoutServiceConfig;
  private currentSession: WorkoutSession | null = null;

  private constructor(config?: Partial<WorkoutServiceConfig>) {
    // Minimal configuration for online-first flow.
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      enableExerciseValidation: true,
      ...config,
    };

    // Note: event subscriptions and auto-sync/auto-save removed intentionally.
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

      // Attempt to create workout session on the server and let Supabase generate the ID.
      let workout: WorkoutSession;
      try {
        const payload: any = {
          userId: user.id,
          planId: options.planId,
          sessionId: options.sessionId,
          name,
          startedAt: new Date().toISOString(),
        };

        // Delegate creation to DatabaseService which handles transforms and offline fallback
        const inserted = await databaseService.insertWorkoutSession(payload);
        workout = inserted;
      } catch (err) {
        logger.warn("Unexpected error while persisting workout to DatabaseService", err, "workout", user.id);
        workout = {
          id: `temp_workout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: user.id,
          planId: options.planId,
          sessionId: options.sessionId,
          name,
          startedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sets: [],
        };
      }

      // Set as current session
      this.currentSession = workout;

      logger.info("Workout started successfully", { workoutId: workout.id }, "workout", user.id);

      return {
        success: true,
        data: workout,
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
    plannedExerciseId?: string;
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

      // Optionally validate exercise exists via DatabaseService to avoid FK violations.
      if (this.config.enableExerciseValidation) {
        try {
          const existingExercise = await databaseService.getExerciseById(setData.exerciseId);
          if (!existingExercise) {
            logger.warn(
              "Attempted to add set for missing exercise id; aborting to avoid FK violation",
              { exerciseId: setData.exerciseId },
              "workout",
              user.id
            );

            return {
              success: false,
              error: "Exercise not found",
            };
          }
        } catch (err) {
          logger.warn("Failed to validate exercise existence", err, "workout", user.id);
          return {
            success: false,
            error: "Failed to validate exercise existence",
          };
        }
      }

      // Get current set number for this exercise
      const existingSets = this.currentSession.sets?.filter((set) => set.exerciseId === setData.exerciseId) || [];

      // Prepare payload for server-side insertion and let Supabase generate the set ID.
      const sessionId = this.currentSession.id;
      const setNumber = existingSets.length + 1;
      // Build app-level set object (camelCase). DatabaseService will handle DB transforms.
      const appSet: any = {
        sessionId,
        exerciseId: setData.exerciseId,
        plannedExerciseId: setData.plannedExerciseId,
        setNumber,
        weightKg: setData.weightKg ?? undefined,
        reps: setData.reps,
        rpe: setData.rpe ?? undefined,
        isWarmup: !!setData.isWarmup,
        isFailure: false,
        restSeconds: setData.restSeconds ?? undefined,
        notes: setData.notes ?? undefined,
      };

      // Optimistically add a provisional set locally while we persist.
      const provisionalSet: ExerciseSet = {
        id: `temp_set_${Date.now()}`,
        sessionId,
        exerciseId: setData.exerciseId,
        plannedExerciseId: setData.plannedExerciseId,
        setNumber,
        weightKg: setData.weightKg,
        reps: setData.reps,
        rpe: setData.rpe,
        isWarmup: setData.isWarmup || false,
        isFailure: false,
        restSeconds: setData.restSeconds,
        notes: setData.notes,
        createdAt: new Date().toISOString(),
      };

      if (!this.currentSession.sets) {
        this.currentSession.sets = [];
      }
      this.currentSession.sets.push(provisionalSet);
      this.currentSession.updatedAt = new Date().toISOString();

      // Persist the set via DatabaseService (best-effort). Replace provisional set with server row when available.
      try {
        // Use the app-level set object; DatabaseService will transform to DB format
        const dbSets = [appSet];

        const insertedSets = await databaseService.insertExerciseSets(dbSets);
        const insertedSet = Array.isArray(insertedSets) && insertedSets.length > 0 ? insertedSets[0] : null;

        if (!insertedSet) {
          logger.warn("Failed to persist exercise set via DatabaseService", undefined, "workout", user.id);
          // keep provisional set as-is
        } else {
          const mapped: ExerciseSet = insertedSet;

          // Replace provisional set in currentSession.sets
          const idx = this.currentSession.sets.findIndex((s) => s.id === provisionalSet.id);
          if (idx >= 0) {
            this.currentSession.sets[idx] = mapped;
          } else {
            this.currentSession.sets.push(mapped);
          }

          // Update workout session updated_at on server (best-effort)
          try {
            await this.supabase
              .from("workout_sessions")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", sessionId)
              .eq("user_id", user.id);
          } catch (e) {
            // non-fatal
          }
        }
      } catch (err) {
        logger.warn("Unexpected error while persisting exercise set via DatabaseService", err, "workout", user.id);
      }

      // Determine final set (prefer server-mapped entry if available)
      const provisionalIndex = this.currentSession.sets.findIndex((s) => s.id === provisionalSet.id);
      const finalSet: ExerciseSet =
        provisionalIndex >= 0 ? (this.currentSession.sets[provisionalIndex] as ExerciseSet) : provisionalSet;

      logger.info(
        "Exercise set added",
        {
          exerciseId: finalSet.exerciseId,
          setNumber: finalSet.setNumber,
          weight: finalSet.weightKg,
          reps: finalSet.reps,
          rpe: finalSet.rpe,
        },
        "workout",
        user.id
      );

      return {
        success: true,
        data: finalSet,
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
        updatedAt: new Date().toISOString(),
      };

      // Persist completed workout to Supabase (best-effort)
      try {
        // Delegate persistence to DatabaseService which handles transforms and retries.
        await databaseService.updateWorkoutSession(completedWorkout.id, {
          completedAt: completedWorkout.completedAt,
          durationMinutes: completedWorkout.durationMinutes,
          notes: completedWorkout.notes,
          totalVolumeKg: completedWorkout.totalVolumeKg,
          averageRpe: completedWorkout.averageRpe,
        });
      } catch (err) {
        logger.warn("Failed to persist completed workout via DatabaseService", err, "workout", user.id);
      }

      // Clear current session
      this.currentSession = null;

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

      // Online-first: no client-side offline queue to clean up.
      // Keep behavior minimal and clear local session.
      this.currentSession = null;

      logger.info("Workout cancelled", { workoutId }, "workout", user?.id);

      return {
        success: true,
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

      try {
        const { data: sessions, error } = await this.supabase
          .from("workout_sessions")
          .select(
            "id, started_at, updated_at, completed_at, name, (select count(*) from exercise_sets where session_id = workout_sessions.id) as set_count"
          )
          .eq("user_id", user.id)
          .is("completed_at", null)
          .order("updated_at", { ascending: false })
          .limit(5);

        if (error || !sessions || (Array.isArray(sessions) && sessions.length === 0)) {
          return null;
        }

        const latest = (sessions as any[])[0];
        return {
          workoutId: latest.id,
          lastSavedAt: (latest.updated_at ?? latest.started_at) as string,
          currentExercise: 0,
          currentSet: Number(latest.set_count ?? 0),
          completedSets: [], // detailed sets can be fetched via recoverWorkoutSession
          canRecover: true,
        };
      } catch (err) {
        logger.error("Failed to query server for recoverable sessions", err, "workout");
        return null;
      }
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

      // Fetch workout and its sets from server and normalize to frontend types
      let recoveredWorkout: WorkoutSession | null = null;
      try {
        const { data: workoutRow, error } = await this.supabase
          .from("workout_sessions")
          .select("*, exercise_sets(*)")
          .eq("id", workoutId)
          .eq("user_id", user.id)
          .single();

        if (error || !workoutRow) {
          return {
            success: false,
            error: "Workout session not found",
          };
        }

        // Use central transform to map DB row (with nested exercise_sets) to app WorkoutSession shape
        const transformed = transformWorkoutSessionWithSets(workoutRow as any) as WorkoutSession;

        // Set as current session
        this.currentSession = transformed;

        logger.info("Workout session recovered", { workoutId }, "workout", user.id);
      } catch (err) {
        logger.error("Failed to recover workout session from server", err, "workout");
        return {
          success: false,
          error: "Failed to recover workout session",
        };
      }

      if (!recoveredWorkout) {
        return {
          success: false,
          error: "Workout session not available",
        };
      }

      return {
        success: true,
        data: recoveredWorkout,
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

  /**
   * Fetch recent exercise history (grouped by workout session) for the current user.
   * Returns an array of objects: { date: string, sets: [{ weight?, reps, rpe?, isWarmup }] }
   * This method never throws — it logs errors and returns an empty array on failure.
   *
   * New behavior: accepts an optional plannedExerciseId to scope history to a specific planned exercise instance.
   */
  async getExerciseHistory(
    exerciseId: string,
    plannedExerciseId: string,
    limit: number = 6
  ): Promise<
    {
      date: string;
      sets: { weight?: number; reps: number; rpe?: number; isWarmup: boolean }[];
    }[]
  > {
    try {
      if (!plannedExerciseId || typeof plannedExerciseId !== "string") {
        throw new Error("WorkoutService.getExerciseHistory: plannedExerciseId is required");
      }
      const user = await authService.getCurrentUser();
      if (!user) return [];

      // Delegate to DatabaseService which implements the plannedExerciseId-aware query.
      // databaseService.queryExerciseHistory returns summaries with session/date and sets.
      const summaries: any[] = await databaseService.queryExerciseHistory(
        user.id,
        exerciseId,
        plannedExerciseId,
        limit
      );

      if (!summaries || summaries.length === 0) return [];

      // Normalize to the front-end shape expected by callers
      const mapped = summaries.map((s) => {
        const sets = (s.sets || []).map((st: any) => ({
          weight: st.weight ?? 0,
          reps: st.reps ?? 0,
          rpe: st.rpe ?? undefined,
          isWarmup: !!st.isWarmup,
          notes: st.notes ?? undefined,
        }));
        return {
          date: s.date,
          sets,
        };
      });

      return mapped;
    } catch (err) {
      logger.error("getExerciseHistory failed", err, "workout");
      return [];
    }
  }

  // ============================================================================
  // GETTERS AND STATE
  // ============================================================================

  getCurrentSession(): WorkoutSession | null {
    return this.currentSession;
  }

  hasActiveWorkout(): boolean {
    return this.currentSession !== null;
  }

  getConfig(): WorkoutServiceConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<WorkoutServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    // No timers to start/stop in online-first flow.
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  async cleanup(): Promise<void> {
    try {
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
