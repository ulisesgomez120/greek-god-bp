// ============================================================================
// PROGRESSION TYPES
// ============================================================================
// Comprehensive TypeScript interfaces for experience-based progression algorithms

import type { ExperienceLevel, ExerciseSet, Exercise } from "./index";

// ============================================================================
// CORE PROGRESSION TYPES
// ============================================================================

export interface ProgressionContext {
  userId: string;
  exerciseId: string;
  exerciseName: string;
  experienceLevel: ExperienceLevel;
  currentWeight: number;
  targetReps: number;
  targetRPE: number;
  recentSessions: SessionProgressionData[];
  weeksAtCurrentWeight: number;
  equipmentType: EquipmentType;
  exerciseCategory: ExerciseCategory;
}

export interface SessionProgressionData {
  sessionId: string;
  date: string;
  sets: ExerciseSet[];
  completedTargetReps: boolean;
  averageRPE: number | null;
  maxWeight: number;
  totalVolume: number;
  formRating?: number; // 1-5 scale for untrained users
  confidence?: number; // 1-5 scale for untrained users
  targetMuscleActivation?: boolean; // Self-assessment for untrained
}

export interface ProgressionRecommendation {
  shouldProgress: boolean;
  recommendedAction: ProgressionAction;
  recommendedWeight?: number;
  recommendedReps?: number;
  reason: string;
  confidence: ProgressionConfidence;
  alternativeActions?: AlternativeAction[];
  educationalTips?: string[];
  nextReviewDate?: string;
}

export interface AlternativeAction {
  type: "deload" | "volume_increase" | "technique_focus" | "rest_day" | "form_check";
  description: string;
  parameters?: {
    deloadPercentage?: number;
    additionalSets?: number;
    restDays?: number;
  };
}

export interface PlateauDetection {
  isPlateaued: boolean;
  plateauDuration: number; // weeks
  plateauType: "strength" | "volume" | "rpe" | "mixed";
  statisticalConfidence: number; // 0-1
  trendAnalysis: {
    weightTrend: "increasing" | "decreasing" | "stable";
    rpeTrend: "increasing" | "decreasing" | "stable";
    volumeTrend: "increasing" | "decreasing" | "stable";
  };
  recommendations: PlateauBreakingStrategy[];
}

export interface PlateauBreakingStrategy {
  strategy: "deload" | "periodization" | "exercise_variation" | "volume_manipulation" | "intensity_technique";
  description: string;
  duration: number; // weeks
  expectedOutcome: string;
}

// ============================================================================
// EXPERIENCE-SPECIFIC TYPES
// ============================================================================

export interface UntrainedProgressionData {
  weeksAtWeight: number;
  formConsistencyScore: number; // 0-1
  confidenceScore: number; // 1-5
  targetMuscleActivation: boolean;
  completionRate: number; // percentage of prescribed reps completed
  selfAssessmentResponses: FormAssessmentResponse[];
}

export interface BeginnerProgressionData {
  consecutiveSuccessfulSessions: number;
  linearProgressionRate: number; // kg per week
  repCompletionConsistency: number; // 0-1
  missedSessions: number;
  totalWeeksTraining: number;
}

export interface EarlyIntermediateProgressionData {
  currentAverageRPE: number;
  targetRPE: number;
  rpeDropRequired: number; // typically 1.0
  rpeConsistency: number; // variance in RPE ratings
  autoRegulationScore: number; // how well they use RPE
  progressionEarned: boolean;
}

export interface FormAssessmentResponse {
  question: string;
  response: boolean | number;
  timestamp: string;
}

// ============================================================================
// PROGRESSION RULES & PARAMETERS
// ============================================================================

export interface ExperienceLevelRules {
  untrained: UntrainedRules;
  beginner: BeginnerRules;
  early_intermediate: EarlyIntermediateRules;
}

export interface UntrainedRules {
  minimumWeeksAtWeight: number;
  requiredConfidenceScore: number;
  requiredConsistencyScore: number;
  formAssessmentQuestions: FormAssessmentQuestion[];
  progressionIncrements: EquipmentIncrements;
  focusMessage: string;
}

export interface BeginnerRules {
  requiredConsecutiveSessions: number;
  repCompletionThreshold: number; // percentage
  progressionSchedule: "weekly" | "bi_weekly";
  progressionIncrements: EquipmentIncrements;
  plateauThreshold: number; // weeks without progress
}

export interface EarlyIntermediateRules {
  rpeDropThreshold: number; // typically 1.0
  rpeConsistencyRequired: number; // max variance allowed
  plateauThreshold: number; // weeks without progress
  progressionIncrements: EquipmentIncrements;
  deloadProtocol: DeloadProtocol;
}

export interface EquipmentIncrements {
  barbell: number;
  dumbbell: number;
  machine: number;
  cable: number;
  bodyweight: number; // for rep progression
}

export interface DeloadProtocol {
  triggerConditions: string[];
  deloadPercentage: number;
  deloadDuration: number; // weeks
  progressionAfterDeload: string;
}

export interface FormAssessmentQuestion {
  id: string;
  question: string;
  type: "boolean" | "scale" | "multiple_choice";
  options?: string[];
  targetMuscle?: string;
  weight: number; // importance weight for scoring
}

// ============================================================================
// STATISTICAL ANALYSIS TYPES
// ============================================================================

export interface ProgressionStatistics {
  performanceTrend: PerformanceTrend;
  plateauAnalysis: PlateauAnalysis;
  consistencyMetrics: ConsistencyMetrics;
  progressionRate: ProgressionRate;
}

export interface PerformanceTrend {
  timeframe: number; // weeks analyzed
  weightProgression: {
    slope: number;
    rSquared: number;
    trend: "increasing" | "decreasing" | "stable";
  };
  volumeProgression: {
    slope: number;
    rSquared: number;
    trend: "increasing" | "decreasing" | "stable";
  };
  rpeProgression: {
    slope: number;
    rSquared: number;
    trend: "increasing" | "decreasing" | "stable";
  };
}

export interface PlateauAnalysis {
  isPlateaued: boolean;
  plateauDuration: number;
  plateauConfidence: number; // statistical confidence
  plateauType: "strength" | "volume" | "rpe" | "mixed";
  breakingStrategies: PlateauBreakingStrategy[];
}

export interface ConsistencyMetrics {
  rpeVariance: number;
  repCompletionRate: number;
  sessionAttendanceRate: number;
  formConsistencyScore: number;
}

export interface ProgressionRate {
  weightPerWeek: number;
  volumePerWeek: number;
  strengthGainRate: number; // estimated 1RM progression
  comparedToExpected: number; // percentage of expected progression rate
}

// ============================================================================
// UI/UX TYPES
// ============================================================================

export interface ProgressionIndicator {
  status: "ready" | "maintain" | "caution" | "deload";
  color: "green" | "yellow" | "orange" | "red";
  message: string;
  explanation: string;
  actionRequired: boolean;
}

export interface ProgressionEducation {
  concept: string;
  explanation: string;
  examples: string[];
  tips: string[];
  commonMistakes: string[];
}

export interface UserOverride {
  originalRecommendation: ProgressionRecommendation;
  userChoice: ProgressionAction;
  reason?: string;
  timestamp: string;
  warningShown: boolean;
  educationalContentViewed: boolean;
}

// ============================================================================
// ENUMS
// ============================================================================

export type ProgressionAction =
  | "increase_weight"
  | "increase_reps"
  | "maintain"
  | "deload"
  | "technique_focus"
  | "rest_period";

export type ProgressionConfidence = "high" | "medium" | "low";

export type EquipmentType = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" | "kettlebell";

export type ExerciseCategory =
  | "compound_lower"
  | "compound_upper"
  | "isolation_upper"
  | "isolation_lower"
  | "core"
  | "cardio";

// ============================================================================
// API TYPES
// ============================================================================

export interface ProgressionRequest {
  userId: string;
  exerciseId: string;
  weeksToAnalyze?: number;
  includeStatistics?: boolean;
}

export interface ProgressionResponse {
  recommendation: ProgressionRecommendation;
  statistics?: ProgressionStatistics;
  plateauDetection?: PlateauDetection;
  educationalContent?: ProgressionEducation;
  nextAssessmentDate: string;
}

export interface BulkProgressionRequest {
  userId: string;
  exerciseIds: string[];
  sessionId?: string;
}

export interface BulkProgressionResponse {
  recommendations: Record<string, ProgressionRecommendation>;
  overallAssessment: {
    readyToProgress: number;
    needMaintenance: number;
    requireAttention: number;
  };
  priorityRecommendations: ProgressionRecommendation[];
}

// ============================================================================
// EXPORT ALL TYPES
// ============================================================================

// All types are exported individually above
