// ============================================================================
// SUBSCRIPTION TIERS CONSTANTS
// ============================================================================
// Subscription tier definitions and feature matrices for the feature access
// control system. Works with temporary subscription system during testing.

import type { TempSubscriptionPlan } from "../types/tempSubscription";

// ============================================================================
// FEATURE DEFINITIONS
// ============================================================================

export const FEATURES = {
  // Core Features (Free)
  UNLIMITED_WORKOUTS: "unlimited_workouts",
  BASIC_PROGRESS: "basic_progress",
  EXERCISE_LIBRARY: "exercise_library",
  COMMUNITY_SUPPORT: "community_support",

  // Premium Features
  AI_COACHING: "ai_coaching",
  MONTHLY_REVIEWS: "monthly_reviews",
  CUSTOM_PROGRAMS: "custom_programs",
  ADVANCED_ANALYTICS: "advanced_analytics",
  DATA_EXPORT: "data_export",
  PRIORITY_SUPPORT: "priority_support",
  OFFLINE_SYNC: "offline_sync",
  WORKOUT_TEMPLATES: "workout_templates",

  // Coach Features
  CLIENT_MANAGEMENT: "client_management",
  COACH_DASHBOARD: "coach_dashboard",
  BULK_ASSIGNMENT: "bulk_assignment",
  CLIENT_ANALYTICS: "client_analytics",
  PROGRAM_TEMPLATES: "program_templates",
  COACH_BRANDING: "coach_branding",
  REVENUE_ANALYTICS: "revenue_analytics",
  CLIENT_COMMUNICATION: "client_communication",
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

// ============================================================================
// FEATURE METADATA
// ============================================================================

export interface FeatureMetadata {
  key: FeatureKey;
  name: string;
  description: string;
  category: "core" | "premium" | "coach";
  icon: string;
  previewEnabled: boolean;
  previewDuration?: number; // seconds
  upgradePrompt: {
    title: string;
    description: string;
    benefits: string[];
    ctaText: string;
    testingNote: string;
  };
}

export const FEATURE_METADATA: Record<FeatureKey, FeatureMetadata> = {
  [FEATURES.UNLIMITED_WORKOUTS]: {
    key: FEATURES.UNLIMITED_WORKOUTS,
    name: "Unlimited Workouts",
    description: "Track unlimited workout sessions",
    category: "core",
    icon: "💪",
    previewEnabled: false,
    upgradePrompt: {
      title: "Unlimited Workouts",
      description: "Track as many workouts as you want",
      benefits: ["No session limits", "Full workout history", "Progress tracking"],
      ctaText: "Always Free",
      testingNote: "This feature is always free!",
    },
  },

  [FEATURES.BASIC_PROGRESS]: {
    key: FEATURES.BASIC_PROGRESS,
    name: "Basic Progress Tracking",
    description: "View basic workout progress and statistics",
    category: "core",
    icon: "📊",
    previewEnabled: false,
    upgradePrompt: {
      title: "Basic Progress",
      description: "Track your basic workout progress",
      benefits: ["Workout history", "Basic charts", "Personal records"],
      ctaText: "Always Free",
      testingNote: "This feature is always free!",
    },
  },

  [FEATURES.EXERCISE_LIBRARY]: {
    key: FEATURES.EXERCISE_LIBRARY,
    name: "Exercise Library",
    description: "Access to complete exercise database",
    category: "core",
    icon: "📚",
    previewEnabled: false,
    upgradePrompt: {
      title: "Exercise Library",
      description: "Browse our complete exercise database",
      benefits: ["52+ exercises", "Form instructions", "Muscle targeting"],
      ctaText: "Always Free",
      testingNote: "This feature is always free!",
    },
  },

  [FEATURES.COMMUNITY_SUPPORT]: {
    key: FEATURES.COMMUNITY_SUPPORT,
    name: "Community Support",
    description: "Access to community forums and basic support",
    category: "core",
    icon: "👥",
    previewEnabled: false,
    upgradePrompt: {
      title: "Community Support",
      description: "Get help from our community",
      benefits: ["Community forums", "Basic support", "FAQ access"],
      ctaText: "Always Free",
      testingNote: "This feature is always free!",
    },
  },

  [FEATURES.AI_COACHING]: {
    key: FEATURES.AI_COACHING,
    name: "AI Coaching",
    description: "Get personalized AI coaching feedback and guidance",
    category: "premium",
    icon: "🤖",
    previewEnabled: true,
    previewDuration: 30,
    upgradePrompt: {
      title: "Unlock AI Coaching",
      description: "Get personalized workout guidance from our AI coach",
      benefits: [
        "Real-time form feedback",
        "Personalized progression advice",
        "RPE-based recommendations",
        "Injury prevention tips",
      ],
      ctaText: "Try Premium (Testing)",
      testingNote: "Test all premium features free for 30 days - no payment required!",
    },
  },

  [FEATURES.MONTHLY_REVIEWS]: {
    key: FEATURES.MONTHLY_REVIEWS,
    name: "Monthly AI Reviews",
    description: "Comprehensive monthly progress reviews generated by AI",
    category: "premium",
    icon: "📋",
    previewEnabled: true,
    previewDuration: 15,
    upgradePrompt: {
      title: "Unlock Monthly Reviews",
      description: "Get detailed AI-generated monthly progress reports",
      benefits: [
        "Comprehensive progress analysis",
        "Strength gain insights",
        "Goal achievement tracking",
        "Next month recommendations",
      ],
      ctaText: "Try Premium (Testing)",
      testingNote: "Test all premium features free for 30 days - no payment required!",
    },
  },

  [FEATURES.CUSTOM_PROGRAMS]: {
    key: FEATURES.CUSTOM_PROGRAMS,
    name: "Custom Programs",
    description: "Create and customize your own workout programs",
    category: "premium",
    icon: "🎯",
    previewEnabled: true,
    previewDuration: 45,
    upgradePrompt: {
      title: "Unlock Custom Programs",
      description: "Create personalized workout programs tailored to your goals",
      benefits: [
        "Unlimited custom programs",
        "Program templates",
        "Exercise substitutions",
        "Progressive overload planning",
      ],
      ctaText: "Try Premium (Testing)",
      testingNote: "Test all premium features free for 30 days - no payment required!",
    },
  },

  [FEATURES.ADVANCED_ANALYTICS]: {
    key: FEATURES.ADVANCED_ANALYTICS,
    name: "Advanced Analytics",
    description: "Detailed analytics and insights into your training",
    category: "premium",
    icon: "📈",
    previewEnabled: true,
    previewDuration: 20,
    upgradePrompt: {
      title: "Unlock Advanced Analytics",
      description: "Get detailed insights into your strength gains and performance trends",
      benefits: [
        "Volume progression tracking",
        "Strength gain analysis",
        "RPE trend analysis",
        "Performance predictions",
      ],
      ctaText: "Try Premium (Testing)",
      testingNote: "Test all premium features free for 30 days - no payment required!",
    },
  },

  [FEATURES.DATA_EXPORT]: {
    key: FEATURES.DATA_EXPORT,
    name: "Data Export",
    description: "Export your workout data in various formats",
    category: "premium",
    icon: "💾",
    previewEnabled: false,
    upgradePrompt: {
      title: "Unlock Data Export",
      description: "Export your workout data for backup or analysis",
      benefits: ["CSV export", "JSON export", "PDF reports", "Cloud backup"],
      ctaText: "Try Premium (Testing)",
      testingNote: "Test all premium features free for 30 days - no payment required!",
    },
  },

  [FEATURES.PRIORITY_SUPPORT]: {
    key: FEATURES.PRIORITY_SUPPORT,
    name: "Priority Support",
    description: "Get priority customer support and faster response times",
    category: "premium",
    icon: "🚀",
    previewEnabled: false,
    upgradePrompt: {
      title: "Unlock Priority Support",
      description: "Get faster response times and priority assistance",
      benefits: ["24-hour response time", "Direct developer access", "Feature requests", "Beta access"],
      ctaText: "Try Premium (Testing)",
      testingNote: "Test all premium features free for 30 days - no payment required!",
    },
  },

  [FEATURES.OFFLINE_SYNC]: {
    key: FEATURES.OFFLINE_SYNC,
    name: "Advanced Offline Sync",
    description: "Enhanced offline capabilities with conflict resolution",
    category: "premium",
    icon: "🔄",
    previewEnabled: false,
    upgradePrompt: {
      title: "Unlock Advanced Offline Sync",
      description: "Enhanced offline capabilities with smart conflict resolution",
      benefits: ["Unlimited offline storage", "Smart sync", "Conflict resolution", "Backup protection"],
      ctaText: "Try Premium (Testing)",
      testingNote: "Test all premium features free for 30 days - no payment required!",
    },
  },

  [FEATURES.WORKOUT_TEMPLATES]: {
    key: FEATURES.WORKOUT_TEMPLATES,
    name: "Workout Templates",
    description: "Access to premium workout templates and programs",
    category: "premium",
    icon: "📝",
    previewEnabled: true,
    previewDuration: 30,
    upgradePrompt: {
      title: "Unlock Workout Templates",
      description: "Access premium workout templates designed by experts",
      benefits: ["50+ premium templates", "Specialized programs", "Expert-designed", "Regular updates"],
      ctaText: "Try Premium (Testing)",
      testingNote: "Test all premium features free for 30 days - no payment required!",
    },
  },

  [FEATURES.CLIENT_MANAGEMENT]: {
    key: FEATURES.CLIENT_MANAGEMENT,
    name: "Client Management",
    description: "Manage multiple clients and their workout programs",
    category: "coach",
    icon: "👨‍💼",
    previewEnabled: true,
    previewDuration: 60,
    upgradePrompt: {
      title: "Unlock Client Management",
      description: "Manage multiple clients and track their progress",
      benefits: ["Unlimited clients", "Progress tracking", "Program assignment", "Communication tools"],
      ctaText: "Try Coach (Testing)",
      testingNote: "Test all coach features free for 30 days - no payment required!",
    },
  },

  [FEATURES.COACH_DASHBOARD]: {
    key: FEATURES.COACH_DASHBOARD,
    name: "Coach Dashboard",
    description: "Comprehensive dashboard for coaching business management",
    category: "coach",
    icon: "📊",
    previewEnabled: true,
    previewDuration: 45,
    upgradePrompt: {
      title: "Unlock Coach Dashboard",
      description: "Access your comprehensive coaching dashboard",
      benefits: ["Client overview", "Progress analytics", "Business metrics", "Performance insights"],
      ctaText: "Try Coach (Testing)",
      testingNote: "Test all coach features free for 30 days - no payment required!",
    },
  },

  [FEATURES.BULK_ASSIGNMENT]: {
    key: FEATURES.BULK_ASSIGNMENT,
    name: "Bulk Program Assignment",
    description: "Assign programs to multiple clients at once",
    category: "coach",
    icon: "📤",
    previewEnabled: false,
    upgradePrompt: {
      title: "Unlock Bulk Assignment",
      description: "Assign programs to multiple clients simultaneously",
      benefits: ["Time saving", "Batch operations", "Program templates", "Client grouping"],
      ctaText: "Try Coach (Testing)",
      testingNote: "Test all coach features free for 30 days - no payment required!",
    },
  },

  [FEATURES.CLIENT_ANALYTICS]: {
    key: FEATURES.CLIENT_ANALYTICS,
    name: "Client Analytics",
    description: "Detailed analytics for each client's progress",
    category: "coach",
    icon: "📈",
    previewEnabled: true,
    previewDuration: 30,
    upgradePrompt: {
      title: "Unlock Client Analytics",
      description: "Get detailed analytics for each client's progress",
      benefits: ["Individual progress tracking", "Comparative analysis", "Goal achievement", "Trend analysis"],
      ctaText: "Try Coach (Testing)",
      testingNote: "Test all coach features free for 30 days - no payment required!",
    },
  },

  [FEATURES.PROGRAM_TEMPLATES]: {
    key: FEATURES.PROGRAM_TEMPLATES,
    name: "Coach Program Templates",
    description: "Create and manage reusable program templates",
    category: "coach",
    icon: "📋",
    previewEnabled: true,
    previewDuration: 40,
    upgradePrompt: {
      title: "Unlock Program Templates",
      description: "Create reusable program templates for your coaching business",
      benefits: ["Template library", "Easy customization", "Client-specific adjustments", "Version control"],
      ctaText: "Try Coach (Testing)",
      testingNote: "Test all coach features free for 30 days - no payment required!",
    },
  },

  [FEATURES.COACH_BRANDING]: {
    key: FEATURES.COACH_BRANDING,
    name: "Coach Branding",
    description: "Customize the app with your coaching brand",
    category: "coach",
    icon: "🎨",
    previewEnabled: false,
    upgradePrompt: {
      title: "Unlock Coach Branding",
      description: "Customize the app with your coaching brand and logo",
      benefits: ["Custom branding", "Logo integration", "Color schemes", "Professional appearance"],
      ctaText: "Try Coach (Testing)",
      testingNote: "Test all coach features free for 30 days - no payment required!",
    },
  },

  [FEATURES.REVENUE_ANALYTICS]: {
    key: FEATURES.REVENUE_ANALYTICS,
    name: "Revenue Analytics",
    description: "Track your coaching business revenue and metrics",
    category: "coach",
    icon: "💰",
    previewEnabled: true,
    previewDuration: 25,
    upgradePrompt: {
      title: "Unlock Revenue Analytics",
      description: "Track your coaching business performance and revenue",
      benefits: ["Revenue tracking", "Client retention", "Growth metrics", "Financial insights"],
      ctaText: "Try Coach (Testing)",
      testingNote: "Test all coach features free for 30 days - no payment required!",
    },
  },

  [FEATURES.CLIENT_COMMUNICATION]: {
    key: FEATURES.CLIENT_COMMUNICATION,
    name: "Client Communication",
    description: "Built-in communication tools for client interaction",
    category: "coach",
    icon: "💬",
    previewEnabled: false,
    upgradePrompt: {
      title: "Unlock Client Communication",
      description: "Communicate with clients directly through the app",
      benefits: ["In-app messaging", "Progress updates", "Feedback system", "Notification management"],
      ctaText: "Try Coach (Testing)",
      testingNote: "Test all coach features free for 30 days - no payment required!",
    },
  },
};

// ============================================================================
// SUBSCRIPTION TIER DEFINITIONS
// ============================================================================

export interface SubscriptionTier {
  id: TempSubscriptionPlan;
  name: string;
  displayName: string;
  description: string;
  features: FeatureKey[];
  testingDuration: number; // days
  isRecommended?: boolean;
  upgradeFrom?: TempSubscriptionPlan[];
}

export const SUBSCRIPTION_TIERS: Record<TempSubscriptionPlan, SubscriptionTier> = {
  free: {
    id: "free",
    name: "Free",
    displayName: "Free",
    description: "Essential workout tracking features",
    features: [
      FEATURES.UNLIMITED_WORKOUTS,
      FEATURES.BASIC_PROGRESS,
      FEATURES.EXERCISE_LIBRARY,
      FEATURES.COMMUNITY_SUPPORT,
    ],
    testingDuration: 0,
  },

  premium: {
    id: "premium",
    name: "Premium",
    displayName: "Premium (Testing)",
    description: "Advanced features with AI coaching and analytics",
    features: [
      // Include all free features
      FEATURES.UNLIMITED_WORKOUTS,
      FEATURES.BASIC_PROGRESS,
      FEATURES.EXERCISE_LIBRARY,
      FEATURES.COMMUNITY_SUPPORT,
      // Premium features
      FEATURES.AI_COACHING,
      FEATURES.MONTHLY_REVIEWS,
      FEATURES.CUSTOM_PROGRAMS,
      FEATURES.ADVANCED_ANALYTICS,
      FEATURES.DATA_EXPORT,
      FEATURES.PRIORITY_SUPPORT,
      FEATURES.OFFLINE_SYNC,
      FEATURES.WORKOUT_TEMPLATES,
    ],
    testingDuration: 30,
    isRecommended: true,
    upgradeFrom: ["free"],
  },

  coach: {
    id: "coach",
    name: "Coach",
    displayName: "Coach (Testing)",
    description: "Professional coaching tools for fitness professionals",
    features: [
      // Include all premium features
      FEATURES.UNLIMITED_WORKOUTS,
      FEATURES.BASIC_PROGRESS,
      FEATURES.EXERCISE_LIBRARY,
      FEATURES.COMMUNITY_SUPPORT,
      FEATURES.AI_COACHING,
      FEATURES.MONTHLY_REVIEWS,
      FEATURES.CUSTOM_PROGRAMS,
      FEATURES.ADVANCED_ANALYTICS,
      FEATURES.DATA_EXPORT,
      FEATURES.PRIORITY_SUPPORT,
      FEATURES.OFFLINE_SYNC,
      FEATURES.WORKOUT_TEMPLATES,
      // Coach features
      FEATURES.CLIENT_MANAGEMENT,
      FEATURES.COACH_DASHBOARD,
      FEATURES.BULK_ASSIGNMENT,
      FEATURES.CLIENT_ANALYTICS,
      FEATURES.PROGRAM_TEMPLATES,
      FEATURES.COACH_BRANDING,
      FEATURES.REVENUE_ANALYTICS,
      FEATURES.CLIENT_COMMUNICATION,
    ],
    testingDuration: 30,
    upgradeFrom: ["free", "premium"],
  },
};

// ============================================================================
// FEATURE ACCESS UTILITIES
// ============================================================================

/**
 * Check if a subscription tier includes a specific feature
 */
export function tierHasFeature(tier: TempSubscriptionPlan, feature: FeatureKey): boolean {
  return SUBSCRIPTION_TIERS[tier].features.includes(feature);
}

/**
 * Get all features for a subscription tier
 */
export function getTierFeatures(tier: TempSubscriptionPlan): FeatureKey[] {
  return SUBSCRIPTION_TIERS[tier].features;
}

/**
 * Get the minimum tier required for a feature
 */
export function getMinimumTierForFeature(feature: FeatureKey): TempSubscriptionPlan {
  const tiers: TempSubscriptionPlan[] = ["free", "premium", "coach"];

  for (const tier of tiers) {
    if (tierHasFeature(tier, feature)) {
      return tier;
    }
  }

  return "coach"; // Default to highest tier if not found
}

/**
 * Get features that would be gained by upgrading to a tier
 */
export function getUpgradeFeatures(currentTier: TempSubscriptionPlan, targetTier: TempSubscriptionPlan): FeatureKey[] {
  const currentFeatures = getTierFeatures(currentTier);
  const targetFeatures = getTierFeatures(targetTier);

  return targetFeatures.filter((feature) => !currentFeatures.includes(feature));
}

/**
 * Get recommended upgrade tier for a feature
 */
export function getRecommendedUpgradeForFeature(feature: FeatureKey): TempSubscriptionPlan {
  const minimumTier = getMinimumTierForFeature(feature);

  // If feature requires coach tier, recommend coach
  if (minimumTier === "coach") {
    return "coach";
  }

  // Otherwise recommend premium (most common upgrade)
  return "premium";
}

// ============================================================================
// FEATURE CATEGORIES
// ============================================================================

export const FEATURE_CATEGORIES = {
  CORE: "core",
  PREMIUM: "premium",
  COACH: "coach",
} as const;

export type FeatureCategory = (typeof FEATURE_CATEGORIES)[keyof typeof FEATURE_CATEGORIES];

/**
 * Get features by category
 */
export function getFeaturesByCategory(category: FeatureCategory): FeatureKey[] {
  return Object.values(FEATURE_METADATA)
    .filter((metadata) => metadata.category === category)
    .map((metadata) => metadata.key);
}

/**
 * Get feature metadata
 */
export function getFeatureMetadata(feature: FeatureKey): FeatureMetadata {
  return FEATURE_METADATA[feature];
}

// ============================================================================
// TESTING UTILITIES
// ============================================================================

/**
 * Check if a tier is in testing mode
 */
export function isTierTesting(tier: TempSubscriptionPlan): boolean {
  return tier !== "free";
}

/**
 * Get testing duration for a tier
 */
export function getTierTestingDuration(tier: TempSubscriptionPlan): number {
  return SUBSCRIPTION_TIERS[tier].testingDuration;
}

/**
 * Get testing disclaimer for a tier
 */
export function getTierTestingDisclaimer(tier: TempSubscriptionPlan): string {
  if (tier === "free") {
    return "Always free - no testing required";
  }

  return `Testing Mode - No Payment Required • ${getTierTestingDuration(tier)} days free access`;
}
