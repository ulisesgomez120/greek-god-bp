// ============================================================================
// PROGRESS SERVICE
// ============================================================================
// Comprehensive progress tracking service with workout history, strength gains,
// volume tracking, 1RM estimates, personal records, and trend analysis

import { supabase } from "../lib/supabase";
import { logger } from "../utils/logger";
import { calculateOneRepMax } from "../utils/progressCalculations";
import type {
  WorkoutSession,
  ExerciseSet,
  Exercise,
  ProgressMetrics,
  VolumeDataPoint,
  StrengthDataPoint,
  PersonalRecord,
} from "../types";
import type { Database } from "../types/database";

// ============================================================================
// TYPES
// ============================================================================

export interface ExerciseSessionSummary {
  sessionId: string;
  sessionName: string;
  date: string;
  sets: {
    setNumber: number;
    weight: number;
    reps: number;
    rpe?: number;
    notes?: string;
    isWarmup: boolean;
    isFailure: boolean;
  }[];
  bestSet: {
    weight: number;
    reps: number;
    volume: number;
    estimatedOneRepMax: number;
  };
  totalVolume: number;
  averageRpe?: number;
  isPersonalRecord: boolean;
  progressionFromPrevious?: {
    weightChange: number;
    repChange: number;
    volumeChange: number;
    oneRepMaxChange: number;
  };
  notes?: string;
}

export interface ProgressAnalytics {
  strengthGains: Record<string, number>; // exerciseId -> gain percentage
  volumeTrends: Record<string, "increasing" | "decreasing" | "stable">;
  personalRecords: PersonalRecord[];
  consistencyScore: number;
  totalWorkouts: number;
  totalVolumeLifted: number;
  averageWorkoutDuration: number;
  strengthScore: number;
}

export interface WorkoutHistoryFilters {
  startDate?: string;
  endDate?: string;
  exerciseIds?: string[];
  muscleGroups?: string[];
  planId?: string;
  minDuration?: number;
  maxDuration?: number;
  searchQuery?: string;
}

export interface ExportData {
  workouts: WorkoutSession[];
  exercises: Exercise[];
  progressMetrics: ProgressMetrics[];
  personalRecords: PersonalRecord[];
  exportDate: string;
  userId: string;
  dateRange: {
    start: string;
    end: string;
  };
}

// ============================================================================
// PROGRESS SERVICE CLASS
// ============================================================================

export class ProgressService {
  /**
   * Get comprehensive progress analytics for a user
   */
  static async getProgressAnalytics(
    userId: string,
    timeframe: "month" | "quarter" | "year" = "quarter"
  ): Promise<ProgressAnalytics> {
    try {
      logger.info("Fetching progress analytics", { userId, timeframe }, "progress");

      // Get workout history for analytics calculation
      const { workouts } = await this.getWorkoutHistory(
        userId,
        {
          startDate: this.getStartDate(timeframe),
          endDate: new Date().toISOString().split("T")[0],
        },
        1,
        1000
      );

      // Get personal records
      const personalRecords = await this.getPersonalRecords(userId);

      // Calculate strength score
      const strengthScore = await this.calculateOverallStrengthScore(userId);

      // Calculate basic analytics from workout data
      const totalWorkouts = workouts.length;
      const totalVolumeLifted = workouts.reduce((sum, w) => sum + (w.totalVolumeKg || 0), 0);
      const averageWorkoutDuration =
        workouts.length > 0 ? workouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0) / workouts.length : 0;

      const analytics: ProgressAnalytics = {
        strengthGains: {},
        volumeTrends: {},
        personalRecords,
        consistencyScore: 75, // Placeholder - would calculate from workout frequency
        totalWorkouts,
        totalVolumeLifted,
        averageWorkoutDuration,
        strengthScore,
      };

      logger.info("Progress analytics calculated", { userId, totalWorkouts: analytics.totalWorkouts }, "progress");

      return analytics;
    } catch (error) {
      logger.error("Failed to get progress analytics", error, "progress");
      throw new Error("Failed to fetch progress analytics");
    }
  }

  /**
   * Get workout history with filtering and pagination
   */
  static async getWorkoutHistory(
    userId: string,
    filters: WorkoutHistoryFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    workouts: WorkoutSession[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      logger.info("Fetching workout history", { userId, filters, page, limit }, "progress");

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
      if (filters.startDate) {
        query = query.gte("started_at", filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte("started_at", filters.endDate);
      }
      if (filters.planId) {
        query = query.eq("plan_id", filters.planId);
      }
      if (filters.minDuration) {
        query = query.gte("duration_minutes", filters.minDuration);
      }
      if (filters.maxDuration) {
        query = query.lte("duration_minutes", filters.maxDuration);
      }
      if (filters.searchQuery) {
        query = query.ilike("name", `%${filters.searchQuery}%`);
      }

      // Get total count for pagination
      const countQuery = supabase
        .from("workout_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("completed_at", "is", null);

      // Apply same filters to count query
      if (filters.startDate) {
        countQuery.gte("started_at", filters.startDate);
      }
      if (filters.endDate) {
        countQuery.lte("started_at", filters.endDate);
      }
      if (filters.planId) {
        countQuery.eq("plan_id", filters.planId);
      }
      if (filters.minDuration) {
        countQuery.gte("duration_minutes", filters.minDuration);
      }
      if (filters.maxDuration) {
        countQuery.lte("duration_minutes", filters.maxDuration);
      }
      if (filters.searchQuery) {
        countQuery.ilike("name", `%${filters.searchQuery}%`);
      }

      const { count } = await countQuery;

      // Apply pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data: workouts, error } = await query;

      if (error) throw error;

      // Filter by exercise IDs or muscle groups if specified
      let filteredWorkouts = workouts || [];
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

      const totalCount = count || 0;
      const hasMore = offset + limit < totalCount;

      logger.info(
        "Workout history fetched",
        {
          userId,
          workoutCount: filteredWorkouts.length,
          totalCount,
          hasMore,
        },
        "progress"
      );

      // Transform database results to match WorkoutSession type
      const transformedWorkouts: WorkoutSession[] = filteredWorkouts.map((workout: any) => ({
        id: workout.id,
        userId: workout.user_id,
        planId: workout.plan_id,
        sessionId: workout.session_id,
        name: workout.name,
        startedAt: workout.started_at,
        completedAt: workout.completed_at,
        durationMinutes: workout.duration_minutes,
        totalVolumeKg: workout.total_volume_kg,
        averageRpe: workout.average_rpe,
        notes: workout.notes,
        syncStatus: workout.sync_status || "synced",
        offlineCreated: workout.offline_created || false,
        createdAt: workout.created_at,
        updatedAt: workout.updated_at,
        sets:
          workout.exercise_sets?.map((set: any) => ({
            id: set.id,
            sessionId: set.session_id,
            exerciseId: set.exercise_id,
            setNumber: set.set_number,
            weightKg: set.weight_kg,
            reps: set.reps,
            rpe: set.rpe,
            isWarmup: set.is_warmup || false,
            isFailure: set.is_failure || false,
            restSeconds: set.rest_seconds,
            notes: set.notes,
            createdAt: set.created_at,
          })) || [],
      }));

      return {
        workouts: transformedWorkouts,
        totalCount,
        hasMore,
      };
    } catch (error) {
      logger.error("Failed to get workout history", error, "progress");
      throw new Error("Failed to fetch workout history");
    }
  }

  /**
   * Get last 6 sessions for a specific exercise
   */
  static async getExerciseHistory(userId: string, exerciseId: string): Promise<ExerciseSessionSummary[]> {
    try {
      logger.info("Fetching exercise history", { userId, exerciseId }, "progress");

      const { data: sessions, error } = await supabase
        .from("workout_sessions")
        .select(
          `
          id,
          name,
          started_at,
          notes,
          exercise_sets!inner (
            set_number,
            weight_kg,
            reps,
            rpe,
            notes,
            is_warmup,
            is_failure,
            created_at
          )
        `
        )
        .eq("user_id", userId)
        .eq("exercise_sets.exercise_id", exerciseId)
        .not("completed_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(6);

      if (error) throw error;

      if (!sessions || sessions.length === 0) {
        return [];
      }

      // Process sessions into summaries
      const summaries: ExerciseSessionSummary[] = [];

      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        const sets = (session.exercise_sets || [])
          .sort((a: any, b: any) => a.set_number - b.set_number)
          .map((set: any) => ({
            setNumber: set.set_number,
            weight: set.weight_kg || 0,
            reps: set.reps || 0,
            rpe: set.rpe,
            notes: set.notes,
            isWarmup: set.is_warmup || false,
            isFailure: set.is_failure || false,
          }));

        // Calculate best set (highest estimated 1RM)
        const workingSets = sets.filter((set) => !set.isWarmup);
        let bestSet = workingSets[0];
        let bestOneRepMax = 0;

        for (const set of workingSets) {
          const oneRepMax = this.calculateOneRepMax(set.weight, set.reps, set.rpe);
          if (oneRepMax > bestOneRepMax) {
            bestOneRepMax = oneRepMax;
            bestSet = set;
          }
        }

        const totalVolume = workingSets.reduce((sum, set) => sum + set.weight * set.reps, 0);
        const averageRpe = workingSets
          .filter((set) => set.rpe)
          .reduce((sum, set, _, arr) => sum + (set.rpe || 0) / arr.length, 0);

        // Check if this session contains a personal record
        const isPersonalRecord = await this.checkIfPersonalRecord(
          userId,
          exerciseId,
          bestOneRepMax,
          session.started_at
        );

        // Calculate progression from previous session
        let progressionFromPrevious;
        if (i < sessions.length - 1) {
          const previousSession = summaries[i - 1]; // Previous in array = more recent
          if (previousSession) {
            progressionFromPrevious = {
              weightChange: bestSet.weight - previousSession.bestSet.weight,
              repChange: bestSet.reps - previousSession.bestSet.reps,
              volumeChange: totalVolume - previousSession.totalVolume,
              oneRepMaxChange: bestOneRepMax - previousSession.bestSet.estimatedOneRepMax,
            };
          }
        }

        summaries.push({
          sessionId: session.id,
          sessionName: session.name,
          date: session.started_at,
          sets,
          bestSet: {
            weight: bestSet.weight,
            reps: bestSet.reps,
            volume: bestSet.weight * bestSet.reps,
            estimatedOneRepMax: bestOneRepMax,
          },
          totalVolume,
          averageRpe: averageRpe || undefined,
          isPersonalRecord,
          progressionFromPrevious,
          notes: session.notes || undefined,
        });
      }

      logger.info(
        "Exercise history fetched",
        {
          userId,
          exerciseId,
          sessionCount: summaries.length,
        },
        "progress"
      );

      return summaries;
    } catch (error) {
      logger.error("Failed to get exercise history", error, "progress");
      throw new Error("Failed to fetch exercise history");
    }
  }

  /**
   * Get strength progression data for charts
   */
  static async getStrengthProgression(
    userId: string,
    exerciseId: string,
    timeframe: "month" | "quarter" | "year" = "quarter"
  ): Promise<StrengthDataPoint[]> {
    try {
      logger.info("Fetching strength progression", { userId, exerciseId, timeframe }, "progress");

      const startDate = this.getStartDate(timeframe);

      const { data: sets, error } = await supabase
        .from("exercise_sets")
        .select(
          `
          weight_kg,
          reps,
          rpe,
          created_at,
          workout_sessions!inner (
            user_id,
            started_at,
            completed_at
          )
        `
        )
        .eq("exercise_id", exerciseId)
        .eq("workout_sessions.user_id", userId)
        .eq("is_warmup", false)
        .not("workout_sessions.completed_at", "is", null)
        .gte("workout_sessions.started_at", startDate)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const progressionData: StrengthDataPoint[] = (sets || [])
        .filter((set: any) => set.weight_kg && set.reps)
        .map((set: any) => ({
          date: set.created_at,
          exerciseId,
          oneRepMax: this.calculateOneRepMax(set.weight_kg, set.reps, set.rpe),
          estimatedMax: this.calculateOneRepMax(set.weight_kg, set.reps, set.rpe),
          estimatedOneRepMax: this.calculateOneRepMax(set.weight_kg, set.reps, set.rpe),
          weight: set.weight_kg,
          reps: set.reps,
          rpe: set.rpe,
        }));

      logger.info(
        "Strength progression fetched",
        {
          userId,
          exerciseId,
          dataPoints: progressionData.length,
        },
        "progress"
      );

      return progressionData;
    } catch (error) {
      logger.error("Failed to get strength progression", error, "progress");
      throw new Error("Failed to fetch strength progression");
    }
  }

  /**
   * Get volume progression data for charts
   */
  static async getVolumeProgression(
    userId: string,
    exerciseId?: string,
    timeframe: "month" | "quarter" | "year" = "quarter"
  ): Promise<VolumeDataPoint[]> {
    try {
      logger.info("Fetching volume progression", { userId, exerciseId, timeframe }, "progress");

      const startDate = this.getStartDate(timeframe);

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
            exercise_id
          )
        `
        )
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .gte("started_at", startDate)
        .order("started_at", { ascending: true });

      const { data: sessions, error } = await query;

      if (error) throw error;

      const volumeData: VolumeDataPoint[] = (sessions || [])
        .map((session: any) => {
          let sessionVolume = 0;
          let sessionSets = 0;

          if (exerciseId) {
            // Calculate volume for specific exercise
            const exerciseSets = (session.exercise_sets || []).filter(
              (set: any) => set.exercise_id === exerciseId && !set.is_warmup
            );

            sessionVolume = exerciseSets.reduce(
              (sum: number, set: any) => sum + (set.weight_kg || 0) * (set.reps || 0),
              0
            );
            sessionSets = exerciseSets.length;
          } else {
            // Use total session volume
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
        .filter((data: VolumeDataPoint) => (data.volume || 0) > 0);

      logger.info(
        "Volume progression fetched",
        {
          userId,
          exerciseId,
          dataPoints: volumeData.length,
        },
        "progress"
      );

      return volumeData;
    } catch (error) {
      logger.error("Failed to get volume progression", error, "progress");
      throw new Error("Failed to fetch volume progression");
    }
  }

  /**
   * Get personal records for a user
   */
  static async getPersonalRecords(userId: string, exerciseId?: string, limit: number = 50): Promise<PersonalRecord[]> {
    try {
      logger.info("Fetching personal records", { userId, exerciseId, limit }, "progress");

      // Get all working sets for the user
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
        .eq("is_warmup", false)
        .not("workout_sessions.completed_at", "is", null)
        .order("created_at", { ascending: false });

      if (exerciseId) {
        query = query.eq("exercise_id", exerciseId);
      }

      const { data: sets, error } = await query;

      if (error) throw error;

      // Group sets by exercise and find records
      const exerciseRecords = new Map<string, PersonalRecord[]>();

      for (const set of sets || []) {
        const exerciseId = set.exercise_id;
        const oneRepMax = this.calculateOneRepMax(set.weight_kg || 0, set.reps || 0, set.rpe || undefined);
        const volume = (set.weight_kg || 0) * (set.reps || 0);

        if (!exerciseRecords.has(exerciseId)) {
          exerciseRecords.set(exerciseId, []);
        }

        const records = exerciseRecords.get(exerciseId)!;

        // Check for weight record (1RM equivalent)
        const currentMaxRecord = records.find((r) => r.type === "weight");
        if (!currentMaxRecord || oneRepMax > currentMaxRecord.value) {
          // Remove old weight record
          const index = records.findIndex((r) => r.type === "weight");
          if (index >= 0) records.splice(index, 1);

          records.push({
            exerciseId,
            type: "weight",
            value: oneRepMax,
            achievedAt: set.created_at,
            sessionId: set.session_id,
          });
        }

        // Check for volume record
        const currentVolumeRecord = records.find((r) => r.type === "volume");
        if (!currentVolumeRecord || volume > currentVolumeRecord.value) {
          // Remove old volume record
          const index = records.findIndex((r) => r.type === "volume");
          if (index >= 0) records.splice(index, 1);

          records.push({
            exerciseId,
            type: "volume",
            value: volume,
            achievedAt: set.created_at,
            sessionId: set.session_id,
          });
        }

        // Check for rep record at same weight
        const sameWeightRecord = records.find(
          (r) => r.type === "reps" && Math.abs(r.value - (set.weight_kg || 0)) < 0.5
        );
        if (!sameWeightRecord || (set.reps || 0) > sameWeightRecord.value) {
          // Remove old rep record at this weight
          const index = records.findIndex((r) => r.type === "reps" && Math.abs(r.value - (set.weight_kg || 0)) < 0.5);
          if (index >= 0) records.splice(index, 1);

          records.push({
            exerciseId,
            type: "reps",
            value: set.reps || 0,
            achievedAt: set.created_at,
            sessionId: set.session_id,
          });
        }
      }

      // Flatten and sort all records
      const allRecords = Array.from(exerciseRecords.values())
        .flat()
        .sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime())
        .slice(0, limit);

      logger.info(
        "Personal records fetched",
        {
          userId,
          exerciseId,
          recordCount: allRecords.length,
        },
        "progress"
      );

      return allRecords;
    } catch (error) {
      logger.error("Failed to get personal records", error, "progress");
      throw new Error("Failed to fetch personal records");
    }
  }

  /**
   * Export user progress data
   */
  static async exportProgressData(
    userId: string,
    startDate: string,
    endDate: string,
    format: "json" | "csv" = "json"
  ): Promise<ExportData | string> {
    try {
      logger.info("Exporting progress data", { userId, startDate, endDate, format }, "progress");

      // Get workout history
      const { workouts } = await this.getWorkoutHistory(
        userId,
        {
          startDate,
          endDate,
        },
        1,
        1000
      ); // Large limit for export

      // Get exercises
      const exerciseIds = Array.from(new Set(workouts.flatMap((w) => (w.sets || []).map((s: any) => s.exerciseId))));

      const { data: exercises, error: exercisesError } = await supabase
        .from("exercises")
        .select("*")
        .in("id", exerciseIds);

      if (exercisesError) throw exercisesError;

      // Get personal records
      const personalRecords = await this.getPersonalRecords(userId);

      // Get progress metrics
      const analytics = await this.getProgressAnalytics(userId);

      const exportData: ExportData = {
        workouts,
        exercises: (exercises || []) as unknown as Exercise[], // Cast to Exercise type
        progressMetrics: [analytics] as any, // Convert analytics to metrics format
        personalRecords,
        exportDate: new Date().toISOString(),
        userId,
        dateRange: {
          start: startDate,
          end: endDate,
        },
      };

      if (format === "json") {
        return exportData;
      } else {
        // Convert to CSV format
        return this.convertToCSV(exportData);
      }
    } catch (error) {
      logger.error("Failed to export progress data", error, "progress");
      throw new Error("Failed to export progress data");
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Calculate one rep max using multiple formulas
   */
  static calculateOneRepMax(
    weight: number,
    reps: number,
    rpe?: number,
    formula: "epley" | "brzycki" | "rpe" = "rpe"
  ): number {
    if (reps === 1) return weight;

    switch (formula) {
      case "rpe":
        if (rpe && rpe >= 6 && rpe <= 10) {
          const repsInReserve = 10 - rpe;
          const totalReps = reps + repsInReserve;
          return weight * (1 + totalReps / 30); // Modified Epley with RPE
        }
        // Fallback to Epley if no RPE
        return weight * (1 + reps / 30);

      case "brzycki":
        return weight * (36 / (37 - reps));

      case "epley":
      default:
        return weight * (1 + reps / 30);
    }
  }

  /**
   * Get start date for timeframe
   */
  private static getStartDate(timeframe: "month" | "quarter" | "year"): string {
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

  /**
   * Parse volume trends from database response
   */
  private static parseVolumeTrends(volumeProgress: any): Record<string, "increasing" | "decreasing" | "stable"> {
    // This would parse the volume progression data to determine trends
    // For now, return empty object - would be implemented based on actual data structure
    return {};
  }

  /**
   * Calculate overall strength score
   */
  private static async calculateOverallStrengthScore(userId: string): Promise<number> {
    try {
      // Get user's bodyweight
      const { data: profile } = await supabase.from("user_profiles").select("weight_kg").eq("id", userId).single();

      const bodyweight = profile?.weight_kg || 70; // Default to 70kg

      // Get recent 1RMs for major lifts
      const majorLifts = ["squat", "bench", "deadlift", "press"];
      let totalScore = 0;
      let liftCount = 0;

      for (const lift of majorLifts) {
        const { data: exercises } = await supabase.from("exercises").select("id").ilike("name", `%${lift}%`).limit(1);

        if (exercises && exercises.length > 0) {
          const strengthData = await this.getStrengthProgression(userId, exercises[0].id, "month");
          if (strengthData.length > 0) {
            const latestOneRM = strengthData[strengthData.length - 1].oneRepMax;
            const relativeStrength = latestOneRM / bodyweight;

            // Score based on strength standards (simplified)
            let liftScore = 0;
            if (lift === "squat") liftScore = (relativeStrength / 1.5) * 100;
            else if (lift === "bench") liftScore = (relativeStrength / 1.25) * 100;
            else if (lift === "deadlift") liftScore = (relativeStrength / 2.0) * 100;
            else if (lift === "press") liftScore = (relativeStrength / 0.75) * 100;

            totalScore += Math.min(liftScore, 200); // Cap at 200%
            liftCount++;
          }
        }
      }

      return liftCount > 0 ? Math.round(totalScore / liftCount) : 0;
    } catch (error) {
      logger.error("Failed to calculate strength score", error, "progress");
      return 0;
    }
  }

  /**
   * Check if a performance is a personal record
   */
  private static async checkIfPersonalRecord(
    userId: string,
    exerciseId: string,
    oneRepMax: number,
    sessionDate: string
  ): Promise<boolean> {
    try {
      const { data: previousBest, error } = await supabase
        .from("exercise_sets")
        .select(
          `
          weight_kg,
          reps,
          rpe,
          workout_sessions!inner (
            user_id,
            started_at,
            completed_at
          )
        `
        )
        .eq("exercise_id", exerciseId)
        .eq("workout_sessions.user_id", userId)
        .eq("is_warmup", false)
        .not("workout_sessions.completed_at", "is", null)
        .lt("workout_sessions.started_at", sessionDate)
        .order("workout_sessions.started_at", { ascending: false })
        .limit(50); // Check last 50 sets

      if (error || !previousBest || previousBest.length === 0) {
        return true; // First time doing this exercise
      }

      // Find the best previous 1RM
      let bestPreviousOneRM = 0;
      for (const set of previousBest) {
        const previousOneRM = this.calculateOneRepMax(set.weight_kg || 0, set.reps || 0, set.rpe || undefined);
        if (previousOneRM > bestPreviousOneRM) {
          bestPreviousOneRM = previousOneRM;
        }
      }

      return oneRepMax > bestPreviousOneRM;
    } catch (error) {
      logger.error("Failed to check personal record", error, "progress");
      return false;
    }
  }

  /**
   * Convert export data to CSV format
   */
  private static convertToCSV(data: ExportData): string {
    const csvRows: string[] = [];

    // Add header
    csvRows.push("Date,Exercise,Sets,Reps,Weight,RPE,Volume,Notes");

    // Add workout data
    for (const workout of data.workouts) {
      for (const set of workout.sets || []) {
        const exercise = data.exercises.find((e) => e.id === (set as any).exercise_id);
        const row = [
          workout.startedAt,
          exercise?.name || "Unknown",
          (set as any).set_number,
          (set as any).reps,
          (set as any).weight_kg,
          (set as any).rpe || "",
          ((set as any).weight_kg || 0) * ((set as any).reps || 0),
          (set as any).notes || "",
        ].join(",");
        csvRows.push(row);
      }
    }

    return csvRows.join("\n");
  }
}

export default ProgressService;
