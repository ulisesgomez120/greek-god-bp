// ============================================================================
// AI PROGRESSION EDGE FUNCTION
// ============================================================================
// Supabase Edge Function for AI-powered progression suggestions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface AIProgressionRequest {
  userId: string;
  exerciseIds?: string[];
  analysisDepth?: "basic" | "detailed" | "comprehensive";
  includeMotivation?: boolean;
}

interface AIProgressionResponse {
  analysis: {
    userId: string;
    analysisDate: string;
    overallProgress: {
      trend: "excellent" | "good" | "moderate" | "concerning";
      summary: string;
      keyMetrics: Record<string, number>;
    };
    exerciseSuggestions: Array<{
      exerciseId: string;
      exerciseName: string;
      suggestion: {
        type: "increase_weight" | "increase_reps" | "maintain" | "deload" | "technique_focus";
        reasoning: string;
        confidence: number;
      };
    }>;
    generalRecommendations: string[];
    motivationalMessage: string;
    nextReviewDate: string;
    tokensUsed: number;
    processingTimeMs: number;
  };
  tokensUsed: number;
  cost: number;
  processingTimeMs: number;
  error?: string;
}

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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Estimate token count for text
 */
function estimateTokenCount(text: string): number {
  const characters = text.length;
  const baseTokens = Math.ceil(characters / 4);
  const complexityMultiplier = text.includes("{") || text.includes("[") ? 1.2 : 1.0;
  return Math.ceil(baseTokens * complexityMultiplier);
}

/**
 * Calculate cost for tokens and model
 */
function calculateTokenCost(inputTokens: number, outputTokens: number, model: string): number {
  const costs = {
    "gpt-4o-mini": 0.00015,
    "gpt-3.5-turbo": 0.0005,
  };

  const modelCost = costs[model as keyof typeof costs] || costs["gpt-4o-mini"];
  return ((inputTokens + outputTokens) / 1000) * modelCost;
}

/**
 * Select optimal model based on query complexity
 */
function selectOptimalModel(prompt: string, remainingBudget: number): string {
  const estimatedTokens = estimateTokenCount(prompt);
  const isSimpleQuery = estimatedTokens < 200;

  const gpt4Cost = calculateTokenCost(estimatedTokens, 150, "gpt-4o-mini");
  const gpt35Cost = calculateTokenCost(estimatedTokens, 150, "gpt-3.5-turbo");

  if (remainingBudget < 0.01) {
    return "gpt-3.5-turbo";
  }

  if (isSimpleQuery) {
    return gpt35Cost <= remainingBudget ? "gpt-3.5-turbo" : "gpt-4o-mini";
  }

  return gpt4Cost <= remainingBudget ? "gpt-4o-mini" : "gpt-3.5-turbo";
}

// ============================================================================
// AI SERVICE FUNCTIONS
// ============================================================================

/**
 * Make request to OpenAI API
 */
async function makeOpenAIRequest(
  messages: Array<{ role: string; content: string }>,
  model: string = "gpt-4o-mini",
  maxTokens: number = 500
): Promise<OpenAIResponse> {
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiApiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
      response_format: { type: "text" },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * Check if user can make AI queries
 */
async function checkUserUsageLimits(supabase: any, userId: string, estimatedCost: number): Promise<boolean> {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

    // Get usage from current month
    const { data: usageRecords, error } = await supabase
      .from("ai_usage_tracking")
      .select("tokens_used, estimated_cost")
      .eq("user_id", userId)
      .gte("created_at", `${currentMonth}-01`)
      .lt("created_at", getNextMonthStart(currentMonth));

    if (error) {
      console.error("Failed to fetch AI usage:", error);
      return false;
    }

    const monthlyCost = usageRecords?.reduce((sum: number, record: any) => sum + record.estimated_cost, 0) || 0;
    const monthlyQueries = usageRecords?.length || 0;

    // Check user subscription
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status, plan_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    // Free tier limits
    if (!subscription) {
      return monthlyQueries < 2; // 2 free queries per month
    }

    // Premium tier limits
    const remainingBudget = 1.0 - monthlyCost; // $1 monthly budget
    return remainingBudget >= estimatedCost;
  } catch (error) {
    console.error("Error checking usage limits:", error);
    return false;
  }
}

/**
 * Get next month start date
 */
function getNextMonthStart(currentMonth: string): string {
  const [year, month] = currentMonth.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01`;
}

/**
 * Track AI usage
 */
async function trackAIUsage(
  supabase: any,
  userId: string,
  queryType: string,
  tokensUsed: number,
  cost: number,
  model: string,
  responseTimeMs: number
): Promise<void> {
  try {
    const { error } = await supabase.from("ai_usage_tracking").insert({
      user_id: userId,
      query_type: queryType,
      tokens_used: tokensUsed,
      estimated_cost: cost,
      model_used: model,
      response_time_ms: responseTimeMs,
    });

    if (error) {
      console.error("Failed to track AI usage:", error);
    }
  } catch (error) {
    console.error("Error tracking AI usage:", error);
  }
}

/**
 * Build progression context from user data
 */
async function buildProgressionContext(supabase: any, userId: string, exerciseIds?: string[]): Promise<any> {
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
    console.error("Error building progression context:", error);
    return {
      userProfile: { experience_level: "beginner", fitness_goals: [] },
      recentSessions: [],
      exerciseData: null,
      analysisDate: new Date().toISOString(),
    };
  }
}

/**
 * Build progression analysis prompt
 */
function buildProgressionPrompt(context: any, request: AIProgressionRequest): string {
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

Focus on RPE-based progression principles and the user's experience level.
Keep response concise and practical.`;
}

/**
 * Get system prompt for progression analysis
 */
function getProgressionSystemPrompt(): string {
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
 * Parse AI response into structured data
 */
function parseProgressionResponse(response: string, userId: string): any {
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

  // Extract motivational message
  const motivationalKeywords = ["great", "excellent", "keep", "progress", "strong", "improvement"];
  const sentences = response.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const motivationalSentence = sentences.find((sentence) =>
    motivationalKeywords.some((keyword) => sentence.toLowerCase().includes(keyword))
  );

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
    motivationalMessage: motivationalSentence?.trim() || "Keep up the great work with your training!",
    nextReviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    tokensUsed: estimateTokenCount(response),
    processingTimeMs: 0, // Will be set by caller
  };
}

/**
 * Generate fallback progression when AI is unavailable
 */
function generateFallbackProgression(userId: string): any {
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

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startTime = Date.now();

    // Parse request body
    const requestBody: AIProgressionRequest = await req.json();
    const { userId, exerciseIds, analysisDepth = "basic", includeMotivation = false } = requestBody;

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build context and prompt
    const context = await buildProgressionContext(supabase, userId, exerciseIds);
    const prompt = buildProgressionPrompt(context, requestBody);

    // Estimate cost and check limits
    const estimatedCost = calculateTokenCost(estimateTokenCount(prompt), 150, "gpt-4o-mini");
    const canMakeQuery = await checkUserUsageLimits(supabase, userId, estimatedCost);

    if (!canMakeQuery) {
      // Return fallback progression
      const fallbackAnalysis = generateFallbackProgression(userId);
      const processingTime = Date.now() - startTime;

      return new Response(
        JSON.stringify({
          analysis: { ...fallbackAnalysis, processingTimeMs: processingTime },
          tokensUsed: 0,
          cost: 0,
          processingTimeMs: processingTime,
          error: "Monthly AI usage limit exceeded",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Select model and make OpenAI request
    const selectedModel = selectOptimalModel(prompt, 1.0);
    const messages = [
      {
        role: "system",
        content: getProgressionSystemPrompt(),
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    const openaiResponse = await makeOpenAIRequest(messages, selectedModel, 800);
    const processingTime = Date.now() - startTime;

    // Parse response
    const analysis = parseProgressionResponse(openaiResponse.choices[0].message.content, userId);
    analysis.processingTimeMs = processingTime;

    // Calculate actual cost
    const actualCost = calculateTokenCost(
      openaiResponse.usage.prompt_tokens,
      openaiResponse.usage.completion_tokens,
      selectedModel
    );

    // Track usage
    await trackAIUsage(
      supabase,
      userId,
      "progression_analysis",
      openaiResponse.usage.total_tokens,
      actualCost,
      selectedModel,
      processingTime
    );

    // Return response
    const response: AIProgressionResponse = {
      analysis,
      tokensUsed: openaiResponse.usage.total_tokens,
      cost: actualCost,
      processingTimeMs: processingTime,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AI progression function error:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
