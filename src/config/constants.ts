import Constants from "expo-constants";
import { EnvironmentConfig } from "@/types";

// ============================================================================
// APPLICATION CONSTANTS AND ENVIRONMENT CONFIGURATION
// ============================================================================

// Environment Configuration
export const ENV_CONFIG: EnvironmentConfig = {
  supabaseUrl: Constants.expoConfig?.extra?.supabaseUrl || "",
  supabaseAnonKey: Constants.expoConfig?.extra?.supabaseAnonKey || "",
  openaiApiKey: Constants.expoConfig?.extra?.openaiApiKey,
  stripePublishableKey: Constants.expoConfig?.extra?.stripePublishableKey || "",
  apiUrl: Constants.expoConfig?.extra?.apiUrl || "https://api.trainsmart.app",
  environment: (Constants.expoConfig?.extra?.environment as "development" | "staging" | "production") || "development",
  enableAnalytics: Constants.expoConfig?.extra?.enableAnalytics || false,
  enableFlipper: Constants.expoConfig?.extra?.enableFlipper || false,
  sentryDsn: Constants.expoConfig?.extra?.sentryDsn,
};

// App Information
export const APP_INFO = {
  name: "TrainSmart",
  version: Constants.expoConfig?.version || "1.0.0",
  buildNumber: Constants.expoConfig?.ios?.buildNumber || "1",
  bundleId: Constants.expoConfig?.ios?.bundleIdentifier || "com.trainsmart.app",
  scheme: Constants.expoConfig?.scheme || "trainsmart",
} as const;

// API Configuration
export const API_CONFIG = {
  baseUrl: ENV_CONFIG.apiUrl,
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
  endpoints: {
    auth: {
      signup: "/auth/signup",
      login: "/auth/login",
      logout: "/auth/logout",
      refresh: "/auth/refresh",
      resetPassword: "/auth/reset-password",
    },
    workouts: {
      sessions: "/workouts/sessions",
      plans: "/workouts/plans",
      exercises: "/workouts/exercises",
      progress: "/workouts/progress",
      sync: "/workouts/sync",
    },
    ai: {
      query: "/ai/query",
      conversations: "/ai/conversations",
      monthlyReview: "/ai/monthly-review",
      usage: "/ai/usage",
    },
    subscriptions: {
      plans: "/subscriptions/plans",
      subscribe: "/subscriptions/subscribe",
      cancel: "/subscriptions/cancel",
      webhook: "/subscriptions/webhook",
    },
    user: {
      profile: "/user/profile",
      preferences: "/user/preferences",
      export: "/user/export",
      delete: "/user/delete",
    },
  },
} as const;

// Design System Constants
export const COLORS = {
  // Primary Colors
  primary: {
    blue: "#B5CFF8",
    white: "#FFFFFF",
    dark: "#1C1C1E",
  },

  // Secondary Colors
  secondary: {
    blueLight: "#D7E4FD",
    gray: "#F2F2F7",
    blueDeep: "#87B1F3",
  },

  // Accent Colors
  accent: {
    successGreen: "#34C759",
    progressTeal: "#64D2FF",
    warningAmber: "#FF9500",
    errorRed: "#FF3B30",
  },

  // Functional Colors
  functional: {
    neutralGray: "#8E8E93",
    darkText: "#000000",
    lightText: "#FFFFFF",
  },

  // Backgrounds
  backgrounds: {
    backgroundWhite: "#FFFFFF",
    backgroundLight: "#F8FAFD",
    backgroundDark: "#0D1117",
    surfaceDark: "#21262D",
  },

  // Semantic Colors
  semantic: {
    // Workout Progress
    progressSuccess: "#34C759",
    progressWarning: "#FF9500",
    progressInfo: "#64D2FF",
    progressNeutral: "#8E8E93",

    // AI Coaching
    coachingPrimary: "#B5CFF8",
    coachingSecondary: "#D7E4FD",
    coachingSuccess: "#34C759",
    coachingWarning: "#FF9500",

    // Subscription States
    subscriptionActive: "#34C759",
    subscriptionTrialing: "#64D2FF",
    subscriptionExpired: "#FF3B30",
    subscriptionFree: "#8E8E93",
  },
} as const;

export const TYPOGRAPHY = {
  fontFamily: {
    primary: "SF Pro Text",
    display: "SF Pro Display",
    fallback: "Inter",
  },

  weights: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },

  sizes: {
    h1: 34,
    h2: 28,
    h3: 22,
    bodyLarge: 17,
    body: 15,
    bodySmall: 13,
    caption: 11,
    button: 17,
  },

  lineHeights: {
    h1: 40,
    h2: 32,
    h3: 28,
    bodyLarge: 22,
    body: 20,
    bodySmall: 18,
    caption: 16,
    button: 22,
  },
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const BORDER_RADIUS = {
  small: 8,
  medium: 12,
  large: 16,
  xlarge: 20,
  round: 50,
} as const;

// Animation Constants
export const ANIMATIONS = {
  duration: {
    fast: 150,
    standard: 250,
    slow: 300,
    coaching: 400,
    progressiveOverload: 500,
  },

  easing: {
    standard: "ease-out",
    spring: "spring",
    easeInOut: "ease-in-out",
    cubic: "cubic-bezier(0.25, 0.8, 0.25, 1)",
  },
} as const;

// Workout Constants
export const WORKOUT_CONSTANTS = {
  // RPE Scale
  rpe: {
    min: 1,
    max: 10,
    target: 8, // Target RPE for main working sets
    progressionThreshold: 1, // Must drop 1 RPE point to progress
  },

  // Rest Times (in seconds)
  restTimes: {
    warmup: 60,
    accessory: 90,
    compound: 180,
    heavy: 300,
  },

  // Progression Constants
  progression: {
    // Weight increases by exercise type (in kg)
    weightIncrease: {
      barbell: 2.5,
      dumbbell: 1.25,
      machine: 2.5,
      bodyweight: 0, // Use rep progression
    },

    // Experience-based progression rules
    experienceLevels: {
      untrained: {
        focusWeeks: 3, // Focus on form for 3 weeks
        progressionType: "technique",
      },
      beginner: {
        progressionType: "linear",
        weeklyIncrease: true,
      },
      early_intermediate: {
        progressionType: "rpe_based",
        targetRpe: 8,
      },
      intermediate: {
        progressionType: "periodized",
        deloadFrequency: 4, // Every 4 weeks
      },
    },
  },

  // Volume Calculations
  volume: {
    // Minimum effective volume per muscle group per week
    minimumSets: {
      chest: 8,
      back: 10,
      shoulders: 8,
      biceps: 6,
      triceps: 6,
      quadriceps: 10,
      hamstrings: 6,
      glutes: 6,
      calves: 8,
      abs: 6,
    },

    // Maximum recoverable volume per muscle group per week
    maximumSets: {
      chest: 22,
      back: 25,
      shoulders: 20,
      biceps: 20,
      triceps: 18,
      quadriceps: 25,
      hamstrings: 18,
      glutes: 20,
      calves: 20,
      abs: 25,
    },
  },
} as const;

// AI Coaching Constants
export const AI_CONSTANTS = {
  // Usage Limits
  usage: {
    freeMonthlyQueries: 2,
    premiumMonthlyBudget: 1.0, // $1 per month
    maxTokensPerQuery: 500,
    maxContextLength: 2000,
  },

  // Model Configuration
  models: {
    primary: "gpt-4o-mini",
    fallback: "gpt-3.5-turbo",
    costPerToken: {
      "gpt-4o-mini": 0.00015, // per 1K tokens
      "gpt-3.5-turbo": 0.0005, // per 1K tokens
    },
  },

  // Personality Levels
  personalities: {
    just_gentle: {
      name: "Just Gentle",
      description: "Supportive, encouraging, patience-focused",
      traits: ["supportive", "patient", "encouraging"],
    },
    more_gentle: {
      name: "More Gentle",
      description: "Primarily supportive with occasional challenges",
      traits: ["supportive", "gentle", "motivating"],
    },
    more_challenging: {
      name: "More Challenging",
      description: "Balanced approach with more direct feedback",
      traits: ["balanced", "direct", "motivating"],
    },
    just_challenging: {
      name: "Just Challenging",
      description: "Direct, results-focused, performance-driven",
      traits: ["direct", "challenging", "results-focused"],
    },
  },
} as const;

// Subscription Constants
export const SUBSCRIPTION_CONSTANTS = {
  // Plan Features
  features: {
    free: [
      "Unlimited workout logging",
      "Basic progression tracking",
      "One pre-built program",
      "2 AI coaching conversations per month",
      "Basic progress charts",
    ],
    premium: [
      "All free features",
      "All pre-built programs",
      "Unlimited AI coaching",
      "Monthly AI progress reviews",
      "Advanced analytics",
      "Custom program builder",
      "Data export",
    ],
    coach: [
      "All premium features",
      "Client management dashboard",
      "Program sharing",
      "Progress monitoring",
      "Bulk program creation",
    ],
  },

  // Pricing (in cents)
  pricing: {
    premium: {
      monthly: 999, // $9.99
      yearly: 7999, // $79.99 (33% discount)
    },
    coach: {
      monthly: 2999, // $29.99
      yearly: 23999, // $239.99 (33% discount)
    },
  },

  // Trial Periods (in days)
  trialPeriods: {
    premium: 7,
    coach: 14,
  },
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  // Secure Storage (encrypted)
  secure: {
    accessToken: "access_token",
    refreshToken: "refresh_token",
    userCredentials: "user_credentials",
  },

  // Async Storage (unencrypted)
  async: {
    userPreferences: "user_preferences",
    workoutCache: "workout_cache",
    aiPersonality: "ai_personality",
    onboardingComplete: "onboarding_complete",
    lastSyncTime: "last_sync_time",
    appVersion: "app_version",
  },
} as const;

// Validation Constants
export const VALIDATION = {
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  },

  email: {
    maxLength: 254,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },

  workout: {
    maxSets: 50,
    maxReps: 1000,
    maxWeight: 1000, // kg
    maxRestTime: 3600, // seconds (1 hour)
    maxDuration: 14400, // seconds (4 hours)
  },

  profile: {
    displayName: {
      minLength: 2,
      maxLength: 50,
    },
    // Height ranges are stored/referenced in cm (metric source-of-truth).
    // For UI validation we also provide approximate imperial bounds for convenience.
    height: {
      min: 100, // cm
      max: 250, // cm
      // Imperial approximate bounds (for display/validation helpers)
      // 4'0" = 121.92 cm, 8'2" = 249.92 cm
      minFtIn: { ft: 4, in: 0 },
      maxFtIn: { ft: 8, in: 2 },
    },
    // Weight ranges are stored in kg (metric source-of-truth).
    // Imperial approximate bounds are provided for UI validation helpers.
    weight: {
      min: 30, // kg
      max: 300, // kg
      // Imperial approximate bounds (for display/validation helpers)
      // 30 kg ≈ 66.1 lbs, 300 kg ≈ 661.4 lbs
      minLbs: 66,
      maxLbs: 661,
    },
  },
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  network: {
    offline: "You are currently offline. Some features may not be available.",
    timeout: "Request timed out. Please check your connection and try again.",
    serverError: "Server error occurred. Please try again later.",
    notFound: "The requested resource was not found.",
  },

  auth: {
    invalidCredentials: "Invalid email or password.",
    emailExists: "An account with this email already exists.",
    weakPassword: "Password must be at least 12 characters with uppercase, lowercase, numbers, and special characters.",
    sessionExpired: "Your session has expired. Please log in again.",
  },

  workout: {
    invalidRpe: "RPE must be between 1 and 10.",
    invalidWeight: "Weight must be a positive number.",
    invalidReps: "Reps must be a positive number.",
    syncFailed: "Failed to update workout data. Please try again.",
  },

  ai: {
    limitReached: "You have reached your monthly AI coaching limit.",
    apiError: "AI coaching is temporarily unavailable. Please try again later.",
    invalidQuery: "Please enter a valid question or request.",
  },

  subscription: {
    paymentFailed: "Payment failed. Please update your payment method.",
    subscriptionExpired: "Your subscription has expired. Please renew to continue using premium features.",
    upgradeRequired: "This feature requires a premium subscription.",
  },
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  auth: {
    signupSuccess: "Account created successfully! Please check your email to verify your account.",
    loginSuccess: "Welcome back!",
    passwordReset: "Password reset email sent. Please check your inbox.",
  },

  workout: {
    sessionCompleted: "Great workout! Your progress has been saved.",
    syncCompleted: "Workout data updated successfully.",
    progressionUnlocked: "Congratulations! You're ready to increase the weight.",
  },

  subscription: {
    subscriptionActive: "Welcome to TrainSmart Premium! Enjoy your enhanced features.",
    subscriptionCanceled:
      "Your subscription has been canceled. You can continue using premium features until the end of your billing period.",
  },

  profile: {
    profileUpdated: "Your profile has been updated successfully.",
    preferencesUpdated: "Your preferences have been saved.",
  },
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  enableAICoaching: true,
  enableCustomWorkouts: true,
  enableCoachDashboard: false, // Coming soon
  enableOfflineSync: false,
  enableProgressiveOverload: true,
  enableRealTimeUpdates: true,
  enableSocialFeatures: false, // Future phase
  enableWearableIntegration: false, // Future phase
} as const;

// Development Constants
export const DEV_CONSTANTS = {
  enableDebugMode: ENV_CONFIG.environment === "development",
  enableFlipper: ENV_CONFIG.enableFlipper,
  logLevel: ENV_CONFIG.environment === "production" ? "error" : "debug",
  mockApiResponses: false,
  skipOnboarding: false,
} as const;
