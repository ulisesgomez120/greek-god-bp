// ============================================================================
// WORKOUT PLAN SERVICE
// ============================================================================
// Service for loading workout plans, phases, and sessions from database

import { databaseService } from "./database.service";
import { logger } from "../utils/logger";
import type { WorkoutPlanWithSessions } from "../types/database";
import { normalizePlannedExercises, normalizePlanSummary } from "@/types/transforms";
import type { NextWorkoutInfo, UserWorkoutProgress } from "@/types/workoutProgress";

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
  // NEXT WORKOUT / PROGRESSION HELPERS START
  // ============================================================================

  /**
   * Get next workout info for a user + plan.
   * Returns whether user should resume an incomplete session, what the next session is,
   * or that the program is complete.
   */
  async getNextWorkout(userId: string, planId: string): Promise<NextWorkoutInfo | null> {
    try {
      // 1) Try to read explicit progress record
      let progress: UserWorkoutProgress | null = null;
      const dbProgress = await databaseService.getUserWorkoutProgress(userId, planId);
      console.log("DB Progress:", dbProgress);
      if (dbProgress) {
        progress = {
          id: dbProgress.id,
          userId: dbProgress.user_id,
          planId: dbProgress.plan_id,
          currentPhaseNumber: dbProgress.current_phase_number,
          currentRepetition: dbProgress.current_repetition,
          currentDayNumber: dbProgress.current_day_number,
          lastCompletedSessionId: dbProgress.last_completed_session_id ?? null,
          lastWorkoutSessionId: dbProgress.last_workout_session_id ?? null,
          completedAt: dbProgress.completed_at ?? null,
          updatedAt: dbProgress.updated_at,
          createdAt: dbProgress.created_at,
        } as UserWorkoutProgress;
      }

      // 2) If no progress, do not derive here — per simplified flow, return null so UI hides Next/Resume.
      if (!progress) {
        return null;
      }

      // 3) Resume logic: only resume the session referenced by user_workout_progress.last_workout_session_id.
      // Only resume when that session exists and has not been completed (completed_at IS NULL).
      let incomplete: any | null = null;
      if (progress.lastWorkoutSessionId) {
        try {
          const lastSess = await databaseService.getWorkoutSessionById(progress.lastWorkoutSessionId);
          if (lastSess && lastSess.completed_at == null) {
            incomplete = lastSess;
          }
        } catch (err) {
          logger.warn("Failed to load last_workout_session_id referenced session", err, "workoutPlan");
        }
      }

      // Debug: surface the resume candidate derived from progress and whether we consider it resumable.
      logger.info(
        "getNextWorkout: resume candidate from progress.last_workout_session_id",
        {
          resumeSessionId: incomplete?.id ?? null,
          resumeSessionCompletedAt: incomplete?.completed_at ?? null,
          resumeSessionPlanId: incomplete?.plan_id ?? null,
          resumeSessionPlannedDay: incomplete?.workout_plan_sessions?.day_number ?? null,
        },
        "workoutPlan"
      );
      logger.info(
        "getNextWorkout: treating progress.last_workout_session_id as incomplete?",
        { incomplete: !!incomplete },
        "workoutPlan"
      );

      // 4) Determine next planned session.
      // If there is a recent incomplete session, compute the next session relative to that
      // incomplete session (i.e. the session after the incomplete one). This ensures Resume
      // points to the in-progress session and Next points to the following planned day.
      let next: (WorkoutSessionSummary & { phaseNumber: number; repetition: number; totalRepetitions: number }) | null =
        null;
      if (incomplete) {
        // Use stored progress as the source of truth for "Next" — do not derive from history here.
        next = await this.findNextSession(
          planId,
          progress.currentPhaseNumber,
          progress.currentRepetition,
          progress.currentDayNumber
        );
      } else {
        next = await this.findNextSession(
          planId,
          progress.currentPhaseNumber,
          progress.currentRepetition,
          progress.currentDayNumber
        );
      }

      // Debug: log the computed "next" session for verification before returning resume/next
      logger.info(
        "getNextWorkout: computed next",
        {
          nextSessionId: next?.id ?? null,
          nextPhaseNumber: next?.phaseNumber ?? null,
          nextDayNumber: next?.dayNumber ?? null,
          nextRepetition: next?.repetition ?? null,
        },
        "workoutPlan"
      );

      if (incomplete) {
        // Provide resume info in addition to next session (both may be shown)
        const resumeInfo = {
          workoutSessionId: incomplete.id,
          planId: incomplete.plan_id,
          phaseId: `phase${incomplete.workout_plan_sessions?.phase_number ?? progress.currentPhaseNumber}`,
          sessionId: incomplete.session_id || incomplete.sessionId || "",
          workoutName: incomplete.name,
          phaseNumber: incomplete.workout_plan_sessions?.phase_number ?? progress.currentPhaseNumber,
          dayNumber: incomplete.workout_plan_sessions?.day_number ?? progress.currentDayNumber,
          repetition: progress.currentRepetition,
        };

        if (next) {
          return {
            type: "resume",
            resumeSession: resumeInfo,
            nextSession: {
              planId,
              phaseId: `phase${next.phaseNumber}`,
              sessionId: next.id,
              workoutName: next.name,
              phaseNumber: next.phaseNumber,
              dayNumber: next.dayNumber,
              repetition: next.repetition,
              totalRepetitions: next.totalRepetitions,
            },
          } as NextWorkoutInfo;
        }

        return {
          type: "resume",
          resumeSession: resumeInfo,
        } as NextWorkoutInfo;
      }

      if (!next) {
        return {
          type: "complete",
        } as NextWorkoutInfo;
      }

      return {
        type: "next",
        nextSession: {
          planId,
          phaseId: `phase${next.phaseNumber}`,
          sessionId: next.id,
          workoutName: next.name,
          phaseNumber: next.phaseNumber,
          dayNumber: next.dayNumber,
          repetition: next.repetition,
          totalRepetitions: next.totalRepetitions,
        },
      } as NextWorkoutInfo;
    } catch (error) {
      logger.error("getNextWorkout failed", error, "workoutPlan");
      throw error;
    }
  }

  /**
   * Find the next session in sequence for a plan given a current position.
   * Returns the WorkoutSessionSummary-like object or null if program complete.
   */
  private async findNextSession(
    planId: string,
    currentPhaseNumber: number,
    currentRepetition: number,
    currentDayNumber: number
  ): Promise<
    | (WorkoutSessionSummary & {
        phaseNumber: number;
        repetition: number;
        totalRepetitions: number;
      })
    | null
  > {
    // Load plan sessions
    console.log(
      "Finding next session for plan:",
      planId,
      "phase:",
      currentPhaseNumber,
      "repetition:",
      currentRepetition,
      "day:",
      currentDayNumber
    );
    const plan = await this.getWorkoutPlanWithSessions(planId);
    if (!plan) return null;

    const sessions = (plan as any).workout_plan_sessions ?? (plan as any).sessions ?? [];
    // Group sessions by phaseNumber and sort by day_number
    const byPhase = new Map<number, any[]>();
    sessions.forEach((s: any) => {
      const pn = Number(s.phase_number) || 1;
      if (!byPhase.has(pn)) byPhase.set(pn, []);
      byPhase.get(pn)!.push(s);
    });

    const phaseNumbers = Array.from(byPhase.keys()).sort((a, b) => a - b);

    // Helper to get ordered sessions for a phase (sorted by day_number asc)
    const getOrderedPhaseSessions = (pn: number) =>
      (byPhase.get(pn) || [])
        .slice()
        .sort((a: any, b: any) => (Number(a.day_number) || 1) - (Number(b.day_number) || 1));

    // Start from current position and search forward
    let pn = currentPhaseNumber;
    let rep = currentRepetition;
    let day = currentDayNumber;

    for (;;) {
      const phaseSessions = getOrderedPhaseSessions(pn);
      if (!phaseSessions || phaseSessions.length === 0) {
        // No sessions in this phase; advance to next phase
        const nextPhaseIndex = phaseNumbers.indexOf(pn) + 1;
        if (nextPhaseIndex >= phaseNumbers.length) {
          // No more phases
          return null;
        }
        pn = phaseNumbers[nextPhaseIndex];
        rep = 1;
        day = 1;
        continue;
      }

      // Determine total repetitions for this phase (assume phase_repetitions set on any session row)
      const totalReps = Number(phaseSessions[0].phase_repetitions) || 4;
      // Locate the session corresponding to the progress `day`.
      // Note: `day` represents the next day the user should perform (not the last completed day),
      // so prefer that session when found.
      const dayIndex = phaseSessions.findIndex((s) => Number(s.day_number) === Number(day));
      if (dayIndex >= 0) {
        const s = phaseSessions[dayIndex];
        return {
          id: s.id,
          name: s.name,
          dayNumber: Number(s.day_number) || 1,
          weekNumber: s.week_number || s.phase_repetitions || 1,
          estimatedDurationMinutes: s.estimated_duration_minutes || 60,
          exerciseCount: s.planned_exercises?.length || 0,
          exercises: normalizePlannedExercises(s.planned_exercises) || [],
          phaseNumber: pn,
          repetition: rep,
          totalRepetitions: totalReps,
        } as WorkoutSessionSummary & { phaseNumber: number; repetition: number; totalRepetitions: number };
      }

      // If the requested day isn't found in this phase's sessions, handle repetition/phase rollover:
      // If we haven't exhausted repetitions for this phase, start the next repetition at day 1.
      if (rep < totalReps) {
        // Start next repetition at day 1 and return the first session of the phase.
        rep = rep + 1;
        const s = phaseSessions[0];
        return {
          id: s.id,
          name: s.name,
          dayNumber: Number(s.day_number) || 1,
          weekNumber: s.week_number || s.phase_repetitions || 1,
          estimatedDurationMinutes: s.estimated_duration_minutes || 60,
          exerciseCount: s.planned_exercises?.length || 0,
          exercises: normalizePlannedExercises(s.planned_exercises) || [],
          phaseNumber: pn,
          repetition: rep,
          totalRepetitions: totalReps,
        } as WorkoutSessionSummary & { phaseNumber: number; repetition: number; totalRepetitions: number };
      }

      // Fallback: return first session of the phase (should be rare if progress is computed correctly)
      {
        const s = phaseSessions[0];
        return {
          id: s.id,
          name: s.name,
          dayNumber: Number(s.day_number) || 1,
          weekNumber: s.week_number || s.phase_repetitions || 1,
          estimatedDurationMinutes: s.estimated_duration_minutes || 60,
          exerciseCount: s.planned_exercises?.length || 0,
          exercises: normalizePlannedExercises(s.planned_exercises) || [],
          phaseNumber: pn,
          repetition: rep,
          totalRepetitions: totalReps,
        } as WorkoutSessionSummary & { phaseNumber: number; repetition: number; totalRepetitions: number };
      }

      // Move to first day of next phase
      const nextPhaseIdx = phaseNumbers.indexOf(pn) + 1;
      if (nextPhaseIdx >= phaseNumbers.length) {
        // No more phases
        return null;
      }
      pn = phaseNumbers[nextPhaseIdx];
      rep = 1;
      day = 1;
    }
  }

  /**
   * Find the next session after a given session/day within the same plan.
   * This walks the plan sequence starting from the provided phase/day and returns the
   * very next planned session (or null if at the end). Used to compute "Next" when a
   * resumable (in-progress) workout exists so we don't return the same session for both.
   */
  private async findNextSessionAfter(
    planId: string,
    currentPhaseNumber: number,
    currentRepetition: number,
    currentDayNumber: number
  ): Promise<
    | (WorkoutSessionSummary & {
        phaseNumber: number;
        repetition: number;
        totalRepetitions: number;
      })
    | null
  > {
    // Reuse plan loading & grouping logic from findNextSession
    const plan = await this.getWorkoutPlanWithSessions(planId);
    if (!plan) return null;

    const sessions = (plan as any).workout_plan_sessions ?? (plan as any).sessions ?? [];
    const byPhase = new Map<number, any[]>();
    sessions.forEach((s: any) => {
      const pn = Number(s.phase_number) || 1;
      if (!byPhase.has(pn)) byPhase.set(pn, []);
      byPhase.get(pn)!.push(s);
    });

    const phaseNumbers = Array.from(byPhase.keys()).sort((a, b) => a - b);

    const getOrderedPhaseSessions = (pn: number) =>
      (byPhase.get(pn) || [])
        .slice()
        .sort((a: any, b: any) => (Number(a.day_number) || 1) - (Number(b.day_number) || 1));

    // Start from given position and find the session that immediately follows currentDayNumber
    let pn = currentPhaseNumber;
    let rep = currentRepetition;
    let day = currentDayNumber;

    for (;;) {
      const phaseSessions = getOrderedPhaseSessions(pn);

      // If phase has no sessions, advance to next phase
      if (!phaseSessions || phaseSessions.length === 0) {
        const nextPhaseIndex = phaseNumbers.indexOf(pn) + 1;
        if (nextPhaseIndex >= phaseNumbers.length) return null;
        pn = phaseNumbers[nextPhaseIndex];
        rep = 1;
        day = 1;
        continue;
      }

      const totalReps = Number(phaseSessions[0].phase_repetitions) || 4;

      // Find the index of the current day within this phase
      const dayIndex = phaseSessions.findIndex((s) => Number(s.day_number) === Number(day));

      // If found, the next planned session is the next index in same phase (if any)
      if (dayIndex >= 0) {
        const nextIndex = dayIndex + 1;
        if (nextIndex < phaseSessions.length) {
          const s = phaseSessions[nextIndex];
          return {
            id: s.id,
            name: s.name,
            dayNumber: Number(s.day_number) || 1,
            weekNumber: s.week_number || s.phase_repetitions || 1,
            estimatedDurationMinutes: s.estimated_duration_minutes || 60,
            exerciseCount: s.planned_exercises?.length || 0,
            exercises: normalizePlannedExercises(s.planned_exercises) || [],
            phaseNumber: pn,
            repetition: rep,
            totalRepetitions: totalReps,
          } as WorkoutSessionSummary & { phaseNumber: number; repetition: number; totalRepetitions: number };
        }

        // If no more days in this repetition, advance repetition (start at day 1)
        if (rep < totalReps) {
          rep = rep + 1;
          const s = phaseSessions[0];
          return {
            id: s.id,
            name: s.name,
            dayNumber: Number(s.day_number) || 1,
            weekNumber: s.week_number || s.phase_repetitions || 1,
            estimatedDurationMinutes: s.estimated_duration_minutes || 60,
            exerciseCount: s.planned_exercises?.length || 0,
            exercises: normalizePlannedExercises(s.planned_exercises) || [],
            phaseNumber: pn,
            repetition: rep,
            totalRepetitions: totalReps,
          } as WorkoutSessionSummary & { phaseNumber: number; repetition: number; totalRepetitions: number };
        }

        // Otherwise move to next phase and return its first session
        const nextPhaseIdx = phaseNumbers.indexOf(pn) + 1;
        if (nextPhaseIdx >= phaseNumbers.length) return null;
        pn = phaseNumbers[nextPhaseIdx];
        rep = 1;
        day = 1;
        const nextPhaseSessions = getOrderedPhaseSessions(pn);
        if (nextPhaseSessions && nextPhaseSessions.length > 0) {
          const s = nextPhaseSessions[0];
          return {
            id: s.id,
            name: s.name,
            dayNumber: Number(s.day_number) || 1,
            weekNumber: s.week_number || s.phase_repetitions || 1,
            estimatedDurationMinutes: s.estimated_duration_minutes || 60,
            exerciseCount: s.planned_exercises?.length || 0,
            exercises: normalizePlannedExercises(s.planned_exercises) || [],
            phaseNumber: pn,
            repetition: 1,
            totalRepetitions: Number(nextPhaseSessions[0].phase_repetitions) || 1,
          } as WorkoutSessionSummary & { phaseNumber: number; repetition: number; totalRepetitions: number };
        }

        return null;
      } else {
        // If current day not found in this phase, attempt to find first session after day within phase
        // (take smallest session.day_number > day)
        const later = phaseSessions.find((s) => Number(s.day_number) > Number(day));
        if (later) {
          const s = later;
          return {
            id: s.id,
            name: s.name,
            dayNumber: Number(s.day_number) || 1,
            weekNumber: s.week_number || s.phase_repetitions || 1,
            estimatedDurationMinutes: s.estimated_duration_minutes || 60,
            exerciseCount: s.planned_exercises?.length || 0,
            exercises: normalizePlannedExercises(s.planned_exercises) || [],
            phaseNumber: pn,
            repetition: rep,
            totalRepetitions: totalReps,
          } as WorkoutSessionSummary & { phaseNumber: number; repetition: number; totalRepetitions: number };
        }

        // No later session in this phase — advance repetition or phase as above
        if (rep < totalReps) {
          rep = rep + 1;
          const s = phaseSessions[0];
          return {
            id: s.id,
            name: s.name,
            dayNumber: Number(s.day_number) || 1,
            weekNumber: s.week_number || s.phase_repetitions || 1,
            estimatedDurationMinutes: s.estimated_duration_minutes || 60,
            exerciseCount: s.planned_exercises?.length || 0,
            exercises: normalizePlannedExercises(s.planned_exercises) || [],
            phaseNumber: pn,
            repetition: rep,
            totalRepetitions: totalReps,
          } as WorkoutSessionSummary & { phaseNumber: number; repetition: number; totalRepetitions: number };
        }

        const nextPhaseIdx = phaseNumbers.indexOf(pn) + 1;
        if (nextPhaseIdx >= phaseNumbers.length) return null;
        pn = phaseNumbers[nextPhaseIdx];
        rep = 1;
        day = 1;
      }
    }
  }

  /**
   * Get the next workout for the user's most relevant plan (prefers incomplete session's plan).
   * Returns NextWorkoutInfo or null if no plan context is available.
   */
  async getNextWorkoutForUser(userId: string): Promise<NextWorkoutInfo | null> {
    try {
      // Prefer plan from the most recent session (completed or incomplete).
      // `getMostRecentSession` was intentionally changed to return the most
      // recent session row — treat it as the primary source for plan context.
      const recent = await databaseService.getMostRecentSession(userId);
      let planId: string | null = null;

      if (recent && recent.plan_id) {
        planId = recent.plan_id;
      } else {
        // Fallback: use most recent workout session's plan if no recent session row is available
        const recentSessions = await databaseService.getWorkoutSessions(userId, 1);
        if (recentSessions && recentSessions.length > 0) {
          planId = (recentSessions[0] as any).planId || null;
        }
      }

      if (!planId) return null;

      return this.getNextWorkout(userId, planId);
    } catch (err: any) {
      logger.warn("getNextWorkoutForUser failed", err, "workoutPlan");
      return null;
    }
  }

  /**
   * Find the next session in sequence for a plan given a current position.
   * Returns the WorkoutSessionSummary-like object or null if program complete.
   */
  async advanceToNextWorkout(userId: string, planId: string): Promise<{ progress: any; createdSession?: any }> {
    // Ensure we have progress
    const dbProgress = await databaseService.getUserWorkoutProgress(userId, planId);
    let progressRecord = dbProgress;
    if (!progressRecord) {
      const calculated = await databaseService.calculateProgressFromHistory(userId, planId);
      progressRecord = await databaseService.updateUserWorkoutProgress(userId, planId, {
        current_phase_number: calculated.phaseNumber,
        current_repetition: calculated.repetition,
        current_day_number: calculated.dayNumber,
      });
    }

    const currentPhase = progressRecord.current_phase_number;
    const currentRepetition = progressRecord.current_repetition;
    const currentDay = progressRecord.current_day_number;

    const next = await this.findNextSession(planId, currentPhase, currentRepetition, currentDay);
    if (!next) {
      // Nothing to advance to
      return { progress: progressRecord };
    }

    // Create workout_sessions row for the next session
    const created = await databaseService.insertWorkoutSession({
      userId,
      planId,
      sessionId: next.id,
      name: next.name,
      startedAt: new Date().toISOString(),
    } as any);

    // Update progress: advance day/repetition/phase accordingly
    // If next.repetition > currentRepetition OR next.phaseNumber !== currentPhase then update accordingly
    const updates: any = {
      last_workout_session_id: created.id,
      updated_at: new Date().toISOString(),
    };

    updates.current_phase_number = next.phaseNumber;
    updates.current_repetition = next.repetition;
    updates.current_day_number = next.dayNumber;

    const newProgress = await databaseService.updateUserWorkoutProgress(userId, planId, updates);

    return { progress: newProgress, createdSession: created };
  }

  /**
   * Get a workout session synchronously from the service cache without triggering any
   * database/network calls. Returns null if the plan/session is not present in cache.
   */
  getCachedWorkoutSession(planId: string, phaseId: string, sessionId: string): WorkoutSessionSummary | null {
    try {
      const plan = this.cachedPlans.get(planId);
      if (!plan) return null;

      const sessionsRaw = (plan as any).workout_plan_sessions ?? (plan as any).sessions ?? [];

      const sessions: WorkoutSessionSummary[] = sessionsRaw.map((session: any) => {
        return {
          id: session.id,
          name: session.name,
          dayNumber: session.day_number,
          weekNumber: session.week_number || 1,
          estimatedDurationMinutes: session.estimated_duration_minutes || 60,
          exerciseCount: session.planned_exercises?.length || 0,
          exercises: normalizePlannedExercises(session.planned_exercises) || [],
        } as WorkoutSessionSummary;
      });

      return sessions.find((s) => s.id === sessionId) || null;
    } catch (error) {
      logger.error("Failed to get cached workout session", error, "workoutPlan");
      return null;
    }
  }
  // ============================================================================
  // NEXT WORKOUT / PROGRESSION HELPERS END
  // ============================================================================
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
