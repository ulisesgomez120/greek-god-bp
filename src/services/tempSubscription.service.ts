// ============================================================================
// TEMPORARY SUBSCRIPTION SERVICE
// ============================================================================
// Service for managing temporary subscriptions during the testing phase.
// This will be replaced with native IAP service when ready for production.

import { supabase } from "../lib/supabase";
import { logger } from "../utils/logger";
import type {
  TempSubscription,
  TempSubscriptionPlan,
  TempSubscriptionStatus,
  EffectiveSubscription,
  FeatureAccess,
} from "../types/tempSubscription";
import { FEATURE_KEYS } from "../types/tempSubscription";
import type { UserProfile } from "../types/database";

// ============================================================================
// TEMPORARY SUBSCRIPTION SERVICE CLASS
// ============================================================================

export class TempSubscriptionService {
  /**
   * Get user's current temporary subscription
   */
  static async getCurrentTempSubscription(userId: string): Promise<TempSubscription | null> {
    try {
      logger.info("Getting current temp subscription", { userId }, "tempSubscription");

      // Use raw SQL query to avoid TypeScript issues with new columns
      const { data: profiles, error } = await supabase.from("user_profiles").select("*").eq("id", userId).single();

      if (error) {
        logger.error("Failed to get temp subscription", error, "tempSubscription", userId);
        return null;
      }

      // Type assertion for new columns until database types are regenerated
      const profile = profiles as any;

      if (!profile || !profile.temp_subscription_plan || profile.temp_subscription_plan === "free") {
        return {
          plan: "free",
          expiresAt: null,
          isActive: true,
          isTesting: false,
        };
      }

      const expiresAt = profile.temp_subscription_expires;
      const isActive = !expiresAt || new Date(expiresAt) > new Date();
      const daysRemaining = expiresAt
        ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        plan: profile.temp_subscription_plan as TempSubscriptionPlan,
        expiresAt,
        isActive,
        isTesting: profile.temp_subscription_plan !== "free",
        daysRemaining: daysRemaining && daysRemaining > 0 ? daysRemaining : 0,
      };
    } catch (error) {
      logger.error("Error getting temp subscription", error, "tempSubscription", userId);
      return null;
    }
  }

  /**
   * Get user's effective subscription (temp or real)
   */
  static async getEffectiveSubscription(userId: string): Promise<EffectiveSubscription | null> {
    try {
      logger.info("Getting effective subscription", { userId }, "tempSubscription");

      // For now, use the temp subscription directly until database functions are available
      const tempSubscription = await this.getCurrentTempSubscription(userId);

      if (!tempSubscription) {
        return {
          type: "free",
          plan: "free",
          features: ["unlimited_workouts"],
          expiresAt: null,
          isActive: true,
          isTesting: false,
        };
      }

      // Map temp subscription to effective subscription
      const features = this.getPlanFeatures(tempSubscription.plan);

      return {
        type: tempSubscription.isTesting ? "temporary" : "free",
        plan: tempSubscription.plan,
        features,
        expiresAt: tempSubscription.expiresAt,
        isActive: tempSubscription.isActive,
        isTesting: tempSubscription.isTesting,
      };
    } catch (error) {
      logger.error("Error getting effective subscription", error, "tempSubscription", userId);
      return null;
    }
  }

  /**
   * Upgrade user to temporary premium subscription
   */
  static async upgradeTempSubscription(
    userId: string,
    plan: TempSubscriptionPlan,
    durationDays: number = 30
  ): Promise<TempSubscriptionStatus> {
    try {
      logger.info("Upgrading temp subscription", { userId, plan, durationDays }, "tempSubscription");

      if (plan === "free") {
        return {
          success: false,
          error: "Cannot upgrade to free plan",
        };
      }

      // Calculate expiry date
      const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      // Update user profile directly until database functions are available
      const { error } = await supabase
        .from("user_profiles")
        .update({
          temp_subscription_plan: plan,
          temp_subscription_expires: expiresAt,
          updated_at: new Date().toISOString(),
        } as any) // Type assertion for new columns
        .eq("id", userId);

      if (error) {
        logger.error("Failed to upgrade temp subscription", error, "tempSubscription", userId);
        return {
          success: false,
          error: error.message,
        };
      }

      logger.info("Temp subscription upgraded successfully", { userId, plan }, "tempSubscription");

      return {
        success: true,
        plan,
        expiresAt,
        durationDays,
        isTesting: true,
      };
    } catch (error) {
      logger.error("Error upgrading temp subscription", error, "tempSubscription", userId);
      return {
        success: false,
        error: "Failed to upgrade subscription",
      };
    }
  }

  /**
   * Check if user has access to a specific feature
   */
  static async checkFeatureAccess(userId: string, featureKey: string): Promise<FeatureAccess> {
    try {
      const effectiveSubscription = await this.getEffectiveSubscription(userId);

      if (!effectiveSubscription) {
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
    } catch (error) {
      logger.error("Error checking feature access", error, "tempSubscription", userId);
      return {
        hasAccess: false,
        reason: "no_subscription",
        upgradeRequired: true,
      };
    }
  }

  /**
   * Check if user has active temporary subscription
   */
  static async hasActiveTempSubscription(userId: string): Promise<boolean> {
    try {
      // Use the temp subscription directly until database functions are available
      const tempSubscription = await this.getCurrentTempSubscription(userId);
      return tempSubscription ? tempSubscription.isActive && tempSubscription.isTesting : false;
    } catch (error) {
      logger.error("Error checking active temp subscription", error, "tempSubscription", userId);
      return false;
    }
  }

  /**
   * Get feature requirements for upgrade prompts
   */
  static getFeatureRequirements(featureKey: string): {
    featureName: string;
    requiredPlans: TempSubscriptionPlan[];
    upgradePrompt: {
      title: string;
      description: string;
      ctaText: string;
      testingNote: string;
    };
  } | null {
    const featureConfigs = {
      [FEATURE_KEYS.AI_COACHING]: {
        featureName: "AI Coaching",
        requiredPlans: ["premium", "coach"] as TempSubscriptionPlan[],
        upgradePrompt: {
          title: "Unlock AI Coaching",
          description: "Get personalized workout guidance and form feedback from our AI coach.",
          ctaText: "Try Premium (Testing)",
          testingNote: "Test all premium features free for 30 days - no payment required!",
        },
      },
      [FEATURE_KEYS.MONTHLY_REVIEWS]: {
        featureName: "Monthly AI Reviews",
        requiredPlans: ["premium", "coach"] as TempSubscriptionPlan[],
        upgradePrompt: {
          title: "Unlock Monthly Reviews",
          description: "Get comprehensive AI-generated monthly progress reviews and insights.",
          ctaText: "Try Premium (Testing)",
          testingNote: "Test all premium features free for 30 days - no payment required!",
        },
      },
      [FEATURE_KEYS.CUSTOM_PROGRAMS]: {
        featureName: "Custom Programs",
        requiredPlans: ["premium", "coach"] as TempSubscriptionPlan[],
        upgradePrompt: {
          title: "Unlock Custom Programs",
          description: "Create and customize your own workout programs tailored to your goals.",
          ctaText: "Try Premium (Testing)",
          testingNote: "Test all premium features free for 30 days - no payment required!",
        },
      },
      [FEATURE_KEYS.ADVANCED_ANALYTICS]: {
        featureName: "Advanced Analytics",
        requiredPlans: ["premium", "coach"] as TempSubscriptionPlan[],
        upgradePrompt: {
          title: "Unlock Advanced Analytics",
          description: "Get detailed insights into your strength gains, volume progression, and performance trends.",
          ctaText: "Try Premium (Testing)",
          testingNote: "Test all premium features free for 30 days - no payment required!",
        },
      },
      [FEATURE_KEYS.DATA_EXPORT]: {
        featureName: "Data Export",
        requiredPlans: ["premium", "coach"] as TempSubscriptionPlan[],
        upgradePrompt: {
          title: "Unlock Data Export",
          description: "Export your workout data in various formats for backup or analysis.",
          ctaText: "Try Premium (Testing)",
          testingNote: "Test all premium features free for 30 days - no payment required!",
        },
      },
      [FEATURE_KEYS.CLIENT_MANAGEMENT]: {
        featureName: "Client Management",
        requiredPlans: ["coach"] as TempSubscriptionPlan[],
        upgradePrompt: {
          title: "Unlock Client Management",
          description: "Manage multiple clients, track their progress, and assign custom programs.",
          ctaText: "Try Coach (Testing)",
          testingNote: "Test all coach features free for 30 days - no payment required!",
        },
      },
      [FEATURE_KEYS.COACH_DASHBOARD]: {
        featureName: "Coach Dashboard",
        requiredPlans: ["coach"] as TempSubscriptionPlan[],
        upgradePrompt: {
          title: "Unlock Coach Dashboard",
          description: "Access your comprehensive coaching dashboard with client analytics and tools.",
          ctaText: "Try Coach (Testing)",
          testingNote: "Test all coach features free for 30 days - no payment required!",
        },
      },
    };

    return (featureConfigs as any)[featureKey] || null;
  }

  /**
   * Calculate days remaining until expiry
   */
  static calculateDaysRemaining(expiresAt: string | null): number | null {
    if (!expiresAt) return null;

    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
  }

  /**
   * Check if subscription is expiring soon (within 3 days)
   */
  static isExpiringSoon(expiresAt: string | null): boolean {
    const daysRemaining = this.calculateDaysRemaining(expiresAt);
    return daysRemaining !== null && daysRemaining <= 3 && daysRemaining > 0;
  }

  /**
   * Check if subscription is expired
   */
  static isExpired(expiresAt: string | null): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt) <= new Date();
  }

  /**
   * Get subscription comparison between current and target plan
   */
  static getSubscriptionComparison(current: TempSubscriptionPlan, target: TempSubscriptionPlan) {
    const planHierarchy = { free: 0, premium: 1, coach: 2 };
    const currentLevel = planHierarchy[current];
    const targetLevel = planHierarchy[target];

    const isUpgrade = targetLevel > currentLevel;
    const isDowngrade = targetLevel < currentLevel;

    // Get features for each plan
    const currentFeatures = this.getPlanFeatures(current);
    const targetFeatures = this.getPlanFeatures(target);

    const newFeatures = targetFeatures.filter((feature) => !currentFeatures.includes(feature));
    const removedFeatures = currentFeatures.filter((feature) => !targetFeatures.includes(feature));

    return {
      current,
      target,
      isUpgrade,
      isDowngrade,
      newFeatures,
      removedFeatures,
    };
  }

  /**
   * Get features for a specific plan
   */
  private static getPlanFeatures(plan: TempSubscriptionPlan): string[] {
    const planFeatures = {
      free: ["unlimited_workouts"],
      premium: [
        "unlimited_workouts",
        "ai_coaching",
        "monthly_reviews",
        "custom_programs",
        "advanced_analytics",
        "data_export",
        "priority_support",
      ],
      coach: [
        "unlimited_workouts",
        "ai_coaching",
        "monthly_reviews",
        "custom_programs",
        "advanced_analytics",
        "data_export",
        "priority_support",
        "client_management",
        "coach_dashboard",
      ],
    };

    return planFeatures[plan] || [];
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

export const tempSubscriptionService = TempSubscriptionService;

// Export individual methods for easier importing
export const {
  getCurrentTempSubscription,
  getEffectiveSubscription,
  upgradeTempSubscription,
  checkFeatureAccess,
  hasActiveTempSubscription,
  getFeatureRequirements,
  calculateDaysRemaining,
  isExpiringSoon,
  isExpired,
  getSubscriptionComparison,
} = TempSubscriptionService;
