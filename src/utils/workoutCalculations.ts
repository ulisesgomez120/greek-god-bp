// ============================================================================
// WORKOUT CALCULATIONS UTILITY
// ============================================================================
// Volume and progress calculations for workout tracking

import type { ExerciseSet, WorkoutSession, Exercise } from "../types";

// ============================================================================
// TYPES
// ============================================================================

export interface VolumeCalculation {
  totalVolume: number; // Total weight lifted (kg)
  totalReps: number;
  totalSets: number;
  workingSets: number;
  warmupSets: number;
  averageRPE: number | null;
  averageWeight: number | null;
  maxWeight: number | null;
}

export interface ProgressComparison {
  volumeChange: number; // Percentage change
  strengthChange: number; // Max weight change
  rpeChange: number; // Average RPE change
  enduranceChange: number; // Total reps change
  isProgression: boolean;
  progressionType: "strength" | "volume" | "endurance" | "mixed" | "none";
}

export interface ExerciseProgress {
  exerciseId: string;
  exerciseName: string;
  current: VolumeCalculation;
  previous: VolumeCalculation | null;
  comparison: ProgressComparison | null;
  recommendation: ProgressionRecommendation;
}

export interface ProgressionRecommendation {
  shouldIncrease: boolean;
  recommendedWeight?: number;
  recommendedReps?: number;
  recommendedSets?: number;
  reason: string;
  confidence: "high" | "medium" | "low";
}

// ============================================================================
// VOLUME CALCULATIONS
// ============================================================================

/**
 * Calculate volume metrics for a set of exercise sets
 */
export function calculateVolume(sets: ExerciseSet[]): VolumeCalculation {
  if (sets.length === 0) {
    return {
      totalVolume: 0,
      totalReps: 0,
      totalSets: 0,
      workingSets: 0,
      warmupSets: 0,
      averageRPE: null,
      averageWeight: null,
      maxWeight: null,
    };
  }

  const workingSets = sets.filter((set) => !set.isWarmup);
  const warmupSets = sets.filter((set) => set.isWarmup);

  // Calculate total volume (weight × reps for each set)
  const totalVolume = sets.reduce((sum, set) => {
    const weight = set.weightKg || 0;
    return sum + weight * set.reps;
  }, 0);

  // Calculate total reps
  const totalReps = sets.reduce((sum, set) => sum + set.reps, 0);

  // Calculate average RPE (working sets only)
  const setsWithRPE = workingSets.filter((set) => set.rpe !== null && set.rpe !== undefined);
  const averageRPE =
    setsWithRPE.length > 0 ? setsWithRPE.reduce((sum, set) => sum + (set.rpe || 0), 0) / setsWithRPE.length : null;

  // Calculate average weight (working sets only)
  const setsWithWeight = workingSets.filter((set) => set.weightKg !== null && set.weightKg !== undefined);
  const averageWeight =
    setsWithWeight.length > 0
      ? setsWithWeight.reduce((sum, set) => sum + (set.weightKg || 0), 0) / setsWithWeight.length
      : null;

  // Calculate max weight
  const maxWeight = sets.reduce((max, set) => {
    const weight = set.weightKg || 0;
    return weight > max ? weight : max;
  }, 0);

  return {
    totalVolume,
    totalReps,
    totalSets: sets.length,
    workingSets: workingSets.length,
    warmupSets: warmupSets.length,
    averageRPE: averageRPE ? Math.round(averageRPE * 10) / 10 : null,
    averageWeight: averageWeight ? Math.round(averageWeight * 10) / 10 : null,
    maxWeight: maxWeight > 0 ? maxWeight : null,
  };
}

/**
 * Calculate session-wide volume metrics
 */
export function calculateSessionVolume(session: WorkoutSession, sets: ExerciseSet[]): VolumeCalculation {
  return calculateVolume(sets);
}

// ============================================================================
// PROGRESS CALCULATIONS
// ============================================================================

/**
 * Compare two volume calculations to determine progress
 */
export function compareProgress(current: VolumeCalculation, previous: VolumeCalculation): ProgressComparison {
  // Calculate percentage changes
  const volumeChange =
    previous.totalVolume > 0 ? ((current.totalVolume - previous.totalVolume) / previous.totalVolume) * 100 : 0;

  const strengthChange = previous.maxWeight && current.maxWeight ? current.maxWeight - previous.maxWeight : 0;

  const rpeChange = previous.averageRPE && current.averageRPE ? current.averageRPE - previous.averageRPE : 0;

  const enduranceChange =
    previous.totalReps > 0 ? ((current.totalReps - previous.totalReps) / previous.totalReps) * 100 : 0;

  // Determine progression type
  let progressionType: ProgressComparison["progressionType"] = "none";
  let isProgression = false;

  if (strengthChange > 0) {
    progressionType = "strength";
    isProgression = true;
  } else if (volumeChange > 5) {
    progressionType = "volume";
    isProgression = true;
  } else if (enduranceChange > 10) {
    progressionType = "endurance";
    isProgression = true;
  } else if (volumeChange > 0 && enduranceChange > 0) {
    progressionType = "mixed";
    isProgression = true;
  }

  return {
    volumeChange: Math.round(volumeChange * 10) / 10,
    strengthChange: Math.round(strengthChange * 10) / 10,
    rpeChange: Math.round(rpeChange * 10) / 10,
    enduranceChange: Math.round(enduranceChange * 10) / 10,
    isProgression,
    progressionType,
  };
}

/**
 * Generate progression recommendation based on current performance
 */
export function generateProgressionRecommendation(
  current: VolumeCalculation,
  previous: VolumeCalculation | null,
  exerciseName: string
): ProgressionRecommendation {
  // No previous data - conservative approach
  if (!previous) {
    return {
      shouldIncrease: false,
      reason: "Complete a few more sessions to establish baseline performance",
      confidence: "low",
    };
  }

  const comparison = compareProgress(current, previous);

  // RPE-based recommendations (primary factor)
  if (current.averageRPE !== null) {
    // RPE too low - ready to progress
    if (current.averageRPE <= 7) {
      const weightIncrease = calculateWeightIncrease(current.maxWeight || 0, exerciseName);
      return {
        shouldIncrease: true,
        recommendedWeight: (current.maxWeight || 0) + weightIncrease,
        reason: `Average RPE of ${current.averageRPE} indicates room for progression`,
        confidence: "high",
      };
    }

    // RPE too high - maintain or reduce
    if (current.averageRPE >= 9) {
      return {
        shouldIncrease: false,
        reason: `Average RPE of ${current.averageRPE} is too high - focus on form and consistency`,
        confidence: "high",
      };
    }

    // RPE in sweet spot (7-8.5) - maintain
    return {
      shouldIncrease: false,
      reason: `Average RPE of ${current.averageRPE} is in the optimal training zone`,
      confidence: "medium",
    };
  }

  // Fallback to volume-based recommendations
  if (comparison.volumeChange > 10) {
    return {
      shouldIncrease: true,
      recommendedWeight: (current.maxWeight || 0) + calculateWeightIncrease(current.maxWeight || 0, exerciseName),
      reason: "Volume increased significantly - ready for weight progression",
      confidence: "medium",
    };
  }

  return {
    shouldIncrease: false,
    reason: "Continue with current weights to build consistency",
    confidence: "low",
  };
}

/**
 * Calculate appropriate weight increase based on exercise type
 */
function calculateWeightIncrease(currentWeight: number, exerciseName: string): number {
  const exerciseNameLower = exerciseName.toLowerCase();

  // Large compound movements - bigger increases
  if (
    exerciseNameLower.includes("squat") ||
    exerciseNameLower.includes("deadlift") ||
    exerciseNameLower.includes("row")
  ) {
    return currentWeight < 60 ? 2.5 : 5;
  }

  // Upper body compounds - moderate increases
  if (
    exerciseNameLower.includes("press") ||
    exerciseNameLower.includes("bench") ||
    exerciseNameLower.includes("pull")
  ) {
    return currentWeight < 40 ? 1.25 : 2.5;
  }

  // Isolation exercises - small increases
  return currentWeight < 20 ? 0.5 : 1.25;
}

// ============================================================================
// EXERCISE PROGRESS ANALYSIS
// ============================================================================

/**
 * Analyze progress for a specific exercise across sessions
 */
export function analyzeExerciseProgress(
  exerciseId: string,
  exerciseName: string,
  currentSets: ExerciseSet[],
  previousSets: ExerciseSet[]
): ExerciseProgress {
  const current = calculateVolume(currentSets);
  const previous = previousSets.length > 0 ? calculateVolume(previousSets) : null;
  const comparison = previous ? compareProgress(current, previous) : null;
  const recommendation = generateProgressionRecommendation(current, previous, exerciseName);

  return {
    exerciseId,
    exerciseName,
    current,
    previous,
    comparison,
    recommendation,
  };
}

/**
 * Calculate workout session summary
 */
export function calculateWorkoutSummary(
  session: WorkoutSession,
  allSets: ExerciseSet[],
  exercises: Exercise[]
): {
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  averageRPE: number | null;
  exerciseCount: number;
  duration: number | null;
  exerciseBreakdown: ExerciseProgress[];
} {
  const sessionVolume = calculateVolume(allSets);

  // Group sets by exercise
  const setsByExercise = allSets.reduce((acc, set) => {
    if (!acc[set.exerciseId]) {
      acc[set.exerciseId] = [];
    }
    acc[set.exerciseId].push(set);
    return acc;
  }, {} as Record<string, ExerciseSet[]>);

  // Calculate progress for each exercise
  const exerciseBreakdown = Object.entries(setsByExercise).map(([exerciseId, sets]) => {
    const exercise = exercises.find((e) => e.id === exerciseId);
    const exerciseName = exercise?.name || "Unknown Exercise";

    return analyzeExerciseProgress(exerciseId, exerciseName, sets, []);
  });

  const duration =
    session.completedAt && session.startedAt
      ? Math.round((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / (1000 * 60))
      : null;

  return {
    totalVolume: sessionVolume.totalVolume,
    totalSets: sessionVolume.totalSets,
    totalReps: sessionVolume.totalReps,
    averageRPE: sessionVolume.averageRPE,
    exerciseCount: Object.keys(setsByExercise).length,
    duration,
    exerciseBreakdown,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format volume for display
 */
export function formatVolume(volume: number): string {
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k kg`;
  }
  return `${Math.round(volume)} kg`;
}

/**
 * Format RPE for display
 */
export function formatRPE(rpe: number | null): string {
  if (rpe === null) return "N/A";
  return `RPE ${rpe}`;
}

/**
 * Get RPE color based on value
 */
export function getRPEColor(rpe: number | null): string {
  if (rpe === null) return "#8E8E93";
  if (rpe <= 6) return "#34C759"; // Green - easy
  if (rpe <= 8) return "#B5CFF8"; // Blue - moderate
  if (rpe <= 9) return "#FF9500"; // Orange - hard
  return "#FF3B30"; // Red - maximum
}

/**
 * Calculate estimated 1RM using Epley formula
 */
export function calculateEstimated1RM(weight: number, reps: number, rpe?: number): number {
  if (reps === 1) return weight;

  // Adjust for RPE if provided
  let adjustedReps = reps;
  if (rpe && rpe < 10) {
    // Estimate additional reps based on RPE
    const additionalReps = 10 - rpe;
    adjustedReps = reps + additionalReps;
  }

  // Epley formula: 1RM = weight × (1 + reps/30)
  return Math.round(weight * (1 + adjustedReps / 30));
}

export default {
  calculateVolume,
  calculateSessionVolume,
  compareProgress,
  generateProgressionRecommendation,
  analyzeExerciseProgress,
  calculateWorkoutSummary,
  formatVolume,
  formatRPE,
  getRPEColor,
  calculateEstimated1RM,
};
