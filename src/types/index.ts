// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
// Comprehensive type definitions for the TrainSmart application

import type { User as SupabaseUser } from "@supabase/supabase-js";

// ============================================================================
// ENVIRONMENT & CONFIG TYPES
// ============================================================================

export interface EnvironmentConfig {
  apiUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  stripePublishableKey: string;
  environment: "development" | "staging" | "production";
  openaiApiKey?: string;
  enableAnalytics?: boolean;
  enableFlipper?: boolean;
  sentryDsn?: string;
}

// ============================================================================
// AUTH TYPES
// ============================================================================

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  experienceLevel: ExperienceLevel;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: SupabaseUser | null;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: SupabaseUser | null;
  session: Session | null;
  loading: boolean;
  error?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  profile: {
    displayName: string;
    experienceLevel: ExperienceLevel;
  };
}

// ============================================================================
// WORKOUT TYPES
// ============================================================================

export type ExperienceLevel = "untrained" | "beginner" | "early_intermediate" | "intermediate" | "advanced";

export interface WorkoutState {
  currentWorkout: WorkoutSession | null;
  isActive: boolean;
  currentExercise: number;
  currentSet: number;
  restTimer?: number;
  plans: WorkoutPlan[];
  exercises: Exercise[];
  progressMetrics: Record<string, ExerciseProgressMetrics>;
}

export interface WorkoutSession {
  id: string;
  userId: string;
  planId?: string;
  sessionId?: string;
  name: string;
  startedAt: string;
  completedAt?: string;
  durationMinutes?: number;
  notes?: string;
  totalVolumeKg?: number;
  averageRpe?: number;
  sets?: ExerciseSet[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  description: string;
  experienceLevel: ExperienceLevel;
  durationWeeks: number;
  sessionsPerWeek: number;
  exercises: string[]; // Exercise IDs
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  muscleGroups: string[];
  equipment: string[];
  instructions: string[];
  tips: string[];
  videoUrl?: string;
  imageUrl?: string;
  isCompound: boolean;
  difficulty: "beginner" | "intermediate" | "advanced";
  createdAt: string;
}

export interface ExerciseSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  plannedExerciseId?: string;
  setNumber: number;
  weightKg?: number;
  reps: number;
  rpe?: number;
  isWarmup: boolean;
  isFailure: boolean;
  restSeconds?: number;
  notes?: string;
  createdAt: string;
}

export interface ProgressionRecommendation {
  shouldProgress: boolean;
  recommendedIncrease?: number;
  reason: string;
  alternativeAction?: string;
}

export interface ExerciseProgressMetrics {
  exerciseId: string;
  lastProgression?: string;
  recommendation?: ProgressionRecommendation;
  personalRecords: {
    oneRepMax?: number;
    maxVolume?: number;
    bestSet?: ExerciseSet;
  };
}

// ============================================================================
// PROGRESS TYPES
// ============================================================================

export interface ProgressState {
  metrics: ProgressMetrics;
  trends: {
    strength: StrengthDataPoint[];
    volume: VolumeDataPoint[];
  };
  personalRecords: Record<string, PersonalRecord>;
  loading: boolean;
  error?: string;
}

export interface ProgressMetrics {
  exerciseId?: string;
  userId?: string;
  currentWeight?: number;
  currentReps?: number;
  currentRpe?: number;
  lastProgression?: string;
  strengthScore?: number;
  oneRepMax?: number;
  volumeProgression?: VolumeDataPoint[];
  strengthProgression?: StrengthDataPoint[];
  totalWorkouts: number;
  totalVolumeKg: number;
  averageSessionDuration: number;
  strengthGains: number;
  consistencyScore: number;
  lastUpdated: string;
}

export interface VolumeDataPoint {
  date: string;
  totalVolume: number;
  sessionCount: number;
  volume?: number;
  sets?: number;
  averageRpe?: number;
}

export interface StrengthDataPoint {
  date: string;
  exerciseId: string;
  oneRepMax: number;
  estimatedMax: number;
  estimatedOneRepMax?: number;
  weight?: number;
  reps?: number;
  rpe?: number;
}

export interface PersonalRecord {
  exerciseId: string;
  type: "weight" | "reps" | "volume";
  value: number;
  achievedAt: string;
  sessionId: string;
}

// ============================================================================
// SUBSCRIPTION TYPES
// ============================================================================

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "past_due"
  | "trialing"
  | "unpaid";

export interface SubscriptionState {
  currentSubscription: Subscription | null;
  availablePlans: SubscriptionPlan[];
  paymentHistory: PaymentHistory[];
  loading: boolean;
  error?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string;
  trialStart?: string;
  trialEnd?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  interval: "month" | "year";
  stripePriceId: string;
  features: string[];
  maxAiQueries: number; // -1 for unlimited
  maxCustomWorkouts: number; // -1 for unlimited
  maxClients: number; // 0 for non-coach plans
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface PaymentHistory {
  id: string;
  subscriptionId: string;
  stripePaymentIntentId: string;
  amountCents: number;
  currency: string;
  status: "succeeded" | "failed" | "pending" | "requires_payment_method";
  description: string;
  receiptUrl?: string;
  failureReason?: string;
  createdAt: string;
}

// ============================================================================
// UI TYPES
// ============================================================================

export interface UIState {
  theme: "light" | "dark" | "system";
  notifications: Notification[];
  modals: {
    isWorkoutModalOpen: boolean;
    isProgressModalOpen: boolean;
    isSettingsModalOpen: boolean;
  };
  loading: {
    global: boolean;
    workout: boolean;
    progress: boolean;
    subscription: boolean;
  };
  lastSyncAt?: string;
  error?: string;
}

export interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  actions?: NotificationAction[];
  autoHide?: boolean;
  duration?: number;
  createdAt: string;
}

export interface NotificationAction {
  label: string;
  action: string | (() => void);
  style?: "primary" | "secondary" | "danger";
}

// ============================================================================
// API TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface WorkoutFormData {
  name: string;
  planId?: string;
  exercises: string[];
  notes?: string;
}

export interface ExerciseSetFormData {
  exerciseId: string;
  weightKg?: number;
  reps: number;
  rpe?: number;
  isWarmup?: boolean;
  restSeconds?: number;
  notes?: string;
  plannedExerciseId?: string;
}

export interface ProfileFormData {
  displayName: string;
  experienceLevel: ExperienceLevel;
  email: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// ============================================================================
// REDUX TYPES
// ============================================================================

export interface RootState {
  auth: AuthState;
  workout: WorkoutState;
  progress: ProgressState;
  subscription: SubscriptionState;
  ui: UIState;
}

// ============================================================================
// EXPORT ALL TYPES
// ============================================================================

// All types are exported individually above
