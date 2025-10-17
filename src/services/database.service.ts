// ============================================================================
// DATABASE SERVICE WITH CONNECTION POOLING AND ERROR HANDLING
// ============================================================================
// Provides optimized database operations (online-first)

import { supabase } from "@/lib/supabase";
import { ERROR_MESSAGES } from "@/config/constants";
import type {
  WorkoutSession,
  ExerciseSet,
  UserProfile,
  Exercise,
  WorkoutPlan,
  ProgressMetrics,
  TutorialVideo,
} from "@/types";
import type {
  UserProfile as DbUserProfile,
  WorkoutSession as DbWorkoutSession,
  ExerciseSet as DbExerciseSet,
  Exercise as DbExercise,
  WorkoutPlan as DbWorkoutPlan,
} from "@/types/database";
import {
  transformUserProfile,
  transformUserProfileToDb,
  transformWorkoutSession,
  transformWorkoutSessionToDb,
  transformExerciseSet,
  transformExerciseSetToDb,
  transformExercise,
  transformExerciseTutorialVideo,
  transformWorkoutPlan,
  transformWorkoutSessionWithSets,
  transformWorkoutPlanWithSessions,
} from "@/types/transforms";

export interface DatabaseError {
  message: string;
  code?: string;
  details?: string;
  isNetworkError: boolean;
}

export interface SyncResult {
  success: boolean;
  synced: string[];
  conflicts: string[];
  errors: { id: string; error: string }[];
}

export interface QueryOptions {
  useCache?: boolean;
  cacheTimeout?: number; // milliseconds
  retryAttempts?: number;
  timeout?: number;
}

// ============================================================================
// DATABASE SERVICE CLASS
// ============================================================================

export class DatabaseService {
  private static instance: DatabaseService;
  private connectionPool: Map<string, any> = new Map();
  private queryCache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private isOnline: boolean = true;

  private constructor() {
    this.initializeService();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // ============================================================================
  // INITIALIZATION AND CONNECTION MANAGEMENT
  // ============================================================================

  private async initializeService(): Promise<void> {
    // Initialization: no local offline queue maintained here anymore.
    // Offline persistence and processing is handled by OfflineService.
    try {
      // Subscribe to centralized connection monitoring if needed (lib/supabase handles polling)
      // Additional initialization steps can be added here in the future.
    } catch (error) {
      console.warn("DatabaseService: initialization warning", error);
    }
  }

  private monitorConnectionStatus(): void {
    // Test connection every 30 seconds
    setInterval(async () => {
      try {
        const { error } = await supabase.from("user_profiles").select("id").limit(1);
        const wasOffline = !this.isOnline;
        this.isOnline = !error;

        // If we just came back online, notify OfflineService (do not manage queue here)
        if (wasOffline && this.isOnline) {
          // OfflineService processing removed from DatabaseService.
          // Centralized sync / server-side functions handle pending items now.
          console.log("DatabaseService: regained connectivity; offline queue processing is handled externally.");
        }
      } catch (error) {
        this.isOnline = false;
      }
    }, 30000);
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  private getCacheKey(table: string, query: any): string {
    return `${table}:${JSON.stringify(query)}`;
  }

  private getCachedData(key: string): any | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.queryCache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCachedData(key: string, data: any, ttl: number = 300000): void {
    // Default 5 minute cache
    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  private clearCache(pattern?: string): void {
    if (!pattern) {
      this.queryCache.clear();
      return;
    }

    for (const key of this.queryCache.keys()) {
      if (key.includes(pattern)) {
        this.queryCache.delete(key);
      }
    }
  }

  // ============================================================================
  // OFFLINE QUEUE MANAGEMENT
  // ============================================================================
  // Note: client-side offline queue persistence/processing has been removed.
  // Any server-side or centralized sync processing should be handled externally.

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  private handleDatabaseError(error: any): DatabaseError {
    const isNetworkError = this.isNetworkRelatedError(error);

    return {
      message: error.message || ERROR_MESSAGES.network.serverError,
      code: error.code,
      details: error.details,
      isNetworkError,
    };
  }

  private isNetworkRelatedError(error: any): boolean {
    const networkErrorCodes = ["NETWORK_ERROR", "TIMEOUT", "CONNECTION_ERROR", "FETCH_ERROR"];
    const networkErrorMessages = ["network", "timeout", "connection", "fetch"];

    return (
      networkErrorCodes.includes(error?.code) ||
      networkErrorMessages.some((msg) => error?.message?.toLowerCase().includes(msg))
    );
  }

  // ============================================================================
  // USER PROFILE OPERATIONS
  // ============================================================================

  async getUserProfile(userId: string, options: QueryOptions = {}): Promise<UserProfile | null> {
    const cacheKey = this.getCacheKey("user_profiles", { userId });

    // Check cache first
    if (options.useCache !== false) {
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;
    }

    try {
      const { data, error } = await supabase.from("user_profiles").select("*").eq("id", userId).single();

      if (error) throw error;

      if (!data) return null;

      // Transform database result to application type
      const transformedData = transformUserProfile(data as DbUserProfile);

      // Cache the transformed result
      if (options.useCache !== false) {
        this.setCachedData(cacheKey, transformedData, options.cacheTimeout);
      }

      return transformedData;
    } catch (error) {
      const dbError = this.handleDatabaseError(error);

      if (dbError.isNetworkError) {
        // Try to return cached data even if expired
        const cached = this.queryCache.get(cacheKey);
        if (cached) return cached.data;
      }

      throw dbError;
    }
  }

  async updateUserProfile(
    userId: string,
    updates: Partial<UserProfile>,
    options: QueryOptions = {}
  ): Promise<UserProfile> {
    try {
      // Transform application updates to database format
      const dbUpdates = transformUserProfileToDb(updates);

      const { data, error } = await supabase
        .from("user_profiles")
        .update({
          ...dbUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select()
        .single();

      if (error) throw error;

      // Clear related cache
      this.clearCache("user_profiles");

      // Transform database result back to application type
      return transformUserProfile(data as DbUserProfile);
    } catch (error) {
      const dbError = this.handleDatabaseError(error);

      if (dbError.isNetworkError) {
        // Offline queue persistence has been removed from DatabaseService.
        console.warn("DatabaseService: offline queue persistence removed; update_user_profile was not enqueued");
      }

      throw dbError;
    }
  }

  // ============================================================================
  // WORKOUT SESSION OPERATIONS
  // ============================================================================

  async getWorkoutSessions(
    userId: string,
    limit: number = 50,
    offset: number = 0,
    options: QueryOptions = {}
  ): Promise<WorkoutSession[]> {
    const cacheKey = this.getCacheKey("workout_sessions", { userId, limit, offset });

    // Check cache first
    if (options.useCache !== false) {
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;
    }

    try {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select(
          `
          *,
          exercise_sets (*)
        `
        )
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      if (!data) return [];

      // Transform database results to application types
      const transformedData = data.map((session: any) =>
        transformWorkoutSessionWithSets(session as DbWorkoutSession & { exercise_sets?: DbExerciseSet[] })
      );

      // Cache the transformed result
      if (options.useCache !== false) {
        this.setCachedData(cacheKey, transformedData, options.cacheTimeout);
      }

      return transformedData;
    } catch (error) {
      const dbError = this.handleDatabaseError(error);

      if (dbError.isNetworkError) {
        // Try to return cached data
        const cached = this.queryCache.get(cacheKey);
        if (cached) return cached.data;

        // Return empty array if no cache
        return [];
      }

      throw dbError;
    }
  }

  async insertWorkoutSession(
    session: Omit<WorkoutSession, "id" | "createdAt" | "updatedAt">,
    options: QueryOptions = {}
  ): Promise<WorkoutSession> {
    try {
      // Transform application data to database format
      const dbSession = transformWorkoutSessionToDb(session);

      // Ensure required fields are present
      const insertData = {
        user_id: dbSession.user_id || session.userId,
        name: dbSession.name || session.name,
        started_at: dbSession.started_at || session.startedAt,
        ...dbSession,
        sync_status: "synced" as const,
      };

      const { data, error } = await supabase.from("workout_sessions").insert(insertData).select().single();

      if (error) throw error;

      // Clear related cache
      this.clearCache("workout_sessions");

      // Transform database result back to application type
      return transformWorkoutSession(data as DbWorkoutSession);
    } catch (error) {
      const dbError = this.handleDatabaseError(error);

      if (dbError.isNetworkError) {
        console.warn("DatabaseService: offline queue persistence removed; insert_workout_session was not enqueued");

        // Return a temporary session with pending status
        return {
          ...session,
          id: `temp_${Date.now()}`,
          syncStatus: "pending",
          offlineCreated: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as WorkoutSession;
      }

      throw dbError;
    }
  }

  async updateWorkoutSession(
    sessionId: string,
    updates: Partial<WorkoutSession>,
    options: QueryOptions = {}
  ): Promise<WorkoutSession> {
    try {
      // Transform application updates to database format
      const dbUpdates = transformWorkoutSessionToDb(updates);

      const { data, error } = await supabase
        .from("workout_sessions")
        .update({
          ...dbUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
        .select()
        .single();

      if (error) throw error;

      // Clear related cache
      this.clearCache("workout_sessions");

      // Transform database result back to application type
      return transformWorkoutSession(data as DbWorkoutSession);
    } catch (error) {
      const dbError = this.handleDatabaseError(error);

      if (dbError.isNetworkError) {
        console.warn("DatabaseService: offline queue persistence removed; update_workout_session was not enqueued");
      }

      throw dbError;
    }
  }

  // ============================================================================
  // EXERCISE SET OPERATIONS
  // ============================================================================

  async insertExerciseSets(
    sets: Omit<ExerciseSet, "id" | "createdAt">[],
    options: QueryOptions = {}
  ): Promise<ExerciseSet[]> {
    try {
      // Transform application data to database format and ensure required fields
      const dbSets = sets.map((set) => {
        const dbSet = transformExerciseSetToDb(set);
        return {
          session_id: dbSet.session_id || set.sessionId,
          exercise_id: dbSet.exercise_id || set.exerciseId,
          set_number: dbSet.set_number || set.setNumber,
          ...dbSet,
        };
      });

      const { data, error } = await supabase.from("exercise_sets").insert(dbSets).select();

      if (error) throw error;

      // Clear related cache
      this.clearCache("exercise_sets");

      // Transform database results back to application types
      return (data || []).map((set: any) => transformExerciseSet(set as DbExerciseSet));
    } catch (error) {
      const dbError = this.handleDatabaseError(error);

      if (dbError.isNetworkError) {
        console.warn("DatabaseService: offline queue persistence removed; insert_exercise_sets was not enqueued");

        // Return temporary sets with pending status
        return sets.map((set, index) => ({
          ...set,
          id: `temp_set_${Date.now()}_${index}`,
          createdAt: new Date().toISOString(),
        })) as ExerciseSet[];
      }

      throw dbError;
    }
  }

  async getExerciseSets(sessionId: string, options: QueryOptions = {}): Promise<ExerciseSet[]> {
    const cacheKey = this.getCacheKey("exercise_sets", { sessionId });

    // Check cache first
    if (options.useCache !== false) {
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;
    }

    try {
      const { data, error } = await supabase
        .from("exercise_sets")
        .select("*")
        .eq("session_id", sessionId)
        .order("set_number", { ascending: true });

      if (error) throw error;

      if (!data) return [];

      // Transform database results to application types
      const transformedData = data.map((set: any) => transformExerciseSet(set as DbExerciseSet));

      // Cache the transformed result
      if (options.useCache !== false) {
        this.setCachedData(cacheKey, transformedData, options.cacheTimeout);
      }

      return transformedData;
    } catch (error) {
      const dbError = this.handleDatabaseError(error);

      if (dbError.isNetworkError) {
        const cached = this.queryCache.get(cacheKey);
        if (cached) return cached.data;
        return [];
      }

      throw dbError;
    }
  }

  // ============================================================================
  // EXERCISE AND WORKOUT PLAN OPERATIONS
  // ============================================================================

  async getExercises(options: QueryOptions = {}): Promise<Exercise[]> {
    const cacheKey = this.getCacheKey("exercises", {});

    // Check cache first (exercises don't change often, longer cache)
    if (options.useCache !== false) {
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;
    }

    try {
      const { data, error } = await supabase.from("exercises").select("*").order("name", { ascending: true });

      if (error) throw error;

      if (!data) return [];

      // Transform database results to application types
      const transformedData = data.map((exercise: any) => transformExercise(exercise as DbExercise));

      // Cache for 1 hour (exercises are relatively static)
      if (options.useCache !== false) {
        this.setCachedData(cacheKey, transformedData, 3600000);
      }

      return transformedData;
    } catch (error) {
      const dbError = this.handleDatabaseError(error);

      if (dbError.isNetworkError) {
        const cached = this.queryCache.get(cacheKey);
        if (cached) return cached.data;
        return [];
      }

      throw dbError;
    }
  }

  /**
   * Get a single exercise by id.
   * Returns the transformed Exercise or null if not found.
   */
  async getExerciseById(exerciseId: string): Promise<Exercise | null> {
    try {
      const { data, error } = await supabase.from("exercises").select("*").eq("id", exerciseId).maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return transformExercise(data as DbExercise);
    } catch (error) {
      const dbError = this.handleDatabaseError(error);
      if (dbError.isNetworkError) {
        // If network error, fall back to cached exercises if available
        const cached = this.queryCache.get(this.getCacheKey("exercises", {}));
        if (cached) {
          const list: Exercise[] = cached.data as Exercise[];
          return list.find((e) => e.id === exerciseId) ?? null;
        }
      }
      throw dbError;
    }
  }

  async getTutorialsForExercise(exerciseId: string, options: QueryOptions = {}): Promise<TutorialVideo[]> {
    const cacheKey = this.getCacheKey("exercise_tutorial_videos", { exerciseId });

    // Check cache first
    if (options.useCache !== false) {
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;
    }

    try {
      const { data, error } = await supabase
        .from("exercise_tutorial_videos")
        .select("*")
        .eq("exercise_id", exerciseId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!data) return [];

      const transformed = (data || []).map((r: any) => transformExerciseTutorialVideo(r as any));

      if (options.useCache !== false) {
        this.setCachedData(cacheKey, transformed, options.cacheTimeout ?? 3600000);
      }

      return transformed;
    } catch (error) {
      const dbError = this.handleDatabaseError(error);
      if (dbError.isNetworkError) {
        const cached = this.queryCache.get(cacheKey);
        if (cached) return cached.data;
        return [];
      }
      throw dbError;
    }
  }

  async getTutorialsForExercises(
    exerciseIds: string[],
    options: QueryOptions = {}
  ): Promise<Record<string, TutorialVideo[]>> {
    const cacheKey = this.getCacheKey("exercise_tutorial_videos", { exerciseIds });

    // Check cache first
    if (options.useCache !== false) {
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;
    }

    try {
      if (!exerciseIds || exerciseIds.length === 0) return {};

      const { data, error } = await supabase
        .from("exercise_tutorial_videos")
        .select("*")
        .in("exercise_id", exerciseIds)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const grouped: Record<string, TutorialVideo[]> = {};
      (data || []).forEach((r: any) => {
        const tv = transformExerciseTutorialVideo(r as any);
        if (!grouped[tv.exerciseId]) grouped[tv.exerciseId] = [];
        grouped[tv.exerciseId].push(tv);
      });

      if (options.useCache !== false) {
        this.setCachedData(cacheKey, grouped, options.cacheTimeout ?? 3600000);
      }

      return grouped;
    } catch (error) {
      const dbError = this.handleDatabaseError(error);
      if (dbError.isNetworkError) {
        const cached = this.queryCache.get(cacheKey);
        if (cached) return cached.data;
        return {};
      }
      throw dbError;
    }
  }

  async getWorkoutPlans(experienceLevel?: string, options: QueryOptions = {}): Promise<WorkoutPlan[]> {
    const cacheKey = this.getCacheKey("workout_plans", { experienceLevel });

    // Check cache first
    if (options.useCache !== false) {
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;
    }

    try {
      let query = supabase
        .from("workout_plans")
        .select(
          `
          *,
          workout_plan_sessions (
            *,
            planned_exercises (
              *,
              exercises (*)
            )
          )
        `
        )
        .eq("is_public", true);

      if (experienceLevel) {
        query = query.contains("target_experience", [experienceLevel]);
      }

      const { data, error } = await query.order("name", { ascending: true });

      if (error) throw error;

      if (!data) return [];

      // Transform database results to application types
      const transformedData = data.map((plan: any) =>
        transformWorkoutPlanWithSessions(
          plan as DbWorkoutPlan & {
            workout_plan_sessions?: any[];
          }
        )
      );

      // Cache for 30 minutes
      if (options.useCache !== false) {
        this.setCachedData(cacheKey, transformedData, 1800000);
      }

      return transformedData;
    } catch (error) {
      const dbError = this.handleDatabaseError(error);

      if (dbError.isNetworkError) {
        const cached = this.queryCache.get(cacheKey);
        if (cached) return cached.data;
        return [];
      }

      throw dbError;
    }
  }

  // ============================================================================
  // PROGRESS AND ANALYTICS
  // ============================================================================

  async getProgressMetrics(
    userId: string,
    exerciseId?: string,
    options: QueryOptions = {}
  ): Promise<ProgressMetrics | null> {
    const cacheKey = this.getCacheKey("progress_metrics", { userId, exerciseId });

    // Check cache first
    if (options.useCache !== false) {
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;
    }

    try {
      // Get workout statistics
      let workoutQuery = supabase
        .from("workout_sessions")
        .select(
          `
          id,
          started_at,
          duration_minutes,
          total_volume_kg,
          average_rpe,
          exercise_sets!inner (
            exercise_id,
            weight_kg,
            reps,
            rpe,
            is_warmup
          )
        `
        )
        .eq("user_id", userId)
        .not("completed_at", "is", null);

      if (exerciseId) {
        workoutQuery = workoutQuery.eq("exercise_sets.exercise_id", exerciseId);
      }

      const { data: workoutData, error: workoutError } = await workoutQuery
        .order("started_at", { ascending: false })
        .limit(50);

      if (workoutError) throw workoutError;

      // Calculate metrics from the data
      const metrics = this.calculateProgressMetrics(workoutData || [], exerciseId);

      // Cache for 10 minutes
      if (options.useCache !== false) {
        this.setCachedData(cacheKey, metrics, 600000);
      }

      return metrics;
    } catch (error) {
      const dbError = this.handleDatabaseError(error);

      if (dbError.isNetworkError) {
        const cached = this.queryCache.get(cacheKey);
        if (cached) return cached.data;
      }

      throw dbError;
    }
  }

  private calculateProgressMetrics(workoutData: any[], exerciseId?: string): ProgressMetrics {
    // Implementation of progress metrics calculation
    const totalWorkouts = workoutData.length;
    const totalVolumeKg = workoutData.reduce((sum: number, workout: any) => sum + (workout.total_volume_kg || 0), 0);
    const averageSessionDuration =
      workoutData.reduce((sum: number, workout: any) => sum + (workout.duration_minutes || 0), 0) / totalWorkouts || 0;

    // Calculate strength progression and other metrics
    // This is a simplified version - you can expand based on your needs
    return {
      totalWorkouts,
      totalVolumeKg,
      averageSessionDuration,
      strengthGains: 0, // Calculate based on exercise progression
      consistencyScore: 0, // Calculate based on workout frequency
      lastUpdated: new Date().toISOString(),
    };
  }

  // ============================================================================
  // PROGRESS / ANALYTICS HELPERS (moved from ProgressService)
  // These helpers centralize complex DB queries related to workout history,
  // exercise history, strength progression, volume progression, and personal
  // records so other services can delegate to DatabaseService.
  // ============================================================================

  /**
   * Query workout history with filtering and pagination
   */
  async queryWorkoutHistory(
    userId: string,
    filters: {
      startDate?: string;
      endDate?: string;
      exerciseIds?: string[];
      muscleGroups?: string[];
      planId?: string;
      minDuration?: number;
      maxDuration?: number;
      searchQuery?: string;
    } = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{ workouts: WorkoutSession[]; totalCount: number; hasMore: boolean }> {
    try {
      let query = supabase
        .from("workout_sessions")
        .select(
          `
          *,
          exercise_sets (
            *,
            exercises (
              name,
              primary_muscle,
              muscle_groups
            )
          )
        `
        )
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .order("started_at", { ascending: false });

      // Apply filters
      if (filters.startDate) query = query.gte("started_at", filters.startDate);
      if (filters.endDate) query = query.lte("started_at", filters.endDate);
      if (filters.planId) query = query.eq("plan_id", filters.planId);
      if (filters.minDuration) query = query.gte("duration_minutes", filters.minDuration);
      if (filters.maxDuration) query = query.lte("duration_minutes", filters.maxDuration);
      if (filters.searchQuery) query = query.ilike("name", `%${filters.searchQuery}%`);

      // Count query
      const countQuery = supabase
        .from("workout_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("completed_at", "is", null);

      if (filters.startDate) countQuery.gte("started_at", filters.startDate);
      if (filters.endDate) countQuery.lte("started_at", filters.endDate);
      if (filters.planId) countQuery.eq("plan_id", filters.planId);
      if (filters.minDuration) countQuery.gte("duration_minutes", filters.minDuration);
      if (filters.maxDuration) countQuery.lte("duration_minutes", filters.maxDuration);
      if (filters.searchQuery) countQuery.ilike("name", `%${filters.searchQuery}%`);

      const { count } = await countQuery;

      // Pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data: workouts, error } = await query;
      if (error) throw error;

      let filteredWorkouts = (workouts || []) as any[];

      // Filter by exerciseIds or muscleGroups in-memory (when necessary)
      if (filters.exerciseIds || filters.muscleGroups) {
        filteredWorkouts = filteredWorkouts.filter((workout) => {
          const workoutExercises = workout.exercise_sets || [];

          if (filters.exerciseIds) {
            return workoutExercises.some((set: any) => filters.exerciseIds!.includes(set.exercise_id));
          }

          if (filters.muscleGroups) {
            return workoutExercises.some((set: any) => {
              const exercise = set.exercises;
              return (
                exercise &&
                (filters.muscleGroups!.includes(exercise.primary_muscle) ||
                  exercise.muscle_groups?.some((mg: string) => filters.muscleGroups!.includes(mg)))
              );
            });
          }

          return true;
        });
      }

      // Use centralized transforms to map DB rows to application types (keeps mapping consistent)
      const transformedWorkouts: WorkoutSession[] = filteredWorkouts.map((workout: any) => {
        // Map top-level workout session fields
        const session = transformWorkoutSession(workout as DbWorkoutSession);

        // Map exercise sets using the canonical transform and attach as sets
        const sets = (workout.exercise_sets || []).map((set: any) => {
          const mappedSet = transformExerciseSet(set as DbExerciseSet);

          // If exercise metadata was included in the joined row, keep it on the set as an optional `exercise` field.
          // Avoid mutating types — cast to any for this augmentation.
          if (set.exercises) {
            (mappedSet as any).exercise = {
              id: set.exercises.id,
              name: set.exercises.name,
              primaryMuscle: set.exercises.primary_muscle,
              muscleGroups: set.exercises.muscle_groups,
            };
          }

          return mappedSet;
        });

        return {
          ...session,
          sets,
        };
      });

      const hasMore = offset + limit < (count || 0);
      return { workouts: transformedWorkouts, totalCount: count || 0, hasMore };
    } catch (error) {
      const dbError = this.handleDatabaseError(error);
      throw dbError;
    }
  }

  /**
   * Query exercise history (last N sessions for an exercise) — requires plannedExerciseId
   */
  async queryExerciseHistory(
    userId: string,
    exerciseId: string,
    plannedExerciseId: string,
    sessionLimit: number = 6,
    setLimit: number = 60
  ) {
    try {
      if (!plannedExerciseId || typeof plannedExerciseId !== "string") {
        throw new Error("queryExerciseHistory: plannedExerciseId is required");
      }

      // Query only exercise_sets (no joins). Order by created_at desc so we get newest sets first,
      // and limit the number of rows scanned for efficiency. We'll group by session_id in-memory.
      const { data: sets, error } = await supabase
        .from("exercise_sets")
        .select("*")
        .eq("exercise_id", exerciseId)
        .eq("planned_exercise_id", plannedExerciseId)
        .order("created_at", { ascending: false })
        .limit(setLimit);

      if (error) throw error;
      if (!sets || sets.length === 0) return [];

      // Group sets by session_id
      const sessionMap = new Map<string, any[]>();
      for (const s of sets) {
        if (!s || !s.session_id) continue;
        if (!sessionMap.has(s.session_id)) sessionMap.set(s.session_id, []);
        sessionMap.get(s.session_id)!.push(s);
      }

      // Convert grouped sessions to an array, derive session date from the earliest set.created_at,
      // sort sets within a session by set_number ascending for display, then sort sessions by date desc.
      const sessions = Array.from(sessionMap.entries()).map(([sessionId, sessionSets]) => {
        // Determine session date as the earliest created_at among the sets in that session
        const createdSorted = sessionSets
          .slice()
          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const sessionDate = createdSorted.length > 0 ? createdSorted[0].created_at : createdSorted[0];

        // Sort sets by set_number ascending for display
        const setsByNumber = sessionSets.slice().sort((a: any, b: any) => (a.set_number || 0) - (b.set_number || 0));

        const mappedSets = setsByNumber.map((set: any) => ({
          setNumber: set.set_number,
          weight: set.weight_kg ?? 0,
          reps: set.reps ?? 0,
          rpe: set.rpe ?? undefined,
          notes: set.notes ?? undefined,
          isWarmup: !!set.is_warmup,
        }));

        return {
          sessionId,
          date: sessionDate,
          sets: mappedSets,
        };
      });

      const sortedSessions = sessions
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, sessionLimit);

      // Return minimal structure used by UI: { date, sets[] }
      return sortedSessions.map((s: any) => ({
        date: s.date,
        sets: s.sets.map((st: any) => ({
          weight: st.weight,
          reps: st.reps,
          rpe: st.rpe,
          isWarmup: st.isWarmup,
          notes: st.notes,
        })),
      }));
    } catch (error) {
      const dbError = this.handleDatabaseError(error);
      throw dbError;
    }
  }

  /**
   * Query strength progression for an exercise (scoped to a planned exercise)
   */
  async queryStrengthProgression(
    userId: string,
    exerciseId: string,
    plannedExerciseId: string,
    timeframe: "month" | "quarter" | "year" = "quarter"
  ) {
    try {
      if (!plannedExerciseId || typeof plannedExerciseId !== "string") {
        throw new Error("queryStrengthProgression: plannedExerciseId is required");
      }

      const startDate = this.getStartDateForProgress(timeframe);

      const { data: sets, error } = await supabase
        .from("exercise_sets")
        .select(
          `
          weight_kg,
          reps,
          rpe,
          created_at,
          planned_exercise_id,
          workout_sessions!inner (
            user_id,
            started_at,
            completed_at
          )
        `
        )
        .eq("exercise_id", exerciseId)
        .eq("planned_exercise_id", plannedExerciseId)
        .eq("workout_sessions.user_id", userId)
        .eq("is_warmup", false)
        .not("workout_sessions.completed_at", "is", null)
        .gte("workout_sessions.started_at", startDate)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const progressionData = (sets || [])
        .filter((set: any) => set.weight_kg && set.reps)
        .map((set: any) => ({
          date: set.created_at,
          exerciseId,
          oneRepMax: this.calculateOneRepMaxForProgress(set.weight_kg, set.reps, set.rpe),
          estimatedMax: this.calculateOneRepMaxForProgress(set.weight_kg, set.reps, set.rpe),
          estimatedOneRepMax: this.calculateOneRepMaxForProgress(set.weight_kg, set.reps, set.rpe),
          weight: set.weight_kg,
          reps: set.reps,
          rpe: set.rpe,
        }));

      return progressionData;
    } catch (error) {
      const dbError = this.handleDatabaseError(error);
      throw dbError;
    }
  }

  /**
   * Query volume progression (session-level) optionally filtered by exercise.
   * If exerciseId is provided, plannedExerciseId is required to scope the query.
   */
  async queryVolumeProgression(
    userId: string,
    exerciseId?: string,
    plannedExerciseId?: string,
    timeframe: "month" | "quarter" | "year" = "quarter"
  ) {
    try {
      if (exerciseId && !plannedExerciseId) {
        throw new Error("queryVolumeProgression: plannedExerciseId is required when exerciseId is provided");
      }

      const startDate = this.getStartDateForProgress(timeframe);

      let query = supabase
        .from("workout_sessions")
        .select(
          `
          started_at,
          total_volume_kg,
          average_rpe,
          exercise_sets (
            weight_kg,
            reps,
            is_warmup,
            exercise_id,
            planned_exercise_id
          )
        `
        )
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .gte("started_at", startDate)
        .order("started_at", { ascending: true });

      const { data: sessions, error } = await query;
      if (error) throw error;

      const volumeData = (sessions || [])
        .map((session: any) => {
          let sessionVolume = 0;
          let sessionSets = 0;

          if (exerciseId) {
            const exerciseSets = (session.exercise_sets || []).filter(
              (set: any) =>
                set.exercise_id === exerciseId && set.planned_exercise_id === plannedExerciseId && !set.is_warmup
            );

            sessionVolume = exerciseSets.reduce(
              (sum: number, set: any) => sum + (set.weight_kg || 0) * (set.reps || 0),
              0
            );
            sessionSets = exerciseSets.length;
          } else {
            sessionVolume = session.total_volume_kg || 0;
            sessionSets = (session.exercise_sets || []).filter((set: any) => !set.is_warmup).length;
          }

          return {
            date: session.started_at,
            totalVolume: sessionVolume,
            sessionCount: 1,
            volume: sessionVolume,
            sets: sessionSets,
            averageRpe: session.average_rpe,
          };
        })
        .filter((d: any) => (d.volume || 0) > 0);

      return volumeData;
    } catch (error) {
      const dbError = this.handleDatabaseError(error);
      throw dbError;
    }
  }

  /**
   * Query personal records for a user — requires plannedExerciseId to scope records
   */
  async queryPersonalRecords(userId: string, plannedExerciseId: string, exerciseId?: string, limit: number = 50) {
    try {
      if (!plannedExerciseId || typeof plannedExerciseId !== "string") {
        throw new Error("queryPersonalRecords: plannedExerciseId is required");
      }

      let query = supabase
        .from("exercise_sets")
        .select(
          `
          *,
          exercises (
            name,
            primary_muscle
          ),
          workout_sessions!inner (
            user_id,
            started_at,
            name
          )
        `
        )
        .eq("workout_sessions.user_id", userId)
        .eq("exercise_sets.planned_exercise_id", plannedExerciseId)
        .eq("is_warmup", false)
        .not("workout_sessions.completed_at", "is", null)
        .order("created_at", { ascending: false });

      if (exerciseId) query = query.eq("exercise_id", exerciseId);

      const { data: sets, error } = await query;
      if (error) throw error;

      const exerciseRecords = new Map<string, any[]>();

      for (const set of sets || []) {
        const exId = set.exercise_id;
        const oneRepMax = this.calculateOneRepMaxForProgress(set.weight_kg || 0, set.reps || 0, set.rpe || undefined);
        const volume = (set.weight_kg || 0) * (set.reps || 0);

        if (!exerciseRecords.has(exId)) exerciseRecords.set(exId, []);

        const records = exerciseRecords.get(exId)!;

        const currentMaxRecord = records.find((r) => r.type === "weight");
        if (!currentMaxRecord || oneRepMax > currentMaxRecord.value) {
          const index = records.findIndex((r) => r.type === "weight");
          if (index >= 0) records.splice(index, 1);

          records.push({
            exerciseId: exId,
            type: "weight",
            value: oneRepMax,
            achievedAt: set.created_at,
            sessionId: set.session_id,
          });
        }

        const currentVolumeRecord = records.find((r) => r.type === "volume");
        if (!currentVolumeRecord || volume > currentVolumeRecord.value) {
          const index = records.findIndex((r) => r.type === "volume");
          if (index >= 0) records.splice(index, 1);

          records.push({
            exerciseId: exId,
            type: "volume",
            value: volume,
            achievedAt: set.created_at,
            sessionId: set.session_id,
          });
        }

        const sameWeightRecord = records.find(
          (r) => r.type === "reps" && Math.abs(r.value - (set.weight_kg || 0)) < 0.5
        );
        if (!sameWeightRecord || (set.reps || 0) > sameWeightRecord.value) {
          const index = records.findIndex((r) => r.type === "reps" && Math.abs(r.value - (set.weight_kg || 0)) < 0.5);
          if (index >= 0) records.splice(index, 1);

          records.push({
            exerciseId: exId,
            type: "reps",
            value: set.reps || 0,
            achievedAt: set.created_at,
            sessionId: set.session_id,
          });
        }
      }

      const allRecords = Array.from(exerciseRecords.values())
        .flat()
        .sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime())
        .slice(0, limit);

      return allRecords;
    } catch (error) {
      const dbError = this.handleDatabaseError(error);
      throw dbError;
    }
  }

  /**
   * Export progress data (workouts, exercises, personal records, analytics)
   */
  async exportProgressData(userId: string, startDate: string, endDate: string, format: "json" | "csv" = "json") {
    try {
      const { workouts } = await this.queryWorkoutHistory(
        userId,
        {
          startDate,
          endDate,
        },
        1,
        1000
      );

      const exerciseIds = Array.from(new Set(workouts.flatMap((w) => (w.sets || []).map((s: any) => s.exerciseId))));
      const { data: exercises, error: exercisesError } = await supabase
        .from("exercises")
        .select("*")
        .in("id", exerciseIds);

      if (exercisesError) throw exercisesError;

      // Personal records now require a plannedExerciseId to scope results.
      // Skip querying personal records here to avoid making an unscoped call.
      const personalRecords: any[] = [];
      const analytics = (await this.getProgressMetrics(userId)) ?? {};

      const exportData = {
        workouts,
        exercises: (exercises || []) as any[],
        progressMetrics: [analytics],
        personalRecords,
        exportDate: new Date().toISOString(),
        userId,
        dateRange: { start: startDate, end: endDate },
      };

      if (format === "json") return exportData;

      // csv conversion (simple)
      const csvRows: string[] = [];
      csvRows.push("Date,Exercise,Sets,Reps,Weight,RPE,Volume,Notes");
      for (const workout of exportData.workouts) {
        for (const set of workout.sets || []) {
          const exercise = exportData.exercises.find((e) => e.id === (set as any).exerciseId);
          const row = [
            workout.startedAt,
            exercise?.name || "Unknown",
            (set as any).setNumber,
            (set as any).reps,
            (set as any).weightKg,
            (set as any).rpe || "",
            ((set as any).weightKg || 0) * ((set as any).reps || 0),
            (set as any).notes || "",
          ].join(",");
          csvRows.push(row);
        }
      }

      return csvRows.join("\n");
    } catch (error) {
      const dbError = this.handleDatabaseError(error);
      throw dbError;
    }
  }

  // ============================================================================
  // PROGRESS / ANALYTICS HELPERS (utility helpers)
  // ============================================================================
  public getStartDateForProgress(timeframe: "month" | "quarter" | "year"): string {
    const now = new Date();
    switch (timeframe) {
      case "month":
        return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split("T")[0];
      case "quarter":
        return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().split("T")[0];
      case "year":
        return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split("T")[0];
      default:
        return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().split("T")[0];
    }
  }

  public calculateOneRepMaxForProgress(weight: number, reps: number, rpe?: number): number {
    if (reps === 1) return weight;
    // Prefer RPE-based modified Epley if available
    if (rpe && rpe >= 6 && rpe <= 10) {
      const repsInReserve = 10 - rpe;
      const totalReps = reps + repsInReserve;
      return weight * (1 + totalReps / 30);
    }
    // Fallback to Epley
    return weight * (1 + reps / 30);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  getConnectionStatus(): boolean {
    return this.isOnline;
  }

  async getOfflineQueueSize(): Promise<number> {
    // Offline queue persistence removed from DatabaseService; report zero.
    return 0;
  }

  async clearAllCache(): Promise<void> {
    this.clearCache();
  }

  async getStorageInfo(): Promise<{
    cacheSize: number;
    offlineQueueSize: number;
    isOnline: boolean;
  }> {
    // Offline queue persistence removed from DatabaseService; offlineQueueSize is 0.
    return {
      cacheSize: this.queryCache.size,
      offlineQueueSize: 0,
      isOnline: this.isOnline,
    };
  }

  // ==========================================================================
  // WORKOUT PROGRESS HELPERS
  // ==========================================================================

  /**
   * Get the user's progress record for a specific plan.
   * Returns the raw DB row transformed minimally or null if none exists.
   */
  async getUserWorkoutProgress(userId: string, planId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from("user_workout_progress")
        .select("*")
        .eq("user_id", userId)
        .eq("plan_id", planId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return data;
    } catch (error) {
      const dbError = this.handleDatabaseError(error);
      if (dbError.isNetworkError) {
        // Try cached lookup
        const cached = this.queryCache.get(this.getCacheKey("user_workout_progress", { userId, planId }));
        if (cached) return cached.data;
      }
      throw dbError;
    }
  }

  /**
   * Insert or update a user's workout progress record (upsert by user_id + plan_id).
   * Returns the new/updated progress row.
   */
  async updateUserWorkoutProgress(userId: string, planId: string, updates: Partial<any>): Promise<any> {
    try {
      const payload = {
        user_id: userId,
        plan_id: planId,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // Upsert on conflict (user_id, plan_id)
      const { data, error } = await supabase
        .from("user_workout_progress")
        .upsert(payload, { onConflict: "user_id,plan_id" })
        .select()
        .single();

      if (error) throw error;

      // Clear related cache
      this.clearCache("user_workout_progress");

      return data;
    } catch (error) {
      const dbError = this.handleDatabaseError(error);
      throw dbError;
    }
  }

  /**
   * Get the most recent incomplete workout_session for the user within a plan.
   * Returns the workout_sessions row or null.
   */
  async getMostRecentIncompleteSession(userId: string, planId?: string): Promise<any | null> {
    try {
      let query = supabase
        .from("workout_sessions")
        .select("*")
        .eq("user_id", userId)
        .is("completed_at", null)
        .order("started_at", { ascending: false })
        .limit(1);

      if (planId) query = query.eq("plan_id", planId);

      const { data, error } = await query;

      if (error) throw error;
      if (!data || (Array.isArray(data) && data.length === 0)) return null;

      // Supabase returns an array (unless .maybeSingle() used) — unify to single row
      return Array.isArray(data) ? data[0] : data;
    } catch (error) {
      const dbError = this.handleDatabaseError(error);
      throw dbError;
    }
  }

  /**
   * Calculate approximate progress (phase, repetition, day) from workout history.
   * Uses started sessions (counts as progress) and workout_plan_sessions to determine
   * total days per phase and phase_repetitions.
   *
   * Returns { phaseNumber, repetition, dayNumber }
   */
  async calculateProgressFromHistory(
    userId: string,
    planId: string
  ): Promise<{
    phaseNumber: number;
    repetition: number;
    dayNumber: number;
  }> {
    try {
      // 1) Load plan sessions metadata: phase_number, day_number, phase_repetitions
      const planRes = await supabase
        .from("workout_plan_sessions")
        .select("id,phase_number,day_number,phase_repetitions")
        .eq("plan_id", planId)
        .order("phase_number", { ascending: true });

      const planSessions = (planRes?.data as any[]) || null;
      const planError = planRes?.error;

      if (planError) throw planError;
      if (!planSessions || planSessions.length === 0) {
        // Fallback to phase 1 day 1
        return { phaseNumber: 1, repetition: 1, dayNumber: 1 };
      }

      // Build phase map: phaseNumber -> { totalDays, phaseRepetitions, sessionIds }
      const phaseMap = new Map<number, { totalDays: number; phaseRepetitions: number; sessionIds: string[] }>();
      for (const ps of planSessions) {
        const pn = Number(ps.phase_number) || 1;
        const entry = phaseMap.get(pn) || {
          totalDays: 0,
          phaseRepetitions: Number(ps.phase_repetitions) || 4,
          sessionIds: [],
        };
        entry.totalDays = Math.max(entry.totalDays, Number(ps.day_number) || 1);
        entry.phaseRepetitions = Number(ps.phase_repetitions) || entry.phaseRepetitions;
        entry.sessionIds.push(ps.id);
        phaseMap.set(pn, entry);
      }

      // 2) Load user workout_sessions joined with plan session metadata
      // Select relevant fields and join via session_id -> workout_plan_sessions
      const userRes = await supabase
        .from("workout_sessions")
        .select(
          `
          id,
          started_at,
          session_id,
          workout_plan_sessions (
            id,
            phase_number,
            day_number
          )
        `
        )
        .eq("user_id", userId)
        .eq("plan_id", planId)
        .order("started_at", { ascending: true })
        .limit(1000);

      const userSessions = (userRes?.data as any[]) || [];
      const sessionsError = userRes?.error;

      if (sessionsError) throw sessionsError;

      const sessions = (userSessions || []).filter((s: any) => s.session_id && s.workout_plan_sessions);

      // 3) Tally unique days per phase that have been started
      const phaseDaySets = new Map<number, Set<number>>();
      sessions.forEach((s: any) => {
        const wp = s.workout_plan_sessions;
        if (!wp) return;
        const pn = Number(wp.phase_number) || 1;
        const dn = Number(wp.day_number) || 1;
        if (!phaseDaySets.has(pn)) phaseDaySets.set(pn, new Set<number>());
        phaseDaySets.get(pn)!.add(dn);
      });

      // 4) Iterate phases in ascending order to find current phase/repetition/day
      const phaseNumbers = Array.from(phaseMap.keys()).sort((a, b) => a - b);

      for (const pn of phaseNumbers) {
        const meta = phaseMap.get(pn)!;
        const uniqueDays = phaseDaySets.get(pn) ? phaseDaySets.get(pn)!.size : 0;
        const totalDays = meta.totalDays || 1;
        const phaseReps = meta.phaseRepetitions || 4;

        const repetitionsCompleted = Math.floor(uniqueDays / totalDays);
        const currentRepetition = Math.min(repetitionsCompleted + 1, phaseReps);

        if (repetitionsCompleted < phaseReps) {
          // Determine next day number: smallest day in 1..totalDays not present
          const daysCompletedSet = phaseDaySets.get(pn) || new Set<number>();
          let nextDay = 1;
          for (let d = 1; d <= totalDays; d++) {
            if (!daysCompletedSet.has(d)) {
              nextDay = d;
              break;
            }
            nextDay = Math.min(totalDays, d + 1);
          }

          return {
            phaseNumber: pn,
            repetition: currentRepetition,
            dayNumber: nextDay,
          };
        }

        // else, this phase is fully completed (all repetitions done) — continue to next phase
      }

      // If all phases completed, return last phase with last repetition and last day
      const lastPhase = Math.max(...phaseNumbers);
      const lastMeta = phaseMap.get(lastPhase)!;
      return {
        phaseNumber: lastPhase,
        repetition: lastMeta.phaseRepetitions || 1,
        dayNumber: lastMeta.totalDays || 1,
      };
    } catch (error) {
      const dbError = this.handleDatabaseError(error);
      throw dbError;
    }
  }
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance();
export default databaseService;
