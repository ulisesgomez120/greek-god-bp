// ============================================================================
// AUTHENTICATION WEBHOOK
// ============================================================================
// Webhook for handling Supabase authentication events with comprehensive
// user profile management and event processing

/// <reference types="../deno.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import type { Database } from "../_shared/database.types.ts";

// ============================================================================
// TYPES
// ============================================================================

interface WebhookPayload {
  type: string;
  table: string;
  record: any;
  schema: string;
  old_record?: any;
}

interface AuthEvent {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: "users";
  record: {
    id: string;
    aud: string;
    role: string;
    email: string;
    email_confirmed_at: string | null;
    phone: string | null;
    confirmed_at: string | null;
    last_sign_in_at: string | null;
    app_metadata: Record<string, any>;
    user_metadata: Record<string, any>;
    identities: any[];
    created_at: string;
    updated_at: string;
  };
  old_record?: any;
}

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  experience_level: "untrained" | "beginner" | "early_intermediate" | "intermediate";
  fitness_goals?: string[];
  height_cm?: number;
  weight_kg?: number;
  avatar_url?: string;
  email_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

serve(async (req) => {
  // Health check endpoint for deployment verification
  try {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
  } catch (e) {
    // ignore URL parse errors and continue
  }

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Read raw body as text for signature verification and robust logging
  const rawBody = await req.text();

  try {
    // Verify webhook signature (optional but recommended)
    const signature = req.headers.get("x-supabase-signature");
    if (!signature) {
      console.warn("Missing webhook signature");
    }

    // Parse webhook payload (use rawBody because req.text() was already consumed)
    const payload: WebhookPayload = JSON.parse(rawBody);
    console.log("Received webhook:", {
      type: payload.type,
      table: payload.table,
      recordId: payload.record?.id,
    });

    // Only process auth.users table events
    if (payload.table !== "users") {
      console.log("Ignoring non-users table event:", payload.table);
      return new Response(JSON.stringify({ message: "Event ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const authEvent = payload as AuthEvent;

    // Process different event types
    switch (authEvent.type) {
      case "INSERT":
        await handleUserCreated(authEvent.record);
        break;
      case "UPDATE":
        await handleUserUpdated(authEvent.record, authEvent.old_record);
        break;
      case "DELETE":
        await handleUserDeleted(authEvent.old_record);
        break;
      default:
        console.log("Unknown event type:", authEvent.type);
    }

    return new Response(JSON.stringify({ message: "Webhook processed successfully" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({
        error: "Webhook processing failed",
        message: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle user creation event
 */
async function handleUserCreated(user: AuthEvent["record"]): Promise<void> {
  try {
    console.log("Processing user creation:", user.id);

    // Extract user metadata
    const displayName = user.user_metadata?.display_name || extractNameFromEmail(user.email);
    const experienceLevel = user.user_metadata?.experience_level || "untrained";
    const fitnessGoals = user.user_metadata?.fitness_goals || [];
    const heightCm = user.user_metadata?.height_cm;
    const weightKg = user.user_metadata?.weight_kg;

    // Create user profile
    const userProfile: Partial<UserProfile> = {
      id: user.id,
      email: user.email,
      display_name: displayName,
      experience_level: experienceLevel,
      fitness_goals: fitnessGoals,
      height_cm: heightCm,
      weight_kg: weightKg,
      email_confirmed: !!user.email_confirmed_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    // Insert user profile
    const { error: profileError } = await supabase.from("user_profiles").insert(userProfile);

    if (profileError) {
      console.error("Failed to create user profile:", profileError);
      throw profileError;
    }

    // Initialize user preferences
    await initializeUserPreferences(user.id, experienceLevel);

    // Send welcome email (if email is confirmed)
    if (user.email_confirmed_at) {
      await sendWelcomeEmail(user.email, displayName);
    }

    console.log("User profile created successfully:", user.id);
  } catch (error) {
    console.error("Error handling user creation:", error);
    throw error;
  }
}

/**
 * Handle user update event
 */
async function handleUserUpdated(user: AuthEvent["record"], oldUser: AuthEvent["record"]): Promise<void> {
  try {
    console.log("Processing user update:", user.id);

    const updates: Partial<UserProfile> = {
      updated_at: user.updated_at,
    };

    // Check if email was confirmed
    if (!oldUser.email_confirmed_at && user.email_confirmed_at) {
      updates.email_confirmed = true;
      console.log("Email confirmed for user:", user.id);

      // Send welcome email on email confirmation
      const displayName = user.user_metadata?.display_name || extractNameFromEmail(user.email);
      await sendWelcomeEmail(user.email, displayName);
    }

    // Check if email changed
    if (oldUser.email !== user.email) {
      updates.email = user.email;
      updates.email_confirmed = !!user.email_confirmed_at;
      console.log("Email updated for user:", user.id);
    }

    // Check if user metadata changed
    if (JSON.stringify(oldUser.user_metadata) !== JSON.stringify(user.user_metadata)) {
      if (user.user_metadata?.display_name) {
        updates.display_name = user.user_metadata.display_name;
      }
      if (user.user_metadata?.experience_level) {
        updates.experience_level = user.user_metadata.experience_level;
      }
      if (user.user_metadata?.fitness_goals) {
        updates.fitness_goals = user.user_metadata.fitness_goals;
      }
      if (user.user_metadata?.height_cm) {
        updates.height_cm = user.user_metadata.height_cm;
      }
      if (user.user_metadata?.weight_kg) {
        updates.weight_kg = user.user_metadata.weight_kg;
      }
      if (user.user_metadata?.avatar_url) {
        updates.avatar_url = user.user_metadata.avatar_url;
      }
    }

    // Update user profile if there are changes
    if (Object.keys(updates).length > 1) {
      // More than just updated_at
      const { error: updateError } = await supabase.from("user_profiles").update(updates).eq("id", user.id);

      if (updateError) {
        console.error("Failed to update user profile:", updateError);
        throw updateError;
      }

      console.log("User profile updated successfully:", user.id);
    }

    // Track login activity
    if (!oldUser.last_sign_in_at && user.last_sign_in_at) {
      await trackLoginActivity(user.id, user.last_sign_in_at);
    }
  } catch (error) {
    console.error("Error handling user update:", error);
    throw error;
  }
}

/**
 * Handle user deletion event
 */
async function handleUserDeleted(user: AuthEvent["record"]): Promise<void> {
  try {
    console.log("Processing user deletion:", user.id);

    // The user profile should be automatically deleted due to CASCADE constraint
    // But we can perform additional cleanup here if needed

    // Log the deletion for audit purposes
    console.log("User deleted:", {
      id: user.id,
      email: user.email,
      deletedAt: new Date().toISOString(),
    });

    // Additional cleanup could include:
    // - Removing user data from external services
    // - Canceling subscriptions
    // - Cleaning up uploaded files
    // - Sending deletion confirmation email

    console.log("User deletion processed successfully:", user.id);
  } catch (error) {
    console.error("Error handling user deletion:", error);
    throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract display name from email
 */
function extractNameFromEmail(email: string): string {
  const localPart = email.split("@")[0];
  return localPart
    .split(/[._-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Initialize user preferences and default settings
 */
async function initializeUserPreferences(userId: string, experienceLevel: string): Promise<void> {
  try {
    // Set default preferences based on experience level
    const defaultPreferences = {
      notifications: {
        workout_reminders: true,
        progress_updates: true,
        ai_coaching: experienceLevel !== "untrained",
        marketing: false,
      },
      privacy: {
        data_sharing: false,
        analytics: true,
        public_profile: false,
      },
      workout: {
        rest_timer_enabled: true,
        auto_progression: experienceLevel !== "untrained",
        rpe_tracking: experienceLevel === "early_intermediate" || experienceLevel === "intermediate",
      },
    };

    // Store preferences (this would be in a user_preferences table)
    // For now, we'll just log them
    console.log("Default preferences set for user:", userId, defaultPreferences);
  } catch (error) {
    console.error("Error initializing user preferences:", error);
    // Don't throw - this is not critical
  }
}

/**
 * Track user login activity
 */
async function trackLoginActivity(userId: string, loginTime: string): Promise<void> {
  try {
    // This could be stored in a login_history table
    const loginRecord = {
      user_id: userId,
      login_time: loginTime,
      ip_address: null, // Would need to extract from request
      user_agent: null, // Would need to extract from request
      success: true,
    };

    console.log("Login activity tracked:", loginRecord);

    // Update user's last login streak, login count, etc.
    // This would involve more complex logic to calculate streaks
  } catch (error) {
    console.error("Error tracking login activity:", error);
    // Don't throw - this is not critical
  }
}

/**
 * Send welcome email to new users
 */
async function sendWelcomeEmail(email: string, displayName: string): Promise<void> {
  try {
    // This would integrate with an email service like SendGrid, Resend, etc.
    // For now, we'll just log the action
    console.log("Welcome email would be sent to:", {
      email,
      displayName,
      template: "welcome",
      timestamp: new Date().toISOString(),
    });

    // Example integration with email service:
    /*
    const emailData = {
      to: email,
      from: "welcome@trainsmart.app",
      subject: "Welcome to TrainSmart!",
      template: "welcome",
      data: {
        displayName,
        loginUrl: "https://app.trainsmart.com/login",
        supportEmail: "support@trainsmart.com",
      },
    };

    await emailService.send(emailData);
    */
  } catch (error) {
    console.error("Error sending welcome email:", error);
    // Don't throw - this is not critical
  }
}

/**
 * Verify webhook signature (security enhancement)
 */
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    // This would implement HMAC signature verification
    // const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    // return signature === expectedSignature;
    return true; // Placeholder
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
}

console.log("Auth webhook function initialized");
