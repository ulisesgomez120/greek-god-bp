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

      const personalRecords = await databaseService.queryPersonalRecords(userId);
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
    plannedExerciseId?: string
  ): Promise<ExerciseSessionSummary[]> {
    try {
      const summaries = await databaseService.queryExerciseHistory(userId, exerciseId, plannedExerciseId, 6);
      return summaries;
    } catch (err) {
      logger.error("Failed to get exercise history", err, "progress");
      throw new Error("Failed to fetch exercise history");
    }
  }

  /**
   * Get strength progression for charts
   */
  static async getStrengthProgression(
    userId: string,
    exerciseId: string,
    timeframe: "month" | "quarter" | "year" = "quarter"
  ): Promise<StrengthDataPoint[]> {
    try {
      const data = await databaseService.queryStrengthProgression(userId, exerciseId, timeframe);
      return data;
    } catch (err) {
      logger.error("Failed to get strength progression", err, "progress");
      throw new Error("Failed to fetch strength progression");
    }
  }

  /**
   * Get volume progression (session-level)
   */
  static async getVolumeProgression(
    userId: string,
    exerciseId?: string,
    timeframe: "month" | "quarter" | "year" = "quarter"
  ): Promise<VolumeDataPoint[]> {
    try {
      const data = await databaseService.queryVolumeProgression(userId, exerciseId, timeframe);
      return data;
    } catch (err) {
      logger.error("Failed to get volume progression", err, "progress");
      throw new Error("Failed to fetch volume progression");
    }
  }

  /**
   * Get personal records for a user
   */
  static async getPersonalRecords(userId: string, exerciseId?: string, limit: number = 50): Promise<PersonalRecord[]> {
    try {
      const records = await databaseService.queryPersonalRecords(userId, exerciseId, limit);
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
