// ============================================================================
// PROGRESS SLICE
// ============================================================================
// Progress tracking and analytics state management with strength calculations,
// personal records, and performance metrics

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { logger } from "../../utils/logger";
import type { ProgressMetrics, VolumeDataPoint, StrengthDataPoint, ExerciseSet, WorkoutSession } from "../../types";

// ============================================================================
// INITIAL STATE
// ============================================================================

interface ProgressState {
  metrics: Record<string, ProgressMetrics>; // exerciseId -> metrics
  personalRecords: Record<string, PersonalRecord[]>; // exerciseId -> PRs
  strengthTrends: Record<string, StrengthTrend>; // exerciseId -> trend
  volumeTrends: Record<string, VolumeTrend>; // exerciseId -> trend
  loading: boolean;
  error?: string;
}

interface PersonalRecord {
  id: string;
  exerciseId: string;
  plannedExerciseId: string;
  type: "1rm" | "volume" | "reps" | "endurance";
  value: number;
  weight?: number;
  reps?: number;
  date: string;
  sessionId: string;
}

interface StrengthTrend {
  exerciseId: string;
  trend: "increasing" | "decreasing" | "stable";
  changePercent: number;
  timeframe: "week" | "month" | "quarter";
  lastCalculated: string;
}

interface VolumeTrend {
  exerciseId: string;
  trend: "increasing" | "decreasing" | "stable";
  changePercent: number;
  averageVolume: number;
  timeframe: "week" | "month" | "quarter";
  lastCalculated: string;
}

const initialState: ProgressState = {
  metrics: {},
  personalRecords: {},
  strengthTrends: {},
  volumeTrends: {},
  loading: false,
  error: undefined,
};

// ============================================================================
// ASYNC THUNKS
// ============================================================================

/**
 * Calculate progress metrics for an exercise
 */
export const calculateProgressMetrics = createAsyncThunk(
  "progress/calculateMetrics",
  async (
    data: {
      exerciseId: string;
      plannedExerciseId: string;
      workoutSessions: WorkoutSession[];
      timeframe?: "month" | "quarter" | "year";
    },
    { rejectWithValue, getState }
  ) => {
    try {
      const { exerciseId, plannedExerciseId, workoutSessions, timeframe = "quarter" } = data;
      if (!plannedExerciseId || typeof plannedExerciseId !== "string") {
        throw new Error("calculateProgressMetrics: plannedExerciseId is required");
      }
      const state = getState() as any;
      const userId = state.auth.user?.id;

      logger.info("Calculating progress metrics", { exerciseId, timeframe }, "progress", userId);

      // Filter sessions for this exercise within timeframe
      const cutoffDate = getCutoffDate(timeframe);
      const relevantSessions = workoutSessions.filter(
        (session) =>
          session.sets?.some((set) => set.exerciseId === exerciseId) && new Date(session.startedAt) >= cutoffDate
      );

      // Extract all sets for this exercise
      const allSets = relevantSessions
        .flatMap((session) => session.sets || [])
        .filter((set) => set.exerciseId === exerciseId && !set.isWarmup)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (allSets.length === 0) {
        return {
          plannedExerciseId,
          exerciseId,
          metrics: null,
        };
      }

      // Calculate volume progression
      const volumeProgression = calculateVolumeProgression(allSets);

      // Calculate strength progression
      const strengthProgression = calculateStrengthProgression(allSets);

      // Calculate current metrics
      const recentSets = allSets.slice(-10); // Last 10 sets
      const currentWeight = Math.max(...recentSets.map((set) => set.weightKg || 0));
      const currentReps = Math.max(...recentSets.map((set) => set.reps));
      const currentRpe = recentSets
        .filter((set) => set.rpe)
        .reduce((sum, set, _, arr) => sum + (set.rpe || 0) / arr.length, 0);

      // Calculate estimated 1RM
      const oneRepMax = calculateOneRepMax(currentWeight, currentReps, currentRpe);

      // Calculate strength score (relative to bodyweight if available)
      const userWeight = state.auth.user?.user_metadata?.weight_kg || 70;
      const strengthScore = calculateStrengthScore(oneRepMax, userWeight, exerciseId);

      const metrics: ProgressMetrics = {
        exerciseId,
        userId,
        currentWeight,
        currentReps,
        currentRpe,
        lastProgression: new Date().toISOString(),
        strengthScore,
        oneRepMax,
        volumeProgression,
        strengthProgression,
        totalWorkouts: relevantSessions.length,
        totalVolumeKg: allSets.reduce((sum, set) => sum + (set.weightKg || 0) * set.reps, 0),
        averageSessionDuration:
          relevantSessions.reduce((sum, session) => sum + (session.durationMinutes || 0), 0) / relevantSessions.length,
        strengthGains:
          strengthProgression.length > 1
            ? (strengthProgression[strengthProgression.length - 1].estimatedOneRepMax || 0) -
              (strengthProgression[0].estimatedOneRepMax || 0)
            : 0,
        consistencyScore: Math.min(100, (relevantSessions.length / 12) * 100), // Based on 12 sessions in timeframe
        lastUpdated: new Date().toISOString(),
      };

      logger.info(
        "Progress metrics calculated",
        {
          exerciseId,
          currentWeight,
          oneRepMax,
          strengthScore,
        },
        "progress",
        userId
      );

      return {
        plannedExerciseId,
        exerciseId,
        metrics,
      };
    } catch (error) {
      logger.error("Failed to calculate progress metrics", error, "progress");
      return rejectWithValue("Failed to calculate progress metrics");
    }
  }
);

/**
 * Update personal records
 */
export const updatePersonalRecords = createAsyncThunk(
  "progress/updatePersonalRecords",
  async (
    data: {
      exerciseId: string;
      newSets: ExerciseSet[];
      sessionId: string;
      plannedExerciseId: string;
    },
    { rejectWithValue, getState }
  ) => {
    try {
      const { exerciseId, newSets, sessionId, plannedExerciseId } = data;
      if (!plannedExerciseId || typeof plannedExerciseId !== "string") {
        throw new Error("updatePersonalRecords: plannedExerciseId is required");
      }
      const state = getState() as any;
      const userId = state.auth.user?.id;
      const existingPRs = state.progress.personalRecords[plannedExerciseId] || [];

      logger.info("Checking for new personal records", { exerciseId, setsCount: newSets.length }, "progress", userId);

      const newPRs: PersonalRecord[] = [];

      // Check for new PRs in the new sets
      for (const set of newSets.filter((s) => !s.isWarmup)) {
        const { weightKg, reps, rpe } = set;

        if (!weightKg || !reps) continue;

        // Check 1RM PR
        const estimated1RM = calculateOneRepMax(weightKg, reps, rpe);
        const current1RMPR = existingPRs
          .filter((pr: PersonalRecord) => pr.type === "1rm")
          .sort((a: PersonalRecord, b: PersonalRecord) => b.value - a.value)[0];

        if (!current1RMPR || estimated1RM > current1RMPR.value) {
          newPRs.push({
            id: `pr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            exerciseId,
            plannedExerciseId,
            type: "1rm",
            value: estimated1RM,
            weight: weightKg,
            reps,
            date: set.createdAt,
            sessionId,
          });
        }

        // Check volume PR (weight × reps)
        const volume = weightKg * reps;
        const currentVolumePR = existingPRs
          .filter((pr: PersonalRecord) => pr.type === "volume")
          .sort((a: PersonalRecord, b: PersonalRecord) => b.value - a.value)[0];

        if (!currentVolumePR || volume > currentVolumePR.value) {
          newPRs.push({
            id: `pr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            exerciseId,
            plannedExerciseId,
            type: "volume",
            value: volume,
            weight: weightKg,
            reps,
            date: set.createdAt,
            sessionId,
          });
        }

        // Check rep PR at same weight
        const sameWeightPRs = existingPRs.filter(
          (pr: PersonalRecord) => pr.type === "reps" && Math.abs((pr.weight || 0) - weightKg) < 0.5
        );
        const currentRepPR = sameWeightPRs.sort((a: PersonalRecord, b: PersonalRecord) => b.value - a.value)[0];

        if (!currentRepPR || reps > currentRepPR.value) {
          newPRs.push({
            id: `pr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            exerciseId,
            plannedExerciseId,
            type: "reps",
            value: reps,
            weight: weightKg,
            reps,
            date: set.createdAt,
            sessionId,
          });
        }
      }

      if (newPRs.length > 0) {
        logger.info(
          "New personal records achieved",
          {
            exerciseId,
            plannedExerciseId,
            newPRCount: newPRs.length,
            types: newPRs.map((pr) => pr.type),
          },
          "progress",
          userId
        );
      }

      return {
        plannedExerciseId,
        exerciseId,
        newPRs,
      };
    } catch (error) {
      logger.error("Failed to update personal records", error, "progress");
      return rejectWithValue("Failed to update personal records");
    }
  }
);

/**
 * Calculate strength and volume trends
 */
export const calculateTrends = createAsyncThunk(
  "progress/calculateTrends",
  async (
    data: {
      exerciseId: string;
      plannedExerciseId: string;
      timeframe: "week" | "month" | "quarter";
    },
    { rejectWithValue, getState }
  ) => {
    try {
      const { exerciseId, plannedExerciseId, timeframe } = data;
      if (!plannedExerciseId || typeof plannedExerciseId !== "string") {
        throw new Error("calculateTrends: plannedExerciseId is required");
      }
      const state = getState() as any;
      const userId = state.auth.user?.id;
      const metrics = state.progress.metrics[plannedExerciseId];

      if (!metrics) {
        return rejectWithValue("No metrics available for trend calculation");
      }

      logger.info("Calculating trends", { exerciseId, timeframe }, "progress", userId);

      // Calculate strength trend
      const strengthTrend = calculateStrengthTrend(metrics.strengthProgression, timeframe);

      // Calculate volume trend
      const volumeTrend = calculateVolumeTrend(metrics.volumeProgression, timeframe);

      logger.info(
        "Trends calculated",
        {
          exerciseId,
          strengthTrend: strengthTrend.trend,
          volumeTrend: volumeTrend.trend,
        },
        "progress",
        userId
      );

      return {
        plannedExerciseId,
        exerciseId,
        strengthTrend,
        volumeTrend,
      };
    } catch (error) {
      logger.error("Failed to calculate trends", error, "progress");
      return rejectWithValue("Failed to calculate trends");
    }
  }
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getCutoffDate(timeframe: "month" | "quarter" | "year"): Date {
  const now = new Date();
  switch (timeframe) {
    case "month":
      return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case "quarter":
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case "year":
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    default:
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  }
}

function calculateVolumeProgression(sets: ExerciseSet[]): VolumeDataPoint[] {
  const sessionMap = new Map<string, ExerciseSet[]>();

  // Group sets by session
  sets.forEach((set) => {
    if (!sessionMap.has(set.sessionId)) {
      sessionMap.set(set.sessionId, []);
    }
    sessionMap.get(set.sessionId)!.push(set);
  });

  // Calculate volume per session
  return Array.from(sessionMap.entries())
    .map(([sessionId, sessionSets]) => {
      const totalVolume = sessionSets.reduce((sum, set) => {
        return sum + (set.weightKg || 0) * set.reps;
      }, 0);

      const averageRpe = sessionSets
        .filter((set) => set.rpe)
        .reduce((sum, set, _, arr) => sum + (set.rpe || 0) / arr.length, 0);

      return {
        date: sessionSets[0].createdAt,
        totalVolume: totalVolume,
        sessionCount: 1,
        volume: totalVolume,
        sets: sessionSets.length,
        averageRpe: averageRpe || undefined,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function calculateStrengthProgression(sets: ExerciseSet[]): StrengthDataPoint[] {
  return sets
    .filter((set) => set.weightKg && set.reps)
    .map((set) => {
      const estimatedOneRepMax = calculateOneRepMax(set.weightKg!, set.reps, set.rpe);

      return {
        date: set.createdAt,
        exerciseId: "", // Will be set by caller
        oneRepMax: estimatedOneRepMax,
        estimatedMax: estimatedOneRepMax,
        estimatedOneRepMax,
        weight: set.weightKg!,
        reps: set.reps,
        rpe: set.rpe,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function calculateOneRepMax(weight: number, reps: number, rpe?: number): number {
  if (reps === 1) return weight;

  // Use RPE-based calculation if available
  if (rpe && rpe >= 6 && rpe <= 10) {
    const repsInReserve = 10 - rpe;
    const totalReps = reps + repsInReserve;
    return weight * (1 + totalReps / 30); // Modified Epley formula
  }

  // Fallback to Epley formula
  return weight * (1 + reps / 30);
}

function calculateStrengthScore(oneRepMax: number, bodyWeight: number, exerciseId: string): number {
  // Strength standards relative to bodyweight
  const strengthStandards: Record<string, number> = {
    // These would be exercise-specific standards
    squat: 1.5, // 1.5x bodyweight for intermediate
    deadlift: 2.0, // 2x bodyweight for intermediate
    bench: 1.25, // 1.25x bodyweight for intermediate
    default: 1.0, // 1x bodyweight default
  };

  const exerciseName = exerciseId.toLowerCase();
  let standard = strengthStandards.default;

  // Match exercise to standard
  for (const [key, value] of Object.entries(strengthStandards)) {
    if (exerciseName.includes(key)) {
      standard = value;
      break;
    }
  }

  const targetWeight = bodyWeight * standard;
  return Math.round((oneRepMax / targetWeight) * 100);
}

function calculateStrengthTrend(
  strengthProgression: StrengthDataPoint[],
  timeframe: "week" | "month" | "quarter"
): StrengthTrend {
  const cutoffDate = getCutoffDate(timeframe === "week" ? "month" : timeframe);
  const recentData = strengthProgression.filter((point) => new Date(point.date) >= cutoffDate);

  if (recentData.length < 2) {
    return {
      exerciseId: "",
      trend: "stable",
      changePercent: 0,
      timeframe,
      lastCalculated: new Date().toISOString(),
    };
  }

  const firstValue = recentData[0].estimatedOneRepMax || 0;
  const lastValue = recentData[recentData.length - 1].estimatedOneRepMax || 0;
  const changePercent = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

  let trend: "increasing" | "decreasing" | "stable";
  if (changePercent > 2) {
    trend = "increasing";
  } else if (changePercent < -2) {
    trend = "decreasing";
  } else {
    trend = "stable";
  }

  return {
    exerciseId: "",
    trend,
    changePercent: Math.round(changePercent * 10) / 10,
    timeframe,
    lastCalculated: new Date().toISOString(),
  };
}

function calculateVolumeTrend(
  volumeProgression: VolumeDataPoint[],
  timeframe: "week" | "month" | "quarter"
): VolumeTrend {
  const cutoffDate = getCutoffDate(timeframe === "week" ? "month" : timeframe);
  const recentData = volumeProgression.filter((point) => new Date(point.date) >= cutoffDate);

  if (recentData.length < 2) {
    return {
      exerciseId: "",
      trend: "stable",
      changePercent: 0,
      averageVolume: 0,
      timeframe,
      lastCalculated: new Date().toISOString(),
    };
  }

  const averageVolume = recentData.reduce((sum, point) => sum + (point.volume || 0), 0) / recentData.length;

  const firstHalf = recentData.slice(0, Math.floor(recentData.length / 2));
  const secondHalf = recentData.slice(Math.floor(recentData.length / 2));

  const firstHalfAvg = firstHalf.reduce((sum, point) => sum + (point.volume || 0), 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, point) => sum + (point.volume || 0), 0) / secondHalf.length;

  const changePercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

  let trend: "increasing" | "decreasing" | "stable";
  if (changePercent > 5) {
    trend = "increasing";
  } else if (changePercent < -5) {
    trend = "decreasing";
  } else {
    trend = "stable";
  }

  return {
    exerciseId: "",
    trend,
    changePercent: Math.round(changePercent * 10) / 10,
    averageVolume: Math.round(averageVolume),
    timeframe,
    lastCalculated: new Date().toISOString(),
  };
}

// ============================================================================
// PROGRESS SLICE
// ============================================================================

const progressSlice = createSlice({
  name: "progress",
  initialState,
  reducers: {
    // Clear progress data (for logout)
    clearProgressData: (state) => {
      state.metrics = {};
      state.personalRecords = {};
      state.strengthTrends = {};
      state.volumeTrends = {};
      state.loading = false;
      state.error = undefined;
      logger.info("Progress data cleared", undefined, "progress");
    },

    // Set loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    // Clear error
    clearError: (state) => {
      state.error = undefined;
    },

    // Manually add personal record
    addPersonalRecord: (state, action: PayloadAction<PersonalRecord>) => {
      const { exerciseId, plannedExerciseId } = action.payload;
      const key = plannedExerciseId || exerciseId;
      if (!state.personalRecords[key]) {
        state.personalRecords[key] = [];
      }
      state.personalRecords[key].push(action.payload);

      // Sort by value descending
      state.personalRecords[key].sort((a, b) => b.value - a.value);

      logger.info(
        "Personal record added manually",
        {
          exerciseId,
          plannedExerciseId,
          type: action.payload.type,
          value: action.payload.value,
        },
        "progress"
      );
    },

    // Remove personal record
    removePersonalRecord: (state, action: PayloadAction<{ exerciseId: string; recordId: string }>) => {
      const { exerciseId, recordId } = action.payload;
      if (state.personalRecords[exerciseId]) {
        state.personalRecords[exerciseId] = state.personalRecords[exerciseId].filter((pr) => pr.id !== recordId);
        logger.info("Personal record removed", { exerciseId, recordId }, "progress");
      }
    },
  },
  extraReducers: (builder) => {
    // Calculate Progress Metrics
    builder
      .addCase(calculateProgressMetrics.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(calculateProgressMetrics.fulfilled, (state, action) => {
        state.loading = false;
        const { plannedExerciseId, exerciseId, metrics } = action.payload;

        if (metrics) {
          state.metrics[plannedExerciseId] = metrics;
        }
      })
      .addCase(calculateProgressMetrics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Update Personal Records
    builder
      .addCase(updatePersonalRecords.pending, (state) => {
        // Don't set loading for PR updates
      })
      .addCase(updatePersonalRecords.fulfilled, (state, action) => {
        const { plannedExerciseId, exerciseId, newPRs } = action.payload;

        if (!state.personalRecords[plannedExerciseId]) {
          state.personalRecords[plannedExerciseId] = [];
        }

        // Add new PRs and sort
        state.personalRecords[plannedExerciseId].push(...newPRs);
        state.personalRecords[plannedExerciseId].sort((a, b) => b.value - a.value);
      })
      .addCase(updatePersonalRecords.rejected, (state, action) => {
        logger.error("Update personal records failed", action.payload, "progress");
      });

    // Calculate Trends
    builder
      .addCase(calculateTrends.pending, (state) => {
        // Don't set loading for trend calculations
      })
      .addCase(calculateTrends.fulfilled, (state, action) => {
        const { plannedExerciseId, exerciseId, strengthTrend, volumeTrend } = action.payload;

        state.strengthTrends[plannedExerciseId] = { ...strengthTrend, exerciseId };
        state.volumeTrends[plannedExerciseId] = { ...volumeTrend, exerciseId };
      })
      .addCase(calculateTrends.rejected, (state, action) => {
        logger.error("Calculate trends failed", action.payload, "progress");
      });
  },
});

// ============================================================================
// ACTIONS AND SELECTORS
// ============================================================================

export const { clearProgressData, setLoading, clearError, addPersonalRecord, removePersonalRecord } =
  progressSlice.actions;

// Selectors
export const selectProgress = (state: { progress: ProgressState }) => state.progress;
export const selectProgressMetrics = (state: { progress: ProgressState }) => state.progress.metrics;
export const selectPersonalRecords = (state: { progress: ProgressState }) => state.progress.personalRecords;
export const selectStrengthTrends = (state: { progress: ProgressState }) => state.progress.strengthTrends;
export const selectVolumeTrends = (state: { progress: ProgressState }) => state.progress.volumeTrends;
export const selectProgressLoading = (state: { progress: ProgressState }) => state.progress.loading;
export const selectProgressError = (state: { progress: ProgressState }) => state.progress.error;

// Computed selectors
export const selectMetricsForExercise = (exerciseId: string) => (state: { progress: ProgressState }) =>
  state.progress.metrics[exerciseId];

export const selectPersonalRecordsForExercise = (exerciseId: string) => (state: { progress: ProgressState }) =>
  state.progress.personalRecords[exerciseId] || [];

export const selectStrengthTrendForExercise = (exerciseId: string) => (state: { progress: ProgressState }) =>
  state.progress.strengthTrends[exerciseId];

export const selectVolumeTrendForExercise = (exerciseId: string) => (state: { progress: ProgressState }) =>
  state.progress.volumeTrends[exerciseId];

export const selectTopPersonalRecords =
  (limit: number = 5) =>
  (state: { progress: ProgressState }) => {
    const allPRs = Object.values(state.progress.personalRecords).flat();
    return allPRs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, limit);
  };

// New selectors keyed by plannedExerciseId (preferred)
export const selectMetricsForPlannedExercise = (plannedExerciseId: string) => (state: { progress: ProgressState }) =>
  state.progress.metrics[plannedExerciseId];

export const selectPersonalRecordsForPlannedExercise =
  (plannedExerciseId: string) => (state: { progress: ProgressState }) =>
    state.progress.personalRecords[plannedExerciseId] || [];

export const selectStrengthTrendForPlannedExercise =
  (plannedExerciseId: string) => (state: { progress: ProgressState }) =>
    state.progress.strengthTrends[plannedExerciseId];

export const selectVolumeTrendForPlannedExercise =
  (plannedExerciseId: string) => (state: { progress: ProgressState }) =>
    state.progress.volumeTrends[plannedExerciseId];

export const selectOverallStrengthScore = (state: { progress: ProgressState }) => {
  const metrics = Object.values(state.progress.metrics);
  if (metrics.length === 0) return 0;

  const totalScore = metrics.reduce((sum, metric) => sum + (metric.strengthScore || 0), 0);
  return Math.round(totalScore / metrics.length);
};

export default progressSlice.reducer;
