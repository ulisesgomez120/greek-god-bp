// ============================================================================
// AI SERVICE TYPE DEFINITIONS
// ============================================================================
// TypeScript interfaces for AI coaching, usage tracking, and cost management

// ============================================================================
// AI MODEL AND CONFIGURATION TYPES
// ============================================================================

export interface AIModel {
  id: string;
  modelName: string;
  modelVersion: string;
  provider: "openai" | "anthropic" | "google" | "custom";
  modelType: "chat" | "completion" | "embedding" | "fine_tuned";
  maxTokens: number;
  contextWindow: number;
  costPer1kInputTokens: number;
  costPer1kOutputTokens: number;
  isActive: boolean;
  isDefault: boolean;
}

export interface AICoachingContext {
  id: string;
  contextKey: string;
  contextName: string;
  description: string;
  systemPrompt: string;
  suggestedModelId?: string;
  maxConversationLength: number;
  coachingStyle: "supportive" | "challenging" | "analytical" | "motivational";
  expertiseAreas: string[];
  requiresSubscription: boolean;
  isActive: boolean;
}

// ============================================================================
// AI USAGE AND COST TRACKING TYPES
// ============================================================================

export interface AIUsageMetrics {
  userId: string;
  monthlyQueries: number;
  monthlyTokensUsed: number;
  monthlyCost: number;
  remainingQueries: number;
  remainingBudget: number;
  lastResetDate: string;
  currentMonth: string;
}

export interface AIUsageRecord {
  id: string;
  userId: string;
  queryType: string;
  queryText?: string;
  responseText?: string;
  tokensUsed: number;
  estimatedCost: number;
  modelUsed: string;
  responseTimeMs?: number;
  userRating?: number;
  userFeedback?: string;
  createdAt: string;
}

export interface AICostEstimate {
  estimatedTokens: number;
  estimatedCost: number;
  modelRecommendation: string;
  canAfford: boolean;
  remainingBudget: number;
}

// ============================================================================
// AI CONVERSATION AND MESSAGING TYPES
// ============================================================================

export interface AIConversationSession {
  id: string;
  userId: string;
  contextId?: string;
  sessionTitle?: string;
  sessionType: "coaching" | "planning" | "analysis" | "support" | "general";
  status: "active" | "paused" | "completed" | "archived";
  messageCount: number;
  totalTokensUsed: number;
  totalCost: number;
  userContext: Record<string, any>;
  conversationSummary?: string;
  keyInsights: string[];
  actionItems: string[];
  startedAt: string;
  lastMessageAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIMessage {
  id: string;
  sessionId?: string;
  conversationId: string;
  messageRole: "system" | "user" | "assistant" | "function";
  messageType: "user_query" | "ai_response" | "system_message" | "function_call" | "function_response";
  content: string;
  contextData?: Record<string, any>;
  tokensUsed?: number;
  modelId?: string;
  functionCall?: Record<string, any>;
  functionResponse?: Record<string, any>;
  messageMetadata: Record<string, any>;
  processingTimeMs?: number;
  confidenceScore?: number;
  sentimentScore?: number;
  createdAt: string;
}

// ============================================================================
// AI RECOMMENDATIONS AND INSIGHTS TYPES
// ============================================================================

export interface AIWorkoutRecommendation {
  id: string;
  userId: string;
  sessionId?: string;
  recommendationType:
    | "next_workout"
    | "exercise_substitution"
    | "progression_adjustment"
    | "recovery_suggestion"
    | "program_modification"
    | "goal_alignment";
  priority: "low" | "medium" | "high" | "urgent";
  title: string;
  description: string;
  reasoning?: string;
  recommendedExercises?: Record<string, any>;
  recommendedParameters?: Record<string, any>;
  alternativeOptions?: Record<string, any>;
  basedOnData?: Record<string, any>;
  validUntil?: string;
  userFeedback?: "accepted" | "rejected" | "modified" | "pending";
  userNotes?: string;
  appliedAt?: string;
  modelId?: string;
  confidenceScore?: number;
  tokensUsed?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AIInsight {
  id: string;
  userId: string;
  sessionId?: string;
  insightType:
    | "progress_analysis"
    | "pattern_recognition"
    | "goal_assessment"
    | "performance_trend"
    | "recovery_analysis"
    | "form_feedback"
    | "motivation_boost"
    | "plateau_identification";
  category: "strength" | "endurance" | "recovery" | "motivation" | "technique" | "planning";
  title: string;
  summary: string;
  detailedAnalysis?: string;
  keyFindings: string[];
  dataSources: string[];
  timePeriodAnalyzed?: Record<string, any>;
  statisticalSignificance?: number;
  actionableRecommendations: string[];
  suggestedNextSteps: string[];
  userRating?: number;
  userFeedback?: string;
  isBookmarked: boolean;
  modelId?: string;
  confidenceScore?: number;
  tokensUsed?: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// AI PROGRESSION SUGGESTION TYPES
// ============================================================================

export interface AIProgressionSuggestion {
  exerciseId: string;
  exerciseName: string;
  currentWeight?: number;
  currentReps?: number;
  currentRpe?: number;
  suggestion: {
    type: "increase_weight" | "increase_reps" | "maintain" | "deload" | "technique_focus";
    newWeight?: number;
    newReps?: number;
    targetRpe?: number;
    reasoning: string;
    confidence: number;
  };
  alternativeSuggestions?: Array<{
    type: string;
    description: string;
    reasoning: string;
  }>;
  basedOnData: {
    recentSets: number;
    averageRpe: number;
    progressionTrend: "improving" | "plateauing" | "declining";
    lastProgression?: string;
  };
}

export interface AIProgressionAnalysis {
  userId: string;
  analysisDate: string;
  overallProgress: {
    trend: "excellent" | "good" | "moderate" | "concerning";
    summary: string;
    keyMetrics: Record<string, number>;
  };
  exerciseSuggestions: AIProgressionSuggestion[];
  generalRecommendations: string[];
  motivationalMessage: string;
  nextReviewDate: string;
  tokensUsed: number;
  processingTimeMs: number;
}

// ============================================================================
// AI SERVICE REQUEST/RESPONSE TYPES
// ============================================================================

export interface AIQueryRequest {
  query: string;
  context?: {
    recentWorkouts?: boolean;
    progressData?: boolean;
    goals?: boolean;
    exerciseHistory?: boolean;
  };
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface AIQueryResponse {
  response: string;
  tokensUsed: number;
  cost: number;
  remainingBudget: number;
  remainingQueries: number;
  suggestions?: string[];
  confidence?: number;
  processingTimeMs: number;
  model: string;
  conversationId?: string;
  sessionId?: string;
}

export interface AIProgressionRequest {
  userId: string;
  exerciseIds?: string[];
  analysisDepth?: "basic" | "detailed" | "comprehensive";
  includeMotivation?: boolean;
}

export interface AIProgressionResponse {
  analysis: AIProgressionAnalysis;
  tokensUsed: number;
  cost: number;
  processingTimeMs: number;
  error?: string;
}

// ============================================================================
// AI ERROR AND STATUS TYPES
// ============================================================================

export interface AIError {
  code: string;
  message: string;
  details?: string;
  retryable: boolean;
  fallbackAvailable: boolean;
}

export interface AIServiceStatus {
  isAvailable: boolean;
  currentLoad: "low" | "medium" | "high" | "critical";
  estimatedResponseTime: number;
  activeModels: string[];
  maintenanceMode: boolean;
  lastHealthCheck: string;
}

export interface AIUsageLimits {
  freeMonthlyQueries: number;
  premiumMonthlyBudget: number;
  maxTokensPerQuery: number;
  maxContextLength: number;
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
}

// ============================================================================
// AI PREFERENCES AND PERSONALIZATION TYPES
// ============================================================================

export interface UserAIPreferences {
  id: string;
  userId: string;
  preferredCoachingStyle: "supportive" | "challenging" | "analytical" | "motivational";
  communicationFrequency: "minimal" | "moderate" | "frequent" | "intensive";
  preferredResponseLength: "brief" | "moderate" | "detailed" | "comprehensive";
  focusAreas: string[];
  avoidTopics: string[];
  preferredExamples: "personal" | "general" | "scientific" | "motivational";
  enableProactiveSuggestions: boolean;
  enableProgressCelebrations: boolean;
  enableFormReminders: boolean;
  enableRecoverySuggestions: boolean;
  learningStyle: "visual" | "analytical" | "practical" | "social";
  feedbackSensitivity: "direct" | "gentle" | "balanced" | "encouraging";
  allowDataAnalysis: boolean;
  allowPatternRecognition: boolean;
  allowPredictiveInsights: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// AI COMPONENT PROPS TYPES
// ============================================================================

export interface AIInsightProps {
  insight?: AIInsight;
  recommendation?: AIWorkoutRecommendation;
  loading?: boolean;
  error?: string;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onBookmark?: (id: string) => void;
  onFeedback?: (id: string, feedback: string, rating?: number) => void;
  compact?: boolean;
  showActions?: boolean;
}

export interface AIUsageIndicatorProps {
  usage: AIUsageMetrics;
  showDetails?: boolean;
  variant?: "compact" | "detailed";
  onUpgrade?: () => void;
}

export interface AILoadingProps {
  message?: string;
  showTypingIndicator?: boolean;
  estimatedTime?: number;
}

// ============================================================================
// AI HOOK RETURN TYPES
// ============================================================================

export interface UseAIUsageReturn {
  usage: AIUsageMetrics | null;
  loading: boolean;
  error: string | null;
  canMakeQuery: boolean;
  estimateCost: (query: string, model?: string) => Promise<AICostEstimate>;
  trackUsage: (record: Omit<AIUsageRecord, "id" | "createdAt">) => Promise<void>;
  refreshUsage: () => Promise<void>;
  resetMonthlyUsage: () => Promise<void>;
}

export interface UseAIProgressionReturn {
  suggestions: AIProgressionSuggestion[];
  analysis: AIProgressionAnalysis | null;
  loading: boolean;
  error: string | null;
  generateSuggestions: (request: AIProgressionRequest) => Promise<void>;
  acceptSuggestion: (exerciseId: string, suggestionType: string) => Promise<void>;
  rejectSuggestion: (exerciseId: string, reason?: string) => Promise<void>;
  refreshSuggestions: () => Promise<void>;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type AIModelProvider = "openai" | "anthropic" | "google" | "custom";
export type AICoachingStyle = "supportive" | "challenging" | "analytical" | "motivational";
export type AIMessageRole = "system" | "user" | "assistant" | "function";
export type AISessionStatus = "active" | "paused" | "completed" | "archived";
export type AIRecommendationType =
  | "next_workout"
  | "exercise_substitution"
  | "progression_adjustment"
  | "recovery_suggestion"
  | "program_modification"
  | "goal_alignment";
export type AIInsightType =
  | "progress_analysis"
  | "pattern_recognition"
  | "goal_assessment"
  | "performance_trend"
  | "recovery_analysis"
  | "form_feedback"
  | "motivation_boost"
  | "plateau_identification";

// ============================================================================
// EXPORT ALL TYPES
// ============================================================================

// All types are exported individually above with their interface declarations
