// ============================================================================
// TEMPORARY SUBSCRIPTION EDGE FUNCTION
// ============================================================================
// Supabase Edge Function for managing temporary subscriptions during testing phase.
// This will be replaced with native IAP handling when ready for production.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ============================================================================
// TYPES
// ============================================================================

interface TempSubscriptionRequest {
  action: "upgrade" | "get_status" | "check_access";
  userId: string;
  plan?: "premium" | "coach";
  durationDays?: number;
  featureKey?: string;
}

interface TempSubscriptionResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// ============================================================================
// EDGE FUNCTION HANDLER
// ============================================================================

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Parse request
    const { action, userId, plan, durationDays = 30, featureKey }: TempSubscriptionRequest = await req.json();

    // Validate required fields
    if (!action || !userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: action, userId",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle different actions
    let result: TempSubscriptionResponse;

    switch (action) {
      case "upgrade":
        result = await handleUpgrade(supabaseClient, userId, plan!, durationDays);
        break;
      case "get_status":
        result = await getSubscriptionStatus(supabaseClient, userId);
        break;
      case "check_access":
        result = await checkFeatureAccess(supabaseClient, userId, featureKey!);
        break;
      default:
        result = {
          success: false,
          error: `Unknown action: ${action}`,
        };
    }

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Temp subscription function error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ============================================================================
// ACTION HANDLERS
// ============================================================================

/**
 * Handle subscription upgrade
 */
async function handleUpgrade(
  supabase: any,
  userId: string,
  plan: "premium" | "coach",
  durationDays: number
): Promise<TempSubscriptionResponse> {
  try {
    // Validate plan
    if (!plan || !["premium", "coach"].includes(plan)) {
      return {
        success: false,
        error: "Invalid plan. Must be 'premium' or 'coach'",
      };
    }

    // Calculate expiry date
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    // Update user profile
    const { error } = await supabase
      .from("user_profiles")
      .update({
        temp_subscription_plan: plan,
        temp_subscription_expires: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      console.error("Failed to upgrade temp subscription:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    // Log the upgrade
    console.log(`User ${userId} upgraded to ${plan} temp subscription until ${expiresAt}`);

    return {
      success: true,
      data: {
        plan,
        expiresAt,
        durationDays,
        isTesting: true,
      },
    };
  } catch (error) {
    console.error("Upgrade error:", error);
    return {
      success: false,
      error: "Failed to upgrade subscription",
    };
  }
}

/**
 * Get subscription status
 */
async function getSubscriptionStatus(supabase: any, userId: string): Promise<TempSubscriptionResponse> {
  try {
    // Get user profile with temp subscription info
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("temp_subscription_plan, temp_subscription_expires")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Failed to get subscription status:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    if (!profile) {
      return {
        success: false,
        error: "User not found",
      };
    }

    // Check if subscription is active
    const plan = profile.temp_subscription_plan || "free";
    const expiresAt = profile.temp_subscription_expires;
    const isActive = !expiresAt || new Date(expiresAt) > new Date();
    const isTesting = plan !== "free";

    // Calculate days remaining
    let daysRemaining = null;
    if (expiresAt) {
      const diffTime = new Date(expiresAt).getTime() - Date.now();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (daysRemaining < 0) daysRemaining = 0;
    }

    // Get features for the plan
    const features = getPlanFeatures(plan);

    return {
      success: true,
      data: {
        plan,
        expiresAt,
        isActive,
        isTesting,
        daysRemaining,
        features,
      },
    };
  } catch (error) {
    console.error("Get status error:", error);
    return {
      success: false,
      error: "Failed to get subscription status",
    };
  }
}

/**
 * Check feature access
 */
async function checkFeatureAccess(
  supabase: any,
  userId: string,
  featureKey: string
): Promise<TempSubscriptionResponse> {
  try {
    // Get subscription status first
    const statusResult = await getSubscriptionStatus(supabase, userId);

    if (!statusResult.success) {
      return statusResult;
    }

    const { plan, isActive, isTesting, expiresAt } = statusResult.data;

    // Get features for the plan
    const features = getPlanFeatures(plan);

    // Check if feature is included
    const hasFeature = features.includes(featureKey);

    if (!hasFeature) {
      return {
        success: true,
        data: {
          hasAccess: false,
          reason: "feature_not_in_plan",
          upgradeRequired: true,
          isTesting,
        },
      };
    }

    // Check if subscription is active
    if (!isActive) {
      return {
        success: true,
        data: {
          hasAccess: false,
          reason: "expired",
          upgradeRequired: true,
          isTesting,
          expiresAt,
        },
      };
    }

    return {
      success: true,
      data: {
        hasAccess: true,
        isTesting,
        expiresAt,
      },
    };
  } catch (error) {
    console.error("Check access error:", error);
    return {
      success: false,
      error: "Failed to check feature access",
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get features for a specific plan
 */
function getPlanFeatures(plan: string): string[] {
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

  return planFeatures[plan as keyof typeof planFeatures] || planFeatures.free;
}

// ============================================================================
// AUTO-RENEWAL FUNCTION (SEPARATE ENDPOINT)
// ============================================================================

/**
 * Auto-renew expired temporary subscriptions
 * This would typically be called by a cron job
 */
export async function autoRenewTempSubscriptions() {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find users with expired temp subscriptions (within last 7 days)
    const { data: expiredUsers, error } = await supabaseClient
      .from("user_profiles")
      .select("id, temp_subscription_plan, temp_subscription_expires")
      .neq("temp_subscription_plan", "free")
      .not("temp_subscription_expires", "is", null)
      .lte("temp_subscription_expires", new Date().toISOString())
      .gte("temp_subscription_expires", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      console.error("Failed to get expired subscriptions:", error);
      return { renewed: 0, error: error.message };
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      console.log("No expired subscriptions to renew");
      return { renewed: 0 };
    }

    let renewedCount = 0;

    // Renew each expired subscription
    for (const user of expiredUsers) {
      const newExpiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { error: updateError } = await supabaseClient
        .from("user_profiles")
        .update({
          temp_subscription_expires: newExpiryDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        console.error(`Failed to renew subscription for user ${user.id}:`, updateError);
      } else {
        renewedCount++;
        console.log(`Renewed ${user.temp_subscription_plan} subscription for user ${user.id} until ${newExpiryDate}`);
      }
    }

    console.log(`Auto-renewed ${renewedCount} temporary subscriptions`);
    return { renewed: renewedCount };
  } catch (error) {
    console.error("Auto-renewal error:", error);
    return { renewed: 0, error: error.message };
  }
}
