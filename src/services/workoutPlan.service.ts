// ============================================================================
// WORKOUT PLAN SERVICE
// ============================================================================
// Service for loading workout plans, phases, and sessions from database

import { databaseService } from "./database.service";
import { logger } from "../utils/logger";
import type { WorkoutPlanWithSessions } from "../types/database";

// ============================================================================
// TYPES
// ============================================================================

export interface WorkoutPlanSummary {
  id: string;
  name: string;
  description: string;
  type: "full_body" | "upper_lower" | "body_part_split";
  frequencyPerWeek: number;
  durationWeeks: number;
  difficulty: number;
  targetExperience: string[];
}

export interface WorkoutPhase {
  id: string;
  name: string;
  description: string;
  weekStart: number;
  weekEnd: number;
  sessions: WorkoutSessionSummary[];
}

export interface WorkoutSessionSummary {
  id: string;
  name: string;
  dayNumber: number;
  weekNumber: number;
  estimatedDurationMinutes: number;
  exerciseCount: number;
  exercises: ExerciseSummary[];
}

export interface ExerciseSummary {
  id: string;
  name: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetRpe?: number;
  restSeconds?: number;
  notes?: string;
}

// ============================================================================
// WORKOUT PLAN SERVICE CLASS
// ============================================================================

export class WorkoutPlanService {
  private static instance: WorkoutPlanService;
  private cachedPlans: Map<string, WorkoutPlanWithSessions> = new Map();

  private constructor() {}

  public static getInstance(): WorkoutPlanService {
    if (!WorkoutPlanService.instance) {
      WorkoutPlanService.instance = new WorkoutPlanService();
    }
    return WorkoutPlanService.instance;
  }

  // ============================================================================
  // WORKOUT PLANS
  // ============================================================================

  /**
   * Get all available workout plans
   */
  async getWorkoutPlans(experienceLevel?: string): Promise<WorkoutPlanSummary[]> {
    try {
      const plans = await databaseService.getWorkoutPlans(experienceLevel);

      return plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description || "",
        type: plan.type as "full_body" | "upper_lower" | "body_part_split",
        frequencyPerWeek: plan.frequency_per_week || 0,
        durationWeeks: plan.duration_weeks || 0,
        difficulty: plan.difficulty || 1,
        targetExperience: plan.target_experience || [],
      }));
    } catch (error) {
      logger.error("Failed to load workout plans", error, "workoutPlan");
      throw error;
    }
  }

  /**
   * Get workout plan by ID with sessions
   */
  async getWorkoutPlanWithSessions(planId: string): Promise<WorkoutPlanWithSessions | null> {
    try {
      // Check cache first
      if (this.cachedPlans.has(planId)) {
        return this.cachedPlans.get(planId)!;
      }

      const plans = await databaseService.getWorkoutPlans();
      const plan = plans.find((p) => p.id === planId);

      if (plan) {
        this.cachedPlans.set(planId, plan);
      }

      return plan || null;
    } catch (error) {
      logger.error("Failed to load workout plan", error, "workoutPlan");
      throw error;
    }
  }

  // ============================================================================
  // WORKOUT PHASES
  // ============================================================================

  /**
   * Get phases for a workout plan
   */
  async getWorkoutPhases(planId: string): Promise<WorkoutPhase[]> {
    try {
      const plan = await this.getWorkoutPlanWithSessions(planId);
      if (!plan || !plan.workout_plan_sessions) {
        return [];
      }

      // Group sessions by phase (weeks 1-4 = phase 1, weeks 5-8 = phase 2)
      const phases: WorkoutPhase[] = [
        {
          id: "phase1",
          name: "4 Week Strength Base",
          description: "Build your foundation with progressive overload",
          weekStart: 1,
          weekEnd: 4,
          sessions: [],
        },
        {
          id: "phase2",
          name: "4 Week Modified Strength Base",
          description: "Advanced progression with increased intensity",
          weekStart: 5,
          weekEnd: 8,
          sessions: [],
        },
      ];

      // Group sessions by phase
      plan.workout_plan_sessions.forEach((session) => {
        const weekNumber = session.week_number || 1;
        const phaseIndex = weekNumber <= 4 ? 0 : 1;
        if (phases[phaseIndex]) {
          phases[phaseIndex].sessions.push({
            id: session.id,
            name: session.name,
            dayNumber: session.day_number,
            weekNumber: weekNumber,
            estimatedDurationMinutes: session.estimated_duration_minutes || 60,
            exerciseCount: session.planned_exercises?.length || 0,
            exercises:
              session.planned_exercises?.map((ex) => ({
                id: ex.id,
                name: ex.exercises?.name || "Unknown Exercise",
                targetSets: ex.target_sets,
                targetRepsMin: ex.target_reps_min || 0,
                targetRepsMax: ex.target_reps_max || 0,
                targetRpe: ex.target_rpe || undefined,
                restSeconds: ex.rest_seconds || undefined,
                notes: ex.notes || undefined,
              })) || [],
          });
        }
      });

      // Remove empty phases and deduplicate sessions by day number
      return phases
        .filter((phase) => phase.sessions.length > 0)
        .map((phase) => ({
          ...phase,
          sessions: this.deduplicateSessionsByDay(phase.sessions),
        }));
    } catch (error) {
      logger.error("Failed to load workout phases", error, "workoutPlan");
      throw error;
    }
  }

  // ============================================================================
  // WORKOUT SESSIONS
  // ============================================================================

  /**
   * Get workout sessions for a specific phase
   */
  async getWorkoutSessions(planId: string, phaseId: string): Promise<WorkoutSessionSummary[]> {
    try {
      const phases = await this.getWorkoutPhases(planId);
      const phase = phases.find((p) => p.id === phaseId);

      return phase?.sessions || [];
    } catch (error) {
      logger.error("Failed to load workout sessions", error, "workoutPlan");
      throw error;
    }
  }

  /**
   * Get specific workout session
   */
  async getWorkoutSession(planId: string, phaseId: string, sessionId: string): Promise<WorkoutSessionSummary | null> {
    try {
      const sessions = await this.getWorkoutSessions(planId, phaseId);
      return sessions.find((s) => s.id === sessionId) || null;
    } catch (error) {
      logger.error("Failed to load workout session", error, "workoutPlan");
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Format program name for display
   */
  formatProgramName(programId: string): string {
    const formatMap: Record<string, string> = {
      full_body: "Full Body Program",
      upper_lower: "Upper/Lower Program",
      body_part_split: "Body Part Split Program",
    };

    return formatMap[programId] || programId.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  /**
   * Format phase name for display
   */
  formatPhaseName(phaseId: string): string {
    const formatMap: Record<string, string> = {
      phase1: "Phase 1",
      phase2: "Phase 2",
    };

    return formatMap[phaseId] || phaseId.replace(/([a-z])([A-Z])/g, "$1 $2");
  }

  /**
   * Deduplicate sessions by day number (keep first occurrence)
   */
  private deduplicateSessionsByDay(sessions: WorkoutSessionSummary[]): WorkoutSessionSummary[] {
    const seen = new Set<number>();
    return sessions.filter((session) => {
      if (seen.has(session.dayNumber)) {
        return false;
      }
      seen.add(session.dayNumber);
      return true;
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cachedPlans.clear();
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const workoutPlanService = WorkoutPlanService.getInstance();
export default workoutPlanService;
