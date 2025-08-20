// ============================================================================
// WORKOUT SLICE
// ============================================================================
// Workout session state management with offline queue, progression tracking,
// and real-time synchronization

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { logger } from "../../utils/logger";
import type {
  WorkoutState,
  WorkoutSession,
  WorkoutPlan,
  Exercise,
  ExerciseSet,
  ProgressionRecommendation,
  ExperienceLevel,
} from "../../types";

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: WorkoutState = {
  currentWorkout: null,
  isActive: false,
  currentExercise: 0,
  currentSet: 0,
  plans: [],
  exercises: [],
  progressMetrics: {},
};

// ============================================================================
// ASYNC THUNKS
// ============================================================================

/**
 * Start a new workout session
 */
export const startWorkout = createAsyncThunk(
  "workout/startWorkout",
  async (
    workoutData: {
      planId?: string;
      sessionId?: string;
      name: string;
      exercises: string[]; // Exercise IDs
    },
    { rejectWithValue, getState }
  ) => {
    try {
      const state = getState() as any;
      const userId = state.auth.user?.id;

      if (!userId) {
        return rejectWithValue("User not authenticated");
      }

      const newWorkout: WorkoutSession = {
        id: `workout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        planId: workoutData.planId,
        sessionId: workoutData.sessionId,
        name: workoutData.name,
        startedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      logger.info("Starting new workout", { workoutId: newWorkout.id, name: workoutData.name }, "workout", userId);

      return {
        workout: newWorkout,
        exercises: workoutData.exercises,
      };
    } catch (error) {
      logger.error("Failed to start workout", error, "workout");
      return rejectWithValue("Failed to start workout");
    }
  }
);

/**
 * Complete current workout session
 */
export const completeWorkout = createAsyncThunk(
  "workout/completeWorkout",
  async (
    completionData: {
      notes?: string;
      totalVolumeKg?: number;
      averageRpe?: number;
    },
    { rejectWithValue, getState }
  ) => {
    try {
      const state = getState() as any;
      const currentWorkout = state.workout.currentWorkout;
      const userId = state.auth.user?.id;

      if (!currentWorkout) {
        return rejectWithValue("No active workout to complete");
      }

      const completedWorkout: WorkoutSession = {
        ...currentWorkout,
        completedAt: new Date().toISOString(),
        durationMinutes: Math.round(
          (new Date().getTime() - new Date(currentWorkout.startedAt).getTime()) / (1000 * 60)
        ),
        notes: completionData.notes,
        totalVolumeKg: completionData.totalVolumeKg,
        averageRpe: completionData.averageRpe,
        updatedAt: new Date().toISOString(),
      };

      logger.info(
        "Completing workout",
        {
          workoutId: completedWorkout.id,
          duration: completedWorkout.durationMinutes,
          volume: completedWorkout.totalVolumeKg,
        },
        "workout",
        userId
      );

      return completedWorkout;
    } catch (error) {
      logger.error("Failed to complete workout", error, "workout");
      return rejectWithValue("Failed to complete workout");
    }
  }
);

/**
 * Add exercise set to current workout
 */
export const addExerciseSet = createAsyncThunk(
  "workout/addExerciseSet",
  async (
    setData: {
      exerciseId: string;
      weightKg?: number;
      reps: number;
      rpe?: number;
      isWarmup?: boolean;
      restSeconds?: number;
      notes?: string;
    },
    { rejectWithValue, getState }
  ) => {
    try {
      const state = getState() as any;
      const currentWorkout = state.workout.currentWorkout;
      const userId = state.auth.user?.id;

      if (!currentWorkout) {
        return rejectWithValue("No active workout to add set to");
      }

      // Get current set number for this exercise
      const existingSets =
        state.workout.currentWorkout?.sets?.filter((set: ExerciseSet) => set.exerciseId === setData.exerciseId) || [];

      const newSet: ExerciseSet = {
        id: `set_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId: currentWorkout.id,
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

      logger.info(
        "Adding exercise set",
        {
          exerciseId: setData.exerciseId,
          setNumber: newSet.setNumber,
          weight: setData.weightKg,
          reps: setData.reps,
          rpe: setData.rpe,
        },
        "workout",
        userId
      );

      return newSet;
    } catch (error) {
      logger.error("Failed to add exercise set", error, "workout");
      return rejectWithValue("Failed to add exercise set");
    }
  }
);

/**
 * Calculate progression recommendation for an exercise
 */
export const calculateProgression = createAsyncThunk(
  "workout/calculateProgression",
  async (
    data: {
      exerciseId: string;
      experienceLevel: ExperienceLevel;
      recentSets: ExerciseSet[];
    },
    { rejectWithValue, getState }
  ) => {
    try {
      const { exerciseId, experienceLevel, recentSets } = data;
      const state = getState() as any;
      const userId = state.auth.user?.id;

      logger.info("Calculating progression", { exerciseId, experienceLevel }, "workout", userId);

      // Calculate average RPE from recent working sets (non-warmup)
      const workingSets = recentSets.filter((set) => !set.isWarmup && set.rpe);
      const averageRpe =
        workingSets.length > 0 ? workingSets.reduce((sum, set) => sum + (set.rpe || 0), 0) / workingSets.length : 0;

      let recommendation: ProgressionRecommendation;

      switch (experienceLevel) {
        case "untrained":
          recommendation = calculateUntrainedProgression(recentSets);
          break;
        case "beginner":
          recommendation = calculateBeginnerProgression(recentSets, averageRpe);
          break;
        case "early_intermediate":
          recommendation = calculateRpeBasedProgression(recentSets, averageRpe);
          break;
        default:
          recommendation = calculateConservativeProgression(recentSets, averageRpe);
      }

      logger.info(
        "Progression calculated",
        {
          exerciseId,
          shouldProgress: recommendation.shouldProgress,
          reason: recommendation.reason,
        },
        "workout",
        userId
      );

      return {
        exerciseId,
        recommendation,
      };
    } catch (error) {
      logger.error("Failed to calculate progression", error, "workout");
      return rejectWithValue("Failed to calculate progression");
    }
  }
);

// ============================================================================
// PROGRESSION ALGORITHMS
// ============================================================================

/**
 * Untrained progression: Focus on form consistency
 */
function calculateUntrainedProgression(recentSets: ExerciseSet[]): ProgressionRecommendation {
  const workingSets = recentSets.filter((set) => !set.isWarmup);

  if (workingSets.length < 6) {
    // Less than 2 weeks of consistent training
    return {
      shouldProgress: false,
      reason: "Focus on perfecting form and technique. Use the same weight for at least 3 weeks.",
      alternativeAction: "Practice proper form and breathing technique",
    };
  }

  // Check for consistency in reps and form
  const recentReps = workingSets.slice(-6).map((set) => set.reps);
  const isConsistent = recentReps.every((reps) => reps >= recentReps[0] * 0.9); // Within 10% of target

  if (!isConsistent) {
    return {
      shouldProgress: false,
      reason: "Work on consistency before adding weight. Complete all target reps with good form.",
      alternativeAction: "Focus on completing all prescribed reps",
    };
  }

  return {
    shouldProgress: true,
    recommendedIncrease: 2.5, // Very small increases for untrained
    reason: "Good form consistency achieved. Ready for small weight increase.",
  };
}

/**
 * Beginner progression: Linear progression
 */
function calculateBeginnerProgression(recentSets: ExerciseSet[], averageRpe: number): ProgressionRecommendation {
  const workingSets = recentSets.filter((set) => !set.isWarmup);

  if (workingSets.length < 3) {
    return {
      shouldProgress: false,
      reason: "Need more data to determine progression",
    };
  }

  // Check if user completed target reps in recent sessions
  const recentSessions = groupSetsBySession(workingSets);
  const lastSession = recentSessions[recentSessions.length - 1];

  const completedTargetReps = lastSession.every((set) => set.reps >= 5); // Assuming 5+ reps target

  if (!completedTargetReps) {
    return {
      shouldProgress: false,
      reason: "Complete all target reps before increasing weight",
      alternativeAction: "Focus on hitting rep targets consistently",
    };
  }

  // Linear progression for beginners - add weight weekly
  return {
    shouldProgress: true,
    recommendedIncrease: 5, // 5kg/10lbs for compound movements
    reason: "Completed target reps. Ready for linear progression increase.",
  };
}

/**
 * Early intermediate progression: RPE-based
 */
function calculateRpeBasedProgression(recentSets: ExerciseSet[], averageRpe: number): ProgressionRecommendation {
  const targetRpe = 8; // Target RPE for working sets
  const rpeThreshold = 1; // Must drop 1 RPE point to progress

  if (!averageRpe || averageRpe === 0) {
    return {
      shouldProgress: false,
      reason: "RPE data needed for progression decisions. Please rate your sets.",
      alternativeAction: "Record RPE for all working sets",
    };
  }

  if (averageRpe <= targetRpe - rpeThreshold) {
    return {
      shouldProgress: true,
      recommendedIncrease: 2.5,
      reason: `RPE dropped to ${averageRpe.toFixed(1)}, ready for weight increase`,
    };
  }

  if (averageRpe > targetRpe + 0.5) {
    return {
      shouldProgress: false,
      reason: `RPE too high (${averageRpe.toFixed(1)}). Focus on recovery or reduce weight.`,
      alternativeAction: "Consider deload or extra rest day",
    };
  }

  return {
    shouldProgress: false,
    reason: `Current RPE ${averageRpe.toFixed(1)} - maintain current weight until RPE ≤ ${targetRpe - rpeThreshold}`,
    alternativeAction: "Continue with current weight, focus on technique",
  };
}

/**
 * Conservative progression for advanced users
 */
function calculateConservativeProgression(recentSets: ExerciseSet[], averageRpe: number): ProgressionRecommendation {
  // Very conservative approach for intermediate+ users
  return {
    shouldProgress: false,
    reason: "Advanced progression requires individualized programming",
    alternativeAction: "Consider working with a coach for advanced progression",
  };
}

/**
 * Helper function to group sets by session
 */
function groupSetsBySession(sets: ExerciseSet[]): ExerciseSet[][] {
  const sessionMap = new Map<string, ExerciseSet[]>();

  sets.forEach((set) => {
    if (!sessionMap.has(set.sessionId)) {
      sessionMap.set(set.sessionId, []);
    }
    sessionMap.get(set.sessionId)!.push(set);
  });

  return Array.from(sessionMap.values());
}

// ============================================================================
// WORKOUT SLICE
// ============================================================================

const workoutSlice = createSlice({
  name: "workout",
  initialState,
  reducers: {
    // Set current exercise index
    setCurrentExercise: (state, action: PayloadAction<number>) => {
      state.currentExercise = action.payload;
      logger.info("Current exercise changed", { exerciseIndex: action.payload }, "workout");
    },

    // Set current set index
    setCurrentSet: (state, action: PayloadAction<number>) => {
      state.currentSet = action.payload;
      logger.info("Current set changed", { setIndex: action.payload }, "workout");
    },

    // Load workout plans
    setWorkoutPlans: (state, action: PayloadAction<WorkoutPlan[]>) => {
      state.plans = action.payload;
      logger.info("Workout plans loaded", { count: action.payload.length }, "workout");
    },

    // Load exercises
    setExercises: (state, action: PayloadAction<Exercise[]>) => {
      state.exercises = action.payload;
      logger.info("Exercises loaded", { count: action.payload.length }, "workout");
    },

    // Cancel current workout
    cancelWorkout: (state) => {
      if (state.currentWorkout) {
        logger.info("Workout cancelled", { workoutId: state.currentWorkout.id }, "workout");
      }

      state.currentWorkout = null;
      state.isActive = false;
      state.currentExercise = 0;
      state.currentSet = 0;
    },

    // Clear data (for logout)
    clearWorkoutData: (state) => {
      state.currentWorkout = null;
      state.isActive = false;
      state.currentExercise = 0;
      state.currentSet = 0;
      logger.info("Workout data cleared", undefined, "workout");
    },
  },
  extraReducers: (builder) => {
    // Start Workout
    builder
      .addCase(startWorkout.pending, (state) => {
        // Don't set loading state to avoid UI flicker
      })
      .addCase(startWorkout.fulfilled, (state, action) => {
        state.currentWorkout = action.payload.workout;
        state.isActive = true;
        state.currentExercise = 0;
        state.currentSet = 0;
      })
      .addCase(startWorkout.rejected, (state, action) => {
        logger.error("Start workout failed", action.payload, "workout");
      });

    // Complete Workout
    builder
      .addCase(completeWorkout.pending, (state) => {
        // Keep workout active during completion
      })
      .addCase(completeWorkout.fulfilled, (state, action) => {
        // Update current workout
        state.currentWorkout = action.payload;
        state.isActive = false;
        state.currentExercise = 0;
        state.currentSet = 0;

        // No offline queue updates in online-first flow
      })
      .addCase(completeWorkout.rejected, (state, action) => {
        logger.error("Complete workout failed", action.payload, "workout");
      });

    // Add Exercise Set
    builder
      .addCase(addExerciseSet.pending, (state) => {
        // Don't set loading state
      })
      .addCase(addExerciseSet.fulfilled, (state, action) => {
        if (state.currentWorkout) {
          // Add set to current workout
          if (!state.currentWorkout.sets) {
            (state.currentWorkout as any).sets = [];
          }
          (state.currentWorkout as any).sets.push(action.payload);

          // No offline queue updates in online-first flow
        }
      })
      .addCase(addExerciseSet.rejected, (state, action) => {
        logger.error("Add exercise set failed", action.payload, "workout");
      });

    // Calculate Progression
    builder
      .addCase(calculateProgression.pending, (state) => {
        // Don't set loading state
      })
      .addCase(calculateProgression.fulfilled, (state, action) => {
        const { exerciseId, recommendation } = action.payload;
        state.progressMetrics[exerciseId] = {
          ...state.progressMetrics[exerciseId],
          lastProgression: new Date().toISOString(),
          recommendation,
        } as any;
      })
      .addCase(calculateProgression.rejected, (state, action) => {
        logger.error("Calculate progression failed", action.payload, "workout");
      });

    // (offline sync removed)
  },
});

// ============================================================================
// ACTIONS AND SELECTORS
// ============================================================================

export const { setCurrentExercise, setCurrentSet, setWorkoutPlans, setExercises, cancelWorkout, clearWorkoutData } =
  workoutSlice.actions;

// Selectors
export const selectWorkout = (state: { workout: WorkoutState }) => state.workout;
export const selectCurrentWorkout = (state: { workout: WorkoutState }) => state.workout.currentWorkout;
export const selectIsWorkoutActive = (state: { workout: WorkoutState }) => state.workout.isActive;
export const selectCurrentExercise = (state: { workout: WorkoutState }) => state.workout.currentExercise;
export const selectCurrentSet = (state: { workout: WorkoutState }) => state.workout.currentSet;
export const selectWorkoutPlans = (state: { workout: WorkoutState }) => state.workout.plans;
export const selectExercises = (state: { workout: WorkoutState }) => state.workout.exercises;
export const selectProgressMetrics = (state: { workout: WorkoutState }) => state.workout.progressMetrics;

// Computed selectors
export const selectHasPendingWorkouts = (state: { workout: WorkoutState }) => false;

export const selectCurrentWorkoutDuration = (state: { workout: WorkoutState }) => {
  const currentWorkout = state.workout.currentWorkout;
  if (!currentWorkout || !state.workout.isActive) return 0;

  return Math.round((Date.now() - new Date(currentWorkout.startedAt).getTime()) / (1000 * 60));
};

export const selectExerciseById = (exerciseId: string) => (state: { workout: WorkoutState }) =>
  state.workout.exercises.find((exercise) => exercise.id === exerciseId);

export const selectWorkoutPlanById = (planId: string) => (state: { workout: WorkoutState }) =>
  state.workout.plans.find((plan) => plan.id === planId);

export const selectProgressionForExercise = (exerciseId: string) => (state: { workout: WorkoutState }) =>
  state.workout.progressMetrics[exerciseId]?.recommendation;

export default workoutSlice.reducer;
