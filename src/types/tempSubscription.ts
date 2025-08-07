// ============================================================================
// TEMPORARY SUBSCRIPTION TYPES
// ============================================================================
// TypeScript interfaces for the temporary subscription system used during
// the testing phase. This will be replaced with native IAP types later.

// ============================================================================
// CORE TYPES
// ============================================================================

export type TempSubscriptionPlan = "free" | "premium" | "coach";

export interface TempSubscription {
  plan: TempSubscriptionPlan;
  expiresAt: string | null;
  isActive: boolean;
  isTesting: boolean;
  daysRemaining?: number;
}

export interface TempSubscriptionUpgrade {
  plan: TempSubscriptionPlan;
  durationDays: number;
}

export interface TempSubscriptionStatus {
  success: boolean;
  plan?: TempSubscriptionPlan;
  expiresAt?: string;
  durationDays?: number;
  isTesting?: boolean;
  error?: string;
}

// ============================================================================
// EFFECTIVE SUBSCRIPTION TYPES
// ============================================================================

export type SubscriptionType = "free" | "real" | "temporary";

export interface EffectiveSubscription {
  type: SubscriptionType;
  plan: string;
  features: string[];
  expiresAt: string | null;
  isActive: boolean;
  isTesting: boolean;
}

// ============================================================================
// PLAN DEFINITIONS
// ============================================================================

export interface TempPlanDefinition {
  id: TempSubscriptionPlan;
  name: string;
  description: string;
  features: string[];
  testingDisclaimer: string;
  durationDays: number;
  isRecommended?: boolean;
}

export const TEMP_PLAN_DEFINITIONS: Record<TempSubscriptionPlan, TempPlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    description: "Basic workout tracking with limited features",
    features: [
      "Unlimited workout logging",
      "Basic progression tracking",
      "One pre-built program",
      "Exercise form notes",
    ],
    testingDisclaimer: "Always free - no testing required",
    durationDays: 0,
  },
  premium: {
    id: "premium",
    name: "Premium (Testing)",
    description: "Full access to all premium features for testing",
    features: [
      "All free features",
      "Unlimited AI coaching conversations",
      "Automated monthly AI progress reviews",
      "Advanced analytics and strength tracking",
      "Custom program builder",
      "Data export and backup",
      "Priority customer support",
    ],
    testingDisclaimer: "Testing Mode - No Payment Required",
    durationDays: 30,
    isRecommended: true,
  },
  coach: {
    id: "coach",
    name: "Coach (Testing)",
    description: "For fitness professionals managing multiple clients",
    features: [
      "All Premium features",
      "Manage up to 50 clients",
      "Client progress dashboard",
      "Custom program templates",
      "Bulk program assignment",
      "Client communication tools",
      "Revenue analytics",
      "White-label options",
    ],
    testingDisclaimer: "Testing Mode - No Payment Required",
    durationDays: 30,
  },
};

// ============================================================================
// FEATURE ACCESS TYPES
// ============================================================================

export interface FeatureAccess {
  hasAccess: boolean;
  reason?: "no_subscription" | "expired" | "feature_not_in_plan" | "testing_mode";
  upgradeRequired?: boolean;
  isTesting?: boolean;
  expiresAt?: string;
}

export interface FeatureGateConfig {
  featureKey: string;
  featureName: string;
  requiredPlans: TempSubscriptionPlan[];
  upgradePrompt: {
    title: string;
    description: string;
    ctaText: string;
    testingNote: string;
  };
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export interface TempSubscriptionUIState {
  showUpgradeModal: boolean;
  selectedPlan: TempSubscriptionPlan | null;
  upgrading: boolean;
  error: string | null;
  showTestingBanner: boolean;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface TempSubscriptionApiResponse {
  success: boolean;
  data?: {
    plan: TempSubscriptionPlan;
    expiresAt: string;
    durationDays: number;
    isTesting: boolean;
  };
  error?: {
    message: string;
    code?: string;
  };
}

export interface EffectiveSubscriptionApiResponse {
  success: boolean;
  data?: EffectiveSubscription;
  error?: {
    message: string;
    code?: string;
  };
}

// ============================================================================
// HOOK RETURN TYPES
// ============================================================================

export interface UseTempSubscriptionReturn {
  // Current subscription state
  subscription: TempSubscription | null;
  effectiveSubscription: EffectiveSubscription | null;

  // Loading states
  loading: boolean;
  upgrading: boolean;

  // Error state
  error: string | null;

  // Actions
  upgradeToPremium: () => Promise<void>;
  upgradeToCoach: () => Promise<void>;
  checkFeatureAccess: (featureKey: string) => FeatureAccess;
  refreshSubscription: () => Promise<void>;

  // Computed values
  isActive: boolean;
  isTesting: boolean;
  isPremium: boolean;
  isCoach: boolean;
  daysRemaining: number | null;
  expiresAt: string | null;

  // UI helpers
  getUpgradePrompt: (featureKey: string) => FeatureGateConfig | null;
  shouldShowTestingBanner: boolean;
}

// ============================================================================
// COMPONENT PROP TYPES
// ============================================================================

export interface TempSubscriptionScreenProps {
  navigation: any; // React Navigation type
}

export interface TempPlanSelectorProps {
  currentPlan: TempSubscriptionPlan;
  onPlanSelect: (plan: TempSubscriptionPlan) => void;
  loading?: boolean;
  disabled?: boolean;
}

export interface TestingBannerProps {
  visible: boolean;
  plan: TempSubscriptionPlan;
  expiresAt: string | null;
  onDismiss?: () => void;
}

export interface FeatureGateProps {
  featureKey: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
  onUpgradePress?: () => void;
}

// ============================================================================
// REDUX STATE TYPES
// ============================================================================

export interface TempSubscriptionState {
  // Current temp subscription
  tempSubscription: TempSubscription | null;

  // Effective subscription (temp or real)
  effectiveSubscription: EffectiveSubscription | null;

  // Loading states
  loading: boolean;
  upgrading: boolean;

  // Error state
  error: string | null;

  // UI state
  ui: TempSubscriptionUIState;

  // Last updated timestamp
  lastUpdated: string | null;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface SubscriptionComparison {
  current: TempSubscriptionPlan;
  target: TempSubscriptionPlan;
  isUpgrade: boolean;
  isDowngrade: boolean;
  newFeatures: string[];
  removedFeatures: string[];
}

export interface ExpiryInfo {
  isExpired: boolean;
  isExpiringSoon: boolean; // Within 3 days
  daysRemaining: number;
  expiresAt: string;
  autoRenewsAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const TEMP_SUBSCRIPTION_CONSTANTS = {
  DEFAULT_DURATION_DAYS: 30,
  EXPIRY_WARNING_DAYS: 3,
  AUTO_RENEWAL_ENABLED: true,
  TESTING_BANNER_DISMISS_DURATION: 24 * 60 * 60 * 1000, // 24 hours in ms
} as const;

// ============================================================================
// FEATURE KEYS
// ============================================================================

export const FEATURE_KEYS = {
  AI_COACHING: "ai_coaching",
  MONTHLY_REVIEWS: "monthly_reviews",
  CUSTOM_PROGRAMS: "custom_programs",
  ADVANCED_ANALYTICS: "advanced_analytics",
  DATA_EXPORT: "data_export",
  PRIORITY_SUPPORT: "priority_support",
  CLIENT_MANAGEMENT: "client_management",
  COACH_DASHBOARD: "coach_dashboard",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

// ============================================================================
// EXPORT ALL TYPES
// ============================================================================
// All types are already exported above, no need to re-export them here
