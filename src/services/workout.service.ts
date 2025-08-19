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
  private supabase = supabase;
  private config: WorkoutServiceConfig;
  private currentSession: WorkoutSession | null = null;

  private constructor(config?: Partial<WorkoutServiceConfig>) {
    // Minimal configuration for online-first flow.
    this.config = {
      enableOfflineMode: false,
      maxRetries: 3,
      retryDelay: 1000,
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
        const insertPayload: any = {
          user_id: user.id,
          plan_id: options.planId,
          session_id: options.sessionId,
          name,
          started_at: new Date().toISOString(),
          sync_status: "synced",
          offline_created: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Single attempt: let the database generate the ID. If it fails, fall back to a provisional local session.
        const { data: inserted, error: insertError } = await this.supabase
          .from("workout_sessions")
          .insert(insertPayload)
          .select()
          .single();

        if (insertError || !inserted) {
          logger.warn(
            "Failed to persist workout to Supabase, continuing with local session",
            insertError,
            "workout",
            user.id
          );

          // Fall back to local provisional session (use temp prefix to avoid collision with DB UUIDs)
          workout = {
            id: `temp_workout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
        } else {
          // Normalize server response into WorkoutSession shape
          workout = {
            id: inserted.id,
            userId: inserted.user_id,
            planId: inserted.plan_id,
            sessionId: inserted.session_id,
            name: inserted.name,
            startedAt: inserted.started_at,
            syncStatus: inserted.sync_status,
            offlineCreated: inserted.offline_created || false,
            createdAt: inserted.created_at,
            updatedAt: inserted.updated_at,
            sets: [],
          } as WorkoutSession;
        }
      } catch (err) {
        logger.warn("Unexpected error while persisting workout to Supabase", err, "workout", user.id);
        workout = {
          id: `temp_workout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      }

      // Set as current session
      this.currentSession = workout;

      logger.info("Workout started successfully", { workoutId: workout.id }, "workout", user.id);

      return {
        success: true,
        data: workout,
        offline: this.config.enableOfflineMode,
        syncPending: false,
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

      // Validate exercise exists in DB to avoid FK violations.
      // This prevents attempts to insert exercise_sets referencing missing exercises.
      try {
        const { data: existingExercise, error: exError } = await this.supabase
          .from("exercises")
          .select("id")
          .eq("id", setData.exerciseId)
          .maybeSingle();

        if (exError) {
          logger.warn("Failed to validate exercise existence", exError, "workout", user.id);
        }

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
        logger.warn("Unexpected error while validating exercise existence", err, "workout", user.id);
        // Proceed cautiously — if validation fails due to transient error, abort to be safe.
        return {
          success: false,
          error: "Failed to validate exercise existence",
        };
      }

      // Get current set number for this exercise
      const existingSets = this.currentSession.sets?.filter((set) => set.exerciseId === setData.exerciseId) || [];

      // Prepare payload for server-side insertion and let Supabase generate the set ID.
      const sessionId = this.currentSession.id;
      const setNumber = existingSets.length + 1;
      const setPayload: any = {
        session_id: sessionId,
        exercise_id: setData.exerciseId,
        set_number: setNumber,
        weight_kg: setData.weightKg ?? null,
        reps: setData.reps,
        rpe: setData.rpe ?? null,
        is_warmup: !!setData.isWarmup,
        is_failure: false,
        rest_seconds: setData.restSeconds ?? null,
        notes: setData.notes ?? null,
        created_at: new Date().toISOString(),
      };

      // Optimistically add a provisional set locally while we persist.
      const provisionalSet: ExerciseSet = {
        id: `temp_set_${Date.now()}`,
        sessionId,
        exerciseId: setData.exerciseId,
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

      // Persist the set to Supabase (best-effort). Replace provisional set with server row when available.
      try {
        const { data: insertedSet, error: setInsertError } = await this.supabase
          .from("exercise_sets")
          .insert(setPayload)
          .select()
          .single();

        if (setInsertError || !insertedSet) {
          logger.warn("Failed to persist exercise set to Supabase", setInsertError, "workout", user.id);
          // keep provisional set as-is
        } else {
          // Map inserted row to ExerciseSet and replace provisional entry
          const mapped: ExerciseSet = {
            id: insertedSet.id,
            sessionId: insertedSet.session_id,
            exerciseId: insertedSet.exercise_id,
            setNumber: insertedSet.set_number,
            weightKg: insertedSet.weight_kg ?? undefined,
            reps: Number(insertedSet.reps),
            rpe: insertedSet.rpe ?? undefined,
            isWarmup: !!insertedSet.is_warmup,
            isFailure: !!insertedSet.is_failure,
            restSeconds: insertedSet.rest_seconds ?? undefined,
            notes: insertedSet.notes ?? undefined,
            createdAt: insertedSet.created_at,
          };

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
        logger.warn("Unexpected error while persisting exercise set to Supabase", err, "workout", user.id);
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
        offline: this.config.enableOfflineMode,
        syncPending: false,
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
        syncStatus: "synced",
        updatedAt: new Date().toISOString(),
      };

      // Persist completed workout to Supabase (best-effort)
      try {
        const { error: upsertError } = await this.supabase.from("workout_sessions").upsert(
          {
            id: completedWorkout.id,
            user_id: completedWorkout.userId,
            plan_id: completedWorkout.planId,
            session_id: completedWorkout.sessionId,
            name: completedWorkout.name,
            started_at: completedWorkout.startedAt,
            completed_at: completedWorkout.completedAt,
            duration_minutes: completedWorkout.durationMinutes,
            notes: completedWorkout.notes,
            total_volume_kg: completedWorkout.totalVolumeKg,
            average_rpe: completedWorkout.averageRpe,
            sync_status: "synced",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

        if (upsertError) {
          logger.warn("Failed to persist completed workout to Supabase", upsertError, "workout", user.id);
        }
      } catch (err) {
        logger.warn("Unexpected error while persisting completed workout to Supabase", err, "workout", user.id);
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
        offline: this.config.enableOfflineMode,
        syncPending: false,
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

        const sets = Array.isArray(workoutRow.exercise_sets)
          ? workoutRow.exercise_sets.map((s: any) => ({
              id: s.id,
              sessionId: s.session_id,
              exerciseId: s.exercise_id,
              plannedExerciseId: s.planned_exercise_id ?? null,
              setNumber: s.set_number,
              weightKg: s.weight_kg ?? null,
              reps: s.reps ?? null,
              rpe: s.rpe ?? null,
              isWarmup: !!s.is_warmup,
              isFailure: !!s.is_failure,
              restSeconds: s.rest_seconds ?? null,
              notes: s.notes ?? null,
              createdAt: s.created_at,
            }))
          : [];

        recoveredWorkout = {
          id: workoutRow.id,
          userId: workoutRow.user_id,
          planId: workoutRow.plan_id,
          sessionId: workoutRow.session_id,
          name: workoutRow.name,
          startedAt: workoutRow.started_at,
          completedAt: workoutRow.completed_at ?? undefined,
          durationMinutes: workoutRow.duration_minutes ?? undefined,
          notes: workoutRow.notes ?? undefined,
          totalVolumeKg: workoutRow.total_volume_kg ?? undefined,
          averageRpe: workoutRow.average_rpe ?? undefined,
          syncStatus: workoutRow.sync_status,
          offlineCreated: workoutRow.offline_created || false,
          createdAt: workoutRow.created_at,
          updatedAt: workoutRow.updated_at,
          sets,
        } as WorkoutSession;

        // Set as current session
        this.currentSession = recoveredWorkout;

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
        offline: this.config.enableOfflineMode,
        syncPending: false,
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
   */
  async getExerciseHistory(
    exerciseId: string,
    limit: number = 6
  ): Promise<
    {
      date: string;
      sets: { weight?: number; reps: number; rpe?: number; isWarmup: boolean }[];
    }[]
  > {
    try {
      const user = await authService.getCurrentUser();
      if (!user) return [];

      // Query exercise_sets with related workout_sessions data.
      // We'll fetch a larger set of rows and reduce/group into distinct sessions,
      // since Supabase relational filtering can be constrained depending on schema/constraints.
      const { data, error } = await this.supabase
        .from("exercise_sets")
        .select(
          "id, weight_kg, reps, rpe, is_warmup, created_at, session_id, workout_sessions(id, started_at, user_id)"
        )
        .eq("exercise_id", exerciseId)
        .order("created_at", { ascending: false })
        .limit(Math.max(50, limit * 10)); // fetch a reasonable window to group sessions

      if (error) {
        logger.error("getExerciseHistory supabase error", error, "workout");
        return [];
      }

      const rows = (data || []) as any[];

      // Group rows by workout session id (preferred) or started_at
      const sessionsMap = new Map<string, { date: string; sets: any[] }>();

      for (const row of rows) {
        const ws = row.workout_sessions || null;
        // Ensure the session belongs to current user (if relation provided)
        if (ws && ws.user_id && ws.user_id !== user.id) {
          // skip rows that are not the user's sessions (defensive)
          continue;
        }

        const sessionKey = (ws && ws.id) || String(row.session_id) || String(row.created_at);
        const sessionDate = (ws && ws.started_at) || row.created_at;

        if (!sessionsMap.has(sessionKey)) {
          sessionsMap.set(sessionKey, { date: sessionDate, sets: [] });
        }

        const sess = sessionsMap.get(sessionKey)!;
        sess.sets.push({
          weight: row.weight_kg,
          reps: row.reps,
          rpe: row.rpe,
          isWarmup: !!row.is_warmup,
        });
      }

      // Convert to array sorted by date desc and limit results
      const sessions = Array.from(sessionsMap.values())
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limit)
        .map((s) => ({
          date: typeof s.date === "string" ? s.date : new Date(s.date).toISOString(),
          sets: s.sets,
        }));

      return sessions;
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
