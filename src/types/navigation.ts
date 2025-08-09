// ============================================================================
// NAVIGATION TYPES
// ============================================================================
// TypeScript definitions for navigation parameter lists

// ============================================================================
// WORKOUT NAVIGATION TYPES
// ============================================================================

export type WorkoutStackParamList = {
  WorkoutHome: undefined;
  ProgramSelection: undefined;
  PhaseSelection: { programId: string };
  DaySelection: { programId: string; phaseId: string };
  ExerciseList: { programId: string; phaseId: string; dayId: string; workoutName: string };
  ActiveWorkout: {
    workoutId?: string;
    resumeSession?: boolean;
    programId?: string;
    phaseId?: string;
    dayId?: string;
    workoutName?: string;
  };
  ExerciseDetail: { exerciseId: string };
  WorkoutSummary: { sessionId: string };
};

// ============================================================================
// PROGRESS NAVIGATION TYPES
// ============================================================================

export type ProgressStackParamList = {
  ProgressDashboard: undefined;
  WorkoutHistory: undefined;
  StrengthCharts: { exerciseId?: string };
};

// ============================================================================
// AI COACH NAVIGATION TYPES
// ============================================================================

export type AICoachStackParamList = {
  AICoach: undefined;
  MonthlyReview: { reviewId: string };
  Conversations: undefined;
};

// ============================================================================
// PROFILE NAVIGATION TYPES
// ============================================================================

export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
  Subscription: undefined;
  ExperienceLevel: undefined;
};

// ============================================================================
// TAB NAVIGATION TYPES
// ============================================================================

export type TabParamList = {
  WorkoutTab: undefined;
  ProgressTab: undefined;
  AICoachTab: undefined;
  ProfileTab: undefined;
};

// ============================================================================
// ROOT NAVIGATION TYPES
// ============================================================================

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

// ============================================================================
// AUTH NAVIGATION TYPES
// ============================================================================

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  EmailVerification: undefined;
  Onboarding: undefined;
};
