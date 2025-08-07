// ============================================================================
// FEATURE FLAGS UTILITY
// ============================================================================
// Feature definitions and access control logic for the feature access control
// system. Integrates with temporary subscription system during testing phase.

import type { TempSubscriptionPlan, EffectiveSubscription } from "../types/tempSubscription";
import {
  FEATURES,
  FEATURE_METADATA,
  SUBSCRIPTION_TIERS,
  tierHasFeature,
  getMinimumTierForFeature,
  getRecommendedUpgradeForFeature,
  getFeatureMetadata,
  type FeatureKey,
  type FeatureMetadata,
} from "../constants/subscriptionTiers";

// ============================================================================
// FEATURE ACCESS TYPES
// ============================================================================

export interface FeatureAccessResult {
  hasAccess: boolean;
  reason?: "no_subscription" | "expired" | "feature_not_in_plan" | "testing_mode" | "preview_mode";
  upgradeRequired?: boolean;
  isTesting?: boolean;
  expiresAt?: string;
  previewTimeRemaining?: number;
  recommendedTier?: TempSubscriptionPlan;
  metadata?: FeatureMetadata;
}

export interface FeaturePreviewState {
  isActive: boolean;
  startTime: number;
  duration: number;
  featureKey: FeatureKey;
  userId: string;
}

export interface FeatureGateOptions {
  allowPreview?: boolean;
  previewDuration?: number;
  showUpgradePrompt?: boolean;
  fallbackBehavior?: "hide" | "show_locked" | "show_preview";
}

// ============================================================================
// FEATURE PREVIEW MANAGER
// ============================================================================

class FeaturePreviewManager {
  private activePreviews = new Map<string, FeaturePreviewState>();

  /**
   * Start a feature preview for a user
   */
  startPreview(userId: string, featureKey: FeatureKey, duration?: number): FeaturePreviewState {
    const metadata = getFeatureMetadata(featureKey);
    const previewDuration = duration || metadata.previewDuration || 30;

    const previewState: FeaturePreviewState = {
      isActive: true,
      startTime: Date.now(),
      duration: previewDuration * 1000, // Convert to milliseconds
      featureKey,
      userId,
    };

    const key = `${userId}:${featureKey}`;
    this.activePreviews.set(key, previewState);

    // Auto-cleanup after preview expires
    setTimeout(() => {
      this.endPreview(userId, featureKey);
    }, previewState.duration);

    return previewState;
  }

  /**
   * End a feature preview
   */
  endPreview(userId: string, featureKey: FeatureKey): void {
    const key = `${userId}:${featureKey}`;
    this.activePreviews.delete(key);
  }

  /**
   * Check if a feature preview is active
   */
  isPreviewActive(userId: string, featureKey: FeatureKey): boolean {
    const key = `${userId}:${featureKey}`;
    const preview = this.activePreviews.get(key);

    if (!preview) return false;

    const now = Date.now();
    const elapsed = now - preview.startTime;

    if (elapsed >= preview.duration) {
      this.endPreview(userId, featureKey);
      return false;
    }

    return true;
  }

  /**
   * Get remaining preview time in seconds
   */
  getPreviewTimeRemaining(userId: string, featureKey: FeatureKey): number {
    const key = `${userId}:${featureKey}`;
    const preview = this.activePreviews.get(key);

    if (!preview) return 0;

    const now = Date.now();
    const elapsed = now - preview.startTime;
    const remaining = Math.max(0, preview.duration - elapsed);

    return Math.ceil(remaining / 1000);
  }

  /**
   * Get all active previews for a user
   */
  getUserPreviews(userId: string): FeaturePreviewState[] {
    return Array.from(this.activePreviews.values()).filter((preview) => preview.userId === userId);
  }

  /**
   * Clear all previews for a user
   */
  clearUserPreviews(userId: string): void {
    const keys = Array.from(this.activePreviews.keys()).filter((key) => key.startsWith(`${userId}:`));
    keys.forEach((key) => this.activePreviews.delete(key));
  }
}

// Global preview manager instance
const previewManager = new FeaturePreviewManager();

// ============================================================================
// FEATURE ACCESS CONTROL
// ============================================================================

/**
 * Check if a user has access to a specific feature
 */
export function checkFeatureAccess(
  featureKey: FeatureKey,
  subscription: EffectiveSubscription | null,
  userId?: string,
  options: FeatureGateOptions = {}
): FeatureAccessResult {
  const metadata = getFeatureMetadata(featureKey);

  // If no subscription data, deny access
  if (!subscription) {
    return {
      hasAccess: false,
      reason: "no_subscription",
      upgradeRequired: true,
      recommendedTier: getRecommendedUpgradeForFeature(featureKey),
      metadata,
    };
  }

  // Check if feature is included in user's plan
  const hasFeature = subscription.features.includes(featureKey);

  if (!hasFeature) {
    // Check if preview is available and active
    if (options.allowPreview && metadata.previewEnabled && userId) {
      const isPreviewActive = previewManager.isPreviewActive(userId, featureKey);
      const previewTimeRemaining = previewManager.getPreviewTimeRemaining(userId, featureKey);

      if (isPreviewActive) {
        return {
          hasAccess: true,
          reason: "preview_mode",
          isTesting: subscription.isTesting,
          previewTimeRemaining,
          metadata,
        };
      }
    }

    return {
      hasAccess: false,
      reason: "feature_not_in_plan",
      upgradeRequired: true,
      isTesting: subscription.isTesting,
      recommendedTier: getRecommendedUpgradeForFeature(featureKey),
      metadata,
    };
  }

  // Check if subscription is active
  if (!subscription.isActive) {
    return {
      hasAccess: false,
      reason: "expired",
      upgradeRequired: true,
      isTesting: subscription.isTesting,
      expiresAt: subscription.expiresAt || undefined,
      recommendedTier: getRecommendedUpgradeForFeature(featureKey),
      metadata,
    };
  }

  // User has access
  return {
    hasAccess: true,
    reason: subscription.isTesting ? "testing_mode" : undefined,
    isTesting: subscription.isTesting,
    expiresAt: subscription.expiresAt || undefined,
    metadata,
  };
}

/**
 * Check multiple features at once
 */
export function checkMultipleFeatureAccess(
  featureKeys: FeatureKey[],
  subscription: EffectiveSubscription | null,
  userId?: string,
  options: FeatureGateOptions = {}
): Record<FeatureKey, FeatureAccessResult> {
  const results: Record<string, FeatureAccessResult> = {};

  for (const featureKey of featureKeys) {
    results[featureKey] = checkFeatureAccess(featureKey, subscription, userId, options);
  }

  return results;
}

/**
 * Get all accessible features for a subscription
 */
export function getAccessibleFeatures(subscription: EffectiveSubscription | null): FeatureKey[] {
  if (!subscription || !subscription.isActive) {
    return SUBSCRIPTION_TIERS.free.features;
  }

  return subscription.features as FeatureKey[];
}

/**
 * Get all locked features for a subscription
 */
export function getLockedFeatures(subscription: EffectiveSubscription | null): FeatureKey[] {
  const accessibleFeatures = getAccessibleFeatures(subscription);
  const allFeatures = Object.values(FEATURES);

  return allFeatures.filter((feature) => !accessibleFeatures.includes(feature));
}

// ============================================================================
// FEATURE PREVIEW FUNCTIONS
// ============================================================================

/**
 * Start a feature preview
 */
export function startFeaturePreview(
  userId: string,
  featureKey: FeatureKey,
  duration?: number
): FeaturePreviewState | null {
  const metadata = getFeatureMetadata(featureKey);

  if (!metadata.previewEnabled) {
    return null;
  }

  return previewManager.startPreview(userId, featureKey, duration);
}

/**
 * End a feature preview
 */
export function endFeaturePreview(userId: string, featureKey: FeatureKey): void {
  previewManager.endPreview(userId, featureKey);
}

/**
 * Check if a feature preview is active
 */
export function isFeaturePreviewActive(userId: string, featureKey: FeatureKey): boolean {
  return previewManager.isPreviewActive(userId, featureKey);
}

/**
 * Get remaining preview time
 */
export function getFeaturePreviewTimeRemaining(userId: string, featureKey: FeatureKey): number {
  return previewManager.getPreviewTimeRemaining(userId, featureKey);
}

/**
 * Get all active previews for a user
 */
export function getUserActivePreviews(userId: string): FeaturePreviewState[] {
  return previewManager.getUserPreviews(userId);
}

/**
 * Clear all previews for a user (useful on logout)
 */
export function clearUserPreviews(userId: string): void {
  previewManager.clearUserPreviews(userId);
}

// ============================================================================
// FEATURE GATE UTILITIES
// ============================================================================

/**
 * Get upgrade prompt configuration for a feature
 */
export function getFeatureUpgradePrompt(featureKey: FeatureKey): FeatureMetadata["upgradePrompt"] {
  const metadata = getFeatureMetadata(featureKey);
  return metadata.upgradePrompt;
}

/**
 * Check if a feature supports previews
 */
export function isFeaturePreviewSupported(featureKey: FeatureKey): boolean {
  const metadata = getFeatureMetadata(featureKey);
  return metadata.previewEnabled;
}

/**
 * Get feature category (core, premium, coach)
 */
export function getFeatureCategory(featureKey: FeatureKey): "core" | "premium" | "coach" {
  const metadata = getFeatureMetadata(featureKey);
  return metadata.category;
}

/**
 * Get feature display information
 */
export function getFeatureDisplayInfo(featureKey: FeatureKey): {
  name: string;
  description: string;
  icon: string;
  category: string;
} {
  const metadata = getFeatureMetadata(featureKey);
  return {
    name: metadata.name,
    description: metadata.description,
    icon: metadata.icon,
    category: metadata.category,
  };
}

// ============================================================================
// SUBSCRIPTION TIER UTILITIES
// ============================================================================

/**
 * Get features that would be unlocked by upgrading to a tier
 */
export function getUnlockedFeaturesByTier(
  currentTier: TempSubscriptionPlan,
  targetTier: TempSubscriptionPlan
): FeatureKey[] {
  const currentFeatures = SUBSCRIPTION_TIERS[currentTier].features;
  const targetFeatures = SUBSCRIPTION_TIERS[targetTier].features;

  return targetFeatures.filter((feature) => !currentFeatures.includes(feature));
}

/**
 * Check if an upgrade would unlock a specific feature
 */
export function wouldUpgradeUnlockFeature(
  currentTier: TempSubscriptionPlan,
  targetTier: TempSubscriptionPlan,
  featureKey: FeatureKey
): boolean {
  const unlockedFeatures = getUnlockedFeaturesByTier(currentTier, targetTier);
  return unlockedFeatures.includes(featureKey);
}

/**
 * Get the best upgrade recommendation for multiple features
 */
export function getBestUpgradeForFeatures(featureKeys: FeatureKey[]): TempSubscriptionPlan {
  let recommendedTier: TempSubscriptionPlan = "free";

  for (const featureKey of featureKeys) {
    const minimumTier = getMinimumTierForFeature(featureKey);

    // Upgrade recommendation priority: coach > premium > free
    if (minimumTier === "coach") {
      recommendedTier = "coach";
    } else if (minimumTier === "premium" && recommendedTier !== "coach") {
      recommendedTier = "premium";
    }
  }

  return recommendedTier;
}

// ============================================================================
// FEATURE FLAG SYSTEM
// ============================================================================

/**
 * Feature flags for gradual rollouts (can be extended later)
 */
export const FEATURE_FLAGS = {
  ENABLE_PREVIEWS: true,
  ENABLE_AI_COACHING: true,
  ENABLE_COACH_FEATURES: true,
  ENABLE_ADVANCED_ANALYTICS: true,
  ENABLE_CUSTOM_PROGRAMS: true,
} as const;

/**
 * Check if a feature flag is enabled
 */
export function isFeatureFlagEnabled(flag: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[flag];
}

/**
 * Check if a feature is enabled by both subscription and feature flags
 */
export function isFeatureFullyEnabled(
  featureKey: FeatureKey,
  subscription: EffectiveSubscription | null,
  userId?: string,
  options: FeatureGateOptions = {}
): boolean {
  // Check subscription access
  const accessResult = checkFeatureAccess(featureKey, subscription, userId, options);
  if (!accessResult.hasAccess) return false;

  // Check feature flags (can be extended with more specific flags)
  switch (featureKey) {
    case FEATURES.AI_COACHING:
    case FEATURES.MONTHLY_REVIEWS:
      return isFeatureFlagEnabled("ENABLE_AI_COACHING");

    case FEATURES.CLIENT_MANAGEMENT:
    case FEATURES.COACH_DASHBOARD:
    case FEATURES.BULK_ASSIGNMENT:
    case FEATURES.CLIENT_ANALYTICS:
    case FEATURES.PROGRAM_TEMPLATES:
    case FEATURES.COACH_BRANDING:
    case FEATURES.REVENUE_ANALYTICS:
    case FEATURES.CLIENT_COMMUNICATION:
      return isFeatureFlagEnabled("ENABLE_COACH_FEATURES");

    case FEATURES.ADVANCED_ANALYTICS:
      return isFeatureFlagEnabled("ENABLE_ADVANCED_ANALYTICS");

    case FEATURES.CUSTOM_PROGRAMS:
    case FEATURES.WORKOUT_TEMPLATES:
      return isFeatureFlagEnabled("ENABLE_CUSTOM_PROGRAMS");

    default:
      return true;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export feature constants for convenience
export { FEATURES, FEATURE_METADATA, SUBSCRIPTION_TIERS };

// Export types
export type { FeatureKey, FeatureMetadata };

// Export preview manager for advanced usage
export { previewManager };
