// ============================================================================
// FEATURE ACCESS HOOK
// ============================================================================
// Enhanced React hook for checking feature availability and managing feature
// access throughout the app. Integrates with temporary subscription system.

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { useTempSubscription } from "./useTempSubscription";
import {
  checkFeatureAccess,
  checkMultipleFeatureAccess,
  startFeaturePreview,
  endFeaturePreview,
  isFeaturePreviewActive,
  getFeaturePreviewTimeRemaining,
  getUserActivePreviews,
  clearUserPreviews,
  getFeatureUpgradePrompt,
  isFeaturePreviewSupported,
  getFeatureDisplayInfo,
  isFeatureFullyEnabled,
  type FeatureAccessResult,
  type FeaturePreviewState,
  type FeatureGateOptions,
} from "../utils/featureFlags";
import { FEATURES, type FeatureKey } from "../constants/subscriptionTiers";
import { logger } from "../utils/logger";

// ============================================================================
// HOOK RETURN TYPES
// ============================================================================

export interface UseFeatureAccessReturn {
  // Access checking
  hasAccess: (featureKey: FeatureKey, options?: FeatureGateOptions) => boolean;
  checkAccess: (featureKey: FeatureKey, options?: FeatureGateOptions) => FeatureAccessResult;
  checkMultipleAccess: (
    featureKeys: FeatureKey[],
    options?: FeatureGateOptions
  ) => Record<FeatureKey, FeatureAccessResult>;

  // Preview management
  startPreview: (featureKey: FeatureKey, duration?: number) => boolean;
  endPreview: (featureKey: FeatureKey) => void;
  isPreviewActive: (featureKey: FeatureKey) => boolean;
  getPreviewTimeRemaining: (featureKey: FeatureKey) => number;
  activePreviews: FeaturePreviewState[];

  // Utility functions
  getUpgradePrompt: (featureKey: FeatureKey) => any;
  getFeatureInfo: (featureKey: FeatureKey) => any;
  isPreviewSupported: (featureKey: FeatureKey) => boolean;
  isFullyEnabled: (featureKey: FeatureKey, options?: FeatureGateOptions) => boolean;

  // State
  loading: boolean;
  error: string | null;
}

export interface UseFeatureGateReturn {
  // Access state
  hasAccess: boolean;
  accessResult: FeatureAccessResult;

  // Preview state
  isPreviewActive: boolean;
  previewTimeRemaining: number;
  canStartPreview: boolean;

  // Actions
  startPreview: () => boolean;
  endPreview: () => void;
  handleUpgrade: () => Promise<void>;

  // UI helpers
  upgradePrompt: any;
  featureInfo: any;
  loading: boolean;
  upgrading: boolean;
}

// ============================================================================
// MAIN FEATURE ACCESS HOOK
// ============================================================================

export function useFeatureAccess(): UseFeatureAccessReturn {
  // Get user ID and subscription data
  const userId = useSelector((state: any) => state.auth.user?.id);
  const { effectiveSubscription, loading: subscriptionLoading, error: subscriptionError } = useTempSubscription();

  // Local state for previews
  const [activePreviews, setActivePreviews] = useState<FeaturePreviewState[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Update active previews
  const updateActivePreviews = useCallback(() => {
    if (userId) {
      const previews = getUserActivePreviews(userId);
      setActivePreviews(previews);
    }
  }, [userId]);

  // Update previews periodically
  useEffect(() => {
    updateActivePreviews();
    const interval = setInterval(updateActivePreviews, 1000); // Update every second
    return () => clearInterval(interval);
  }, [updateActivePreviews]);

  // Clear previews on user change
  useEffect(() => {
    if (!userId) {
      setActivePreviews([]);
      setError(null);
    }
  }, [userId]);

  // Clear previews on logout
  useEffect(() => {
    return () => {
      if (userId) {
        clearUserPreviews(userId);
      }
    };
  }, [userId]);

  // Check if user has access to a feature
  const hasAccess = useCallback(
    (featureKey: FeatureKey, options: FeatureGateOptions = {}): boolean => {
      try {
        const result = checkFeatureAccess(featureKey, effectiveSubscription, userId, options);
        return result.hasAccess;
      } catch (err) {
        logger.error("Error checking feature access", err, "featureAccess", userId);
        setError(err instanceof Error ? err.message : "Failed to check feature access");
        return false;
      }
    },
    [effectiveSubscription, userId]
  );

  // Get detailed access information
  const checkAccess = useCallback(
    (featureKey: FeatureKey, options: FeatureGateOptions = {}): FeatureAccessResult => {
      try {
        return checkFeatureAccess(featureKey, effectiveSubscription, userId, options);
      } catch (err) {
        logger.error("Error getting feature access details", err, "featureAccess", userId);
        setError(err instanceof Error ? err.message : "Failed to get feature access details");
        return {
          hasAccess: false,
          reason: "no_subscription",
          upgradeRequired: true,
        };
      }
    },
    [effectiveSubscription, userId]
  );

  // Check multiple features at once
  const checkMultipleAccess = useCallback(
    (featureKeys: FeatureKey[], options: FeatureGateOptions = {}): Record<FeatureKey, FeatureAccessResult> => {
      try {
        return checkMultipleFeatureAccess(featureKeys, effectiveSubscription, userId, options);
      } catch (err) {
        logger.error("Error checking multiple feature access", err, "featureAccess", userId);
        setError(err instanceof Error ? err.message : "Failed to check multiple feature access");
        // Return a proper record with default access results for each feature
        const defaultResults: Record<FeatureKey, FeatureAccessResult> = {} as Record<FeatureKey, FeatureAccessResult>;
        featureKeys.forEach((key) => {
          defaultResults[key] = {
            hasAccess: false,
            reason: "no_subscription",
            upgradeRequired: true,
          };
        });
        return defaultResults;
      }
    },
    [effectiveSubscription, userId]
  );

  // Start a feature preview
  const startPreview = useCallback(
    (featureKey: FeatureKey, duration?: number): boolean => {
      if (!userId) {
        setError("User not authenticated");
        return false;
      }

      try {
        const preview = startFeaturePreview(userId, featureKey, duration);
        if (preview) {
          updateActivePreviews();
          logger.info("Started feature preview", { featureKey, duration }, "featureAccess", userId);
          return true;
        }
        return false;
      } catch (err) {
        logger.error("Error starting feature preview", err, "featureAccess", userId);
        setError(err instanceof Error ? err.message : "Failed to start preview");
        return false;
      }
    },
    [userId, updateActivePreviews]
  );

  // End a feature preview
  const endPreview = useCallback(
    (featureKey: FeatureKey): void => {
      if (!userId) return;

      try {
        endFeaturePreview(userId, featureKey);
        updateActivePreviews();
        logger.info("Ended feature preview", { featureKey }, "featureAccess", userId);
      } catch (err) {
        logger.error("Error ending feature preview", err, "featureAccess", userId);
        setError(err instanceof Error ? err.message : "Failed to end preview");
      }
    },
    [userId, updateActivePreviews]
  );

  // Check if a preview is active
  const isPreviewActive = useCallback(
    (featureKey: FeatureKey): boolean => {
      if (!userId) return false;
      return isFeaturePreviewActive(userId, featureKey);
    },
    [userId]
  );

  // Get remaining preview time
  const getPreviewTimeRemaining = useCallback(
    (featureKey: FeatureKey): number => {
      if (!userId) return 0;
      return getFeaturePreviewTimeRemaining(userId, featureKey);
    },
    [userId]
  );

  // Get upgrade prompt for a feature
  const getUpgradePrompt = useCallback((featureKey: FeatureKey) => {
    return getFeatureUpgradePrompt(featureKey);
  }, []);

  // Get feature display information
  const getFeatureInfo = useCallback((featureKey: FeatureKey) => {
    return getFeatureDisplayInfo(featureKey);
  }, []);

  // Check if preview is supported
  const isPreviewSupported = useCallback((featureKey: FeatureKey): boolean => {
    return isFeaturePreviewSupported(featureKey);
  }, []);

  // Check if feature is fully enabled (subscription + feature flags)
  const isFullyEnabled = useCallback(
    (featureKey: FeatureKey, options: FeatureGateOptions = {}): boolean => {
      return isFeatureFullyEnabled(featureKey, effectiveSubscription, userId, options);
    },
    [effectiveSubscription, userId]
  );

  // Combine loading states
  const loading = subscriptionLoading;

  // Combine errors
  const combinedError = error || subscriptionError;

  return {
    // Access checking
    hasAccess,
    checkAccess,
    checkMultipleAccess,

    // Preview management
    startPreview,
    endPreview,
    isPreviewActive,
    getPreviewTimeRemaining,
    activePreviews,

    // Utility functions
    getUpgradePrompt,
    getFeatureInfo,
    isPreviewSupported,
    isFullyEnabled,

    // State
    loading,
    error: combinedError,
  };
}

// ============================================================================
// FEATURE GATE HOOK
// ============================================================================

/**
 * Hook for feature gating with upgrade prompts and preview management
 */
export function useFeatureGate(featureKey: FeatureKey, options: FeatureGateOptions = {}): UseFeatureGateReturn {
  const userId = useSelector((state: any) => state.auth.user?.id);
  const { upgradeToPremium, upgradeToCoach, upgrading } = useTempSubscription();
  const featureAccess = useFeatureAccess();

  // Get access result
  const accessResult = useMemo(() => {
    return featureAccess.checkAccess(featureKey, { ...options, allowPreview: true });
  }, [featureAccess, featureKey, options]);

  // Preview state
  const isPreviewActive = featureAccess.isPreviewActive(featureKey);
  const previewTimeRemaining = featureAccess.getPreviewTimeRemaining(featureKey);
  const canStartPreview = featureAccess.isPreviewSupported(featureKey) && !isPreviewActive && !accessResult.hasAccess;

  // Start preview
  const startPreview = useCallback((): boolean => {
    return featureAccess.startPreview(featureKey);
  }, [featureAccess, featureKey]);

  // End preview
  const endPreview = useCallback((): void => {
    featureAccess.endPreview(featureKey);
  }, [featureAccess, featureKey]);

  // Handle upgrade
  const handleUpgrade = useCallback(async (): Promise<void> => {
    if (!accessResult.recommendedTier) return;

    try {
      if (accessResult.recommendedTier === "coach") {
        await upgradeToCoach();
      } else {
        await upgradeToPremium();
      }
    } catch (err) {
      logger.error("Error upgrading subscription", err, "featureGate", userId);
    }
  }, [accessResult.recommendedTier, upgradeToCoach, upgradeToPremium, userId]);

  // Get upgrade prompt
  const upgradePrompt = featureAccess.getUpgradePrompt(featureKey);

  // Get feature info
  const featureInfo = featureAccess.getFeatureInfo(featureKey);

  return {
    // Access state
    hasAccess: accessResult.hasAccess,
    accessResult,

    // Preview state
    isPreviewActive,
    previewTimeRemaining,
    canStartPreview,

    // Actions
    startPreview,
    endPreview,
    handleUpgrade,

    // UI helpers
    upgradePrompt,
    featureInfo,
    loading: featureAccess.loading,
    upgrading,
  };
}

// ============================================================================
// SPECIFIC FEATURE HOOKS
// ============================================================================

/**
 * Hook for AI Coaching feature access
 */
export function useAICoachingAccess() {
  return useFeatureGate(FEATURES.AI_COACHING, { allowPreview: true });
}

/**
 * Hook for Monthly Reviews feature access
 */
export function useMonthlyReviewsAccess() {
  return useFeatureGate(FEATURES.MONTHLY_REVIEWS, { allowPreview: true });
}

/**
 * Hook for Custom Programs feature access
 */
export function useCustomProgramsAccess() {
  return useFeatureGate(FEATURES.CUSTOM_PROGRAMS, { allowPreview: true });
}

/**
 * Hook for Advanced Analytics feature access
 */
export function useAdvancedAnalyticsAccess() {
  return useFeatureGate(FEATURES.ADVANCED_ANALYTICS, { allowPreview: true });
}

/**
 * Hook for Client Management feature access (Coach tier)
 */
export function useClientManagementAccess() {
  return useFeatureGate(FEATURES.CLIENT_MANAGEMENT, { allowPreview: true });
}

/**
 * Hook for Coach Dashboard feature access
 */
export function useCoachDashboardAccess() {
  return useFeatureGate(FEATURES.COACH_DASHBOARD, { allowPreview: true });
}

// ============================================================================
// BULK FEATURE ACCESS HOOKS
// ============================================================================

/**
 * Hook for checking access to multiple premium features
 */
export function usePremiumFeaturesAccess() {
  const featureAccess = useFeatureAccess();

  const premiumFeatures: FeatureKey[] = [
    FEATURES.AI_COACHING,
    FEATURES.MONTHLY_REVIEWS,
    FEATURES.CUSTOM_PROGRAMS,
    FEATURES.ADVANCED_ANALYTICS,
    FEATURES.DATA_EXPORT,
    FEATURES.PRIORITY_SUPPORT,
    FEATURES.OFFLINE_SYNC,
    FEATURES.WORKOUT_TEMPLATES,
  ];

  const accessResults = useMemo(() => {
    return featureAccess.checkMultipleAccess(premiumFeatures, { allowPreview: true });
  }, [featureAccess, premiumFeatures]);

  const hasAnyAccess = useMemo(() => {
    return Object.values(accessResults).some((result) => result.hasAccess);
  }, [accessResults]);

  const hasAllAccess = useMemo(() => {
    return Object.values(accessResults).every((result) => result.hasAccess);
  }, [accessResults]);

  return {
    accessResults,
    hasAnyAccess,
    hasAllAccess,
    loading: featureAccess.loading,
    error: featureAccess.error,
  };
}

/**
 * Hook for checking access to coach features
 */
export function useCoachFeaturesAccess() {
  const featureAccess = useFeatureAccess();

  const coachFeatures: FeatureKey[] = [
    FEATURES.CLIENT_MANAGEMENT,
    FEATURES.COACH_DASHBOARD,
    FEATURES.BULK_ASSIGNMENT,
    FEATURES.CLIENT_ANALYTICS,
    FEATURES.PROGRAM_TEMPLATES,
    FEATURES.COACH_BRANDING,
    FEATURES.REVENUE_ANALYTICS,
    FEATURES.CLIENT_COMMUNICATION,
  ];

  const accessResults = useMemo(() => {
    return featureAccess.checkMultipleAccess(coachFeatures, { allowPreview: true });
  }, [featureAccess, coachFeatures]);

  const hasAnyAccess = useMemo(() => {
    return Object.values(accessResults).some((result) => result.hasAccess);
  }, [accessResults]);

  const hasAllAccess = useMemo(() => {
    return Object.values(accessResults).every((result) => result.hasAccess);
  }, [accessResults]);

  return {
    accessResults,
    hasAnyAccess,
    hasAllAccess,
    loading: featureAccess.loading,
    error: featureAccess.error,
  };
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export default useFeatureAccess;

// Export feature constants for convenience
export { FEATURES };

// Export types
export type { FeatureKey, FeatureAccessResult, FeatureGateOptions };
