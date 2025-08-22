// ============================================================================
// PROGRESSION RULES
// ============================================================================
// Experience-based progression rule definitions with RPE thresholds,
// weight increments, and plateau detection parameters

import type {
  ExperienceLevelRules,
  EquipmentIncrements,
  FormAssessmentQuestion,
  DeloadProtocol,
} from "../types/progression";

// ============================================================================
// EQUIPMENT-BASED WEIGHT INCREMENTS
// ============================================================================

export const BEGINNER_INCREMENTS: EquipmentIncrements = {
  barbell: 2.5, // 2.5kg / 5lbs for compound movements
  dumbbell: 1.25, // 1.25kg / 2.5lbs for dumbbell exercises
  machine: 1.25, // 1.25kg / 2.5lbs for machine exercises
  cable: 1.25, // 1.25kg / 2.5lbs for cable exercises
  bodyweight: 1, // 1 additional rep for bodyweight exercises
};

export const EARLY_INTERMEDIATE_INCREMENTS: EquipmentIncrements = {
  barbell: 1.25, // 1.25kg / 2.5lbs for compound movements
  dumbbell: 0.625, // 0.625kg / 1.25lbs for dumbbell exercises
  machine: 0.625, // 0.625kg / 1.25lbs for machine exercises
  cable: 0.625, // 0.625kg / 1.25lbs for cable exercises
  bodyweight: 1, // 1 additional rep for bodyweight exercises
};

export const UNTRAINED_INCREMENTS: EquipmentIncrements = {
  barbell: 1.25, // Very small increases for untrained
  dumbbell: 0.625, // Focus on form, not weight
  machine: 0.625, // Conservative progression
  cable: 0.625, // Technique mastery first
  bodyweight: 1, // Rep progression when appropriate
};

// ============================================================================
// FORM ASSESSMENT QUESTIONS FOR UNTRAINED USERS
// ============================================================================

export const FORM_ASSESSMENT_QUESTIONS: FormAssessmentQuestion[] = [
  {
    id: "target_muscle_activation",
    question: "Did you feel this exercise primarily in your [target muscle group]?",
    type: "boolean",
    targetMuscle: "dynamic", // Will be replaced with actual target muscle
    weight: 0.3,
  },
  {
    id: "movement_confidence",
    question: "How confident are you with the movement pattern?",
    type: "scale",
    options: ["1 - Very unsure", "2 - Somewhat unsure", "3 - Neutral", "4 - Confident", "5 - Very confident"],
    weight: 0.25,
  },
  {
    id: "form_quality",
    question: "Did you complete all reps with good form?",
    type: "boolean",
    weight: 0.25,
  },
  {
    id: "joint_comfort",
    question: "Any pain or discomfort in joints or back?",
    type: "boolean",
    weight: 0.2, // Negative weight - pain reduces score
  },
];

// ============================================================================
// DELOAD PROTOCOLS
// ============================================================================

export const BEGINNER_DELOAD: DeloadProtocol = {
  triggerConditions: [
    "Failed to complete prescribed reps for 2 consecutive sessions",
    "RPE consistently above 9 for working sets",
    "User reports excessive fatigue or joint discomfort",
  ],
  deloadPercentage: 10, // 10% weight reduction
  deloadDuration: 1, // 1 week
  progressionAfterDeload: "Resume linear progression with previous increments",
};

export const EARLY_INTERMEDIATE_DELOAD: DeloadProtocol = {
  triggerConditions: [
    "RPE trending upward for 3+ weeks",
    "Average RPE above target + 1.5 for 2+ weeks",
    "No progression for 4+ weeks despite consistent training",
    "User reports poor recovery or sleep issues",
  ],
  deloadPercentage: 15, // 15% weight reduction
  deloadDuration: 1, // 1 week
  progressionAfterDeload: "Resume RPE-based progression with enhanced recovery focus",
};

// ============================================================================
// EXPERIENCE LEVEL RULES
// ============================================================================

export const PROGRESSION_RULES: ExperienceLevelRules = {
  untrained: {
    minimumWeeksAtWeight: 3,
    requiredConfidenceScore: 4, // Out of 5
    requiredConsistencyScore: 0.85, // 85% consistency
    formAssessmentQuestions: FORM_ASSESSMENT_QUESTIONS,
    progressionIncrements: UNTRAINED_INCREMENTS,
    focusMessage: "Focus on perfecting form and technique. Weight progression comes after mastery.",
  },
  beginner: {
    requiredConsecutiveSessions: 2,
    repCompletionThreshold: 0.9, // Must complete 90% of prescribed reps
    progressionSchedule: "weekly",
    progressionIncrements: BEGINNER_INCREMENTS,
    plateauThreshold: 3, // 3 weeks without progress triggers intervention
  },
  early_intermediate: {
    rpeDropThreshold: 1.0, // RPE must drop 1 full point below target
    rpeConsistencyRequired: 0.5, // Max RPE variance of 0.5
    plateauThreshold: 4, // 4 weeks without progress triggers plateau protocol
    progressionIncrements: EARLY_INTERMEDIATE_INCREMENTS,
    deloadProtocol: EARLY_INTERMEDIATE_DELOAD,
  },
};

// ============================================================================
// RPE TARGET MAPPINGS
// ============================================================================

export const DEFAULT_RPE_TARGETS = {
  // Main compound movements
  compound_lower: 8, // Squats, deadlifts
  compound_upper: 8, // Bench, overhead press, rows

  // Isolation movements
  isolation_upper: 8, // Curls, tricep extensions, lateral raises
  isolation_lower: 8, // Leg extensions, leg curls

  // Core and cardio
  core: 7, // Abs, planks
  cardio: 7, // Cardio-based exercises
};

// ============================================================================
// PLATEAU DETECTION PARAMETERS
// ============================================================================

export const PLATEAU_DETECTION_CONFIG = {
  // Minimum data points needed for plateau analysis
  minimumDataPoints: 6, // At least 6 sessions

  // Statistical thresholds
  trendSlopeThreshold: 0.1, // Slope must be < 0.1 to be considered "flat"
  confidenceThreshold: 0.7, // 70% statistical confidence required

  // Time windows for analysis
  analysisWindow: {
    beginner: 4, // 4 weeks
    early_intermediate: 6, // 6 weeks
    intermediate: 8, // 8 weeks
  },

  // Plateau breaking strategies
  strategies: [
    {
      strategy: "deload" as const,
      description: "Reduce weight by 10-15% for 1 week, then resume progression",
      duration: 1,
      expectedOutcome: "Reset fatigue and allow for continued progression",
    },
    {
      strategy: "volume_manipulation" as const,
      description: "Add 1-2 additional sets to increase training volume",
      duration: 2,
      expectedOutcome: "Increase training stimulus to drive adaptation",
    },
    {
      strategy: "periodization" as const,
      description: "Switch to different rep ranges (strength vs hypertrophy focus)",
      duration: 4,
      expectedOutcome: "Provide novel stimulus and break through plateau",
    },
    {
      strategy: "exercise_variation" as const,
      description: "Temporarily substitute with similar exercise variation",
      duration: 3,
      expectedOutcome: "Address weak points and provide movement variety",
    },
  ],
};

// ============================================================================
// EDUCATIONAL CONTENT
// ============================================================================

export const PROGRESSION_EDUCATION = {
  rpe_scale: {
    concept: "RPE (Rate of Perceived Exertion)",
    explanation: "RPE is a 1-10 scale rating how difficult a set was, with 10 being absolute failure.",
    examples: [
      "RPE 7: Could have done 3 more reps",
      "RPE 8: Could have done 2 more reps",
      "RPE 9: Could have done 1 more rep",
      "RPE 10: Absolute failure, no more reps possible",
    ],
    tips: [
      "Be honest with your RPE ratings - they guide your progression",
      "RPE can vary day to day based on sleep, stress, and nutrition",
      "Focus on the difficulty of the last rep, not the entire set",
    ],
    commonMistakes: [
      "Rating RPE too low to progress faster (leads to burnout)",
      "Rating RPE too high out of caution (slows progress)",
      "Not considering external factors affecting performance",
    ],
  },

  progressive_overload: {
    concept: "Progressive Overload",
    explanation: "The gradual increase of stress placed on the body during exercise to drive adaptation.",
    examples: [
      "Adding weight to the bar when RPE drops",
      "Performing more reps at the same weight",
      "Adding additional sets to increase volume",
    ],
    tips: [
      "Progression should be earned, not forced",
      "Small, consistent increases are better than large jumps",
      "Listen to your body and adjust based on recovery",
    ],
    commonMistakes: [
      "Adding weight too quickly without mastering current load",
      "Ignoring RPE feedback and forcing progression",
      "Not allowing adequate recovery between sessions",
    ],
  },

  plateau_management: {
    concept: "Training Plateaus",
    explanation: "Periods where progress stalls despite consistent training effort.",
    examples: [
      "Weight hasn't increased for 4+ weeks",
      "RPE remains high despite consistent training",
      "Feeling stuck at current performance level",
    ],
    tips: [
      "Plateaus are normal and expected in training",
      "Focus on recovery, nutrition, and sleep quality",
      "Consider deload weeks or exercise variations",
    ],
    commonMistakes: [
      "Panicking and making drastic program changes",
      "Adding more volume when recovery is the issue",
      "Ignoring lifestyle factors affecting performance",
    ],
  },
};

// ============================================================================
// EXPERIENCE LEVEL MESSAGING
// ============================================================================

export const EXPERIENCE_MESSAGES = {
  untrained: {
    focus: "Master the movement patterns and build consistency",
    progression_earned: "Great form consistency! You've earned this small increase.",
    progression_denied: "Keep practicing current weight until form is more consistent.",
    encouragement: "Focus on quality over quantity. Perfect practice makes perfect!",
  },

  beginner: {
    focus: "Build strength through consistent linear progression",
    progression_earned: "Congratulations! You've earned your weekly strength increase!",
    progression_denied: "Complete all prescribed reps before adding weight.",
    encouragement: "Linear gains are the best gains! Keep up the consistent work.",
  },

  early_intermediate: {
    focus: "Use RPE to guide intelligent progression decisions",
    progression_earned: "Your RPE has dropped - time to challenge yourself with more weight!",
    progression_denied: "Current RPE indicates you're still adapting to this load.",
    encouragement: "Smart progression based on RPE will lead to long-term success.",
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get appropriate weight increment based on equipment type and experience level
 */
export function getWeightIncrement(
  equipmentType: string,
  experienceLevel: "untrained" | "beginner" | "early_intermediate"
): number {
  const incrementMaps = {
    untrained: UNTRAINED_INCREMENTS,
    beginner: BEGINNER_INCREMENTS,
    early_intermediate: EARLY_INTERMEDIATE_INCREMENTS,
  };

  const increments = incrementMaps[experienceLevel];
  return increments[equipmentType as keyof EquipmentIncrements] || increments.machine;
}

/**
 * Get default RPE target for exercise category
 */
export function getDefaultRPETarget(exerciseCategory: string): number {
  return DEFAULT_RPE_TARGETS[exerciseCategory as keyof typeof DEFAULT_RPE_TARGETS] || 8;
}

/**
 * Get plateau detection window for experience level
 */
export function getPlateauWindow(experienceLevel: string): number {
  return (
    PLATEAU_DETECTION_CONFIG.analysisWindow[experienceLevel as keyof typeof PLATEAU_DETECTION_CONFIG.analysisWindow] ||
    6
  );
}

/**
 * Get experience-appropriate messaging
 */
export function getExperienceMessage(
  experienceLevel: "untrained" | "beginner" | "early_intermediate",
  messageType: "focus" | "progression_earned" | "progression_denied" | "encouragement"
): string {
  return EXPERIENCE_MESSAGES[experienceLevel][messageType];
}

// ============================================================================
// PROGRESSION DISPLAY HELPERS (KG -> IMPERIAL)
// ============================================================================

import { kgToLbs, roundToNearest } from "../utils/unitConversions";

/**
 * Map a kg increment to a practical lb increment for display.
 * Rules:
 * - For very small increments (<5lbs) round to nearest 0.5 lb
 * - For moderate increments (5-12lbs) round to nearest 2.5 lb
 * - For larger increments (>=12lbs) round to nearest 5 lb
 */
export function mapKgIncrementToPracticalLb(incrementKg: number): number {
  const lbs = kgToLbs(incrementKg);
  let step = 2.5;
  if (lbs < 5) step = 0.5;
  else if (lbs >= 12) step = 5;
  return roundToNearest(lbs, step);
}

/**
 * Format a progression increment (kg) for display according to desired units.
 * units: "kg" | "lbs"
 */
export function formatProgressionIncrement(incrementKg: number, units: "kg" | "lbs" = "kg"): string {
  if (units === "kg") {
    return `${incrementKg}kg`;
  }
  const lbs = mapKgIncrementToPracticalLb(incrementKg);
  const display = Number.isInteger(lbs) ? String(lbs) : lbs.toFixed(1);
  return `${display} lbs`;
}

export default {
  PROGRESSION_RULES,
  PLATEAU_DETECTION_CONFIG,
  PROGRESSION_EDUCATION,
  getWeightIncrement,
  getDefaultRPETarget,
  getPlateauWindow,
  getExperienceMessage,
  mapKgIncrementToPracticalLb,
  formatProgressionIncrement,
};
