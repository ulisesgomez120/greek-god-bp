// ============================================================================
// AI USAGE HOOK
// ============================================================================
// Hook for tracking AI usage, limits, and cost management

import { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { aiCostManager, getUserAIUsage, estimateAIQueryCost } from "@/utils/aiCostManager";
import { logger } from "@/utils/logger";
import type { RootState } from "@/store";
import type { AIUsageMetrics, AIUsageRecord, AICostEstimate, UseAIUsageReturn } from "@/types/ai";

// ============================================================================
// AI USAGE HOOK
// ============================================================================

export function useAIUsage(): UseAIUsageReturn {
  const [usage, setUsage] = useState<AIUsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get current user from Redux store
  const { user } = useSelector((state: RootState) => state.auth);
  const userId = user?.id;

  /**
   * Load usage data for current user
   */
  const loadUsage = useCallback(async () => {
    if (!userId) {
      setUsage(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const usageData = await getUserAIUsage(userId);
      setUsage(usageData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load AI usage data";
      logger.error("Error loading AI usage:", err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  /**
   * Check if user can make an AI query
   */
  const canMakeQuery = useCallback((): boolean => {
    if (!usage) return false;

    // Check query limits for free users
    if (usage.remainingQueries <= 0 && usage.remainingQueries !== -1) {
      return false;
    }

    // Check budget limits for premium users
    if (usage.remainingBudget <= 0.01) {
      return false;
    }

    return true;
  }, [usage]);

  /**
   * Estimate cost for a query
   */
  const estimateCost = useCallback(
    async (query: string, model?: string): Promise<AICostEstimate> => {
      try {
        const estimate = await estimateAIQueryCost(query, "", model);

        // Add remaining budget info
        return {
          ...estimate,
          canAfford: usage ? usage.remainingBudget >= estimate.estimatedCost : false,
          remainingBudget: usage?.remainingBudget || 0,
        };
      } catch (err) {
        logger.error("Error estimating query cost:", err);
        throw err;
      }
    },
    [usage]
  );

  /**
   * Track AI usage after a query
   */
  const trackUsage = useCallback(
    async (record: Omit<AIUsageRecord, "id" | "createdAt">): Promise<void> => {
      try {
        await aiCostManager.trackUsage(record);

        // Refresh usage data after tracking
        await loadUsage();
      } catch (err) {
        logger.error("Error tracking AI usage:", err);
        throw err;
      }
    },
    [loadUsage]
  );

  /**
   * Refresh usage data
   */
  const refreshUsage = useCallback(async (): Promise<void> => {
    await loadUsage();
  }, [loadUsage]);

  /**
   * Reset monthly usage (for testing/admin purposes)
   */
  const resetMonthlyUsage = useCallback(async (): Promise<void> => {
    if (!userId) return;

    try {
      await aiCostManager.resetMonthlyUsage(userId);
      await loadUsage();
    } catch (err) {
      logger.error("Error resetting monthly usage:", err);
      throw err;
    }
  }, [userId, loadUsage]);

  // Load usage data when user changes
  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  // Auto-refresh usage data every 5 minutes
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      loadUsage();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [userId, loadUsage]);

  return {
    usage,
    loading,
    error,
    canMakeQuery: canMakeQuery(),
    estimateCost,
    trackUsage,
    refreshUsage,
    resetMonthlyUsage,
  };
}

// ============================================================================
// USAGE LIMIT CHECKER HOOK
// ============================================================================

/**
 * Hook to check if user is approaching usage limits
 */
export function useAIUsageLimits() {
  const { usage } = useAIUsage();
  const [warnings, setWarnings] = useState<{
    nearQueryLimit: boolean;
    nearBudgetLimit: boolean;
    warningMessage?: string;
  }>({
    nearQueryLimit: false,
    nearBudgetLimit: false,
  });

  useEffect(() => {
    if (!usage) {
      setWarnings({
        nearQueryLimit: false,
        nearBudgetLimit: false,
      });
      return;
    }

    const checkLimits = async () => {
      try {
        const limits = await aiCostManager.checkUsageLimits(usage.userId);
        setWarnings(limits);
      } catch (error) {
        logger.error("Error checking usage limits:", error);
      }
    };

    checkLimits();
  }, [usage]);

  return warnings;
}

// ============================================================================
// AI QUERY PERMISSION HOOK
// ============================================================================

/**
 * Hook to check if a specific query can be made
 */
export function useAIQueryPermission(query?: string, model?: string) {
  const { usage, canMakeQuery, estimateCost } = useAIUsage();
  const [canMakeThisQuery, setCanMakeThisQuery] = useState(false);
  const [estimate, setEstimate] = useState<AICostEstimate | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!query || !canMakeQuery) {
      setCanMakeThisQuery(false);
      setEstimate(null);
      return;
    }

    const checkQuery = async () => {
      try {
        setChecking(true);
        const queryEstimate = await estimateCost(query, model);
        setEstimate(queryEstimate);
        setCanMakeThisQuery(queryEstimate.canAfford);
      } catch (error) {
        logger.error("Error checking query permission:", error);
        setCanMakeThisQuery(false);
        setEstimate(null);
      } finally {
        setChecking(false);
      }
    };

    checkQuery();
  }, [query, model, canMakeQuery, estimateCost]);

  return {
    canMakeQuery: canMakeThisQuery,
    estimate,
    checking,
    usage,
  };
}

// ============================================================================
// AI USAGE ANALYTICS HOOK
// ============================================================================

/**
 * Hook for AI usage analytics (admin/monitoring)
 */
export function useAIUsageAnalytics(startDate?: string, endDate?: string) {
  const [analytics, setAnalytics] = useState<{
    totalQueries: number;
    totalCost: number;
    totalTokens: number;
    uniqueUsers: number;
    averageCostPerQuery: number;
    modelUsage: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    if (!startDate || !endDate) return;

    try {
      setLoading(true);
      setError(null);

      const analyticsData = await aiCostManager.getUsageAnalytics(startDate, endDate);
      setAnalytics(analyticsData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load analytics";
      logger.error("Error loading AI analytics:", err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return {
    analytics,
    loading,
    error,
    refresh: loadAnalytics,
  };
}

// ============================================================================
// USAGE STATUS HELPERS
// ============================================================================

/**
 * Get user-friendly usage status message
 */
export function getUsageStatusMessage(usage: AIUsageMetrics | null): string {
  if (!usage) return "Loading usage data...";

  // Free tier user
  if (usage.remainingQueries >= 0) {
    if (usage.remainingQueries === 0) {
      return "You've used all your free AI conversations this month. Upgrade to Premium for unlimited access.";
    }
    return `AI Coach: ${usage.remainingQueries}/${
      usage.remainingQueries + usage.monthlyQueries
    } conversations left this month`;
  }

  // Premium user
  const budgetUsed = ((1.0 - usage.remainingBudget) * 100).toFixed(0);
  if (usage.remainingBudget <= 0.01) {
    return "You've reached your monthly AI budget. Usage will reset next month.";
  }

  return `AI Coach: ${budgetUsed}% of monthly budget used ($${(1.0 - usage.remainingBudget).toFixed(2)}/$1.00)`;
}

/**
 * Get usage status color for UI
 */
export function getUsageStatusColor(usage: AIUsageMetrics | null): "success" | "warning" | "error" | "info" {
  if (!usage) return "info";

  // Free tier
  if (usage.remainingQueries >= 0) {
    if (usage.remainingQueries === 0) return "error";
    if (usage.remainingQueries === 1) return "warning";
    return "success";
  }

  // Premium tier
  const budgetUsedPercent = ((1.0 - usage.remainingBudget) / 1.0) * 100;
  if (budgetUsedPercent >= 90) return "error";
  if (budgetUsedPercent >= 75) return "warning";
  return "success";
}

/**
 * Check if user should see upgrade prompt
 */
export function shouldShowUpgradePrompt(usage: AIUsageMetrics | null): boolean {
  if (!usage) return false;

  // Show upgrade prompt for free users who have used 80% or more of their queries
  if (usage.remainingQueries >= 0) {
    const totalQueries = usage.remainingQueries + usage.monthlyQueries;
    const usagePercent = (usage.monthlyQueries / totalQueries) * 100;
    return usagePercent >= 80;
  }

  return false;
}
