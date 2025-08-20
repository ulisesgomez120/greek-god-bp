// ============================================================================
// WORKOUT PLAN SERVICE
// ============================================================================
// Service for loading workout plans, phases, and sessions from database

import { databaseService } from "./database.service";
import { logger } from "../utils/logger";
import type { WorkoutPlanWithSessions } from "../types/database";
import { normalizePlannedExercises, normalizePlanSummary } from "@/types/transforms";

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

      // Map DB / transformed plan to WorkoutPlanSummary via centralized normalizer
      return plans.map((plan: any) => normalizePlanSummary(plan) as WorkoutPlanSummary);
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

      // databaseService.getWorkoutPlans may be typed as returning plain WorkoutPlan[] but
      // in practice it includes nested sessions. Cast to the richer type for further use.
      const plans = (await databaseService.getWorkoutPlans()) as unknown as WorkoutPlanWithSessions[];
      const plan = plans.find((p) => p.id === planId) || null;

      if (plan) {
        this.cachedPlans.set(planId, plan);
      }

      return plan;
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
      if (!plan) {
        return [];
      }

      const sessions = (plan as any).workout_plan_sessions ?? (plan as any).sessions ?? [];

      // Detect whether the DB is using phase_number (preferred) or legacy week_number
      const hasPhaseNumber = sessions.some((s: any) => s.phase_number !== undefined && s.phase_number !== null);

      let phases: WorkoutPhase[] = [];

      if (hasPhaseNumber) {
        // Build phases dynamically from distinct phase_number values
        const distinctPhaseNumbers = Array.from(
          new Set<number>(sessions.map((s: any) => Number(s.phase_number) || 1))
        ).sort((a, b) => a - b);

        phases = distinctPhaseNumbers.map((pn: number) => {
          const id = `phase${pn}`;
          const name = pn === 1 ? "4 Week Strength Base" : pn === 2 ? "4 Week Modified Strength Base" : `Phase ${pn}`;
          const description =
            pn === 1
              ? "Build your foundation with progressive overload"
              : pn === 2
              ? "Advanced progression with increased intensity"
              : "";

          const weekStart = (pn - 1) * 4 + 1;
          const weekEnd = pn * 4;

          return {
            id,
            name,
            description,
            weekStart,
            weekEnd,
            sessions: [] as WorkoutSessionSummary[],
          };
        });

        // Assign sessions to their phase
        sessions.forEach((session: any) => {
          const pn = Number(session.phase_number) || 1;
          const phaseId = `phase${pn}`;
          const phase = phases.find((p) => p.id === phaseId);
          const weekNumber = session.week_number || weekFromPhase(pn);
          const sessionSummary: WorkoutSessionSummary = {
            id: session.id,
            name: session.name,
            dayNumber: session.day_number,
            weekNumber,
            estimatedDurationMinutes: session.estimated_duration_minutes || 60,
            exerciseCount: session.planned_exercises?.length || 0,
            exercises: normalizePlannedExercises(session.planned_exercises) || [],
          };

          if (phase) {
            phase.sessions.push(sessionSummary);
          }
        });
      } else {
        // Legacy behavior: group by week_number into two default phases (1-4, 5-8)
        phases = [
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

        sessions.forEach((session: any) => {
          const weekNumber = session.week_number || 1;
          const phaseIndex = weekNumber <= 4 ? 0 : 1;
          const sessionSummary: WorkoutSessionSummary = {
            id: session.id,
            name: session.name,
            dayNumber: session.day_number,
            weekNumber,
            estimatedDurationMinutes: session.estimated_duration_minutes || 60,
            exerciseCount: session.planned_exercises?.length || 0,
            exercises: normalizePlannedExercises(session.planned_exercises) || [],
          };

          if (phases[phaseIndex]) {
            phases[phaseIndex].sessions.push(sessionSummary);
          }
        });
      }

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

    // Helper: compute approximate week number from phase (if needed)
    function weekFromPhase(phaseNumber: number): number {
      return (phaseNumber - 1) * 4 + 1;
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
