// ============================================================================
// PROFILE TYPE DEFINITIONS
// ============================================================================
// Comprehensive profile types for TrainSmart user profile management system

import type { Database } from "./database";
import type { ExperienceLevel, Gender } from "./database";

// ============================================================================
// CORE PROFILE TYPES
// ============================================================================

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  heightCm?: number;
  weightKg?: number;
  birthDate?: string;
  gender?: Gender;
  experienceLevel: ExperienceLevel;
  fitnessGoals: string[];
  availableEquipment: string[];
  privacySettings: PrivacySettings;
  preferences?: ProfilePreferences;
  role?: "user" | "premium" | "coach" | "admin";
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PrivacySettings {
  dataSharing: boolean;
  analytics: boolean;
  aiCoaching: boolean;
  profileVisibility?: "private" | "friends" | "public";
  workoutSharing: boolean;
  progressSharing: boolean;
}

// ============================================================================
// PROFILE FORM DATA TYPES
// ============================================================================

export interface ProfileSetupData {
  displayName: string;
  experienceLevel: ExperienceLevel;
  fitnessGoals: string[];
  heightCm?: number;
  weightKg?: number;
  birthDate?: string;
  gender?: Gender;
  email?: string; // Optional for profile creation
}

export interface ProfileEditData {
  displayName?: string;
  heightCm?: number;
  weightKg?: number | string;
  birthDate?: string;
  gender?: Gender;
  fitnessGoals?: string[];
  privacySettings?: Partial<PrivacySettings>;
  experienceLevel?: ExperienceLevel;
  preferences?: ProfilePreferences;

  // Normalized privacy fields (frontend will use these when editing privacy)
  privacyDataSharing?: boolean;
  privacyAnalytics?: boolean;
  privacyAiCoaching?: boolean;
  privacyWorkoutSharing?: boolean;
  privacyProgressSharing?: boolean;
}

export interface ExperienceLevelAssessment {
  monthsTraining?: number;
  currentProgram?: string;
  benchPressWeight?: number;
  squatWeight?: number;
  deadliftWeight?: number;
  bodyWeight?: number;
  trainingFrequency?: number;
  formConfidence?: number; // 1-10 scale
  progressionKnowledge?: number; // 1-10 scale
}

// ============================================================================
// PROFILE PICTURE TYPES
// ============================================================================

export interface ProfilePictureUpload {
  uri: string;
  type: string;
  name: string;
  size: number;
}

export interface ProfilePictureState {
  uploading: boolean;
  progress: number;
  error?: string;
  previewUri?: string;
}

// ============================================================================
// FITNESS GOALS AND EQUIPMENT
// ============================================================================

export interface FitnessGoal {
  id: string;
  name: string;
  description: string;
  category: "strength" | "muscle" | "endurance" | "weight_loss" | "general";
  // Icon is represented with a library-agnostic descriptor to enable a consistent Icon component.
  icon: {
    name: string;
    library?: "ionicons";
  };
  popular: boolean;
}

export interface Equipment {
  id: string;
  name: string;
  category: "free_weights" | "machines" | "cardio" | "accessories";
  icon: string;
  required: boolean; // For basic programs
}

// ============================================================================
// EXPERIENCE LEVEL SYSTEM
// ============================================================================

export interface ExperienceLevelInfo {
  level: ExperienceLevel;
  name: string;
  description: string;
  duration: string;
  characteristics: string[];
  progressionStrategy: string;
  recommendedPrograms: string[];
  strengthStandards?: {
    benchPress?: { beginner: number; intermediate: number };
    squat?: { beginner: number; intermediate: number };
    deadlift?: { beginner: number; intermediate: number };
  };
}

export interface ExperienceLevelRecommendation {
  recommendedLevel: ExperienceLevel;
  confidence: number; // 0-1
  reasoning: string[];
  alternatives?: {
    level: ExperienceLevel;
    reason: string;
  }[];
}

// ============================================================================
// PROFILE VALIDATION TYPES
// ============================================================================

export interface ProfileValidationResult {
  isValid: boolean;
  errors: ProfileValidationError[];
  warnings: ProfileValidationWarning[];
}

export interface ProfileValidationError {
  field: keyof ProfileSetupData | keyof ProfileEditData;
  message: string;
  code: string;
}

export interface ProfileValidationWarning {
  field: keyof ProfileSetupData | keyof ProfileEditData;
  message: string;
  suggestion?: string;
}

// ============================================================================
// PROFILE SERVICE TYPES
// ============================================================================

export interface ProfileServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface ProfileUpdateOptions {
  optimistic?: boolean;
  skipValidation?: boolean;
  syncImmediately?: boolean;
}

export interface ProfileSyncStatus {
  lastSyncAt?: string;
  pendingChanges: boolean;
  syncInProgress: boolean;
  conflicts: ProfileConflict[];
}

export interface ProfileConflict {
  field: string;
  localValue: any;
  serverValue: any;
  timestamp: string;
}

// ============================================================================
// PROFILE ANALYTICS TYPES
// ============================================================================

export interface ProfileCompletionStatus {
  overall: number; // 0-100 percentage
  sections: {
    basicInfo: number;
    fitnessProfile: number;
    goals: number;
    equipment: number;
    privacy: number;
  };
  missingFields: string[];
  recommendations: string[];
}

export interface ProfileInsights {
  strengthToWeightRatio?: number;
  experienceLevelAccuracy?: number;
  goalAlignment?: number;
  equipmentUtilization?: number;
  progressPotential?: number;
}

// ============================================================================
// ONBOARDING FLOW TYPES
// ============================================================================

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: string;
  required: boolean;
  order: number;
  estimatedTime: number; // in minutes
}

export interface OnboardingProgress {
  currentStep: number;
  totalSteps: number;
  completedSteps: string[];
  skippedSteps: string[];
  timeSpent: number; // in seconds
}

export interface OnboardingState {
  isActive: boolean;
  progress: OnboardingProgress;
  data: Partial<ProfileSetupData>;
  canSkip: boolean;
  showProgress: boolean;
}

// ============================================================================
// PROFILE PREFERENCES TYPES
// ============================================================================

export interface ProfilePreferences {
  // Simplified unit preference: true = metric (kg/cm/km), false = imperial (lbs/ft_in/miles)
  useMetric: boolean;

  // Keep other non-unit preferences
  notifications: {
    workoutReminders: boolean;
    progressUpdates: boolean;
    aiCoaching: boolean;
    socialUpdates: boolean;
  };
  display: {
    theme: "light" | "dark" | "system";
    compactMode: boolean;
    showRPE: boolean;
    showRestTimer: boolean;
  };
  coaching: {
    personality: "gentle" | "balanced" | "challenging";
    frequency: "minimal" | "moderate" | "frequent";
    focusAreas: string[];
  };

  // Backwards-compat optional legacy units object (will be removed after migration)
  units?: {
    weight?: "kg" | "lbs";
    height?: "cm" | "ft_in";
    distance?: "km" | "miles";
  };
}

// ============================================================================
// PROFILE EXPORT TYPES
// ============================================================================

export interface ProfileExportData {
  profile: UserProfile;
  preferences: ProfilePreferences;
  workoutHistory: any[]; // Will be defined in workout types
  progressData: any[]; // Will be defined in progress types
  aiConversations?: any[]; // Will be defined in AI types
  exportedAt: string;
  version: string;
}

export interface ProfileImportResult {
  success: boolean;
  imported: {
    profile: boolean;
    preferences: boolean;
    workoutHistory: number;
    progressData: number;
  };
  errors: string[];
  warnings: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_FITNESS_GOALS: FitnessGoal[] = [
  {
    id: "build_muscle",
    name: "Build Muscle",
    description: "Increase muscle mass and size",
    category: "muscle",
    icon: { name: "fitness-outline", library: "ionicons" },
    popular: true,
  },
  {
    id: "get_stronger",
    name: "Get Stronger",
    description: "Increase maximum strength in key lifts",
    category: "strength",
    icon: { name: "barbell", library: "ionicons" },
    popular: true,
  },
  {
    id: "lose_weight",
    name: "Lose Weight",
    description: "Reduce body fat while maintaining muscle",
    category: "weight_loss",
    icon: { name: "scale-outline", library: "ionicons" },
    popular: true,
  },
  {
    id: "improve_endurance",
    name: "Improve Endurance",
    description: "Build cardiovascular and muscular endurance",
    category: "endurance",
    icon: { name: "heart-outline", library: "ionicons" },
    popular: false,
  },
  {
    id: "general_fitness",
    name: "General Fitness",
    description: "Overall health and fitness improvement",
    category: "general",
    icon: { name: "pulse-outline", library: "ionicons" },
    popular: true,
  },
  {
    id: "sport_performance",
    name: "Sport Performance",
    description: "Improve performance in specific sports",
    category: "strength",
    icon: { name: "trophy-outline", library: "ionicons" },
    popular: false,
  },
];

export const DEFAULT_EQUIPMENT: Equipment[] = [
  {
    id: "barbell",
    name: "Barbell",
    category: "free_weights",
    icon: "barbell",
    required: true,
  },
  {
    id: "dumbbells",
    name: "Dumbbells",
    category: "free_weights",
    icon: "dumbbell",
    required: true,
  },
  {
    id: "bench",
    name: "Bench",
    category: "accessories",
    icon: "bench",
    required: true,
  },
  {
    id: "squat_rack",
    name: "Squat Rack",
    category: "accessories",
    icon: "rack",
    required: true,
  },
  {
    id: "pull_up_bar",
    name: "Pull-up Bar",
    category: "accessories",
    icon: "pullup",
    required: false,
  },
  {
    id: "cables",
    name: "Cable Machine",
    category: "machines",
    icon: "cable",
    required: false,
  },
  {
    id: "kettlebells",
    name: "Kettlebells",
    category: "free_weights",
    icon: "kettlebell",
    required: false,
  },
  {
    id: "resistance_bands",
    name: "Resistance Bands",
    category: "accessories",
    icon: "band",
    required: false,
  },
];

export const EXPERIENCE_LEVELS: ExperienceLevelInfo[] = [
  {
    level: "untrained",
    name: "Untrained",
    description:
      "New to resistance training — learning safe movement patterns and building the habit of regular workouts. Focus is on balance, mobility, and practicing proper technique before increasing load.",
    duration: "0-3 months",
    characteristics: [
      "Learning basic movement patterns",
      "Prioritizes safety and consistency",
      "Quick early improvements as habits form",
      "Working on exercise confidence",
    ],
    progressionStrategy: "Focus on movement mastery and consistent practice before adding weight",
    recommendedPrograms: ["full_body_beginner"],
  },
  {
    level: "beginner",
    name: "Beginner",
    description:
      "Has some regular training experience and basic technique — can follow simple programs and make reliable weekly improvements when form is solid.",
    duration: "3-9 months",
    characteristics: [
      "Comfortable with core lifts",
      "Training consistently several times per week",
      "Making steady, measurable progress",
      "Still refining technique",
    ],
    progressionStrategy: "Small, consistent weekly increases when form is maintained",
    recommendedPrograms: ["full_body_beginner", "upper_lower_beginner"],
  },
  {
    level: "early_intermediate",
    name: "Early intermediate",
    description:
      "Training consistently for several months with solid technique. Progress is slower than before and is guided more by how hard sets feel rather than just rep completion.",
    duration: "9-18 months",
    characteristics: [
      "Good technical foundation on main lifts",
      "Progression requires attention to recovery and effort",
      "Beginning to use subjective effort cues (RPE)",
      "Ready for slightly more complex programming",
    ],
    progressionStrategy: "Use effort cues (RPE) and small increments to guide gradual progress",
    recommendedPrograms: ["upper_lower_intermediate", "body_part_split"],
  },
  {
    level: "intermediate",
    name: "Intermediate",
    description:
      "A practiced lifter who benefits from structured programming and planned variation. Gains require periodization, varied volume, and intentional planning. You will often need planned deloads, subtle program tweaks, and focused accessory work to continue making measurable progress.",
    duration: "18+ months",
    characteristics: [
      "Handles higher training volume",
      "Needs planned progression and recovery",
      "Understands autoregulation and periodization",
      "Uses technique refinements and variations",
    ],
    progressionStrategy: "Structured periodized plans with planned blocks and variation",
    recommendedPrograms: ["body_part_split", "custom_programs"],
  },
  {
    level: "advanced",
    name: "Advanced",
    description:
      "Long-term, experienced trainee with specific performance or aesthetic goals. Progression is highly individualized and often requires expert programming and close monitoring. Small gains require careful management of training variables, recovery, and nutrition, and progress is usually incremental and highly contextual.",
    duration: "3+ years",
    characteristics: [
      "Specialized and goal-focused training",
      "Advanced periodization and recovery strategies",
      "May train for performance or competition",
      "Requires individualized adjustments",
    ],
    progressionStrategy: "Highly individualized programming tailored to specific goals and context",
    recommendedPrograms: ["custom_programs"],
  },
];

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  dataSharing: false,
  analytics: true,
  aiCoaching: true,
  profileVisibility: "private",
  workoutSharing: false,
  progressSharing: false,
};

export const DEFAULT_PROFILE_PREFERENCES: ProfilePreferences = {
  useMetric: false, // default to imperial during development as previously set

  notifications: {
    workoutReminders: true,
    progressUpdates: true,
    aiCoaching: true,
    socialUpdates: false,
  },
  display: {
    theme: "system",
    compactMode: false,
    showRPE: true,
    showRestTimer: true,
  },
  coaching: {
    personality: "balanced",
    frequency: "moderate",
    focusAreas: [],
  },
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isValidExperienceLevel(level: string): level is ExperienceLevel {
  return ["untrained", "beginner", "early_intermediate", "intermediate", "advanced"].includes(level);
}

export function isValidGender(gender: string): gender is Gender {
  return ["male", "female", "other", "prefer_not_to_say"].includes(gender);
}

export function isProfileComplete(profile: Partial<UserProfile>): profile is UserProfile {
  return !!(
    profile.id &&
    profile.email &&
    profile.displayName &&
    profile.experienceLevel &&
    profile.fitnessGoals &&
    profile.fitnessGoals.length > 0
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

export function getExperienceLevelInfo(level: ExperienceLevel): ExperienceLevelInfo {
  return EXPERIENCE_LEVELS.find((info) => info.level === level) || EXPERIENCE_LEVELS[0];
}

export function getNextExperienceLevel(currentLevel: ExperienceLevel): ExperienceLevel | null {
  const levels: ExperienceLevel[] = ["untrained", "beginner", "early_intermediate", "intermediate", "advanced"];
  const currentIndex = levels.indexOf(currentLevel);

  if (currentIndex === -1 || currentIndex === levels.length - 1) {
    return null;
  }

  return levels[currentIndex + 1];
}

export function formatProfileCompletionPercentage(status: ProfileCompletionStatus): string {
  return `${Math.round(status.overall)}%`;
}

export function getProfileCompletionColor(percentage: number): string {
  if (percentage >= 80) return "#34C759"; // Green
  if (percentage >= 60) return "#FF9500"; // Orange
  return "#FF3B30"; // Red
}
