// ============================================================================
// PROGRESSION SERVICE
// ============================================================================
// Sophisticated progression engine with experience-level specific logic,
// RPE-based progression decisions, plateau detection, and alternative strategies

import type {
  ProgressionContext,
  ProgressionRecommendation,
  SessionProgressionData,
  UntrainedProgressionData,
  BeginnerProgressionData,
  EarlyIntermediateProgressionData,
  PlateauDetection,
  ProgressionStatistics,
  FormAssessmentResponse,
  EquipmentType,
  ExerciseCategory,
} from "../types/progression";
import type { ExerciseSet, ExperienceLevel } from "../types";

import {
  PROGRESSION_RULES,
  getWeightIncrement,
  getDefaultRPETarget,
  getExperienceMessage,
} from "../constants/progressionRules";

import {
  calculateTotalVolume,
  calculateAverageRPE,
  findMaxWeight,
  checkTargetRepsCompleted,
  detectPlateau,
  generateProgressionStatistics,
} from "../utils/progressionCalculations";

import { logger } from "../utils/logger";

// ============================================================================
// MAIN PROGRESSION SERVICE
// ============================================================================

export class ProgressionService {
  /**
   * Calculate progression recommendation based on user experience level and recent performance
   */
  async calculateProgression(context: ProgressionContext): Promise<ProgressionRecommendation> {
    try {
      logger.info(
        "Calculating progression",
        {
          exerciseId: context.exerciseId,
          experienceLevel: context.experienceLevel,
          sessionsAnalyzed: context.recentSessions.length,
        },
        "progression",
        context.userId
      );

      // Validate input data
      if (context.recentSessions.length === 0) {
        return this.generateInsufficientDataRecommendation(context);
      }

      // Route to experience-specific algorithm
      switch (context.experienceLevel) {
        case "untrained":
          return await this.calculateUntrainedProgression(context);
        case "beginner":
          return await this.calculateBeginnerProgression(context);
        case "early_intermediate":
          return await this.calculateRPEBasedProgression(context);
        default:
          return await this.calculateConservativeProgression(context);
      }
    } catch (error) {
      logger.error("Progression calculation failed", error, "progression", context.userId);
      return this.generateErrorRecommendation(context, error);
    }
  }

  /**
   * Untrained progression: Focus on form mastery and consistency
   */
  private async calculateUntrainedProgression(context: ProgressionContext): Promise<ProgressionRecommendation> {
    const rules = PROGRESSION_RULES.untrained;
    const progressionData = this.buildUntrainedProgressionData(context);

    // Hard requirement: minimum weeks at current weight
    if (progressionData.weeksAtWeight < rules.minimumWeeksAtWeight) {
      return {
        shouldProgress: false,
        recommendedAction: "technique_focus",
        reason: `Focus on perfecting form. Use current weight for at least ${rules.minimumWeeksAtWeight} weeks total.`,
        confidence: "high",
        educationalTips: [
          "Master the movement pattern before adding weight",
          "Focus on full range of motion and controlled tempo",
          "Ensure you feel the exercise in the target muscles",
        ],
        nextReviewDate: this.calculateNextReviewDate(7), // Review weekly
      };
    }

    // Check form consistency and confidence
    const meetsConfidenceThreshold = progressionData.confidenceScore >= rules.requiredConfidenceScore;
    const meetsConsistencyThreshold = progressionData.formConsistencyScore >= rules.requiredConsistencyScore;

    if (!meetsConfidenceThreshold || !meetsConsistencyThreshold) {
      return {
        shouldProgress: false,
        recommendedAction: "technique_focus",
        reason: `Continue practicing current weight. ${!meetsConfidenceThreshold ? "Build movement confidence. " : ""}${
          !meetsConsistencyThreshold ? "Improve form consistency." : ""
        }`,
        confidence: "high",
        alternativeActions: [
          {
            type: "form_check",
            description: "Record yourself or work with a trainer to verify form",
          },
        ],
        educationalTips: [
          "Quality over quantity - perfect practice makes perfect",
          "Focus on feeling the exercise in the right muscles",
          "Take time to set up properly for each set",
        ],
        nextReviewDate: this.calculateNextReviewDate(7),
      };
    }

    // All criteria met - ready for small progression
    const recommendedWeight = context.currentWeight + getWeightIncrement(context.equipmentType, "untrained");

    return {
      shouldProgress: true,
      recommendedAction: "increase_weight",
      recommendedWeight,
      reason: getExperienceMessage("untrained", "progression_earned"),
      confidence: "high",
      educationalTips: [
        "Great job mastering the movement!",
        "Continue focusing on form with the new weight",
        "Small, consistent increases lead to long-term success",
      ],
      nextReviewDate: this.calculateNextReviewDate(14), // Review in 2 weeks
    };
  }

  /**
   * Beginner progression: Linear progression based on rep completion
   */
  private async calculateBeginnerProgression(context: ProgressionContext): Promise<ProgressionRecommendation> {
    const rules = PROGRESSION_RULES.beginner;
    const progressionData = this.buildBeginnerProgressionData(context);

    // Check for plateau (no progression for threshold weeks)
    const plateauDetection = detectPlateau(context.recentSessions, "beginner");
    if (plateauDetection.isPlateaued) {
      return this.generatePlateauRecommendation(context, plateauDetection);
    }

    // Check if user has completed target reps consistently
    const recentSessions = context.recentSessions.slice(0, rules.requiredConsecutiveSessions);
    const allSessionsSuccessful = recentSessions.every((session) => session.completedTargetReps);

    if (!allSessionsSuccessful) {
      return {
        shouldProgress: false,
        recommendedAction: "maintain",
        reason: getExperienceMessage("beginner", "progression_denied"),
        confidence: "high",
        alternativeActions: [
          {
            type: "technique_focus",
            description: "Focus on completing all prescribed reps with good form",
          },
        ],
        educationalTips: [
          "Consistency is key for linear progression",
          "Complete all target reps before adding weight",
          "Rest adequately between sessions for recovery",
        ],
        nextReviewDate: this.calculateNextReviewDate(7),
      };
    }

    // Ready for linear progression
    const recommendedWeight = context.currentWeight + getWeightIncrement(context.equipmentType, "beginner");

    return {
      shouldProgress: true,
      recommendedAction: "increase_weight",
      recommendedWeight,
      reason: getExperienceMessage("beginner", "progression_earned"),
      confidence: "high",
      educationalTips: [
        "Linear progression is working great!",
        "Continue this pattern of consistent increases",
        "Track your progress to stay motivated",
      ],
      nextReviewDate: this.calculateNextReviewDate(7), // Weekly progression
    };
  }

  /**
   * Early intermediate progression: RPE-based auto-regulation
   */
  private async calculateRPEBasedProgression(context: ProgressionContext): Promise<ProgressionRecommendation> {
    const rules = PROGRESSION_RULES.early_intermediate;
    const progressionData = this.buildEarlyIntermediateProgressionData(context);

    // Check for plateau first
    const plateauDetection = detectPlateau(context.recentSessions, "early_intermediate");
    if (plateauDetection.isPlateaued) {
      return this.generatePlateauRecommendation(context, plateauDetection);
    }

    // Insufficient RPE data
    if (progressionData.currentAverageRPE === 0) {
      return {
        shouldProgress: false,
        recommendedAction: "maintain",
        reason: "RPE data needed for progression decisions. Please rate your sets.",
        confidence: "low",
        educationalTips: [
          "RPE (Rate of Perceived Exertion) guides smart progression",
          "Rate each working set on a 1-10 scale",
          "Be honest - RPE varies based on sleep, stress, and nutrition",
        ],
        nextReviewDate: this.calculateNextReviewDate(7),
      };
    }

    // Check for deload conditions
    if (this.shouldDeload(progressionData, rules)) {
      const deloadWeight =
        Math.round(context.currentWeight * (1 - rules.deloadProtocol.deloadPercentage / 100) * 100) / 100;

      return {
        shouldProgress: true,
        recommendedAction: "deload",
        recommendedWeight: deloadWeight,
        reason: `RPE trending too high (${progressionData.currentAverageRPE.toFixed(
          1
        )}). Deload recommended to manage fatigue.`,
        confidence: "high",
        alternativeActions: [
          {
            type: "rest_day",
            description: "Take an extra rest day before deloading",
            parameters: { restDays: 1 },
          },
        ],
        educationalTips: [
          "Deloads are a tool, not a failure",
          "Reducing weight temporarily allows for continued long-term progress",
          "Focus on recovery during deload week",
        ],
        nextReviewDate: this.calculateNextReviewDate(7),
      };
    }

    // Check if RPE has dropped enough to warrant progression
    const rpeDropped = progressionData.targetRPE - progressionData.currentAverageRPE;

    if (rpeDropped >= rules.rpeDropThreshold) {
      const recommendedWeight = context.currentWeight + getWeightIncrement(context.equipmentType, "early_intermediate");

      return {
        shouldProgress: true,
        recommendedAction: "increase_weight",
        recommendedWeight,
        reason: getExperienceMessage("early_intermediate", "progression_earned"),
        confidence: "high",
        educationalTips: [
          `RPE dropped to ${progressionData.currentAverageRPE.toFixed(1)} - you've earned this increase!`,
          "RPE-based progression ensures you progress when ready",
          "Continue rating your sets honestly",
        ],
        nextReviewDate: this.calculateNextReviewDate(14),
      };
    }

    // RPE still too high - maintain current weight
    return {
      shouldProgress: false,
      recommendedAction: "maintain",
      reason: `Current RPE ${progressionData.currentAverageRPE.toFixed(1)} - maintain until RPE ≤ ${(
        progressionData.targetRPE - rules.rpeDropThreshold
      ).toFixed(1)}`,
      confidence: "high",
      educationalTips: [
        "Your body is still adapting to the current load",
        "Patience with RPE-based progression leads to long-term success",
        "Focus on consistency and recovery",
      ],
      nextReviewDate: this.calculateNextReviewDate(7),
    };
  }

  /**
   * Conservative progression for advanced users or fallback
   */
  private async calculateConservativeProgression(context: ProgressionContext): Promise<ProgressionRecommendation> {
    return {
      shouldProgress: false,
      recommendedAction: "maintain",
      reason: "Advanced progression requires individualized programming beyond automated recommendations.",
      confidence: "low",
      alternativeActions: [
        {
          type: "form_check",
          description: "Consider working with a qualified coach for advanced progression strategies",
        },
      ],
      educationalTips: [
        "Advanced trainees benefit from periodized programming",
        "Consider working with a coach for personalized guidance",
        "Focus on consistency and long-term progress trends",
      ],
      nextReviewDate: this.calculateNextReviewDate(14),
    };
  }

  // ============================================================================
  // DATA BUILDING METHODS
  // ============================================================================

  private buildUntrainedProgressionData(context: ProgressionContext): UntrainedProgressionData {
    const recentSessions = context.recentSessions.slice(0, 6); // Last 6 sessions

    // Calculate form consistency score from form ratings
    const formRatings = recentSessions
      .filter((session) => session.formRating !== undefined)
      .map((session) => session.formRating!);

    const formConsistencyScore =
      formRatings.length > 0
        ? formRatings.reduce((sum, rating) => sum + rating, 0) / formRatings.length / 5 // Normalize to 0-1
        : 0;

    // Calculate confidence score from confidence ratings
    const confidenceRatings = recentSessions
      .filter((session) => session.confidence !== undefined)
      .map((session) => session.confidence!);

    const confidenceScore =
      confidenceRatings.length > 0
        ? confidenceRatings.reduce((sum, rating) => sum + rating, 0) / confidenceRatings.length
        : 0;

    // Calculate completion rate
    const completionRate =
      recentSessions.length > 0
        ? recentSessions.filter((session) => session.completedTargetReps).length / recentSessions.length
        : 0;

    // Check target muscle activation
    const targetMuscleActivation = recentSessions
      .filter((session) => session.targetMuscleActivation !== undefined)
      .every((session) => session.targetMuscleActivation === true);

    return {
      weeksAtWeight: context.weeksAtCurrentWeight,
      formConsistencyScore,
      confidenceScore,
      targetMuscleActivation,
      completionRate,
      selfAssessmentResponses: [], // Would be populated from actual form assessments
    };
  }

  private buildBeginnerProgressionData(context: ProgressionContext): BeginnerProgressionData {
    const recentSessions = context.recentSessions.slice(0, 4); // Last 4 sessions

    // Count consecutive successful sessions
    let consecutiveSuccessfulSessions = 0;
    for (const session of recentSessions) {
      if (session.completedTargetReps) {
        consecutiveSuccessfulSessions++;
      } else {
        break;
      }
    }

    // Calculate rep completion consistency
    const repCompletionConsistency =
      recentSessions.length > 0
        ? recentSessions.filter((session) => session.completedTargetReps).length / recentSessions.length
        : 0;

    // Estimate linear progression rate (weight gain per week)
    const linearProgressionRate = this.calculateProgressionRate(recentSessions);

    return {
      consecutiveSuccessfulSessions,
      linearProgressionRate,
      repCompletionConsistency,
      missedSessions: 0, // Would need additional data to calculate
      totalWeeksTraining: Math.max(context.weeksAtCurrentWeight, 4), // Estimate
    };
  }

  private buildEarlyIntermediateProgressionData(context: ProgressionContext): EarlyIntermediateProgressionData {
    const recentSessions = context.recentSessions.slice(0, 6); // Last 6 sessions

    // Calculate current average RPE
    const rpeValues = recentSessions
      .filter((session) => session.averageRPE !== null)
      .map((session) => session.averageRPE!);

    const currentAverageRPE =
      rpeValues.length > 0 ? rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length : 0;

    // Calculate RPE consistency (lower variance = more consistent)
    const rpeVariance = this.calculateVariance(rpeValues);
    const rpeConsistency = 1 / (1 + rpeVariance); // Convert variance to consistency score

    // Determine if progression is earned based on RPE drop
    const targetRPE = context.targetRPE || getDefaultRPETarget(context.exerciseCategory);
    const rpeDropRequired = PROGRESSION_RULES.early_intermediate.rpeDropThreshold;
    const progressionEarned = currentAverageRPE <= targetRPE - rpeDropRequired;

    return {
      currentAverageRPE,
      targetRPE,
      rpeDropRequired,
      rpeConsistency,
      autoRegulationScore: rpeConsistency, // Simplified - could be more complex
      progressionEarned,
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private shouldDeload(data: EarlyIntermediateProgressionData, rules: any): boolean {
    // Check if RPE is consistently too high
    const rpeThreshold = data.targetRPE + 1.5; // 1.5 points above target
    return data.currentAverageRPE >= rpeThreshold;
  }

  private calculateProgressionRate(sessions: SessionProgressionData[]): number {
    if (sessions.length < 2) return 0;

    const sortedSessions = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const firstSession = sortedSessions[0];
    const lastSession = sortedSessions[sortedSessions.length - 1];

    const weightChange = lastSession.maxWeight - firstSession.maxWeight;
    const timeDiffMs = new Date(lastSession.date).getTime() - new Date(firstSession.date).getTime();
    const timeDiffWeeks = timeDiffMs / (1000 * 60 * 60 * 24 * 7);

    return timeDiffWeeks > 0 ? weightChange / timeDiffWeeks : 0;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

    return variance;
  }

  private generatePlateauRecommendation(
    context: ProgressionContext,
    plateauDetection: PlateauDetection
  ): ProgressionRecommendation {
    const primaryStrategy = plateauDetection.recommendations[0];

    if (!primaryStrategy) {
      return {
        shouldProgress: false,
        recommendedAction: "maintain",
        reason: "Plateau detected but no clear strategy available. Continue current program.",
        confidence: "low",
        nextReviewDate: this.calculateNextReviewDate(7),
      };
    }

    let recommendedAction: any = "maintain";
    let recommendedWeight: number | undefined;

    switch (primaryStrategy.strategy) {
      case "deload":
        recommendedAction = "deload";
        recommendedWeight = Math.round(context.currentWeight * 0.85 * 100) / 100; // 15% reduction
        break;
      case "volume_manipulation":
        recommendedAction = "maintain";
        break;
      default:
        recommendedAction = "maintain";
    }

    return {
      shouldProgress: recommendedAction !== "maintain",
      recommendedAction,
      recommendedWeight,
      reason: `Plateau detected (${plateauDetection.plateauDuration} weeks). ${primaryStrategy.description}`,
      confidence: plateauDetection.statisticalConfidence > 0.7 ? "high" : "medium",
      alternativeActions: plateauDetection.recommendations.slice(1, 3).map((strategy) => ({
        type: strategy.strategy as any,
        description: strategy.description,
      })),
      educationalTips: [
        "Plateaus are normal and expected in training",
        "Strategic changes help break through sticking points",
        "Focus on recovery and consistency during plateau-breaking phases",
      ],
      nextReviewDate: this.calculateNextReviewDate(7),
    };
  }

  private generateInsufficientDataRecommendation(context: ProgressionContext): ProgressionRecommendation {
    return {
      shouldProgress: false,
      recommendedAction: "maintain",
      reason: "Insufficient workout data to make progression recommendation. Complete more sessions.",
      confidence: "low",
      educationalTips: [
        "Consistent training data helps provide better recommendations",
        "Log at least 3-4 sessions before expecting progression guidance",
        "Focus on learning proper form and building consistency",
      ],
      nextReviewDate: this.calculateNextReviewDate(7),
    };
  }

  private generateErrorRecommendation(context: ProgressionContext, error: any): ProgressionRecommendation {
    return {
      shouldProgress: false,
      recommendedAction: "maintain",
      reason: "Unable to calculate progression recommendation due to technical error.",
      confidence: "low",
      educationalTips: [
        "Continue with your current program",
        "Focus on consistency and proper form",
        "Try again after your next workout",
      ],
      nextReviewDate: this.calculateNextReviewDate(7),
    };
  }

  private calculateNextReviewDate(daysFromNow: number): string {
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + daysFromNow);
    return nextReview.toISOString();
  }

  // ============================================================================
  // PUBLIC UTILITY METHODS
  // ============================================================================

  /**
   * Build progression context from workout data
   */
  buildProgressionContext(
    userId: string,
    exerciseId: string,
    exerciseName: string,
    experienceLevel: ExperienceLevel,
    currentWeight: number,
    targetReps: number,
    targetRPE: number,
    recentSessions: SessionProgressionData[],
    weeksAtCurrentWeight: number,
    equipmentType: EquipmentType,
    exerciseCategory: ExerciseCategory
  ): ProgressionContext {
    return {
      userId,
      exerciseId,
      exerciseName,
      experienceLevel,
      currentWeight,
      targetReps,
      targetRPE,
      recentSessions,
      weeksAtCurrentWeight,
      equipmentType,
      exerciseCategory,
    };
  }

  /**
   * Convert exercise sets to session progression data
   */
  buildSessionProgressionData(
    sessionId: string,
    date: string,
    sets: ExerciseSet[],
    targetReps: number,
    formRating?: number,
    confidence?: number,
    targetMuscleActivation?: boolean
  ): SessionProgressionData {
    return {
      sessionId,
      date,
      sets,
      completedTargetReps: checkTargetRepsCompleted(sets, targetReps),
      averageRPE: calculateAverageRPE(sets),
      maxWeight: findMaxWeight(sets),
      totalVolume: calculateTotalVolume(sets),
      formRating,
      confidence,
      targetMuscleActivation,
    };
  }

  /**
   * Get comprehensive progression statistics
   */
  async getProgressionStatistics(
    sessions: SessionProgressionData[],
    timeframeWeeks: number,
    experienceLevel: string
  ): Promise<ProgressionStatistics> {
    return generateProgressionStatistics(sessions, timeframeWeeks, experienceLevel);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const progressionService = new ProgressionService();
export default progressionService;
