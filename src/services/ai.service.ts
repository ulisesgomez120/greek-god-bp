// ============================================================================
// AI SERVICE
// ============================================================================
// OpenAI integration with cost optimization and progression suggestions

import { ENV_CONFIG, AI_CONSTANTS, ERROR_MESSAGES } from "@/config/constants";
import { supabase } from "@/lib/supabase";
import { logger } from "@/utils/logger";
import { aiCostManager, estimateTokenCount, selectOptimalModel, calculateTokenCost } from "@/utils/aiCostManager";
import type {
  AIQueryRequest,
  AIQueryResponse,
  AIProgressionRequest,
  AIProgressionResponse,
  AIProgressionSuggestion,
  AIProgressionAnalysis,
  AIError,
  AIServiceStatus,
  AIConversationSession,
} from "@/types/ai";
import type { ExerciseSet, WorkoutSession, ProgressionRecommendation } from "@/types";

// ============================================================================
// OPENAI CLIENT SETUP
// ============================================================================

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ============================================================================
// AI SERVICE CLASS
// ============================================================================

export class AIService {
  private static instance: AIService;
  private readonly baseUrl = "https://api.openai.com/v1";
  private readonly apiKey: string;

  constructor() {
    this.apiKey = ENV_CONFIG.openaiApiKey || "";
    if (!this.apiKey) {
      logger.warn("OpenAI API key not configured - AI features will be disabled");
    }
  }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * Check if AI service is available
   */
  async getServiceStatus(): Promise<AIServiceStatus> {
    try {
      if (!this.apiKey) {
        return {
          isAvailable: false,
          currentLoad: "critical",
          estimatedResponseTime: 0,
          activeModels: [],
          maintenanceMode: true,
          lastHealthCheck: new Date().toISOString(),
        };
      }

      // Simple health check with minimal token usage
      const startTime = Date.now();
      const response = await this.makeOpenAIRequest([{ role: "user", content: "Hello" }], "gpt-3.5-turbo", 5);

      const responseTime = Date.now() - startTime;

      return {
        isAvailable: true,
        currentLoad: responseTime < 2000 ? "low" : responseTime < 5000 ? "medium" : "high",
        estimatedResponseTime: responseTime,
        activeModels: ["gpt-4o-mini", "gpt-3.5-turbo"],
        maintenanceMode: false,
        lastHealthCheck: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("AI service health check failed:", error);
      return {
        isAvailable: false,
        currentLoad: "critical",
        estimatedResponseTime: 0,
        activeModels: [],
        maintenanceMode: false,
        lastHealthCheck: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate AI progression suggestions for user workouts
   */
  async generateProgressionSuggestions(request: AIProgressionRequest): Promise<AIProgressionResponse> {
    const startTime = Date.now();

    try {
      // Check if user can make AI queries
      const canQuery = await aiCostManager.canMakeQuery(request.userId, 0.05);
      if (!canQuery) {
        throw this.createAIError("USAGE_LIMIT_EXCEEDED", ERROR_MESSAGES.ai.limitReached);
      }

      // Get user context and recent workout data
      const context = await this.buildProgressionContext(request.userId, request.exerciseIds);

      // Build progression analysis prompt
      const prompt = this.buildProgressionPrompt(context, request);

      // Estimate cost and select model
      const estimate = await aiCostManager.estimateQueryCost(prompt);
      const selectedModel = estimate.modelRecommendation;

      // Make OpenAI request
      const messages: OpenAIMessage[] = [
        {
          role: "system",
          content: this.getProgressionSystemPrompt(),
        },
        {
          role: "user",
          content: prompt,
        },
      ];

      const response = await this.makeOpenAIRequest(messages, selectedModel, 800);
      const processingTime = Date.now() - startTime;

      // Parse response into structured data
      const analysis = this.parseProgressionResponse(response.choices[0].message.content, request.userId);

      // Track usage
      await aiCostManager.trackUsage({
        userId: request.userId,
        queryType: "progression_analysis",
        queryText: prompt,
        responseText: response.choices[0].message.content,
        tokensUsed: response.usage.total_tokens,
        estimatedCost: calculateTokenCost(
          response.usage.prompt_tokens,
          response.usage.completion_tokens,
          selectedModel
        ),
        modelUsed: selectedModel,
        responseTimeMs: processingTime,
      });

      return {
        analysis,
        tokensUsed: response.usage.total_tokens,
        cost: calculateTokenCost(response.usage.prompt_tokens, response.usage.completion_tokens, selectedModel),
        processingTimeMs: processingTime,
      };
    } catch (error) {
      logger.error("Error generating progression suggestions:", error);

      if (error instanceof Error && error.message.includes("USAGE_LIMIT_EXCEEDED")) {
        return {
          analysis: this.generateFallbackProgression(request.userId),
          tokensUsed: 0,
          cost: 0,
          processingTimeMs: Date.now() - startTime,
          error: error.message,
        };
      }

      throw error;
    }
  }

  /**
   * Process general AI coaching query
   */
  async processQuery(request: AIQueryRequest, userId: string): Promise<AIQueryResponse> {
    const startTime = Date.now();

    try {
      // Check usage limits
      const canQuery = await aiCostManager.canMakeQuery(userId, 0.02);
      if (!canQuery) {
        throw this.createAIError("USAGE_LIMIT_EXCEEDED", ERROR_MESSAGES.ai.limitReached);
      }

      // Build context if requested
      let context = "";
      if (request.context) {
        context = await this.buildQueryContext(userId, request.context);
      }

      // Estimate cost and select model
      const fullPrompt = request.query + context;
      const estimate = await aiCostManager.estimateQueryCost(fullPrompt);
      const selectedModel = request.model || estimate.modelRecommendation;

      // Build messages
      const messages: OpenAIMessage[] = [
        {
          role: "system",
          content: this.getCoachingSystemPrompt(),
        },
        {
          role: "user",
          content: fullPrompt,
        },
      ];

      // Make OpenAI request
      const response = await this.makeOpenAIRequest(
        messages,
        selectedModel,
        request.maxTokens || AI_CONSTANTS.usage.maxTokensPerQuery,
        request.temperature || 0.7
      );

      const processingTime = Date.now() - startTime;

      // Get updated usage metrics
      const usage = await aiCostManager.getUserUsage(userId);

      // Track usage
      await aiCostManager.trackUsage({
        userId,
        queryType: "general_coaching",
        queryText: request.query,
        responseText: response.choices[0].message.content,
        tokensUsed: response.usage.total_tokens,
        estimatedCost: calculateTokenCost(
          response.usage.prompt_tokens,
          response.usage.completion_tokens,
          selectedModel
        ),
        modelUsed: selectedModel,
        responseTimeMs: processingTime,
      });

      return {
        response: response.choices[0].message.content,
        tokensUsed: response.usage.total_tokens,
        cost: calculateTokenCost(response.usage.prompt_tokens, response.usage.completion_tokens, selectedModel),
        remainingBudget: usage.remainingBudget,
        remainingQueries: usage.remainingQueries,
        processingTimeMs: processingTime,
        model: selectedModel,
      };
    } catch (error) {
      logger.error("Error processing AI query:", error);

      if (error instanceof Error && error.message.includes("USAGE_LIMIT_EXCEEDED")) {
        const usage = await aiCostManager.getUserUsage(userId);
        return {
          response: this.generateFallbackResponse("usage_limit"),
          tokensUsed: 0,
          cost: 0,
          remainingBudget: usage.remainingBudget,
          remainingQueries: usage.remainingQueries,
          processingTimeMs: Date.now() - startTime,
          model: "fallback",
        };
      }

      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Make request to OpenAI API
   */
  private async makeOpenAIRequest(
    messages: OpenAIMessage[],
    model: string = "gpt-4o-mini",
    maxTokens: number = 500,
    temperature: number = 0.7
  ): Promise<OpenAIResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
          response_format: { type: "text" },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error("OpenAI API request failed:", error);
      throw error;
    }
  }

  /**
   * Build context for progression analysis
   */
  private async buildProgressionContext(userId: string, exerciseIds?: string[]): Promise<any> {
    try {
      // Get user profile
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("experience_level, fitness_goals")
        .eq("id", userId)
        .single();

      // Get recent workout sessions
      const { data: recentSessions } = await supabase
        .from("workout_sessions")
        .select(
          `
          id, name, started_at, duration_minutes, average_rpe,
          exercise_sets (
            exercise_id, set_number, weight_kg, reps, rpe, is_warmup,
            exercises (name, muscle_groups)
          )
        `
        )
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .order("started_at", { ascending: false })
        .limit(5);

      // Get exercise-specific data if requested
      let exerciseData = null;
      if (exerciseIds && exerciseIds.length > 0) {
        const { data: exercises } = await supabase
          .from("exercises")
          .select("id, name, muscle_groups, is_compound")
          .in("id", exerciseIds);

        exerciseData = exercises;
      }

      return {
        userProfile: profile,
        recentSessions: recentSessions || [],
        exerciseData,
        analysisDate: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Error building progression context:", error);
      return {
        userProfile: { experience_level: "beginner", fitness_goals: [] },
        recentSessions: [],
        exerciseData: null,
        analysisDate: new Date().toISOString(),
      };
    }
  }

  /**
   * Build context for general queries
   */
  private async buildQueryContext(userId: string, contextOptions: any): Promise<string> {
    const contextParts: string[] = [];

    try {
      if (contextOptions.recentWorkouts) {
        const { data: workouts } = await supabase
          .from("workout_sessions")
          .select("name, started_at, duration_minutes, average_rpe")
          .eq("user_id", userId)
          .not("completed_at", "is", null)
          .order("started_at", { ascending: false })
          .limit(3);

        if (workouts && workouts.length > 0) {
          contextParts.push(`Recent workouts: ${JSON.stringify(workouts)}`);
        }
      }

      if (contextOptions.progressData) {
        // Add basic progress metrics
        const { data: progressData } = await supabase
          .from("workout_sessions")
          .select("total_volume_kg, average_rpe")
          .eq("user_id", userId)
          .not("completed_at", "is", null)
          .gte("started_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order("started_at", { ascending: false });

        if (progressData && progressData.length > 0) {
          const avgVolume = progressData.reduce((sum, w) => sum + (w.total_volume_kg || 0), 0) / progressData.length;
          const avgRPE = progressData.reduce((sum, w) => sum + (w.average_rpe || 0), 0) / progressData.length;
          contextParts.push(`30-day averages: Volume ${avgVolume.toFixed(1)}kg, RPE ${avgRPE.toFixed(1)}`);
        }
      }

      if (contextOptions.goals) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("fitness_goals, experience_level")
          .eq("id", userId)
          .single();

        if (profile) {
          contextParts.push(
            `Goals: ${profile.fitness_goals?.join(", ") || "General fitness"}, Experience: ${profile.experience_level}`
          );
        }
      }
    } catch (error) {
      logger.error("Error building query context:", error);
    }

    return contextParts.length > 0 ? `\n\nContext: ${contextParts.join(". ")}` : "";
  }

  /**
   * Build progression analysis prompt
   */
  private buildProgressionPrompt(context: any, request: AIProgressionRequest): string {
    const { userProfile, recentSessions } = context;

    return `Analyze this user's workout progression and provide specific recommendations:

User Profile:
- Experience Level: ${userProfile?.experience_level || "beginner"}
- Goals: ${userProfile?.fitness_goals?.join(", ") || "General fitness"}

Recent Workout Data:
${JSON.stringify(recentSessions, null, 2)}

Analysis Depth: ${request.analysisDepth || "basic"}
Include Motivation: ${request.includeMotivation || false}

Please provide:
1. Overall progress assessment (excellent/good/moderate/concerning)
2. Specific exercise progression recommendations
3. General training recommendations
4. ${request.includeMotivation ? "Motivational message" : ""}

Focus on RPE-based progression principles and the user's experience level.`;
  }

  /**
   * Get system prompt for progression analysis
   */
  private getProgressionSystemPrompt(): string {
    return `You are an expert strength and conditioning coach specializing in RPE-based training progression. 

Your expertise includes:
- Progressive overload principles
- RPE (Rate of Perceived Exertion) methodology
- Experience-level appropriate programming
- Form and technique optimization
- Recovery and adaptation

Guidelines:
- Base recommendations on RPE trends and user experience level
- Suggest weight increases only when RPE drops significantly (1+ points)
- Consider volume, intensity, and frequency together
- Provide specific, actionable advice
- Be encouraging but realistic
- Always prioritize safety and proper form

Keep responses concise and practical.`;
  }

  /**
   * Get system prompt for general coaching
   */
  private getCoachingSystemPrompt(): string {
    return `You are a knowledgeable and supportive fitness coach with expertise in strength training, progressive overload, and RPE-based training.

Your coaching style:
- Supportive and encouraging
- Evidence-based recommendations
- Practical and actionable advice
- Considers user's experience level and goals
- Emphasizes safety and proper form

Guidelines:
- Keep responses concise and helpful
- Ask clarifying questions when needed
- Provide specific recommendations when possible
- Be motivational but realistic
- Always prioritize user safety

You have access to the user's recent workout data and progress metrics to provide personalized advice.`;
  }

  /**
   * Parse AI response into structured progression analysis
   */
  private parseProgressionResponse(response: string, userId: string): AIProgressionAnalysis {
    // Simple parsing - in production, you might use more sophisticated NLP
    const lines = response.split("\n").filter((line) => line.trim());

    // Extract trend from response
    let trend: "excellent" | "good" | "moderate" | "concerning" = "moderate";
    const trendLine = lines.find(
      (line) =>
        line.toLowerCase().includes("excellent") ||
        line.toLowerCase().includes("good") ||
        line.toLowerCase().includes("moderate") ||
        line.toLowerCase().includes("concerning")
    );

    if (trendLine) {
      if (trendLine.toLowerCase().includes("excellent")) trend = "excellent";
      else if (trendLine.toLowerCase().includes("good")) trend = "good";
      else if (trendLine.toLowerCase().includes("concerning")) trend = "concerning";
    }

    // Extract recommendations
    const recommendations = lines
      .filter((line) => line.includes("•") || line.includes("-") || line.includes("1.") || line.includes("2."))
      .map((line) => line.replace(/^[•\-\d\.]\s*/, "").trim())
      .filter((line) => line.length > 0);

    return {
      userId,
      analysisDate: new Date().toISOString(),
      overallProgress: {
        trend,
        summary: response.substring(0, 200) + "...",
        keyMetrics: {},
      },
      exerciseSuggestions: [], // Would be populated with more sophisticated parsing
      generalRecommendations: recommendations.slice(0, 5),
      motivationalMessage: this.extractMotivationalMessage(response),
      nextReviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      tokensUsed: estimateTokenCount(response),
      processingTimeMs: 0, // Will be set by caller
    };
  }

  /**
   * Extract motivational message from response
   */
  private extractMotivationalMessage(response: string): string {
    const motivationalKeywords = ["great", "excellent", "keep", "progress", "strong", "improvement"];
    const sentences = response.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    const motivationalSentence = sentences.find((sentence) =>
      motivationalKeywords.some((keyword) => sentence.toLowerCase().includes(keyword))
    );

    return motivationalSentence?.trim() || "Keep up the great work with your training!";
  }

  /**
   * Generate fallback progression when AI is unavailable
   */
  private generateFallbackProgression(userId: string): AIProgressionAnalysis {
    return {
      userId,
      analysisDate: new Date().toISOString(),
      overallProgress: {
        trend: "moderate",
        summary:
          "AI analysis temporarily unavailable. Continue with your current program and focus on consistent training.",
        keyMetrics: {},
      },
      exerciseSuggestions: [],
      generalRecommendations: [
        "Continue with your current workout routine",
        "Focus on proper form and technique",
        "Ensure adequate rest between sessions",
        "Track your RPE ratings consistently",
        "Consider progression when RPE drops below 7",
      ],
      motivationalMessage: "Stay consistent with your training - progress comes with time and dedication!",
      nextReviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      tokensUsed: 0,
      processingTimeMs: 0,
    };
  }

  /**
   * Generate fallback responses for different scenarios
   */
  private generateFallbackResponse(type: string): string {
    const fallbacks: Record<string, string> = {
      usage_limit:
        "You've reached your monthly AI coaching limit. Your workout data shows consistent progress - keep up the great work! Consider upgrading to Premium for unlimited AI coaching.",
      api_error:
        "AI coaching is temporarily unavailable. Based on your recent workouts, continue with your current routine and focus on proper form. The AI coach will be back soon!",
      network_error:
        "Unable to connect to AI coaching services. Your workout tracking continues to work offline, and all data will sync when connection is restored.",
    };

    return fallbacks[type] || "AI coaching is temporarily unavailable. Please try again later.";
  }

  /**
   * Create standardized AI error
   */
  private createAIError(code: string, message: string, retryable: boolean = true): AIError {
    return {
      code,
      message,
      retryable,
      fallbackAvailable: true,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE AND CONVENIENCE FUNCTIONS
// ============================================================================

export const aiService = AIService.getInstance();

/**
 * Generate progression suggestions for user
 */
export async function generateProgressionSuggestions(request: AIProgressionRequest): Promise<AIProgressionResponse> {
  return aiService.generateProgressionSuggestions(request);
}

/**
 * Process general AI coaching query
 */
export async function processAIQuery(request: AIQueryRequest, userId: string): Promise<AIQueryResponse> {
  return aiService.processQuery(request, userId);
}

/**
 * Check AI service status
 */
export async function getAIServiceStatus(): Promise<AIServiceStatus> {
  return aiService.getServiceStatus();
}

/**
 * Quick function to get basic progression advice
 */
export async function getBasicProgressionAdvice(userId: string, exerciseIds?: string[]): Promise<string> {
  try {
    const response = await aiService.generateProgressionSuggestions({
      userId,
      exerciseIds,
      analysisDepth: "basic",
      includeMotivation: true,
    });

    return response.analysis.generalRecommendations.join(". ") + " " + response.analysis.motivationalMessage;
  } catch (error) {
    logger.error("Error getting basic progression advice:", error);
    return "Continue with your current routine and focus on consistent training. Progress comes with time and dedication!";
  }
}
