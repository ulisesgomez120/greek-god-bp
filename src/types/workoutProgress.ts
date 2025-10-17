// Types for user workout progress and next-workout helper types

export interface UserWorkoutProgress {
  id: string;
  userId: string;
  planId: string;
  currentPhaseNumber: number;
  currentRepetition: number;
  currentDayNumber: number;
  lastCompletedSessionId?: string | null;
  lastWorkoutSessionId?: string | null;
  completedAt?: string | null;
  updatedAt: string;
  createdAt: string;
}

export type NextWorkoutType = "resume" | "next" | "complete";

export interface NextWorkoutInfo {
  type: NextWorkoutType;
  resumeSession?: {
    workoutSessionId: string;
    planId: string;
    phaseId: string;
    sessionId: string;
    workoutName: string;
    phaseNumber: number;
    dayNumber: number;
    repetition: number;
  };
  nextSession?: {
    planId: string;
    phaseId: string;
    sessionId: string;
    workoutName: string;
    phaseNumber: number;
    dayNumber: number;
    repetition: number;
    totalRepetitions: number;
  };
}
