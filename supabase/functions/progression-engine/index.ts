// ============================================================================
// PROGRESSION ENGINE EDGE FUNCTION
// ============================================================================
// Calculates RPE-based progression recommendations based on user experience level

/// <reference path="../deno.d.ts" />

import { handleCors, createErrorResponse, createSuccessResponse } from "../_shared/cors";
import { getAuthenticatedUser, createSupabaseClient } from "../_shared/supabase";

interface ProgressionRequest {
  exercise_id: string;
  recent_sets?: ExerciseSetData[];
  weeks_to_analyze?: number;
}

interface ExerciseSetData {
  weight_kg: number;
  reps: number;
  rpe: number;
  created_at: string;
  is_warmup: boolean;
}

interface ProgressionRecommendation {
  should_progress: boolean;
  recommended_action: "increase_weight" | "increase_reps" | "maintain" | "deload";
  recommended_weight?: number;
  recommended_reps?: number;
  reason: string;
  confidence: number; // 0-1 scale
  alternative_suggestions?: string[];
}

interface UserProgressionContext {
  experience_level: string;
  current_weight?: number;
  current_reps?: number;
  average_rpe: number;
  rpe_trend: "increasing" | "decreasing" | "stable";
  consistency_score: number;
  weeks_at_current_weight: number;
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return createErrorResponse("Method not allowed", 405);
    }

    // Authenticate user
    const { user } = await getAuthenticatedUser(req);
    const supabase = createSupabaseClient();

    // Parse request body
    const { exercise_id, recent_sets, weeks_to_analyze = 4 }: ProgressionRequest = await req.json();

    if (!exercise_id) {
      return createErrorResponse("exercise_id is required");
    }

    // Get user profile for experience level
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("experience_level")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      return createErrorResponse("Failed to get user profile");
    }

    // Get recent exercise data if not provided
    let exerciseData = recent_sets;
    if (!exerciseData) {
      const { data: recentSets, error: setsError } = await supabase
        .from("exercise_sets")
        .select(
          `
          weight_kg,
          reps,
          rpe,
          created_at,
          is_warmup,
          workout_sessions!inner(user_id, completed_at)
        `
        )
        .eq("exercise_id", exercise_id)
        .eq("workout_sessions.user_id", user.id)
        .not("workout_sessions.completed_at", "is", null)
        .gte("created_at", new Date(Date.now() - weeks_to_analyze * 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      if (setsError) {
        return createErrorResponse("Failed to fetch exercise data");
      }

      exerciseData = recentSets || [];
    }

    // Calculate progression recommendation
    const recommendation = calculateProgression(userProfile.experience_level, exerciseData || [], exercise_id);

    return createSuccessResponse({
      exercise_id,
      recommendation,
      data_points_analyzed: exerciseData?.length || 0,
      analysis_period_weeks: weeks_to_analyze,
    });
  } catch (error) {
    console.error("Progression engine error:", error);
    return createErrorResponse("Internal server error", 500);
  }
});

function calculateProgression(
  experienceLevel: string,
  sets: ExerciseSetData[],
  exerciseId: string
): ProgressionRecommendation {
  // Filter out warmup sets
  const workingSets = sets.filter((set) => !set.is_warmup && set.rpe && set.rpe > 0);

  if (workingSets.length === 0) {
    return {
      should_progress: false,
      recommended_action: "maintain",
      reason: "Insufficient data to make recommendation. Complete more workouts with RPE ratings.",
      confidence: 0,
    };
  }

  // Build user context
  const context = buildProgressionContext(workingSets);

  // Apply experience-based progression logic
  switch (experienceLevel) {
    case "untrained":
      return calculateUntrainedProgression(context, workingSets);
    case "beginner":
      return calculateBeginnerProgression(context, workingSets);
    case "early_intermediate":
      return calculateRPEBasedProgression(context, workingSets);
    case "intermediate":
    case "advanced":
      return calculateAdvancedProgression(context, workingSets);
    default:
      return calculateRPEBasedProgression(context, workingSets);
  }
}

function buildProgressionContext(sets: ExerciseSetData[]): UserProgressionContext {
  // Sort by date (newest first)
  const sortedSets = [...sets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Calculate average RPE
  const rpeValues = sortedSets.map((set) => set.rpe);
  const averageRpe = rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length;

  // Calculate RPE trend (last 3 vs previous 3)
  const recentRpe = rpeValues.slice(0, 3);
  const previousRpe = rpeValues.slice(3, 6);
  let rpeTrend: "increasing" | "decreasing" | "stable" = "stable";

  if (recentRpe.length >= 2 && previousRpe.length >= 2) {
    const recentAvg = recentRpe.reduce((sum, rpe) => sum + rpe, 0) / recentRpe.length;
    const previousAvg = previousRpe.reduce((sum, rpe) => sum + rpe, 0) / previousRpe.length;
    const difference = recentAvg - previousAvg;

    if (difference > 0.5) rpeTrend = "increasing";
    else if (difference < -0.5) rpeTrend = "decreasing";
  }

  // Find current working weight and reps
  const currentWeight = sortedSets[0]?.weight_kg;
  const currentReps = sortedSets[0]?.reps;

  // Calculate weeks at current weight
  const weeksAtCurrentWeight = calculateWeeksAtWeight(sortedSets, currentWeight);

  // Calculate consistency score (how often user hits target rep ranges)
  const consistencyScore = calculateConsistencyScore(sortedSets);

  return {
    experience_level: "", // Will be set by caller
    current_weight: currentWeight,
    current_reps: currentReps,
    average_rpe: Math.round(averageRpe * 10) / 10,
    rpe_trend: rpeTrend,
    consistency_score: consistencyScore,
    weeks_at_current_weight: weeksAtCurrentWeight,
  };
}

function calculateUntrainedProgression(
  context: UserProgressionContext,
  sets: ExerciseSetData[]
): ProgressionRecommendation {
  // For untrained individuals: Focus on technique, not weight progression
  if (context.weeks_at_current_weight < 3) {
    return {
      should_progress: false,
      recommended_action: "maintain",
      reason: "Focus on perfecting form and technique. Maintain current weight for at least 3 weeks.",
      confidence: 0.9,
      alternative_suggestions: [
        "Practice the movement pattern",
        "Focus on full range of motion",
        "Ensure proper breathing technique",
      ],
    };
  }

  // After 3 weeks, small progression if form is consistent
  if (context.consistency_score > 0.8 && context.average_rpe < 7) {
    const recommendedWeight = (context.current_weight || 0) + getWeightIncrement("beginner");
    return {
      should_progress: true,
      recommended_action: "increase_weight",
      recommended_weight: recommendedWeight,
      reason: "Good form consistency achieved. Ready for small weight increase.",
      confidence: 0.8,
    };
  }

  return {
    should_progress: false,
    recommended_action: "maintain",
    reason: "Continue practicing current weight until form is more consistent.",
    confidence: 0.7,
  };
}

function calculateBeginnerProgression(
  context: UserProgressionContext,
  sets: ExerciseSetData[]
): ProgressionRecommendation {
  // Linear progression for beginners
  const targetRpe = 7.5;
  const progressionThreshold = 1.0; // RPE must drop by 1 point

  if (context.average_rpe <= targetRpe - progressionThreshold) {
    const recommendedWeight = (context.current_weight || 0) + getWeightIncrement("beginner");
    return {
      should_progress: true,
      recommended_action: "increase_weight",
      recommended_weight: recommendedWeight,
      reason: `Average RPE (${context.average_rpe}) has dropped below target. Ready for weight increase.`,
      confidence: 0.85,
    };
  }

  if (context.average_rpe > 8.5) {
    return {
      should_progress: false,
      recommended_action: "maintain",
      reason: `Current RPE (${context.average_rpe}) is too high. Focus on recovery and consistency.`,
      confidence: 0.8,
      alternative_suggestions: ["Ensure adequate rest between sessions", "Check nutrition and sleep"],
    };
  }

  return {
    should_progress: false,
    recommended_action: "maintain",
    reason: `Current RPE (${context.average_rpe}) is appropriate. Continue building strength at this weight.`,
    confidence: 0.75,
  };
}

function calculateRPEBasedProgression(
  context: UserProgressionContext,
  sets: ExerciseSetData[]
): ProgressionRecommendation {
  // RPE-based progression for early intermediate
  const targetRpe = 8.0;
  const progressionThreshold = 1.0;

  // Check for deload conditions
  if (context.rpe_trend === "increasing" && context.average_rpe > 8.5) {
    const deloadWeight = Math.round((context.current_weight || 0) * 0.9 * 100) / 100;
    return {
      should_progress: true,
      recommended_action: "deload",
      recommended_weight: deloadWeight,
      reason: "RPE trending upward and too high. Deload recommended to manage fatigue.",
      confidence: 0.8,
    };
  }

  // Check for progression
  if (context.average_rpe <= targetRpe - progressionThreshold && context.consistency_score > 0.7) {
    const recommendedWeight = (context.current_weight || 0) + getWeightIncrement("intermediate");
    return {
      should_progress: true,
      recommended_action: "increase_weight",
      recommended_weight: recommendedWeight,
      reason: `RPE has dropped to ${context.average_rpe}. Ready for weight progression.`,
      confidence: 0.85,
    };
  }

  // Check if stuck at same weight too long
  if (context.weeks_at_current_weight > 4 && context.average_rpe < 7.5) {
    const recommendedWeight = (context.current_weight || 0) + getWeightIncrement("intermediate");
    return {
      should_progress: true,
      recommended_action: "increase_weight",
      recommended_weight: recommendedWeight,
      reason: "Been at current weight for over 4 weeks with low RPE. Time to progress.",
      confidence: 0.7,
    };
  }

  return {
    should_progress: false,
    recommended_action: "maintain",
    reason: `Current training load is appropriate. RPE: ${context.average_rpe}, continue building strength.`,
    confidence: 0.75,
  };
}

function calculateAdvancedProgression(
  context: UserProgressionContext,
  sets: ExerciseSetData[]
): ProgressionRecommendation {
  // More conservative progression for advanced trainees
  const targetRpe = 8.5;
  const progressionThreshold = 0.5; // Smaller threshold for advanced

  if (context.average_rpe <= targetRpe - progressionThreshold && context.rpe_trend === "decreasing") {
    const recommendedWeight = (context.current_weight || 0) + getWeightIncrement("advanced");
    return {
      should_progress: true,
      recommended_action: "increase_weight",
      recommended_weight: recommendedWeight,
      reason: "RPE trending down and below target. Conservative progression recommended.",
      confidence: 0.7,
    };
  }

  // Suggest rep progression instead of weight for advanced trainees
  if (context.average_rpe < 8.0 && (context.current_reps || 0) < 12) {
    return {
      should_progress: true,
      recommended_action: "increase_reps",
      recommended_reps: (context.current_reps || 0) + 1,
      reason: "Consider adding reps before increasing weight for advanced progression.",
      confidence: 0.75,
    };
  }

  return {
    should_progress: false,
    recommended_action: "maintain",
    reason: "Advanced progression requires patience. Current load is appropriate.",
    confidence: 0.8,
  };
}

function getWeightIncrement(level: string): number {
  const increments: Record<string, number> = {
    beginner: 2.5, // 2.5kg / 5lbs
    intermediate: 1.25, // 1.25kg / 2.5lbs
    advanced: 0.625, // 0.625kg / 1.25lbs
  };
  return increments[level] || increments.intermediate;
}

function calculateWeeksAtWeight(sets: ExerciseSetData[], currentWeight?: number): number {
  if (!currentWeight) return 0;

  const tolerance = 0.1; // Allow small variations
  let weeks = 0;
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

  for (const set of sets) {
    if (Math.abs((set.weight_kg || 0) - currentWeight) <= tolerance) {
      const weeksAgo = (Date.now() - new Date(set.created_at).getTime()) / oneWeekMs;
      weeks = Math.max(weeks, Math.ceil(weeksAgo));
    } else {
      break; // Stop when we hit a different weight
    }
  }

  return weeks;
}

function calculateConsistencyScore(sets: ExerciseSetData[]): number {
  if (sets.length === 0) return 0;

  // Calculate how consistent rep ranges are
  const repCounts = sets.map((set) => set.reps);
  const avgReps = repCounts.reduce((sum, reps) => sum + reps, 0) / repCounts.length;
  const repVariance = repCounts.reduce((sum, reps) => sum + Math.pow(reps - avgReps, 2), 0) / repCounts.length;

  // Lower variance = higher consistency
  const consistencyScore = Math.max(0, 1 - repVariance / 10);
  return Math.round(consistencyScore * 100) / 100;
}
