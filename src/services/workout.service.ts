// ============================================================================
// WORKOUT SERVICE
// ============================================================================
// Comprehensive workout session management with offline support, data validation,
// and automatic recovery mechanisms

import { logger } from "../utils/logger";
import { authService } from "./auth.service";
import supabase from "@/lib/supabase";
import { events } from "@/utils/events";
import { ENV_CONFIG, WORKOUT_CONSTANTS, ERROR_MESSAGES, SUCCESS_MESSAGES } from "../config/constants";
import { getTokens } from "@/utils/tokenManager";
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
  private supabase = supabase;
  private config: WorkoutServiceConfig;
  private currentSession: WorkoutSession | null = null;
  private autoSaveTimer?: ReturnType<typeof setInterval>;
  private syncTimer?: ReturnType<typeof setInterval>;

  // Event-driven sync fields
  private isSyncing: boolean = false;
  private debounceTimeout?: ReturnType<typeof setTimeout>;
  private unsubscribers: Array<() => void> = [];

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

    // Initialize event-driven subscriptions (replaces periodic polling by default)
    this.setupSubscriptions();
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
      let workout: WorkoutSession = {
        id: `workout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user.id,
        planId: options.planId,
        sessionId: options.sessionId,
        name,
        startedAt: new Date().toISOString(),
        // legacy fields retained in object for compatibility; server-side persistence handled below
        syncStatus: "pending",
        offlineCreated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sets: [],
      };

      // Persist workout to Supabase (best-effort). If persistence fails we continue with an in-memory session.
      try {
        const { data: inserted, error: insertError } = await this.supabase
          .from("workout_sessions")
          .insert({
            id: workout.id,
            user_id: workout.userId,
            plan_id: workout.planId,
            session_id: workout.sessionId,
            name: workout.name,
            started_at: workout.startedAt,
            sync_status: "synced",
            offline_created: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          logger.warn(
            "Failed to persist workout to Supabase, continuing with local session",
            insertError,
            "workout",
            user.id
          );
        } else if (inserted) {
          // Merge any server-assigned fields back into the local workout object
          workout = { ...workout, ...inserted } as WorkoutSession;
        }
      } catch (err) {
        logger.warn("Unexpected error while persisting workout to Supabase", err, "workout", user.id);
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

      // Persist the set to Supabase (best-effort). If persistence fails we keep the set in memory.
      try {
        const setPayload = {
          id: newSet.id,
          session_id: newSet.sessionId,
          exercise_id: newSet.exerciseId,
          set_number: newSet.setNumber,
          weight_kg: newSet.weightKg,
          reps: newSet.reps,
          rpe: newSet.rpe,
          is_warmup: newSet.isWarmup,
          is_failure: newSet.isFailure,
          rest_seconds: newSet.restSeconds,
          notes: newSet.notes,
          created_at: new Date().toISOString(),
        };

        const { error: setInsertError } = await this.supabase.from("exercise_sets").insert(setPayload);

        if (setInsertError) {
          logger.warn("Failed to persist exercise set to Supabase", setInsertError, "workout", user.id);
        } else {
          // Optionally update workout session's updated_at on server
          await this.supabase
            .from("workout_sessions")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", newSet.sessionId)
            .eq("user_id", user.id);
        }
      } catch (err) {
        logger.warn("Unexpected error while persisting exercise set to Supabase", err, "workout", user.id);
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

      // Offline storage removed in migration to online-first; no client-side cleanup required here.
      // If desired, we could delete server-side session here, but we keep client behavior minimal.
      try {
        // No-op placeholder to preserve behavior in case future logic is needed
      } catch (err) {
        logger.warn("cancelWorkout: cleanup noop failed", err, "workout");
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

      // Query server for incomplete workouts (most recent)
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
          lastSavedAt: latest.updated_at || latest.started_at,
          currentExercise: 0,
          currentSet: latest.set_count || 0,
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

        // Normalize exercise_sets from snake_case -> camelCase ExerciseSet[]
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
          completedAt: workoutRow.completed_at ?? null,
          durationMinutes: workoutRow.duration_minutes ?? null,
          notes: workoutRow.notes ?? null,
          totalVolumeKg: workoutRow.total_volume_kg ?? null,
          averageRpe: workoutRow.average_rpe ?? null,
          syncStatus: workoutRow.sync_status,
          offlineCreated: workoutRow.offline_created || false,
          createdAt: workoutRow.created_at,
          updatedAt: workoutRow.updated_at,
          sets,
        } as WorkoutSession;

        // Set as current session
        this.currentSession = recoveredWorkout;

        // Start auto-save if enabled
        if (this.config.autoSave) {
          this.startAutoSave();
        }

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
  // EVENT SUBSCRIPTIONS & DEBOUNCED SYNC
  // ============================================================================

  /**
   * Setup event subscriptions for auth/network/offline changes
   */
  private setupSubscriptions(): void {
    try {
      // Auth events
      this.unsubscribers.push(
        events.on("auth:signed_in", () => {
          this.scheduleDebouncedSync();
        })
      );
      this.unsubscribers.push(
        events.on("auth:token_refreshed", () => {
          this.scheduleDebouncedSync();
        })
      );

      // Network events
      this.unsubscribers.push(
        events.on("network:online", () => {
          this.scheduleDebouncedSync();
        })
      );

      // Offline pending changes (only trigger if there are pending items)
      this.unsubscribers.push(
        events.on("offline:pending_changed", (payload) => {
          try {
            if (payload && (payload as any).pendingCount > 0) {
              this.scheduleDebouncedSync();
            }
          } catch (err) {
            // ignore malformed payloads
          }
        })
      );

      // App lifecycle (optional)
      this.unsubscribers.push(
        events.on("app:foreground", () => {
          this.scheduleDebouncedSync();
        })
      );
    } catch (err) {
      logger.warn("workoutService: failed to setup subscriptions", err, "workout");
    }
  }

  /**
   * Schedule a debounced sync. If bypass is true, run immediately.
   */
  private scheduleDebouncedSync(bypass: boolean = false): void {
    if (bypass) {
      void this.runSyncRunner();
      return;
    }

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = setTimeout(() => {
      void this.runSyncRunner();
    }, 2000); // 2s debounce window
  }

  /**
   * Run the sync runner with concurrency guard and token check.
   */
  private async runSyncRunner(): Promise<void> {
    if (this.isSyncing) {
      logger.debug("Sync already in progress, skipping", undefined, "workout");
      return;
    }

    // Quick guard: ensure we have tokens before attempting sync
    try {
      const tokens = await getTokens();
      if (!tokens || !tokens.accessToken) {
        logger.debug("Skipping sync: no tokens available", undefined, "workout");
        return;
      }
    } catch (err) {
      logger.debug("Skipping sync: failed to read tokens", err, "workout");
      return;
    }

    this.isSyncing = true;
    try {
      await this.syncPendingWorkouts();
    } catch (err) {
      logger.error("runSyncRunner encountered an error", err, "workout");
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Public method to trigger immediate sync (bypasses debounce).
   */
  public triggerSyncNow(): void {
    void this.runSyncRunner();
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
      if (this.currentSession) {
        try {
          const user = await authService.getCurrentUser();
          if (user) {
            await this.supabase
              .from("workout_sessions")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", this.currentSession.id)
              .eq("user_id", user.id);
            logger.debug("Auto-saved workout session (updated_at)", { workoutId: this.currentSession.id }, "workout");
          }
        } catch (error) {
          logger.error("Auto-save failed (persist)", error, "workout");
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

    // Periodically attempt to sync pending workouts, but only when tokens/session exist.
    this.syncTimer = setInterval(async () => {
      try {
        // Quick guard: avoid calling authService.getCurrentUser repeatedly when unauthenticated.
        const tokens = await getTokens();
        if (!tokens || !tokens.accessToken) {
          // No tokens -> skip sync silently.
          return;
        }

        await this.syncPendingWorkouts();
      } catch (err) {
        logger.error("Auto-sync encountered an error", err, "workout");
      }
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
    // Offline queue no longer used. Return noop result for compatibility.
    return {
      success: true,
      data: { syncedCount: 0, errorCount: 0 },
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

      // Unsubscribe event handlers
      try {
        for (const unsub of this.unsubscribers) {
          try {
            unsub();
          } catch (err) {
            // swallow individual unsubscribe errors
          }
        }
      } catch (err) {
        // ignore
      } finally {
        this.unsubscribers = [];
      }

      // Clear debounce timer if present
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = undefined;
      }

      this.isSyncing = false;

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
