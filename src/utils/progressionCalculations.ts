// ============================================================================
// PROGRESSION CALCULATIONS
// ============================================================================
// Mathematical progression formulas, statistical analysis, and plateau detection
// algorithms for experience-based progression recommendations

import type {
  SessionProgressionData,
  ProgressionStatistics,
  PerformanceTrend,
  PlateauAnalysis,
  ConsistencyMetrics,
  ProgressionRate,
  PlateauDetection,
  PlateauBreakingStrategy,
} from "../types/progression";
import type { ExerciseSet } from "../types";
import { PLATEAU_DETECTION_CONFIG } from "../constants/progressionRules";

// ============================================================================
// STATISTICAL ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Calculate linear regression for trend analysis
 */
export function calculateLinearRegression(dataPoints: { x: number; y: number }[]): {
  slope: number;
  intercept: number;
  rSquared: number;
} {
  if (dataPoints.length < 2) {
    return { slope: 0, intercept: 0, rSquared: 0 };
  }

  const n = dataPoints.length;
  const sumX = dataPoints.reduce((sum, point) => sum + point.x, 0);
  const sumY = dataPoints.reduce((sum, point) => sum + point.y, 0);
  const sumXY = dataPoints.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumXX = dataPoints.reduce((sum, point) => sum + point.x * point.x, 0);
  const sumYY = dataPoints.reduce((sum, point) => sum + point.y * point.y, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const yMean = sumY / n;
  const totalSumSquares = dataPoints.reduce((sum, point) => sum + Math.pow(point.y - yMean, 2), 0);
  const residualSumSquares = dataPoints.reduce((sum, point) => {
    const predicted = slope * point.x + intercept;
    return sum + Math.pow(point.y - predicted, 2);
  }, 0);

  const rSquared = totalSumSquares === 0 ? 0 : 1 - residualSumSquares / totalSumSquares;

  return {
    slope: isNaN(slope) ? 0 : slope,
    intercept: isNaN(intercept) ? 0 : intercept,
    rSquared: isNaN(rSquared) ? 0 : Math.max(0, Math.min(1, rSquared)),
  };
}

/**
 * Calculate variance of a dataset
 */
export function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

  return variance;
}

/**
 * Calculate standard deviation
 */
export function calculateStandardDeviation(values: number[]): number {
  return Math.sqrt(calculateVariance(values));
}

/**
 * Determine trend direction based on slope
 */
export function getTrendDirection(slope: number, threshold: number = 0.1): "increasing" | "decreasing" | "stable" {
  if (slope > threshold) return "increasing";
  if (slope < -threshold) return "decreasing";
  return "stable";
}

// ============================================================================
// PERFORMANCE TREND ANALYSIS
// ============================================================================

/**
 * Analyze performance trends across multiple metrics
 */
export function analyzePerformanceTrend(sessions: SessionProgressionData[], timeframeWeeks: number): PerformanceTrend {
  if (sessions.length < 2) {
    return {
      timeframe: timeframeWeeks,
      weightProgression: { slope: 0, rSquared: 0, trend: "stable" },
      volumeProgression: { slope: 0, rSquared: 0, trend: "stable" },
      rpeProgression: { slope: 0, rSquared: 0, trend: "stable" },
    };
  }

  // Sort sessions by date
  const sortedSessions = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Create data points for regression analysis
  const weightData = sortedSessions.map((session, index) => ({
    x: index,
    y: session.maxWeight,
  }));

  const volumeData = sortedSessions.map((session, index) => ({
    x: index,
    y: session.totalVolume,
  }));

  const rpeData = sortedSessions
    .filter((session) => session.averageRPE !== null)
    .map((session, index) => ({
      x: index,
      y: session.averageRPE!,
    }));

  // Calculate regressions
  const weightRegression = calculateLinearRegression(weightData);
  const volumeRegression = calculateLinearRegression(volumeData);
  const rpeRegression = calculateLinearRegression(rpeData);

  return {
    timeframe: timeframeWeeks,
    weightProgression: {
      slope: weightRegression.slope,
      rSquared: weightRegression.rSquared,
      trend: getTrendDirection(weightRegression.slope, PLATEAU_DETECTION_CONFIG.trendSlopeThreshold),
    },
    volumeProgression: {
      slope: volumeRegression.slope,
      rSquared: volumeRegression.rSquared,
      trend: getTrendDirection(volumeRegression.slope, PLATEAU_DETECTION_CONFIG.trendSlopeThreshold),
    },
    rpeProgression: {
      slope: rpeRegression.slope,
      rSquared: rpeRegression.rSquared,
      trend: getTrendDirection(rpeRegression.slope, PLATEAU_DETECTION_CONFIG.trendSlopeThreshold),
    },
  };
}

// ============================================================================
// PLATEAU DETECTION
// ============================================================================

/**
 * Detect training plateaus using statistical analysis
 */
export function detectPlateau(sessions: SessionProgressionData[], experienceLevel: string): PlateauDetection {
  if (sessions.length < PLATEAU_DETECTION_CONFIG.minimumDataPoints) {
    return {
      isPlateaued: false,
      plateauDuration: 0,
      plateauType: "mixed",
      statisticalConfidence: 0,
      trendAnalysis: {
        weightTrend: "stable",
        rpeTrend: "stable",
        volumeTrend: "stable",
      },
      recommendations: [],
    };
  }

  // Analyze performance trends
  const analysisWindow =
    PLATEAU_DETECTION_CONFIG.analysisWindow[experienceLevel as keyof typeof PLATEAU_DETECTION_CONFIG.analysisWindow] ||
    6;

  const performanceTrend = analyzePerformanceTrend(sessions, analysisWindow);

  // Determine plateau status
  const isWeightPlateaued =
    performanceTrend.weightProgression.trend === "stable" &&
    performanceTrend.weightProgression.rSquared > PLATEAU_DETECTION_CONFIG.confidenceThreshold;

  const isVolumeStagnant =
    performanceTrend.volumeProgression.trend === "stable" &&
    performanceTrend.volumeProgression.rSquared > PLATEAU_DETECTION_CONFIG.confidenceThreshold;

  const isRPEIncreasing =
    performanceTrend.rpeProgression.trend === "increasing" &&
    performanceTrend.rpeProgression.rSquared > PLATEAU_DETECTION_CONFIG.confidenceThreshold;

  // Determine plateau type and confidence
  let plateauType: "strength" | "volume" | "rpe" | "mixed" = "mixed";
  let isPlateaued = false;
  let statisticalConfidence = 0;

  if (isWeightPlateaued && isRPEIncreasing) {
    plateauType = "strength";
    isPlateaued = true;
    statisticalConfidence = Math.min(
      performanceTrend.weightProgression.rSquared,
      performanceTrend.rpeProgression.rSquared
    );
  } else if (isVolumeStagnant && isWeightPlateaued) {
    plateauType = "volume";
    isPlateaued = true;
    statisticalConfidence = Math.min(
      performanceTrend.weightProgression.rSquared,
      performanceTrend.volumeProgression.rSquared
    );
  } else if (isRPEIncreasing && !isWeightPlateaued) {
    plateauType = "rpe";
    isPlateaued = true;
    statisticalConfidence = performanceTrend.rpeProgression.rSquared;
  }

  // Calculate plateau duration (weeks)
  const plateauDuration = isPlateaued ? calculatePlateauDuration(sessions) : 0;

  // Generate breaking strategies
  const recommendations = isPlateaued ? generatePlateauBreakingStrategies(plateauType, experienceLevel) : [];

  return {
    isPlateaued,
    plateauDuration,
    plateauType,
    statisticalConfidence,
    trendAnalysis: {
      weightTrend: performanceTrend.weightProgression.trend,
      rpeTrend: performanceTrend.rpeProgression.trend,
      volumeTrend: performanceTrend.volumeProgression.trend,
    },
    recommendations,
  };
}

/**
 * Calculate how long the plateau has been occurring
 */
function calculatePlateauDuration(sessions: SessionProgressionData[]): number {
  if (sessions.length < 2) return 0;

  const sortedSessions = [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let plateauWeeks = 0;
  let lastWeight = sortedSessions[0].maxWeight;
  const tolerance = 0.5; // 0.5kg tolerance for "same weight"

  for (let i = 1; i < sortedSessions.length; i++) {
    const currentWeight = sortedSessions[i].maxWeight;

    if (Math.abs(currentWeight - lastWeight) <= tolerance) {
      plateauWeeks++;
    } else {
      break; // Found progression, stop counting
    }

    lastWeight = currentWeight;
  }

  // Convert sessions to approximate weeks (assuming 2-3 sessions per week)
  return Math.ceil(plateauWeeks / 2.5);
}

/**
 * Generate plateau breaking strategies based on plateau type and experience level
 */
function generatePlateauBreakingStrategies(
  plateauType: "strength" | "volume" | "rpe" | "mixed",
  experienceLevel: string
): PlateauBreakingStrategy[] {
  const baseStrategies = PLATEAU_DETECTION_CONFIG.strategies;

  // Filter and prioritize strategies based on plateau type
  let prioritizedStrategies: PlateauBreakingStrategy[] = [];

  switch (plateauType) {
    case "strength":
      prioritizedStrategies = [
        baseStrategies.find((s) => s.strategy === "deload")!,
        baseStrategies.find((s) => s.strategy === "periodization")!,
        baseStrategies.find((s) => s.strategy === "exercise_variation")!,
      ];
      break;

    case "volume":
      prioritizedStrategies = [
        baseStrategies.find((s) => s.strategy === "volume_manipulation")!,
        baseStrategies.find((s) => s.strategy === "periodization")!,
        baseStrategies.find((s) => s.strategy === "deload")!,
      ];
      break;

    case "rpe":
      prioritizedStrategies = [
        baseStrategies.find((s) => s.strategy === "deload")!,
        baseStrategies.find((s) => s.strategy === "volume_manipulation")!,
      ];
      break;

    default: // mixed
      prioritizedStrategies = [...baseStrategies];
  }

  // Adjust strategies based on experience level
  if (experienceLevel === "beginner") {
    // Beginners should focus on simpler strategies
    prioritizedStrategies = prioritizedStrategies.filter(
      (s) => s.strategy === "deload" || s.strategy === "volume_manipulation"
    );
  }

  return prioritizedStrategies.filter(Boolean);
}

// ============================================================================
// CONSISTENCY METRICS
// ============================================================================

/**
 * Calculate consistency metrics for progression analysis
 */
export function calculateConsistencyMetrics(sessions: SessionProgressionData[]): ConsistencyMetrics {
  if (sessions.length === 0) {
    return {
      rpeVariance: 0,
      repCompletionRate: 0,
      sessionAttendanceRate: 1, // Assume perfect if no data
      formConsistencyScore: 0,
    };
  }

  // RPE variance
  const rpeValues = sessions.filter((session) => session.averageRPE !== null).map((session) => session.averageRPE!);
  const rpeVariance = calculateVariance(rpeValues);

  // Rep completion rate
  const completionRate =
    sessions.reduce((sum, session) => {
      return sum + (session.completedTargetReps ? 1 : 0);
    }, 0) / sessions.length;

  // Session attendance rate (assuming planned sessions)
  // This would need to be calculated based on planned vs actual sessions
  const sessionAttendanceRate = 1; // Placeholder - would need more context

  // Form consistency score (average of form ratings)
  const formRatings = sessions
    .filter((session) => session.formRating !== undefined)
    .map((session) => session.formRating!);
  const formConsistencyScore =
    formRatings.length > 0
      ? formRatings.reduce((sum, rating) => sum + rating, 0) / formRatings.length / 5 // Normalize to 0-1
      : 0;

  return {
    rpeVariance,
    repCompletionRate: completionRate,
    sessionAttendanceRate,
    formConsistencyScore,
  };
}

// ============================================================================
// PROGRESSION RATE CALCULATIONS
// ============================================================================

/**
 * Calculate progression rates across different metrics
 */
export function calculateProgressionRate(sessions: SessionProgressionData[], timeframeWeeks: number): ProgressionRate {
  if (sessions.length < 2) {
    return {
      weightPerWeek: 0,
      volumePerWeek: 0,
      strengthGainRate: 0,
      comparedToExpected: 0,
    };
  }

  const sortedSessions = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const firstSession = sortedSessions[0];
  const lastSession = sortedSessions[sortedSessions.length - 1];

  // Calculate time difference in weeks
  const timeDiffMs = new Date(lastSession.date).getTime() - new Date(firstSession.date).getTime();
  const timeDiffWeeks = timeDiffMs / (1000 * 60 * 60 * 24 * 7);

  if (timeDiffWeeks === 0) {
    return {
      weightPerWeek: 0,
      volumePerWeek: 0,
      strengthGainRate: 0,
      comparedToExpected: 0,
    };
  }

  // Weight progression per week
  const weightChange = lastSession.maxWeight - firstSession.maxWeight;
  const weightPerWeek = weightChange / timeDiffWeeks;

  // Volume progression per week
  const volumeChange = lastSession.totalVolume - firstSession.totalVolume;
  const volumePerWeek = volumeChange / timeDiffWeeks;

  // Estimated strength gain rate (using 1RM estimation)
  const initialEstimated1RM = estimateOneRepMax(firstSession.maxWeight, 8); // Assume 8 reps
  const finalEstimated1RM = estimateOneRepMax(lastSession.maxWeight, 8);
  const strengthGainRate = (finalEstimated1RM - initialEstimated1RM) / timeDiffWeeks;

  // Compare to expected progression (this would be experience-level dependent)
  const expectedWeightPerWeek = 1.25; // Placeholder - would be calculated based on experience level
  const comparedToExpected = expectedWeightPerWeek > 0 ? (weightPerWeek / expectedWeightPerWeek) * 100 : 0;

  return {
    weightPerWeek: Math.round(weightPerWeek * 100) / 100,
    volumePerWeek: Math.round(volumePerWeek * 100) / 100,
    strengthGainRate: Math.round(strengthGainRate * 100) / 100,
    comparedToExpected: Math.round(comparedToExpected * 100) / 100,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Estimate one-rep max using Epley formula
 */
export function estimateOneRepMax(weight: number, reps: number, rpe?: number): number {
  if (reps === 1) return weight;

  // Adjust for RPE if provided
  let adjustedReps = reps;
  if (rpe && rpe < 10) {
    // Estimate additional reps based on RPE
    const additionalReps = 10 - rpe;
    adjustedReps = reps + additionalReps;
  }

  // Epley formula: 1RM = weight × (1 + reps/30)
  return Math.round(weight * (1 + adjustedReps / 30) * 100) / 100;
}

/**
 * Calculate volume for a set of exercise sets
 */
export function calculateTotalVolume(sets: ExerciseSet[]): number {
  return sets.reduce((total, set) => {
    const weight = set.weightKg || 0;
    return total + weight * set.reps;
  }, 0);
}

/**
 * Calculate average RPE for a set of exercise sets
 */
export function calculateAverageRPE(sets: ExerciseSet[]): number | null {
  const setsWithRPE = sets.filter((set) => set.rpe !== null && set.rpe !== undefined && !set.isWarmup);

  if (setsWithRPE.length === 0) return null;

  const totalRPE = setsWithRPE.reduce((sum, set) => sum + (set.rpe || 0), 0);
  return Math.round((totalRPE / setsWithRPE.length) * 10) / 10;
}

/**
 * Find maximum weight used in a set of exercise sets
 */
export function findMaxWeight(sets: ExerciseSet[]): number {
  const workingSets = sets.filter((set) => !set.isWarmup);
  if (workingSets.length === 0) return 0;

  return Math.max(...workingSets.map((set) => set.weightKg || 0));
}

/**
 * Check if target reps were completed in a session
 */
export function checkTargetRepsCompleted(sets: ExerciseSet[], targetReps: number): boolean {
  const workingSets = sets.filter((set) => !set.isWarmup);

  // Check if at least 80% of working sets hit the target reps
  const setsHittingTarget = workingSets.filter((set) => set.reps >= targetReps).length;
  const completionRate = setsHittingTarget / workingSets.length;

  return completionRate >= 0.8;
}

/**
 * Generate comprehensive progression statistics
 */
export function generateProgressionStatistics(
  sessions: SessionProgressionData[],
  timeframeWeeks: number,
  experienceLevel: string
): ProgressionStatistics {
  const performanceTrend = analyzePerformanceTrend(sessions, timeframeWeeks);
  const plateauAnalysis = detectPlateau(sessions, experienceLevel);
  const consistencyMetrics = calculateConsistencyMetrics(sessions);
  const progressionRate = calculateProgressionRate(sessions, timeframeWeeks);

  return {
    performanceTrend,
    plateauAnalysis: {
      isPlateaued: plateauAnalysis.isPlateaued,
      plateauDuration: plateauAnalysis.plateauDuration,
      plateauConfidence: plateauAnalysis.statisticalConfidence,
      plateauType: plateauAnalysis.plateauType,
      breakingStrategies: plateauAnalysis.recommendations,
    },
    consistencyMetrics,
    progressionRate,
  };
}

export default {
  calculateLinearRegression,
  calculateVariance,
  calculateStandardDeviation,
  getTrendDirection,
  analyzePerformanceTrend,
  detectPlateau,
  calculateConsistencyMetrics,
  calculateProgressionRate,
  estimateOneRepMax,
  calculateTotalVolume,
  calculateAverageRPE,
  findMaxWeight,
  checkTargetRepsCompleted,
  generateProgressionStatistics,
};
