// ============================================================================
// SHARED SUPABASE CLIENT FOR EDGE FUNCTIONS
// ============================================================================
// Provides authenticated Supabase client with service role access

// @ts-ignore - Deno ESM import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { Database as DatabaseTypes } from "./database.types";

// Create Supabase client with service role key for server-side operations
export function createSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Create client with user context (for RLS policies)
export function createSupabaseClientWithAuth(authToken: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
  });

  return client;
}

// Extract and validate JWT token from request
export async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid authorization header");
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createSupabaseClientWithAuth(token);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Invalid or expired token");
  }

  return { user, supabase };
}

// Validate user has required subscription features
export async function validateUserAccess(
  userId: string,
  requiredFeatures: string[],
  supabase: ReturnType<typeof createSupabaseClient>
): Promise<boolean> {
  const { data, error } = await supabase.rpc("user_has_feature_access", {
    user_uuid: userId,
    required_features: requiredFeatures,
  });

  if (error) {
    console.error("Error checking user access:", error);
    return false;
  }

  return data || false;
}

// Get user's current subscription status
export async function getUserSubscriptionStatus(
  userId: string,
  supabase: ReturnType<typeof createSupabaseClient>
): Promise<string> {
  const { data, error } = await supabase.rpc("get_user_subscription_status", {
    user_uuid: userId,
  });

  if (error) {
    console.error("Error getting subscription status:", error);
    return "free";
  }

  return data || "free";
}

// Check user's AI budget for the current month
export async function checkAIBudget(
  userId: string,
  supabase: ReturnType<typeof createSupabaseClient>
): Promise<{
  within_budget: boolean;
  remaining_budget: number;
  total_cost: number;
  total_queries: number;
  budget_limit?: number;
}> {
  const { data, error } = await supabase.rpc("check_ai_budget", {
    user_uuid: userId,
  });

  if (error) {
    console.error("Error checking AI budget:", error);
    // Return safe defaults
    return {
      within_budget: false,
      remaining_budget: 0,
      total_cost: 0,
      total_queries: 0,
    };
  }

  return data;
}

// Track AI usage
export async function trackAIUsage(
  userId: string,
  queryType: string,
  tokensUsed: number,
  estimatedCost: number,
  modelUsed: string,
  responseTimeMs?: number,
  supabase?: ReturnType<typeof createSupabaseClient>
): Promise<void> {
  const client = supabase || createSupabaseClient();

  const { error } = await client.from("ai_usage_tracking").insert({
    user_id: userId,
    query_type: queryType,
    tokens_used: tokensUsed,
    estimated_cost: estimatedCost,
    model_used: modelUsed,
    response_time_ms: responseTimeMs,
  });

  if (error) {
    console.error("Error tracking AI usage:", error);
    // Don't throw error - usage tracking shouldn't break the main flow
  }
}

// Database type definitions (placeholder - will be generated)
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          experience_level: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name: string;
          experience_level?: string;
        };
        Update: {
          display_name?: string;
          experience_level?: string;
        };
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          started_at: string;
          completed_at?: string;
          duration_minutes?: number;
          total_volume_kg?: number;
          average_rpe?: number;
          sync_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          name: string;
          started_at: string;
          completed_at?: string;
          duration_minutes?: number;
          total_volume_kg?: number;
          average_rpe?: number;
        };
        Update: {
          name?: string;
          completed_at?: string;
          duration_minutes?: number;
          total_volume_kg?: number;
          average_rpe?: number;
        };
      };
      ai_usage_tracking: {
        Row: {
          id: string;
          user_id: string;
          query_type: string;
          tokens_used: number;
          estimated_cost: number;
          model_used: string;
          response_time_ms?: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          query_type: string;
          tokens_used: number;
          estimated_cost: number;
          model_used: string;
          response_time_ms?: number;
        };
        Update: {
          user_rating?: number;
          user_feedback?: string;
        };
      };
    };
    Functions: {
      user_has_feature_access: {
        Args: {
          user_uuid: string;
          required_features: string[];
        };
        Returns: boolean;
      };
      get_user_subscription_status: {
        Args: {
          user_uuid: string;
        };
        Returns: string;
      };
      check_ai_budget: {
        Args: {
          user_uuid: string;
        };
        Returns: {
          within_budget: boolean;
          remaining_budget: number;
          total_cost: number;
          total_queries: number;
          budget_limit?: number;
        };
      };
    };
  };
}
