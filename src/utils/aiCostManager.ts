// ============================================================================
// AI COST MANAGER
// ============================================================================
// Cost tracking and budget enforcement for AI services

import { AI_CONSTANTS } from "@/config/constants";
import { supabase } from "@/lib/supabase";
import { logger } from "@/utils/logger";
import type { AIUsageMetrics, AIUsageRecord, AICostEstimate, AIModel, AIUsageLimits } from "@/types/ai";

// ============================================================================
// COST CALCULATION UTILITIES
// ============================================================================

/**
 * Estimate token count for a given text string
 * Uses a simple approximation: ~4 characters per token for English text
 */
export function estimateTokenCount(text: string): number {
  // More accurate estimation considering:
  // - Average English word is ~4.7 characters
  // - GPT tokenizer averages ~0.75 tokens per word
  // - Special characters and formatting can increase token count
  const words = text.trim().split(/\s+/).length;
  const characters = text.length;

  // Use character-based estimation with adjustments
  const baseTokens = Math.ceil(characters / 4);

  // Adjust for complexity
  const complexityMultiplier = text.includes("{") || text.includes("[") ? 1.2 : 1.0;

  return Math.ceil(baseTokens * complexityMultiplier);
}

/**
 * Calculate cost for a given number of tokens and model
 */
export function calculateTokenCost(inputTokens: number, outputTokens: number, model: string): number {
  const costs = AI_CONSTANTS.models.costPerToken;
  const modelCost = costs[model as keyof typeof costs];

  if (!modelCost) {
    // Default to gpt-4o-mini pricing if model not found
    return (inputTokens + outputTokens) * AI_CONSTANTS.models.costPerToken["gpt-4o-mini"];
  }

  // OpenAI charges differently for input vs output tokens
  const inputCost = (inputTokens / 1000) * modelCost;
  const outputCost = (outputTokens / 1000) * modelCost;

  return inputCost + outputCost;
}

/**
 * Select optimal model based on query complexity and budget
 */
export function selectOptimalModel(query: string, context: string = "", remainingBudget: number): string {
  const totalText = query + context;
  const estimatedTokens = estimateTokenCount(totalText);

  // Simple query patterns that can use cheaper models
  const simplePatterns = [/how many sets/i, /what weight/i, /rest time/i, /form check/i, /rpe/i, /progression/i];

  const isSimpleQuery = simplePatterns.some((pattern) => pattern.test(query));
  const isShortQuery = estimatedTokens < 100;

  // Calculate costs for different models
  const gpt4Cost = calculateTokenCost(estimatedTokens, 150, "gpt-4o-mini");
  const gpt35Cost = calculateTokenCost(estimatedTokens, 150, "gpt-3.5-turbo");

  // Decision logic
  if (remainingBudget < 0.01) {
    // Very low budget - use cheapest option
    return "gpt-3.5-turbo";
  }

  if (isSimpleQuery || isShortQuery) {
    // Simple queries can use cheaper model
    return gpt35Cost <= remainingBudget ? "gpt-3.5-turbo" : "gpt-4o-mini";
  }

  // Complex queries benefit from better model if budget allows
  return gpt4Cost <= remainingBudget ? "gpt-4o-mini" : "gpt-3.5-turbo";
}

// ============================================================================
// USAGE TRACKING CLASS
// ============================================================================

export class AICostManager {
  private static instance: AICostManager;
  private usageCache = new Map<string, AIUsageMetrics>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): AICostManager {
    if (!AICostManager.instance) {
      AICostManager.instance = new AICostManager();
    }
    return AICostManager.instance;
  }

  /**
   * Get current usage metrics for a user
   */
  async getUserUsage(userId: string): Promise<AIUsageMetrics> {
    try {
      // Check cache first
      const cached = this.usageCache.get(userId);
      if (cached && Date.now() - new Date(cached.lastResetDate).getTime() < this.CACHE_DURATION) {
        return cached;
      }

      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

      // Get usage from current month
      const { data: usageRecords, error } = await supabase
        .from("ai_usage_tracking")
        .select("tokens_used, estimated_cost")
        .eq("user_id", userId)
        .gte("created_at", `${currentMonth}-01`)
        .lt("created_at", this.getNextMonthStart(currentMonth));

      if (error) {
        logger.error("Failed to fetch AI usage:", error);
        throw new Error("Failed to fetch usage data");
      }

      // Calculate totals
      const monthlyTokensUsed = usageRecords?.reduce((sum, record) => sum + record.tokens_used, 0) || 0;
      const monthlyCost = usageRecords?.reduce((sum, record) => sum + record.estimated_cost, 0) || 0;
      const monthlyQueries = usageRecords?.length || 0;

      // Get user subscription to determine limits
      const limits = await this.getUserLimits(userId);

      const usage: AIUsageMetrics = {
        userId,
        monthlyQueries,
        monthlyTokensUsed,
        monthlyCost,
        remainingQueries: Math.max(0, limits.freeMonthlyQueries - monthlyQueries),
        remainingBudget: Math.max(0, limits.premiumMonthlyBudget - monthlyCost),
        lastResetDate: new Date().toISOString(),
        currentMonth,
      };

      // Cache the result
      this.usageCache.set(userId, usage);

      return usage;
    } catch (error) {
      logger.error("Error getting user usage:", error);
      throw error;
    }
  }

  /**
   * Check if user can make a query within budget/limits
   */
  async canMakeQuery(userId: string, estimatedCost: number): Promise<boolean> {
    try {
      const usage = await this.getUserUsage(userId);
      const limits = await this.getUserLimits(userId);

      // Check query limit for free users
      if (usage.remainingQueries <= 0 && limits.freeMonthlyQueries > 0) {
        return false;
      }

      // Check budget limit for premium users
      if (usage.remainingBudget < estimatedCost) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error("Error checking query permission:", error);
      return false;
    }
  }

  /**
   * Estimate cost for a query
   */
  async estimateQueryCost(query: string, context: string = "", model?: string): Promise<AICostEstimate> {
    try {
      const totalText = query + context;
      const estimatedInputTokens = estimateTokenCount(totalText);
      const estimatedOutputTokens = 150; // Conservative estimate for response

      // Select model if not specified
      const selectedModel = model || selectOptimalModel(query, context, 1.0);

      const estimatedCost = calculateTokenCost(estimatedInputTokens, estimatedOutputTokens, selectedModel);

      return {
        estimatedTokens: estimatedInputTokens + estimatedOutputTokens,
        estimatedCost,
        modelRecommendation: selectedModel,
        canAfford: true, // Will be checked separately
        remainingBudget: 0, // Will be filled by caller
      };
    } catch (error) {
      logger.error("Error estimating query cost:", error);
      throw error;
    }
  }

  /**
   * Track AI usage after a successful query
   */
  async trackUsage(record: Omit<AIUsageRecord, "id" | "createdAt">): Promise<void> {
    try {
      const { error } = await supabase.from("ai_usage_tracking").insert({
        user_id: record.userId,
        query_type: record.queryType,
        query_text: record.queryText,
        response_text: record.responseText,
        tokens_used: record.tokensUsed,
        estimated_cost: record.estimatedCost,
        model_used: record.modelUsed,
        response_time_ms: record.responseTimeMs,
        user_rating: record.userRating,
        user_feedback: record.userFeedback,
      });

      if (error) {
        logger.error("Failed to track AI usage:", error);
        throw new Error("Failed to track usage");
      }

      // Invalidate cache for this user
      this.usageCache.delete(record.userId);

      logger.info("AI usage tracked successfully", {
        userId: record.userId,
        tokensUsed: record.tokensUsed,
        cost: record.estimatedCost,
      });
    } catch (error) {
      logger.error("Error tracking AI usage:", error);
      throw error;
    }
  }

  /**
   * Get user's AI usage limits based on subscription
   */
  private async getUserLimits(userId: string): Promise<AIUsageLimits> {
    try {
      // Check user's subscription status
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("status, plan_id, subscription_plans(features)")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();

      // Default to free tier limits
      let limits: AIUsageLimits = {
        freeMonthlyQueries: AI_CONSTANTS.usage.freeMonthlyQueries,
        premiumMonthlyBudget: 0,
        maxTokensPerQuery: AI_CONSTANTS.usage.maxTokensPerQuery,
        maxContextLength: AI_CONSTANTS.usage.maxContextLength,
        rateLimitPerMinute: 5,
        rateLimitPerHour: 20,
      };

      // Upgrade limits for premium users
      if (subscription?.status === "active") {
        limits = {
          ...limits,
          freeMonthlyQueries: -1, // Unlimited queries
          premiumMonthlyBudget: AI_CONSTANTS.usage.premiumMonthlyBudget,
          rateLimitPerMinute: 20,
          rateLimitPerHour: 100,
        };
      }

      return limits;
    } catch (error) {
      logger.error("Error getting user limits:", error);
      // Return free tier limits on error
      return {
        freeMonthlyQueries: AI_CONSTANTS.usage.freeMonthlyQueries,
        premiumMonthlyBudget: 0,
        maxTokensPerQuery: AI_CONSTANTS.usage.maxTokensPerQuery,
        maxContextLength: AI_CONSTANTS.usage.maxContextLength,
        rateLimitPerMinute: 5,
        rateLimitPerHour: 20,
      };
    }
  }

  /**
   * Get the start of next month for date filtering
   */
  private getNextMonthStart(currentMonth: string): string {
    const [year, month] = currentMonth.split("-").map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01`;
  }

  /**
   * Reset monthly usage (called automatically on month change)
   */
  async resetMonthlyUsage(userId: string): Promise<void> {
    try {
      // Clear cache for user
      this.usageCache.delete(userId);

      logger.info("Monthly AI usage reset", { userId });
    } catch (error) {
      logger.error("Error resetting monthly usage:", error);
      throw error;
    }
  }

  /**
   * Get usage analytics for admin/monitoring
   */
  async getUsageAnalytics(
    startDate: string,
    endDate: string
  ): Promise<{
    totalQueries: number;
    totalCost: number;
    totalTokens: number;
    uniqueUsers: number;
    averageCostPerQuery: number;
    modelUsage: Record<string, number>;
  }> {
    try {
      const { data: records, error } = await supabase
        .from("ai_usage_tracking")
        .select("user_id, tokens_used, estimated_cost, model_used")
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (error) {
        throw error;
      }

      const uniqueUsers = new Set(records?.map((r) => r.user_id) || []).size;
      const totalQueries = records?.length || 0;
      const totalCost = records?.reduce((sum, r) => sum + r.estimated_cost, 0) || 0;
      const totalTokens = records?.reduce((sum, r) => sum + r.tokens_used, 0) || 0;

      // Model usage breakdown
      const modelUsage: Record<string, number> = {};
      records?.forEach((record) => {
        modelUsage[record.model_used] = (modelUsage[record.model_used] || 0) + 1;
      });

      return {
        totalQueries,
        totalCost,
        totalTokens,
        uniqueUsers,
        averageCostPerQuery: totalQueries > 0 ? totalCost / totalQueries : 0,
        modelUsage,
      };
    } catch (error) {
      logger.error("Error getting usage analytics:", error);
      throw error;
    }
  }

  /**
   * Check if user is approaching limits and send warnings
   */
  async checkUsageLimits(userId: string): Promise<{
    nearQueryLimit: boolean;
    nearBudgetLimit: boolean;
    warningMessage?: string;
  }> {
    try {
      const usage = await this.getUserUsage(userId);
      const limits = await this.getUserLimits(userId);

      const queryUsagePercent =
        limits.freeMonthlyQueries > 0 ? (usage.monthlyQueries / limits.freeMonthlyQueries) * 100 : 0;

      const budgetUsagePercent =
        limits.premiumMonthlyBudget > 0 ? (usage.monthlyCost / limits.premiumMonthlyBudget) * 100 : 0;

      const nearQueryLimit = queryUsagePercent >= 80;
      const nearBudgetLimit = budgetUsagePercent >= 80;

      let warningMessage: string | undefined;

      if (nearQueryLimit && nearBudgetLimit) {
        warningMessage = "You're approaching both your query and budget limits for this month.";
      } else if (nearQueryLimit) {
        warningMessage = `You've used ${usage.monthlyQueries} of ${limits.freeMonthlyQueries} AI conversations this month.`;
      } else if (nearBudgetLimit) {
        warningMessage = `You've used $${usage.monthlyCost.toFixed(2)} of your $${limits.premiumMonthlyBudget.toFixed(
          2
        )} monthly AI budget.`;
      }

      return {
        nearQueryLimit,
        nearBudgetLimit,
        warningMessage,
      };
    } catch (error) {
      logger.error("Error checking usage limits:", error);
      return {
        nearQueryLimit: false,
        nearBudgetLimit: false,
      };
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get the singleton cost manager instance
 */
export const aiCostManager = AICostManager.getInstance();

/**
 * Quick function to check if user can make a query
 */
export async function canUserMakeAIQuery(userId: string, estimatedCost: number = 0.01): Promise<boolean> {
  return aiCostManager.canMakeQuery(userId, estimatedCost);
}

/**
 * Quick function to track AI usage
 */
export async function trackAIUsage(record: Omit<AIUsageRecord, "id" | "createdAt">): Promise<void> {
  return aiCostManager.trackUsage(record);
}

/**
 * Quick function to get user usage
 */
export async function getUserAIUsage(userId: string): Promise<AIUsageMetrics> {
  return aiCostManager.getUserUsage(userId);
}

/**
 * Quick function to estimate query cost
 */
export async function estimateAIQueryCost(
  query: string,
  context: string = "",
  model?: string
): Promise<AICostEstimate> {
  return aiCostManager.estimateQueryCost(query, context, model);
}
