// ============================================================================
// USE PROGRESS DATA HOOK
// ============================================================================
// Progress data management hook with caching, real-time updates, and
// comprehensive error handling for workout history and analytics

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppSelector, useAppDispatch } from "./redux";
import { ProgressService, type ExerciseSessionSummary, type ProgressAnalytics } from "../services/progress.service";
import { logger } from "../utils/logger";
import type { WorkoutSession, PersonalRecord, StrengthDataPoint, VolumeDataPoint } from "../types";

// ============================================================================
// TYPES
// ============================================================================

export interface ProgressDataState {
  // Analytics
  analytics: ProgressAnalytics | null;
  analyticsLoading: boolean;
  analyticsError: string | null;

  // Workout History
  workoutHistory: WorkoutSession[];
  workoutHistoryLoading: boolean;
  workoutHistoryError: string | null;
  hasMoreWorkouts: boolean;
  totalWorkoutCount: number;

  // Exercise History
  exerciseHistory: Record<string, ExerciseSessionSummary[]>;
  exerciseHistoryLoading: Record<string, boolean>;
  exerciseHistoryError: Record<string, string | null>;

  // Personal Records
  personalRecords: PersonalRecord[];
  personalRecordsLoading: boolean;
  personalRecordsError: string | null;

  // Strength Progression
  strengthProgression: Record<string, StrengthDataPoint[]>;
  strengthProgressionLoading: Record<string, boolean>;
  strengthProgressionError: Record<string, string | null>;

  // Volume Progression
  volumeProgression: Record<string, VolumeDataPoint[]>;
  volumeProgressionLoading: Record<string, boolean>;
  volumeProgressionError: Record<string, string | null>;

  // Cache metadata
  lastUpdated: Record<string, number>;
  cacheExpiry: number; // 5 minutes
}

export interface UseProgressDataOptions {
  userId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  cacheTimeout?: number;
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

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useProgressData(options: UseProgressDataOptions = {}) {
  const {
    userId: optionsUserId,
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
    cacheTimeout = 300000, // 5 minutes
  } = options;

  const dispatch = useAppDispatch();
  const authUser = useAppSelector((state) => state.auth.user);
  const userId = optionsUserId || authUser?.id;

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [state, setState] = useState<ProgressDataState>({
    // Analytics
    analytics: null,
    analyticsLoading: false,
    analyticsError: null,

    // Workout History
    workoutHistory: [],
    workoutHistoryLoading: false,
    workoutHistoryError: null,
    hasMoreWorkouts: false,
    totalWorkoutCount: 0,

    // Exercise History
    exerciseHistory: {},
    exerciseHistoryLoading: {},
    exerciseHistoryError: {},

    // Personal Records
    personalRecords: [],
    personalRecordsLoading: false,
    personalRecordsError: null,

    // Strength Progression
    strengthProgression: {},
    strengthProgressionLoading: {},
    strengthProgressionError: {},

    // Volume Progression
    volumeProgression: {},
    volumeProgressionLoading: {},
    volumeProgressionError: {},

    // Cache metadata
    lastUpdated: {},
    cacheExpiry: cacheTimeout,
  });

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  const isCacheValid = useCallback(
    (key: string): boolean => {
      const lastUpdate = state.lastUpdated[key];
      if (!lastUpdate) return false;
      return Date.now() - lastUpdate < state.cacheExpiry;
    },
    [state.lastUpdated, state.cacheExpiry]
  );

  const updateCache = useCallback((key: string) => {
    setState((prev) => ({
      ...prev,
      lastUpdated: {
        ...prev.lastUpdated,
        [key]: Date.now(),
      },
    }));
  }, []);

  // ============================================================================
  // ANALYTICS METHODS
  // ============================================================================

  const fetchAnalytics = useCallback(
    async (timeframe: "month" | "quarter" | "year" = "quarter", forceRefresh = false) => {
      if (!userId) {
        logger.warn("No user ID provided for analytics fetch", {}, "progress");
        return;
      }

      const cacheKey = `analytics_${timeframe}`;

      if (!forceRefresh && isCacheValid(cacheKey) && state.analytics) {
        logger.info("Using cached analytics data", { timeframe }, "progress");
        return state.analytics;
      }

      setState((prev) => ({
        ...prev,
        analyticsLoading: true,
        analyticsError: null,
      }));

      try {
        logger.info("Fetching progress analytics", { userId, timeframe }, "progress");

        const analytics = await ProgressService.getProgressAnalytics(userId, timeframe);

        setState((prev) => ({
          ...prev,
          analytics,
          analyticsLoading: false,
          analyticsError: null,
        }));

        updateCache(cacheKey);

        logger.info(
          "Progress analytics fetched successfully",
          {
            userId,
            totalWorkouts: analytics.totalWorkouts,
          },
          "progress"
        );

        return analytics;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch analytics";
        logger.error("Failed to fetch progress analytics", error, "progress");

        setState((prev) => ({
          ...prev,
          analyticsLoading: false,
          analyticsError: errorMessage,
        }));

        throw error;
      }
    },
    [userId, isCacheValid, state.analytics, updateCache]
  );

  // ============================================================================
  // WORKOUT HISTORY METHODS
  // ============================================================================

  const fetchWorkoutHistory = useCallback(
    async (filters: WorkoutHistoryFilters = {}, page = 1, limit = 20, forceRefresh = false) => {
      if (!userId) {
        logger.warn("No user ID provided for workout history fetch", {}, "progress");
        return;
      }

      const cacheKey = `workout_history_${JSON.stringify(filters)}_${page}_${limit}`;

      if (!forceRefresh && isCacheValid(cacheKey) && page === 1 && state.workoutHistory.length > 0) {
        logger.info("Using cached workout history data", { filters, page }, "progress");
        return {
          workouts: state.workoutHistory,
          totalCount: state.totalWorkoutCount,
          hasMore: state.hasMoreWorkouts,
        };
      }

      setState((prev) => ({
        ...prev,
        workoutHistoryLoading: true,
        workoutHistoryError: null,
      }));

      try {
        logger.info("Fetching workout history", { userId, filters, page, limit }, "progress");

        const result = await ProgressService.getWorkoutHistory(userId, filters, page, limit);

        setState((prev) => ({
          ...prev,
          workoutHistory: page === 1 ? result.workouts : [...prev.workoutHistory, ...result.workouts],
          totalWorkoutCount: result.totalCount,
          hasMoreWorkouts: result.hasMore,
          workoutHistoryLoading: false,
          workoutHistoryError: null,
        }));

        updateCache(cacheKey);

        logger.info(
          "Workout history fetched successfully",
          {
            userId,
            workoutCount: result.workouts.length,
            totalCount: result.totalCount,
          },
          "progress"
        );

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch workout history";
        logger.error("Failed to fetch workout history", error, "progress");

        setState((prev) => ({
          ...prev,
          workoutHistoryLoading: false,
          workoutHistoryError: errorMessage,
        }));

        throw error;
      }
    },
    [userId, isCacheValid, state.workoutHistory, state.totalWorkoutCount, state.hasMoreWorkouts, updateCache]
  );

  // ============================================================================
  // EXERCISE HISTORY METHODS
  // ============================================================================

  const fetchExerciseHistory = useCallback(
    async (exerciseId: string, forceRefresh = false) => {
      if (!userId) {
        logger.warn("No user ID provided for exercise history fetch", {}, "progress");
        return;
      }

      const cacheKey = `exercise_history_${exerciseId}`;

      if (!forceRefresh && isCacheValid(cacheKey) && state.exerciseHistory[exerciseId]) {
        logger.info("Using cached exercise history data", { exerciseId }, "progress");
        return state.exerciseHistory[exerciseId];
      }

      setState((prev) => ({
        ...prev,
        exerciseHistoryLoading: {
          ...prev.exerciseHistoryLoading,
          [exerciseId]: true,
        },
        exerciseHistoryError: {
          ...prev.exerciseHistoryError,
          [exerciseId]: null,
        },
      }));

      try {
        logger.info("Fetching exercise history", { userId, exerciseId }, "progress");

        const history = await ProgressService.getExerciseHistory(userId, exerciseId);

        setState((prev) => ({
          ...prev,
          exerciseHistory: {
            ...prev.exerciseHistory,
            [exerciseId]: history,
          },
          exerciseHistoryLoading: {
            ...prev.exerciseHistoryLoading,
            [exerciseId]: false,
          },
          exerciseHistoryError: {
            ...prev.exerciseHistoryError,
            [exerciseId]: null,
          },
        }));

        updateCache(cacheKey);

        logger.info(
          "Exercise history fetched successfully",
          {
            userId,
            exerciseId,
            sessionCount: history.length,
          },
          "progress"
        );

        return history;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch exercise history";
        logger.error("Failed to fetch exercise history", error, "progress");

        setState((prev) => ({
          ...prev,
          exerciseHistoryLoading: {
            ...prev.exerciseHistoryLoading,
            [exerciseId]: false,
          },
          exerciseHistoryError: {
            ...prev.exerciseHistoryError,
            [exerciseId]: errorMessage,
          },
        }));

        throw error;
      }
    },
    [userId, isCacheValid, state.exerciseHistory, updateCache]
  );

  // ============================================================================
  // PERSONAL RECORDS METHODS
  // ============================================================================

  const fetchPersonalRecords = useCallback(
    async (exerciseId?: string, limit = 50, forceRefresh = false) => {
      if (!userId) {
        logger.warn("No user ID provided for personal records fetch", {}, "progress");
        return;
      }

      const cacheKey = `personal_records_${exerciseId || "all"}_${limit}`;

      if (!forceRefresh && isCacheValid(cacheKey) && state.personalRecords.length > 0) {
        logger.info("Using cached personal records data", { exerciseId, limit }, "progress");
        return state.personalRecords;
      }

      setState((prev) => ({
        ...prev,
        personalRecordsLoading: true,
        personalRecordsError: null,
      }));

      try {
        logger.info("Fetching personal records", { userId, exerciseId, limit }, "progress");

        const records = await ProgressService.getPersonalRecords(userId, exerciseId, limit);

        setState((prev) => ({
          ...prev,
          personalRecords: records,
          personalRecordsLoading: false,
          personalRecordsError: null,
        }));

        updateCache(cacheKey);

        logger.info(
          "Personal records fetched successfully",
          {
            userId,
            exerciseId,
            recordCount: records.length,
          },
          "progress"
        );

        return records;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch personal records";
        logger.error("Failed to fetch personal records", error, "progress");

        setState((prev) => ({
          ...prev,
          personalRecordsLoading: false,
          personalRecordsError: errorMessage,
        }));

        throw error;
      }
    },
    [userId, isCacheValid, state.personalRecords, updateCache]
  );

  // ============================================================================
  // STRENGTH PROGRESSION METHODS
  // ============================================================================

  const fetchStrengthProgression = useCallback(
    async (exerciseId: string, timeframe: "month" | "quarter" | "year" = "quarter", forceRefresh = false) => {
      if (!userId) {
        logger.warn("No user ID provided for strength progression fetch", {}, "progress");
        return;
      }

      const cacheKey = `strength_progression_${exerciseId}_${timeframe}`;

      if (!forceRefresh && isCacheValid(cacheKey) && state.strengthProgression[exerciseId]) {
        logger.info("Using cached strength progression data", { exerciseId, timeframe }, "progress");
        return state.strengthProgression[exerciseId];
      }

      setState((prev) => ({
        ...prev,
        strengthProgressionLoading: {
          ...prev.strengthProgressionLoading,
          [exerciseId]: true,
        },
        strengthProgressionError: {
          ...prev.strengthProgressionError,
          [exerciseId]: null,
        },
      }));

      try {
        logger.info("Fetching strength progression", { userId, exerciseId, timeframe }, "progress");

        const progression = await ProgressService.getStrengthProgression(userId, exerciseId, timeframe);

        setState((prev) => ({
          ...prev,
          strengthProgression: {
            ...prev.strengthProgression,
            [exerciseId]: progression,
          },
          strengthProgressionLoading: {
            ...prev.strengthProgressionLoading,
            [exerciseId]: false,
          },
          strengthProgressionError: {
            ...prev.strengthProgressionError,
            [exerciseId]: null,
          },
        }));

        updateCache(cacheKey);

        logger.info(
          "Strength progression fetched successfully",
          {
            userId,
            exerciseId,
            dataPoints: progression.length,
          },
          "progress"
        );

        return progression;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch strength progression";
        logger.error("Failed to fetch strength progression", error, "progress");

        setState((prev) => ({
          ...prev,
          strengthProgressionLoading: {
            ...prev.strengthProgressionLoading,
            [exerciseId]: false,
          },
          strengthProgressionError: {
            ...prev.strengthProgressionError,
            [exerciseId]: errorMessage,
          },
        }));

        throw error;
      }
    },
    [userId, isCacheValid, state.strengthProgression, updateCache]
  );

  // ============================================================================
  // VOLUME PROGRESSION METHODS
  // ============================================================================

  const fetchVolumeProgression = useCallback(
    async (exerciseId?: string, timeframe: "month" | "quarter" | "year" = "quarter", forceRefresh = false) => {
      if (!userId) {
        logger.warn("No user ID provided for volume progression fetch", {}, "progress");
        return;
      }

      const cacheKey = `volume_progression_${exerciseId || "all"}_${timeframe}`;

      if (!forceRefresh && isCacheValid(cacheKey) && state.volumeProgression[exerciseId || "all"]) {
        logger.info("Using cached volume progression data", { exerciseId, timeframe }, "progress");
        return state.volumeProgression[exerciseId || "all"];
      }

      setState((prev) => ({
        ...prev,
        volumeProgressionLoading: {
          ...prev.volumeProgressionLoading,
          [exerciseId || "all"]: true,
        },
        volumeProgressionError: {
          ...prev.volumeProgressionError,
          [exerciseId || "all"]: null,
        },
      }));

      try {
        logger.info("Fetching volume progression", { userId, exerciseId, timeframe }, "progress");

        const progression = await ProgressService.getVolumeProgression(userId, exerciseId, timeframe);

        setState((prev) => ({
          ...prev,
          volumeProgression: {
            ...prev.volumeProgression,
            [exerciseId || "all"]: progression,
          },
          volumeProgressionLoading: {
            ...prev.volumeProgressionLoading,
            [exerciseId || "all"]: false,
          },
          volumeProgressionError: {
            ...prev.volumeProgressionError,
            [exerciseId || "all"]: null,
          },
        }));

        updateCache(cacheKey);

        logger.info(
          "Volume progression fetched successfully",
          {
            userId,
            exerciseId,
            dataPoints: progression.length,
          },
          "progress"
        );

        return progression;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch volume progression";
        logger.error("Failed to fetch volume progression", error, "progress");

        setState((prev) => ({
          ...prev,
          volumeProgressionLoading: {
            ...prev.volumeProgressionLoading,
            [exerciseId || "all"]: false,
          },
          volumeProgressionError: {
            ...prev.volumeProgressionError,
            [exerciseId || "all"]: errorMessage,
          },
        }));

        throw error;
      }
    },
    [userId, isCacheValid, state.volumeProgression, updateCache]
  );

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  const refreshAllData = useCallback(async () => {
    if (!userId) return;

    logger.info("Refreshing all progress data", { userId }, "progress");

    try {
      await Promise.allSettled([
        fetchAnalytics("quarter", true),
        fetchWorkoutHistory({}, 1, 20, true),
        fetchPersonalRecords(undefined, 50, true),
      ]);

      logger.info("All progress data refreshed successfully", { userId }, "progress");
    } catch (error) {
      logger.error("Failed to refresh all progress data", error, "progress");
    }
  }, [userId, fetchAnalytics, fetchWorkoutHistory, fetchPersonalRecords]);

  const clearCache = useCallback(() => {
    setState((prev) => ({
      ...prev,
      lastUpdated: {},
      analytics: null,
      workoutHistory: [],
      exerciseHistory: {},
      personalRecords: [],
      strengthProgression: {},
      volumeProgression: {},
    }));

    logger.info("Progress data cache cleared", { userId }, "progress");
  }, [userId]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const isLoading = useMemo(() => {
    return (
      state.analyticsLoading ||
      state.workoutHistoryLoading ||
      state.personalRecordsLoading ||
      Object.values(state.exerciseHistoryLoading).some(Boolean) ||
      Object.values(state.strengthProgressionLoading).some(Boolean) ||
      Object.values(state.volumeProgressionLoading).some(Boolean)
    );
  }, [
    state.analyticsLoading,
    state.workoutHistoryLoading,
    state.personalRecordsLoading,
    state.exerciseHistoryLoading,
    state.strengthProgressionLoading,
    state.volumeProgressionLoading,
  ]);

  const hasError = useMemo(() => {
    return !!(
      state.analyticsError ||
      state.workoutHistoryError ||
      state.personalRecordsError ||
      Object.values(state.exerciseHistoryError).some(Boolean) ||
      Object.values(state.strengthProgressionError).some(Boolean) ||
      Object.values(state.volumeProgressionError).some(Boolean)
    );
  }, [
    state.analyticsError,
    state.workoutHistoryError,
    state.personalRecordsError,
    state.exerciseHistoryError,
    state.strengthProgressionError,
    state.volumeProgressionError,
  ]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || !userId) return;

    const interval = setInterval(() => {
      refreshAllData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, userId, refreshInterval, refreshAllData]);

  // Initial data load
  useEffect(() => {
    if (userId && !state.analytics) {
      fetchAnalytics();
    }
  }, [userId, state.analytics, fetchAnalytics]);

  // ============================================================================
  // RETURN HOOK INTERFACE
  // ============================================================================

  return {
    // State
    ...state,
    isLoading,
    hasError,

    // Methods
    fetchAnalytics,
    fetchWorkoutHistory,
    fetchExerciseHistory,
    fetchPersonalRecords,
    fetchStrengthProgression,
    fetchVolumeProgression,
    refreshAllData,
    clearCache,

    // Utilities
    isCacheValid,
  };
}

export default useProgressData;
