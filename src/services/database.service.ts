// ============================================================================
// DATABASE SERVICE WITH CONNECTION POOLING AND ERROR HANDLING
// ============================================================================
// Provides optimized database operations with offline sync capabilities

import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS, ERROR_MESSAGES } from "@/config/constants";
import type { WorkoutSession, ExerciseSet, UserProfile, Exercise, WorkoutPlan, ProgressMetrics } from "@/types";
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
  private offlineQueue: Array<{ operation: string; data: any; timestamp: number }> = [];
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
    // Load offline queue from storage
    try {
      const storedQueue = await AsyncStorage.getItem(STORAGE_KEYS.async.offlineWorkouts);
      if (storedQueue) {
        this.offlineQueue = JSON.parse(storedQueue);
      }
    } catch (error) {
      console.warn("Failed to load offline queue:", error);
    }

    // Monitor connection status
    this.monitorConnectionStatus();

    // Process offline queue when coming online
    this.processOfflineQueue();
  }

  private monitorConnectionStatus(): void {
    // Test connection every 30 seconds
    setInterval(async () => {
      try {
        const { error } = await supabase.from("user_profiles").select("id").limit(1);
        const wasOffline = !this.isOnline;
        this.isOnline = !error;

        // If we just came back online, process offline queue
        if (wasOffline && this.isOnline) {
          await this.processOfflineQueue();
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

  private async addToOfflineQueue(operation: string, data: any): Promise<void> {
    this.offlineQueue.push({
      operation,
      data,
      timestamp: Date.now(),
    });

    // Persist to storage
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.async.offlineWorkouts, JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.error("Failed to persist offline queue:", error);
    }
  }

  private async processOfflineQueue(): Promise<void> {
    if (!this.isOnline || this.offlineQueue.length === 0) {
      return;
    }

    console.log(`Processing ${this.offlineQueue.length} offline operations`);

    const processedOperations: string[] = [];

    for (const queueItem of this.offlineQueue) {
      try {
        await this.executeQueuedOperation(queueItem);
        processedOperations.push(`${queueItem.operation}:${queueItem.timestamp}`);
      } catch (error) {
        console.error("Failed to process queued operation:", error);
        // Keep failed operations in queue for retry
      }
    }

    // Remove successfully processed operations
    this.offlineQueue = this.offlineQueue.filter(
      (item) => !processedOperations.includes(`${item.operation}:${item.timestamp}`)
    );

    // Update storage
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.async.offlineWorkouts, JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.error("Failed to update offline queue:", error);
    }
  }

  private async executeQueuedOperation(queueItem: any): Promise<void> {
    const { operation, data } = queueItem;

    switch (operation) {
      case "insert_workout_session":
        await this.insertWorkoutSession(data, { useCache: false });
        break;
      case "update_workout_session":
        await this.updateWorkoutSession(data.id, data, { useCache: false });
        break;
      case "insert_exercise_sets":
        await this.insertExerciseSets(data, { useCache: false });
        break;
      case "update_user_profile":
        await this.updateUserProfile(data.id, data, { useCache: false });
        break;
      default:
        console.warn("Unknown queued operation:", operation);
    }
  }

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
        // Queue for offline processing
        await this.addToOfflineQueue("update_user_profile", { id: userId, ...updates });
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
        // Queue for offline processing
        await this.addToOfflineQueue("insert_workout_session", session);

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
        // Queue for offline processing
        await this.addToOfflineQueue("update_workout_session", { id: sessionId, ...updates });
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
        // Queue for offline processing
        await this.addToOfflineQueue("insert_exercise_sets", sets);

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
    const totalVolumeKg = workoutData.reduce((sum, workout) => sum + (workout.total_volume_kg || 0), 0);
    const averageSessionDuration =
      workoutData.reduce((sum, workout) => sum + (workout.duration_minutes || 0), 0) / totalWorkouts || 0;

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
  // SYNC OPERATIONS
  // ============================================================================

  async syncAllData(userId: string): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      synced: [],
      conflicts: [],
      errors: [],
    };

    try {
      // Process offline queue
      await this.processOfflineQueue();

      // Clear cache to ensure fresh data
      this.clearCache();

      result.synced.push("offline_queue");
    } catch (error) {
      result.success = false;
      result.errors.push({
        id: "sync_operation",
        error: error instanceof Error ? error.message : "Unknown sync error",
      });
    }

    return result;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  getConnectionStatus(): boolean {
    return this.isOnline;
  }

  getOfflineQueueSize(): number {
    return this.offlineQueue.length;
  }

  async clearAllCache(): Promise<void> {
    this.clearCache();
  }

  async getStorageInfo(): Promise<{
    cacheSize: number;
    offlineQueueSize: number;
    isOnline: boolean;
  }> {
    return {
      cacheSize: this.queryCache.size,
      offlineQueueSize: this.offlineQueue.length,
      isOnline: this.isOnline,
    };
  }
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance();
export default databaseService;
