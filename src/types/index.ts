// ============================================================================
// GLOBAL TYPE DEFINITIONS FOR TRAINSMART
// ============================================================================

// User Management Types
export type ExperienceLevel = "untrained" | "beginner" | "early_intermediate" | "intermediate";
export type Gender = "male" | "female" | "other" | "prefer_not_to_say";
export type UserRole = "user" | "premium" | "coach" | "admin";

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  heightCm?: number;
  weightKg?: number;
  birthDate?: string;
  gender?: Gender;
  experienceLevel: ExperienceLevel;
  fitnessGoals: string[];
  availableEquipment: string[];
  privacySettings: PrivacySettings;
  stripeCustomerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrivacySettings {
  dataSharing: boolean;
  analytics: boolean;
  aiCoaching: boolean;
}

// Authentication Types
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
  loading: boolean;
  error?: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  profile: Omit<UserProfile, "id" | "email" | "createdAt" | "updatedAt">;
}

// Workout System Types
export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "quadriceps"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "abs"
  | "core";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "kettlebell"
  | "cable"
  | "machine"
  | "bodyweight"
  | "resistance_band"
  | "plate";

export interface Exercise {
  id: string;
  name: string;
  description?: string;
  instructions: string[];
  muscleGroups: MuscleGroup[];
  primaryMuscle: MuscleGroup;
  equipment: Equipment[];
  difficulty: number; // 1-5 scale
  isCompound: boolean;
  alternatives: string[]; // Exercise IDs
  demoVideoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  plannedExerciseId?: string;
  setNumber: number;
  weightKg?: number;
  reps: number;
  rpe?: number; // Rate of Perceived Exertion (1-10)
  isWarmup: boolean;
  isFailure: boolean;
  restSeconds?: number;
  notes?: string;
  formRating?: number; // 1-5 scale
  createdAt: string;
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
  totalVolumeKg?: number;
  averageRpe?: number;
  notes?: string;
  syncStatus: "synced" | "pending" | "conflict";
  offlineCreated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  description?: string;
  type: "full_body" | "upper_lower" | "body_part_split" | "custom";
  frequencyPerWeek: number;
  durationWeeks: number;
  difficulty: number; // 1-5 scale
  targetExperience: ExperienceLevel[];
  createdBy?: string;
  isTemplate: boolean;
  isPublic: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutPlanSession {
  id: string;
  planId: string;
  name: string;
  dayNumber: number;
  weekNumber: number;
  estimatedDurationMinutes?: number;
  createdAt: string;
}

export interface PlannedExercise {
  id: string;
  sessionId: string;
  exerciseId: string;
  orderInSession: number;
  targetSets: number;
  targetRepsMin?: number;
  targetRepsMax?: number;
  targetRpe?: number;
  restSeconds?: number;
  notes?: string;
  progressionScheme?: ProgressionScheme;
  createdAt: string;
}

// Progression System Types
export interface ProgressionScheme {
  type: "linear" | "rpe_based" | "percentage" | "custom";
  parameters: Record<string, any>;
}

export interface ProgressionRecommendation {
  shouldProgress: boolean;
  recommendedIncrease?: number;
  reason: string;
  alternativeAction?: string;
}

export interface ProgressMetrics {
  exerciseId: string;
  userId: string;
  currentWeight?: number;
  currentReps?: number;
  currentRpe?: number;
  lastProgression?: string;
  strengthScore?: number;
  oneRepMax?: number;
  volumeProgression: VolumeDataPoint[];
  strengthProgression: StrengthDataPoint[];
}

export interface VolumeDataPoint {
  date: string;
  volume: number; // sets × reps × weight
  sets: number;
  averageRpe?: number;
}

export interface StrengthDataPoint {
  date: string;
  weight: number;
  reps: number;
  estimatedOneRepMax: number;
  rpe?: number;
}

// AI Coaching Types
export interface AIConversation {
  id: string;
  userId: string;
  conversationId: string;
  messageType: "user_query" | "ai_response" | "system_message";
  content: string;
  contextData?: Record<string, any>;
  tokensUsed?: number;
  createdAt: string;
}

export interface AIUsageMetrics {
  userId: string;
  monthlyTokensUsed: number;
  monthlyQueriesCount: number;
  monthlyCost: number;
  remainingBudget: number;
  resetDate: string;
}

export interface MonthlyReview {
  id: string;
  userId: string;
  reviewMonth: string; // YYYY-MM format
  workoutCount: number;
  totalVolumeKg: number;
  averageRpe?: number;
  strengthGains: Record<string, number>; // exerciseId -> improvement
  goalProgress: Record<string, number>; // goalId -> progress percentage
  recommendations: string;
  achievements: string[];
  areasForImprovement: string[];
  nextMonthFocus: string;
  aiGeneratedAt?: string;
  tokensUsed?: number;
  createdAt: string;
}

export interface AICoachingPersonality {
  level: "just_gentle" | "more_gentle" | "more_challenging" | "just_challenging";
  description: string;
  traits: string[];
}

// Subscription & Payment Types
export type SubscriptionStatus = "active" | "canceled" | "past_due" | "unpaid" | "incomplete" | "trialing";

export type SubscriptionInterval = "month" | "year";

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  interval: SubscriptionInterval;
  stripePriceId: string;
  features: string[];
  maxAiQueries: number;
  maxCustomWorkouts: number;
  maxClients: number; // For coach plans
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
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
  trialStart?: string;
  trialEnd?: string;
  canceledAt?: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentHistory {
  id: string;
  userId: string;
  subscriptionId?: string;
  stripePaymentIntentId: string;
  amountCents: number;
  currency: string;
  status: string;
  paymentMethodType?: string;
  failureReason?: string;
  processedAt?: string;
  createdAt: string;
}

// UI & Navigation Types
export interface NavigationState {
  activeTab: string;
  modal?: string;
  previousScreen?: string;
}

export interface UIState {
  theme: "light" | "dark";
  networkStatus: "online" | "offline";
  loading: boolean;
  error?: string;
  notifications: Notification[];
}

export interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  duration?: number;
  actions?: NotificationAction[];
  createdAt: string;
}

export interface NotificationAction {
  label: string;
  action: () => void;
  style?: "default" | "destructive";
}

// Form & Validation Types
export interface FormField<T = any> {
  value: T;
  error?: string;
  touched: boolean;
  required: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface FormState<T = Record<string, any>> {
  values: T;
  errors: Record<keyof T, string>;
  touched: Record<keyof T, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

// API Response Types
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
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface NetworkError extends AppError {
  status?: number;
  statusText?: string;
}

export interface ValidationError extends AppError {
  field?: string;
  value?: any;
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Environment Configuration Types
export interface EnvironmentConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  openaiApiKey?: string;
  stripePublishableKey: string;
  apiUrl: string;
  environment: "development" | "staging" | "production";
  enableAnalytics: boolean;
  enableFlipper: boolean;
  sentryDsn?: string;
}

// Redux Store Types
export interface RootState {
  auth: AuthState;
  workout: WorkoutState;
  aiCoach: AICoachState;
  ui: UIState;
  subscription: SubscriptionState;
}

export interface WorkoutState {
  currentWorkout: WorkoutSession | null;
  isActive: boolean;
  currentExercise: number;
  currentSet: number;
  restTimer: number;
  offline: {
    pendingSessions: WorkoutSession[];
    syncStatus: "idle" | "syncing" | "error";
  };
  plans: WorkoutPlan[];
  exercises: Exercise[];
  progressMetrics: Record<string, ProgressMetrics>;
}

export interface AICoachState {
  conversations: AIConversation[];
  currentUsage: AIUsageMetrics | null;
  monthlyReview: MonthlyReview | null;
  personality: AICoachingPersonality;
  loading: boolean;
  error?: string;
}

export interface SubscriptionState {
  currentSubscription: Subscription | null;
  availablePlans: SubscriptionPlan[];
  paymentHistory: PaymentHistory[];
  loading: boolean;
  error?: string;
}

// Component Props Types
export interface BaseComponentProps {
  testID?: string;
  style?: any;
  children?: React.ReactNode;
}

export interface ButtonProps extends BaseComponentProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "text";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
}

export interface InputProps extends BaseComponentProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "numeric" | "email-address";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  multiline?: boolean;
  numberOfLines?: number;
}

// Constants
export const EXPERIENCE_LEVELS: Record<ExperienceLevel, string> = {
  untrained: "Untrained (0-3 months)",
  beginner: "Beginner (3-9 months)",
  early_intermediate: "Early Intermediate (9-18 months)",
  intermediate: "Intermediate (18+ months)",
};

export const RPE_DESCRIPTIONS: Record<number, string> = {
  1: "Very easy - could do many more reps",
  2: "Easy - could do several more reps",
  3: "Moderate - could do a few more reps",
  4: "Somewhat hard - could do 2-3 more reps",
  5: "Hard - could do 1-2 more reps",
  6: "Very hard - could do 1 more rep",
  7: "Extremely hard - maybe 1 more rep",
  8: "Maximum effort - no more reps possible",
  9: "Failure - couldn't complete the set",
  10: "Complete failure - form breakdown",
};

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  quadriceps: "Quadriceps",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  abs: "Abs",
  core: "Core",
};
