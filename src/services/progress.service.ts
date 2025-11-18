// ============================================================================
// PROGRESS SERVICE (delegates DB queries to DatabaseService)
// ============================================================================
// This refactor moves heavy DB querying into DatabaseService helpers and makes
// ProgressService a thin orchestration layer that formats results for callers.

import { logger } from "../utils/logger";
import { calculateOneRepMax } from "../utils/progressCalculations";
import { databaseService } from "./database.service";
import type {
  WorkoutSession,
  ExerciseSet,
  Exercise,
  ProgressMetrics,
  VolumeDataPoint,
  StrengthDataPoint,
  PersonalRecord,
} from "../types";

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

// ============================================================================
// PROGRESS SERVICE CLASS
// ============================================================================

export class ProgressService {
  /**
   * Get comprehensive progress analytics for a user
   * Delegates heavy queries to DatabaseService.
   */
  static async getProgressAnalytics(
    userId: string,
    timeframe: "month" | "quarter" | "year" = "quarter"
  ): Promise<ProgressAnalytics> {
    try {
      logger.info("Fetching progress analytics", { userId, timeframe }, "progress");

      const { workouts } = await databaseService.queryWorkoutHistory(
        userId,
        {
          startDate: databaseService.getStartDateForProgress(timeframe),
          endDate: new Date().toISOString().split("T")[0],
        },
        1,
        1000
      );

      // Personal records now require a plannedExerciseId to scope them.
      // Analytics here are global and not scoped per planned exercise; skip personalRecords
      // to avoid accidental unscoped queries. If needed, callers should request records
      // via ProgressService.getPersonalRecords with an explicit plannedExerciseId.
      const personalRecords: any[] = [];
      const strengthScore = 0; // keep simple for now (could call a helper)

      const totalWorkouts = workouts.length;
      const totalVolumeLifted = workouts.reduce((sum, w) => sum + (w.totalVolumeKg || 0), 0);
      const averageWorkoutDuration =
        workouts.length > 0 ? workouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0) / workouts.length : 0;

      const analytics: ProgressAnalytics = {
        strengthGains: {},
        volumeTrends: {},
        personalRecords,
        consistencyScore: 75,
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
   * Delegates to DatabaseService.queryWorkoutHistory
   */
  static async getWorkoutHistory(
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
  ): Promise<{
    workouts: WorkoutSession[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      const res = await databaseService.queryWorkoutHistory(userId, filters, page, limit);
      return { workouts: res.workouts, totalCount: res.totalCount, hasMore: res.hasMore };
    } catch (err) {
      logger.error("Failed to get workout history", err, "progress");
      throw new Error("Failed to fetch workout history");
    }
  }

  /**
   * Get last N sessions for a specific exercise
   * Delegates to DatabaseService.queryExerciseHistory and returns formatted summaries.
   */
  static async getExerciseHistory(
    userId: string,
    exerciseId: string,
    plannedExerciseId: string,
    sessionLimit: number = 6,
    setLimit: number = 60
  ): Promise<ExerciseSessionSummary[]> {
    try {
      if (!plannedExerciseId || typeof plannedExerciseId !== "string") {
        throw new Error("ProgressService.getExerciseHistory: plannedExerciseId is required");
      }

      // Query the DatabaseService which returns lightweight summaries: { date, sets[] }
      const rawSummaries: any[] = await databaseService.queryExerciseHistory(
        userId,
        exerciseId,
        plannedExerciseId,
        sessionLimit,
        setLimit
      );

      // Map raw summaries to the ExerciseSessionSummary shape expected by callers.
      // We keep calculations lightweight: derive bestSet as highest estimated 1RM among non-warmup sets.
      const mapped: ExerciseSessionSummary[] = (rawSummaries || []).map((s: any) => {
        const rawSets = (s.sets || []) as any[];

        const sets = rawSets.map((st: any, idx: number) => ({
          setNumber: (st.setNumber as number) || idx + 1,
          weight: st.weight ?? 0,
          reps: st.reps ?? 0,
          rpe: st.rpe ?? undefined,
          notes: st.notes ?? undefined,
          isWarmup: !!st.isWarmup,
          isFailure: false,
        }));

        const workingSets = sets.filter((ss) => !ss.isWarmup && ss.weight > 0 && ss.reps > 0);

        let bestSet = {
          weight: 0,
          reps: 0,
          volume: 0,
          estimatedOneRepMax: 0,
        };

        let bestOrm = 0;
        for (const ws of workingSets) {
          const orm = calculateOneRepMax(ws.weight, ws.reps);
          if (orm > bestOrm) {
            bestOrm = orm;
            bestSet = {
              weight: ws.weight,
              reps: ws.reps,
              volume: ws.weight * ws.reps,
              estimatedOneRepMax: orm,
            };
          }
        }

        const totalVolume = workingSets.reduce((sum, ss) => sum + ss.weight * ss.reps, 0);
        const rpeValues = workingSets.filter((ss) => ss.rpe !== undefined).map((ss) => ss.rpe as number);
        const averageRpe =
          rpeValues.length > 0 ? rpeValues.reduce((sum, v) => sum + v, 0) / rpeValues.length : undefined;

        return {
          sessionId: s.sessionId ?? "",
          sessionName: s.sessionName ?? "",
          date: s.date,
          sets,
          bestSet,
          totalVolume,
          averageRpe,
          isPersonalRecord: false,
          progressionFromPrevious: undefined,
          notes: s.notes ?? undefined,
        } as ExerciseSessionSummary;
      });

      return mapped;
    } catch (err) {
      logger.error("Failed to get exercise history", err, "progress");
      throw new Error("Failed to fetch exercise history");
    }
  }

  /**
   * Get strength progression for charts (scoped to a planned exercise)
   */
  static async getStrengthProgression(
    userId: string,
    exerciseId: string,
    plannedExerciseId: string,
    timeframe: "month" | "quarter" | "year" = "quarter"
  ): Promise<StrengthDataPoint[]> {
    try {
      if (!plannedExerciseId || typeof plannedExerciseId !== "string") {
        throw new Error("ProgressService.getStrengthProgression: plannedExerciseId is required");
      }

      const data = await databaseService.queryStrengthProgression(userId, exerciseId, plannedExerciseId, timeframe);
      return data;
    } catch (err) {
      logger.error("Failed to get strength progression", err, "progress");
      throw new Error("Failed to fetch strength progression");
    }
  }

  /**
   * Get volume progression (session-level)
   * If exerciseId is provided, plannedExerciseId must also be provided.
   */
  static async getVolumeProgression(
    userId: string,
    exerciseId?: string,
    plannedExerciseId?: string,
    timeframe: "month" | "quarter" | "year" = "quarter"
  ): Promise<VolumeDataPoint[]> {
    try {
      if (exerciseId && !plannedExerciseId) {
        throw new Error(
          "ProgressService.getVolumeProgression: plannedExerciseId is required when exerciseId is provided"
        );
      }

      const data = await databaseService.queryVolumeProgression(userId, exerciseId, plannedExerciseId, timeframe);
      return data;
    } catch (err) {
      logger.error("Failed to get volume progression", err, "progress");
      throw new Error("Failed to fetch volume progression");
    }
  }

  /**
   * Wrapper: get exercise volume progress with friendly timeframe option
   */
  static async getExerciseVolumeProgress(
    userId: string,
    exerciseId: string,
    plannedExerciseId: string,
    timeframeOption: string = "8w"
  ): Promise<VolumeDataPoint[]> {
    try {
      // Map timeframeOption to database timeframe
      let tf: "month" | "quarter" | "year" = "quarter";
      if (timeframeOption === "4w") tf = "month";
      else if (timeframeOption === "8w") tf = "quarter";
      else if (timeframeOption === "3m") tf = "quarter";
      else if (timeframeOption === "6m") tf = "year";
      else tf = "year";

      const data = await databaseService.queryVolumeProgression(userId, exerciseId, plannedExerciseId, tf);
      return data;
    } catch (err) {
      logger.error("Failed to get exercise volume progress", err, "progress");
      throw new Error("Failed to fetch exercise volume progress");
    }
  }

  static async getExercisePRs(
    userId: string,
    plannedExerciseId: string,
    exerciseId?: string,
    limit: number = 10
  ): Promise<PersonalRecord[]> {
    try {
      const records = await databaseService.queryPersonalRecords(userId, plannedExerciseId, exerciseId, limit);
      return records;
    } catch (err) {
      logger.error("Failed to get exercise PRs", err, "progress");
      throw new Error("Failed to fetch exercise PRs");
    }
  }

  static async getLastSessionsForExercise(
    userId: string,
    exerciseId: string,
    plannedExerciseId: string,
    limit: number = 5
  ): Promise<ExerciseSessionSummary[]> {
    try {
      // Reuse existing getExerciseHistory mapper for consistent formatting
      const sessions = await ProgressService.getExerciseHistory(userId, exerciseId, plannedExerciseId, limit, 60);
      return sessions;
    } catch (err) {
      logger.error("Failed to get last sessions for exercise", err, "progress");
      throw new Error("Failed to fetch last sessions for exercise");
    }
  }

  /**
   * Get personal records for a user (scoped to a planned exercise)
   */
  static async getPersonalRecords(
    userId: string,
    plannedExerciseId: string,
    exerciseId?: string,
    limit: number = 50
  ): Promise<PersonalRecord[]> {
    try {
      if (!plannedExerciseId || typeof plannedExerciseId !== "string") {
        throw new Error("ProgressService.getPersonalRecords: plannedExerciseId is required");
      }

      const records = await databaseService.queryPersonalRecords(userId, plannedExerciseId, exerciseId, limit);
      return records;
    } catch (err) {
      logger.error("Failed to get personal records", err, "progress");
      throw new Error("Failed to fetch personal records");
    }
  }

  /**
   * Export user progress data (workouts, exercises, personal records, analytics)
   */
  static async exportProgressData(userId: string, startDate: string, endDate: string, format: "json" | "csv" = "json") {
    try {
      const exported = await databaseService.exportProgressData(userId, startDate, endDate, format);
      return exported;
    } catch (err) {
      logger.error("Failed to export progress data", err, "progress");
      throw new Error("Failed to export progress data");
    }
  }
}

export default ProgressService;
