// ============================================================================
// PROGRESS CALCULATIONS UTILITIES
// ============================================================================
// Statistical calculations and mathematical formulas for progress metrics,
// 1RM estimates, volume tracking, and trend analysis

import { logger } from "./logger";
import type { ExerciseSet, StrengthDataPoint, VolumeDataPoint } from "../types";

// ============================================================================
// TYPES
// ============================================================================

export interface OneRepMaxFormulas {
  epley: number;
  brzycki: number;
  lander: number;
  lombardi: number;
  mayhew: number;
  oconner: number;
  wathen: number;
  rpe: number;
}

export interface ProgressTrend {
  direction: "increasing" | "decreasing" | "stable";
  strength: "strong" | "moderate" | "weak";
  confidence: number; // 0-1
  changePercentage: number;
  dataPoints: number;
  timespan: number; // days
}

export interface VolumeMetrics {
  totalVolume: number;
  averageVolume: number;
  volumePerSet: number;
  intensityLoad: number; // Volume * average RPE
  tonnage: number; // Total weight moved
}

export interface StrengthMetrics {
  currentMax: number;
  estimatedMax: number;
  maxIncrease: number;
  maxIncreasePercentage: number;
  strengthScore: number; // Relative to bodyweight
  wilksScore?: number; // If bodyweight provided
}

export interface ConsistencyMetrics {
  frequency: number; // Sessions per week
  adherence: number; // Percentage of planned sessions completed
  streak: number; // Current consecutive sessions
  longestStreak: number;
  averageRestDays: number;
}

// ============================================================================
// ONE REP MAX CALCULATIONS
// ============================================================================

/**
 * Calculate one rep max using multiple formulas
 */
export function calculateOneRepMax(
  weight: number,
  reps: number,
  rpe?: number,
  formula: keyof OneRepMaxFormulas = "rpe"
): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;

  const formulas: OneRepMaxFormulas = {
    // Epley Formula (most common)
    epley: weight * (1 + reps / 30),

    // Brzycki Formula (conservative)
    brzycki: weight * (36 / (37 - reps)),

    // Lander Formula
    lander: (100 * weight) / (101.3 - 2.67123 * reps),

    // Lombardi Formula
    lombardi: weight * Math.pow(reps, 0.1),

    // Mayhew Formula
    mayhew: (100 * weight) / (52.2 + 41.9 * Math.exp(-0.055 * reps)),

    // O'Conner Formula
    oconner: weight * (1 + 0.025 * reps),

    // Wathan Formula
    wathen: (100 * weight) / (48.8 + 53.8 * Math.exp(-0.075 * reps)),

    // RPE-based calculation (most accurate for training)
    rpe: calculateRPEBasedOneRepMax(weight, reps, rpe),
  };

  const result = formulas[formula];
  return Math.round(result * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate RPE-based one rep max
 */
function calculateRPEBasedOneRepMax(weight: number, reps: number, rpe?: number): number {
  if (!rpe || rpe < 6 || rpe > 10) {
    // Fallback to Epley if no valid RPE
    return weight * (1 + reps / 30);
  }

  // RPE to RIR (Reps in Reserve) conversion
  const repsInReserve = 10 - rpe;
  const totalReps = reps + repsInReserve;

  // Modified Epley with RPE adjustment
  const baseMax = weight * (1 + totalReps / 30);

  // Apply RPE confidence factor (higher RPE = more accurate)
  const confidenceFactor = (rpe - 6) / 4; // 0 at RPE 6, 1 at RPE 10
  const fallbackMax = weight * (1 + reps / 30);

  return baseMax * confidenceFactor + fallbackMax * (1 - confidenceFactor);
}

/**
 * Get all one rep max estimates
 */
export function getAllOneRepMaxEstimates(weight: number, reps: number, rpe?: number): OneRepMaxFormulas {
  return {
    epley: calculateOneRepMax(weight, reps, rpe, "epley"),
    brzycki: calculateOneRepMax(weight, reps, rpe, "brzycki"),
    lander: calculateOneRepMax(weight, reps, rpe, "lander"),
    lombardi: calculateOneRepMax(weight, reps, rpe, "lombardi"),
    mayhew: calculateOneRepMax(weight, reps, rpe, "mayhew"),
    oconner: calculateOneRepMax(weight, reps, rpe, "oconner"),
    wathen: calculateOneRepMax(weight, reps, rpe, "wathen"),
    rpe: calculateOneRepMax(weight, reps, rpe, "rpe"),
  };
}

/**
 * Calculate percentage of one rep max
 */
export function calculatePercentageOfMax(weight: number, oneRepMax: number): number {
  if (oneRepMax <= 0) return 0;
  return Math.round((weight / oneRepMax) * 100 * 100) / 100;
}

/**
 * Calculate weight for target percentage of max
 */
export function calculateWeightForPercentage(oneRepMax: number, percentage: number): number {
  return Math.round(oneRepMax * (percentage / 100) * 100) / 100;
}

// ============================================================================
// VOLUME CALCULATIONS
// ============================================================================

/**
 * Calculate volume metrics from exercise sets
 */
export function calculateVolumeMetrics(sets: ExerciseSet[]): VolumeMetrics {
  const workingSets = sets.filter((set) => !set.isWarmup && set.weightKg && set.reps);

  if (workingSets.length === 0) {
    return {
      totalVolume: 0,
      averageVolume: 0,
      volumePerSet: 0,
      intensityLoad: 0,
      tonnage: 0,
    };
  }

  const volumes = workingSets.map((set) => (set.weightKg || 0) * (set.reps || 0));
  const totalVolume = volumes.reduce((sum, vol) => sum + vol, 0);
  const averageVolume = totalVolume / workingSets.length;
  const volumePerSet = totalVolume / workingSets.length;

  // Calculate intensity load (volume weighted by RPE)
  const rpeWeightedVolume = workingSets.reduce((sum, set) => {
    const volume = (set.weightKg || 0) * (set.reps || 0);
    const rpe = set.rpe || 7; // Default RPE if not provided
    return sum + volume * (rpe / 10);
  }, 0);

  const intensityLoad = rpeWeightedVolume;
  const tonnage = totalVolume; // Same as total volume in kg

  return {
    totalVolume,
    averageVolume,
    volumePerSet,
    intensityLoad,
    tonnage,
  };
}

/**
 * Calculate volume progression trend
 */
export function calculateVolumeProgression(data: VolumeDataPoint[]): ProgressTrend {
  if (data.length < 2) {
    return {
      direction: "stable",
      strength: "weak",
      confidence: 0,
      changePercentage: 0,
      dataPoints: data.length,
      timespan: 0,
    };
  }

  // Sort by date
  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate linear regression
  const regression = calculateLinearRegression(
    sortedData.map((d, i) => i),
    sortedData.map((d) => d.totalVolume || d.volume || 0)
  );

  // Determine trend direction and strength
  const slope = regression.slope;
  const rSquared = regression.rSquared;

  let direction: "increasing" | "decreasing" | "stable";
  let strength: "strong" | "moderate" | "weak";

  if (Math.abs(slope) < 0.1) {
    direction = "stable";
  } else if (slope > 0) {
    direction = "increasing";
  } else {
    direction = "decreasing";
  }

  if (rSquared > 0.7) {
    strength = "strong";
  } else if (rSquared > 0.4) {
    strength = "moderate";
  } else {
    strength = "weak";
  }

  // Calculate percentage change
  const firstValue = sortedData[0].totalVolume || sortedData[0].volume || 0;
  const lastValue = sortedData[sortedData.length - 1].totalVolume || sortedData[sortedData.length - 1].volume || 0;
  const changePercentage = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

  // Calculate timespan
  const firstDate = new Date(sortedData[0].date);
  const lastDate = new Date(sortedData[sortedData.length - 1].date);
  const timespan = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

  return {
    direction,
    strength,
    confidence: rSquared,
    changePercentage,
    dataPoints: data.length,
    timespan,
  };
}

// ============================================================================
// STRENGTH CALCULATIONS
// ============================================================================

/**
 * Calculate strength metrics from progression data
 */
export function calculateStrengthMetrics(data: StrengthDataPoint[], bodyweight?: number): StrengthMetrics {
  if (data.length === 0) {
    return {
      currentMax: 0,
      estimatedMax: 0,
      maxIncrease: 0,
      maxIncreasePercentage: 0,
      strengthScore: 0,
      wilksScore: undefined,
    };
  }

  // Sort by date
  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const firstMax = sortedData[0].oneRepMax || sortedData[0].estimatedMax || 0;
  const currentMax = sortedData[sortedData.length - 1].oneRepMax || sortedData[sortedData.length - 1].estimatedMax || 0;

  // Calculate estimated max using trend analysis
  const maxValues = sortedData.map((d) => d.oneRepMax || d.estimatedMax || 0);
  const regression = calculateLinearRegression(
    sortedData.map((_, i) => i),
    maxValues
  );

  const estimatedMax = Math.max(currentMax, regression.slope * sortedData.length + regression.intercept);

  const maxIncrease = currentMax - firstMax;
  const maxIncreasePercentage = firstMax > 0 ? (maxIncrease / firstMax) * 100 : 0;

  // Calculate strength score (relative to bodyweight)
  const strengthScore = bodyweight && bodyweight > 0 ? currentMax / bodyweight : 0;

  // Calculate Wilks score if bodyweight provided
  let wilksScore: number | undefined;
  if (bodyweight && bodyweight > 0) {
    wilksScore = calculateWilksScore(currentMax, bodyweight);
  }

  return {
    currentMax,
    estimatedMax,
    maxIncrease,
    maxIncreasePercentage,
    strengthScore,
    wilksScore,
  };
}

/**
 * Calculate strength progression trend
 */
export function calculateStrengthProgression(data: StrengthDataPoint[]): ProgressTrend {
  if (data.length < 2) {
    return {
      direction: "stable",
      strength: "weak",
      confidence: 0,
      changePercentage: 0,
      dataPoints: data.length,
      timespan: 0,
    };
  }

  // Sort by date
  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate linear regression on 1RM values
  const maxValues = sortedData.map((d) => d.oneRepMax || d.estimatedMax || 0);
  const regression = calculateLinearRegression(
    sortedData.map((_, i) => i),
    maxValues
  );

  // Determine trend direction and strength
  const slope = regression.slope;
  const rSquared = regression.rSquared;

  let direction: "increasing" | "decreasing" | "stable";
  let strength: "strong" | "moderate" | "weak";

  if (Math.abs(slope) < 0.5) {
    direction = "stable";
  } else if (slope > 0) {
    direction = "increasing";
  } else {
    direction = "decreasing";
  }

  if (rSquared > 0.7) {
    strength = "strong";
  } else if (rSquared > 0.4) {
    strength = "moderate";
  } else {
    strength = "weak";
  }

  // Calculate percentage change
  const firstValue = maxValues[0];
  const lastValue = maxValues[maxValues.length - 1];
  const changePercentage = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

  // Calculate timespan
  const firstDate = new Date(sortedData[0].date);
  const lastDate = new Date(sortedData[sortedData.length - 1].date);
  const timespan = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

  return {
    direction,
    strength,
    confidence: rSquared,
    changePercentage,
    dataPoints: data.length,
    timespan,
  };
}

// ============================================================================
// CONSISTENCY CALCULATIONS
// ============================================================================

/**
 * Calculate consistency metrics from workout dates
 */
export function calculateConsistencyMetrics(workoutDates: string[]): ConsistencyMetrics {
  if (workoutDates.length === 0) {
    return {
      frequency: 0,
      adherence: 0,
      streak: 0,
      longestStreak: 0,
      averageRestDays: 0,
    };
  }

  // Sort dates
  const sortedDates = workoutDates.map((date) => new Date(date)).sort((a, b) => a.getTime() - b.getTime());

  // Calculate frequency (sessions per week)
  const firstDate = sortedDates[0];
  const lastDate = sortedDates[sortedDates.length - 1];
  const totalDays = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  const totalWeeks = Math.max(1, totalDays / 7);
  const frequency = workoutDates.length / totalWeeks;

  // Calculate rest days between sessions
  const restDays: number[] = [];
  for (let i = 1; i < sortedDates.length; i++) {
    const daysBetween = Math.ceil((sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24));
    restDays.push(daysBetween - 1); // Subtract 1 to get rest days
  }

  const averageRestDays = restDays.length > 0 ? restDays.reduce((sum, days) => sum + days, 0) / restDays.length : 0;

  // Calculate streaks (consecutive workout days within reasonable gaps)
  let currentStreak = 1;
  let longestStreak = 1;
  let tempStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const daysBetween = Math.ceil((sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24));

    if (daysBetween <= 3) {
      // Consider it part of the streak if within 3 days
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }

  longestStreak = Math.max(longestStreak, tempStreak);

  // Current streak (from the end)
  const now = new Date();
  const daysSinceLastWorkout = Math.ceil((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceLastWorkout <= 7) {
    // Still in streak if last workout was within a week
    currentStreak = 1;
    for (let i = sortedDates.length - 2; i >= 0; i--) {
      const daysBetween = Math.ceil((sortedDates[i + 1].getTime() - sortedDates[i].getTime()) / (1000 * 60 * 60 * 24));
      if (daysBetween <= 3) {
        currentStreak++;
      } else {
        break;
      }
    }
  } else {
    currentStreak = 0;
  }

  // Adherence (placeholder - would need planned vs actual sessions)
  const adherence = Math.min(100, (frequency / 3) * 100); // Assume 3 sessions per week target

  return {
    frequency,
    adherence,
    streak: currentStreak,
    longestStreak,
    averageRestDays,
  };
}

// ============================================================================
// STATISTICAL UTILITIES
// ============================================================================

/**
 * Calculate linear regression
 */
export function calculateLinearRegression(
  xValues: number[],
  yValues: number[]
): {
  slope: number;
  intercept: number;
  rSquared: number;
} {
  if (xValues.length !== yValues.length || xValues.length < 2) {
    return { slope: 0, intercept: 0, rSquared: 0 };
  }

  const n = xValues.length;
  const sumX = xValues.reduce((sum, x) => sum + x, 0);
  const sumY = yValues.reduce((sum, y) => sum + y, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
  const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
  const sumYY = yValues.reduce((sum, y) => sum + y * y, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const yMean = sumY / n;
  const totalSumSquares = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
  const residualSumSquares = yValues.reduce((sum, y, i) => {
    const predicted = slope * xValues[i] + intercept;
    return sum + Math.pow(y - predicted, 2);
  }, 0);

  const rSquared = totalSumSquares > 0 ? 1 - residualSumSquares / totalSumSquares : 0;

  return {
    slope,
    intercept,
    rSquared: Math.max(0, Math.min(1, rSquared)), // Clamp between 0 and 1
  };
}

/**
 * Calculate moving average
 */
export function calculateMovingAverage(values: number[], windowSize: number): number[] {
  if (windowSize <= 0 || windowSize > values.length) {
    return values;
  }

  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1);
    const average = window.reduce((sum, val) => sum + val, 0) / window.length;
    result.push(average);
  }

  return result;
}

/**
 * Calculate standard deviation
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDifferences = values.map((val) => Math.pow(val - mean, 2));
  const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length;

  return Math.sqrt(variance);
}

// ============================================================================
// SPECIALIZED CALCULATIONS
// ============================================================================

/**
 * Calculate Wilks score (powerlifting strength standard)
 */
export function calculateWilksScore(weight: number, bodyweight: number, gender: "male" | "female" = "male"): number {
  if (bodyweight <= 0 || weight <= 0) return 0;

  // Wilks coefficients
  const coefficients = {
    male: {
      a: -216.0475144,
      b: 16.2606339,
      c: -0.002388645,
      d: -0.00113732,
      e: 7.01863e-6,
      f: -1.291e-8,
    },
    female: {
      a: 594.31747775582,
      b: -27.23842536447,
      c: 0.82112226871,
      d: -0.00930733913,
      e: 4.731582e-5,
      f: -9.054e-8,
    },
  };

  const coeff = coefficients[gender];
  const bw = bodyweight;

  const denominator =
    coeff.a +
    coeff.b * bw +
    coeff.c * Math.pow(bw, 2) +
    coeff.d * Math.pow(bw, 3) +
    coeff.e * Math.pow(bw, 4) +
    coeff.f * Math.pow(bw, 5);

  const wilksCoefficient = 500 / denominator;
  return Math.round(weight * wilksCoefficient * 100) / 100;
}

/**
 * Calculate training load (volume * intensity)
 */
export function calculateTrainingLoad(sets: ExerciseSet[]): number {
  const workingSets = sets.filter((set) => !set.isWarmup && set.weightKg && set.reps);

  if (workingSets.length === 0) return 0;

  return workingSets.reduce((total, set) => {
    const volume = (set.weightKg || 0) * (set.reps || 0);
    const intensity = (set.rpe || 7) / 10; // Normalize RPE to 0-1
    return total + volume * intensity;
  }, 0);
}

/**
 * Calculate fatigue index from RPE progression
 */
export function calculateFatigueIndex(rpeSets: number[]): number {
  if (rpeSets.length < 2) return 0;

  // Calculate how much RPE increases across sets
  let totalIncrease = 0;
  for (let i = 1; i < rpeSets.length; i++) {
    totalIncrease += Math.max(0, rpeSets[i] - rpeSets[i - 1]);
  }

  // Normalize by number of sets
  return totalIncrease / (rpeSets.length - 1);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default calculateOneRepMax;
