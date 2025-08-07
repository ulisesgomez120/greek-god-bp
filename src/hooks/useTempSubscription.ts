// ============================================================================
// TEMPORARY SUBSCRIPTION HOOK
// ============================================================================
// React hook for managing temporary subscription state and feature access
// during the testing phase. This will be replaced with native IAP hook later.

import { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { tempSubscriptionService } from "../services/tempSubscription.service";
import { logger } from "../utils/logger";
import type {
  TempSubscription,
  EffectiveSubscription,
  TempSubscriptionPlan,
  FeatureAccess,
  FeatureGateConfig,
  UseTempSubscriptionReturn,
} from "../types/tempSubscription";
import { FEATURE_KEYS } from "../types/tempSubscription";

// ============================================================================
// TEMPORARY SUBSCRIPTION HOOK
// ============================================================================

export function useTempSubscription(): UseTempSubscriptionReturn {
  // Get user ID from auth state
  const userId = useSelector((state: any) => state.auth.user?.id);

  // Local state
  const [subscription, setSubscription] = useState<TempSubscription | null>(null);
  const [effectiveSubscription, setEffectiveSubscription] = useState<EffectiveSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load subscription data
  const loadSubscription = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      const [tempSub, effectiveSub] = await Promise.all([
        tempSubscriptionService.getCurrentTempSubscription(userId),
        tempSubscriptionService.getEffectiveSubscription(userId),
      ]);

      setSubscription(tempSub);
      setEffectiveSubscription(effectiveSub);

      logger.info("Temp subscription loaded", { tempSub, effectiveSub }, "tempSubscription", userId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load subscription";
      setError(errorMessage);
      logger.error("Failed to load temp subscription", err, "tempSubscription", userId);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Load subscription on mount and when user changes
  useEffect(() => {
    if (userId) {
      loadSubscription();
    } else {
      // Clear subscription data when user logs out
      setSubscription(null);
      setEffectiveSubscription(null);
      setError(null);
    }
  }, [userId, loadSubscription]);

  // Upgrade to premium
  const upgradeToPremium = useCallback(async () => {
    if (!userId) {
      setError("User not authenticated");
      return;
    }

    try {
      setUpgrading(true);
      setError(null);

      const result = await tempSubscriptionService.upgradeTempSubscription(userId, "premium", 30);

      if (result.success) {
        // Reload subscription data
        await loadSubscription();
        logger.info("Successfully upgraded to premium", { result }, "tempSubscription", userId);
      } else {
        setError(result.error || "Upgrade failed");
        logger.error("Premium upgrade failed", result.error, "tempSubscription", userId);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Upgrade failed";
      setError(errorMessage);
      logger.error("Premium upgrade error", err, "tempSubscription", userId);
    } finally {
      setUpgrading(false);
    }
  }, [userId, loadSubscription]);

  // Upgrade to coach
  const upgradeToCoach = useCallback(async () => {
    if (!userId) {
      setError("User not authenticated");
      return;
    }

    try {
      setUpgrading(true);
      setError(null);

      const result = await tempSubscriptionService.upgradeTempSubscription(userId, "coach", 30);

      if (result.success) {
        // Reload subscription data
        await loadSubscription();
        logger.info("Successfully upgraded to coach", { result }, "tempSubscription", userId);
      } else {
        setError(result.error || "Upgrade failed");
        logger.error("Coach upgrade failed", result.error, "tempSubscription", userId);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Upgrade failed";
      setError(errorMessage);
      logger.error("Coach upgrade error", err, "tempSubscription", userId);
    } finally {
      setUpgrading(false);
    }
  }, [userId, loadSubscription]);

  // Check feature access
  const checkFeatureAccess = useCallback(
    (featureKey: string): FeatureAccess => {
      if (!userId || !effectiveSubscription) {
        return {
          hasAccess: false,
          reason: "no_subscription",
          upgradeRequired: true,
        };
      }

      // Check if feature is in the user's plan
      const hasFeature = effectiveSubscription.features.includes(featureKey);

      if (!hasFeature) {
        return {
          hasAccess: false,
          reason: "feature_not_in_plan",
          upgradeRequired: true,
          isTesting: effectiveSubscription.isTesting,
        };
      }

      // Check if subscription is active
      if (!effectiveSubscription.isActive) {
        return {
          hasAccess: false,
          reason: "expired",
          upgradeRequired: true,
          isTesting: effectiveSubscription.isTesting,
          expiresAt: effectiveSubscription.expiresAt || undefined,
        };
      }

      return {
        hasAccess: true,
        isTesting: effectiveSubscription.isTesting,
        expiresAt: effectiveSubscription.expiresAt || undefined,
      };
    },
    [userId, effectiveSubscription]
  );

  // Refresh subscription data
  const refreshSubscription = useCallback(async () => {
    await loadSubscription();
  }, [loadSubscription]);

  // Get upgrade prompt for a feature
  const getUpgradePrompt = useCallback((featureKey: string): FeatureGateConfig | null => {
    const requirements = tempSubscriptionService.getFeatureRequirements(featureKey);
    if (!requirements) return null;

    return {
      featureKey,
      featureName: requirements.featureName,
      requiredPlans: requirements.requiredPlans,
      upgradePrompt: requirements.upgradePrompt,
    };
  }, []);

  // Computed values
  const isActive = subscription?.isActive ?? false;
  const isTesting = subscription?.isTesting ?? false;
  const isPremium = subscription?.plan === "premium" && isActive;
  const isCoach = subscription?.plan === "coach" && isActive;
  const daysRemaining = subscription?.daysRemaining ?? null;
  const expiresAt = subscription?.expiresAt ?? null;

  // UI helpers
  const shouldShowTestingBanner = isTesting && isActive;

  return {
    // Current subscription state
    subscription,
    effectiveSubscription,

    // Loading states
    loading,
    upgrading,

    // Error state
    error,

    // Actions
    upgradeToPremium,
    upgradeToCoach,
    checkFeatureAccess,
    refreshSubscription,

    // Computed values
    isActive,
    isTesting,
    isPremium,
    isCoach,
    daysRemaining,
    expiresAt,

    // UI helpers
    getUpgradePrompt,
    shouldShowTestingBanner,
  };
}

// ============================================================================
// FEATURE ACCESS HOOK
// ============================================================================

/**
 * Hook for checking access to a specific feature
 */
export function useFeatureAccess(featureKey: string): FeatureAccess & { loading: boolean } {
  const { checkFeatureAccess, loading } = useTempSubscription();

  const access = checkFeatureAccess(featureKey);

  return {
    ...access,
    loading,
  };
}

// ============================================================================
// FEATURE GATE HOOK
// ============================================================================

/**
 * Hook for feature gating with upgrade prompts
 */
export function useFeatureGate(featureKey: string) {
  const { checkFeatureAccess, getUpgradePrompt, upgradeToPremium, upgradeToCoach, loading, upgrading } =
    useTempSubscription();

  const access = checkFeatureAccess(featureKey);
  const upgradePrompt = getUpgradePrompt(featureKey);

  const handleUpgrade = useCallback(async () => {
    if (!upgradePrompt) return;

    // Determine which upgrade to use based on required plans
    const requiresCoach =
      upgradePrompt.requiredPlans.includes("coach") && !upgradePrompt.requiredPlans.includes("premium");

    if (requiresCoach) {
      await upgradeToCoach();
    } else {
      await upgradeToPremium();
    }
  }, [upgradePrompt, upgradeToCoach, upgradeToPremium]);

  return {
    hasAccess: access.hasAccess,
    loading,
    upgrading,
    upgradePrompt,
    onUpgrade: handleUpgrade,
    access,
  };
}

// ============================================================================
// SUBSCRIPTION STATUS HOOK
// ============================================================================

/**
 * Hook for subscription status information
 */
export function useSubscriptionStatus() {
  const {
    subscription,
    effectiveSubscription,
    isActive,
    isTesting,
    isPremium,
    isCoach,
    daysRemaining,
    expiresAt,
    shouldShowTestingBanner,
    loading,
  } = useTempSubscription();

  // Calculate expiry status
  const isExpiringSoon = tempSubscriptionService.isExpiringSoon(expiresAt);
  const isExpired = tempSubscriptionService.isExpired(expiresAt);

  // Get current plan name
  const currentPlanName =
    subscription?.plan === "free"
      ? "Free"
      : subscription?.plan === "premium"
      ? "Premium (Testing)"
      : subscription?.plan === "coach"
      ? "Coach (Testing)"
      : "Free";

  // Get status message
  const getStatusMessage = (): string => {
    if (loading) return "Loading...";
    if (!subscription) return "Free Plan";
    if (isExpired) return "Subscription Expired";
    if (isExpiringSoon && daysRemaining !== null)
      return `Expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
    if (isTesting && daysRemaining !== null) return `Testing - ${daysRemaining} days remaining`;
    return currentPlanName;
  };

  return {
    subscription,
    effectiveSubscription,
    currentPlanName,
    statusMessage: getStatusMessage(),
    isActive,
    isTesting,
    isPremium,
    isCoach,
    daysRemaining,
    expiresAt,
    isExpiringSoon,
    isExpired,
    shouldShowTestingBanner,
    loading,
  };
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export default useTempSubscription;

// Export feature keys for convenience
export { FEATURE_KEYS };
