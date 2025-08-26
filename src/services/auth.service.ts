// ============================================================================
// AUTHENTICATION SERVICE
// ============================================================================
// Simplified Supabase Auth integration with essential functionality only
// Enhanced: Single-point profile creation for verified emails during sign-in
// and session initialization. If profile creation fails in production, the
// user will be logged out to avoid leaving them in authentication limbo.

import { ENV_CONFIG } from "@/config/constants";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@/constants/auth";
import { logger } from "@/utils/logger";
import { storeTokens, getTokens, clearTokens, areTokensExpired } from "@/utils/tokenManager";
import type { Database } from "@/types/database";
import type {
  LoginCredentials,
  SignupData,
  AuthResponse,
  PasswordResetRequest,
  EmailVerificationRequest,
  AuthError,
} from "../types/auth";

import supabase, { getAuthenticatedClient } from "@/lib/supabase";
import { events } from "@/utils/events";
import { transformUserProfileToDb } from "@/types/transforms";

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

/**
 * Check whether a user profile exists.
 * Returns true if a row exists in user_profiles with the provided userId.
 */
async function checkProfileExists(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("user_profiles").select("id").eq("id", userId).maybeSingle();
    if (error) {
      logger.warn("checkProfileExists: DB check returned error", error, "auth", userId);
      // If we can't determine, be conservative and return false so caller may attempt creation
      return false;
    }
    return !!data;
  } catch (err) {
    logger.warn("checkProfileExists: unexpected error", err, "auth", userId);
    return false;
  }
}

/**
 * Create a user profile using data from the auth user object.
 * Uses an authenticated client when an access token is available so RLS policies
 * that rely on the authenticated user will work correctly.
 *
 * Throws on error.
 */
async function createProfileFromAuthUser(user: any, accessToken?: string): Promise<void> {
  // Build minimal profile payload using available metadata / sensible defaults
  const meta = user.user_metadata || user.raw_user_meta_data || {};
  const displayName = meta.display_name || meta.displayName || user.email?.split("@")[0] || "New User";
  const experienceLevel = meta.experience_level || meta.experienceLevel || "untrained";

  const dbProfile = transformUserProfileToDb({
    id: user.id,
    email: user.email,
    displayName,
    experienceLevel,
  } as any);

  const insertPayload: any = {
    ...dbProfile,
    id: user.id,
    email: user.email || "",
    display_name: (dbProfile as any).display_name ?? displayName,
    experience_level: experienceLevel,
    fitness_goals: meta.fitness_goals || meta.fitnessGoals || [],
    height_cm: meta.heightCm ?? null,
    weight_kg: meta.weightKg ?? null,
  };

  // Prefer creating using an authenticated client scoped to the user's access token
  const client = accessToken ? getAuthenticatedClient(accessToken) : supabase;

  const { error } = await client.from("user_profiles").insert(insertPayload);
  if (error) {
    logger.error("createProfileFromAuthUser: failed to create profile", error, "auth", user.id);
    throw error;
  }

  logger.info("createProfileFromAuthUser: profile created", { userId: user.id }, "auth", user.id);
}

/**
 * Sign up new user with profile creation
 */
export async function signUp(signupData: SignupData): Promise<AuthResponse> {
  try {
    logger.info("Attempting user signup", { email: signupData.email }, "auth");

    // Basic validation
    if (!signupData.email || !signupData.password) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Email and password are required",
          type: "validation",
        },
      };
    }

    // Attempt signup with Supabase
    const { data, error } = await supabase.auth.signUp({
      email: signupData.email,
      password: signupData.password,
      options: {
        data: {
          display_name: signupData.profile.displayName,
          experience_level: signupData.profile.experienceLevel,
        },
      },
    });

    if (error) {
      logger.error("Signup failed", error, "auth");
      return {
        success: false,
        error: mapSupabaseError(error),
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: {
          code: "NO_USER_DATA",
          message: "Signup failed: No user data returned",
          type: "server",
        },
      };
    }

    // Create user profile if signup successful and email confirmed (or session exists)
    if (data.user) {
      try {
        // If Supabase returned a session (email confirmation not required), create profile now.
        if (data.session && data.user) {
          try {
            // create profile with authenticated session token to respect RLS
            await createProfileFromAuthUser(data.user, data.session.access_token);
          } catch (profileError) {
            logger.error("Profile creation during signup failed", profileError, "auth", data.user.id);
            // Don't fail the signup if profile creation fails here; user can still verify email and have profile created at login.
          }
        }
      } catch (profileError) {
        logger.error("Profile creation failed in signup flow", profileError, "auth", data.user.id);
      }
    }

    // Handle session based on email confirmation requirement
    if (data.session) {
      // User is immediately logged in (email confirmation not required)
      await handleSuccessfulAuth(data.session);

      logger.info("User signed up and logged in successfully", { userId: data.user.id }, "auth", data.user.id);

      return {
        success: true,
        user: data.user,
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
          user: data.user,
        },
        message: SUCCESS_MESSAGES.auth.signupSuccess,
      };
    } else {
      // Email confirmation required
      logger.info("User signed up, email confirmation required", { userId: data.user.id }, "auth", data.user.id);

      return {
        success: true,
        user: data.user,
        session: null,
        requiresEmailConfirmation: true,
        message: SUCCESS_MESSAGES.auth.signupSuccess,
      };
    }
  } catch (error) {
    logger.error("Signup error", error, "auth");
    return {
      success: false,
      error: {
        code: "SIGNUP_FAILED",
        message: "An unexpected error occurred during signup",
        type: "network",
      },
    };
  }
}

/**
 * Sign in user with email and password
 *
 * Enhanced behavior:
 * - After successful sign-in, if the user's email is verified and a profile
 *   does not exist, attempt to create the profile once using the authenticated
 *   session. If profile creation fails, sign the user out to avoid leaving them
 *   authenticated without a profile.
 */
export async function signIn(credentials: LoginCredentials): Promise<AuthResponse> {
  try {
    logger.info("Attempting user login", { email: credentials.email }, "auth");

    // Basic validation
    if (!credentials.email || !credentials.password) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Email and password are required",
          type: "validation",
        },
      };
    }

    // Attempt login with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      logger.error("Login failed", error, "auth");
      return {
        success: false,
        error: mapSupabaseError(error),
      };
    }

    if (!data.user || !data.session) {
      return {
        success: false,
        error: {
          code: "NO_SESSION_DATA",
          message: "Login failed: No session data returned",
          type: "server",
        },
      };
    }

    // If email is verified, ensure profile exists and create if missing
    const user = data.user;
    const session = data.session;

    const emailVerified =
      Boolean(user.email_confirmed_at) || Boolean((user as any).email_verified) || Boolean((user as any).confirmed_at);

    if (emailVerified) {
      const exists = await checkProfileExists(user.id);
      if (!exists) {
        try {
          await createProfileFromAuthUser(user, session.access_token);
        } catch (profileErr) {
          // If profile creation fails in production, sign the user out to avoid leaving them stuck.
          logger.error("signIn: profile creation failed; signing out user", profileErr, "auth", user.id);
          try {
            await supabase.auth.signOut();
          } catch (signOutErr) {
            logger.warn("signIn: signOut after profile creation failure also failed", signOutErr, "auth", user.id);
          }
          return {
            success: false,
            error: {
              code: "PROFILE_CREATE_FAILED",
              message: "Failed to create user profile. Please try again or contact support.",
              type: "server",
            },
          };
        }
      }
    } else {
      // If email not verified, do not create a profile. Let client show verification flow.
      logger.info("signIn: user email not verified; skipping profile creation", { userId: user.id }, "auth", user.id);
    }

    // Handle successful authentication
    await handleSuccessfulAuth(session);

    logger.info("User logged in successfully", { userId: data.user.id }, "auth", data.user.id);

    return {
      success: true,
      user: data.user,
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
        user: data.user,
      },
      message: SUCCESS_MESSAGES.auth.loginSuccess,
    };
  } catch (error) {
    logger.error("Login error", error, "auth");
    return {
      success: false,
      error: {
        code: "LOGIN_FAILED",
        message: "An unexpected error occurred during login",
        type: "network",
      },
    };
  }
}

/**
 * Sign out user and cleanup
 */
export async function signOut(): Promise<AuthResponse> {
  try {
    logger.info("Attempting user logout", undefined, "auth");

    // Sign out from Supabase (this handles token cleanup automatically)
    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.warn("Supabase logout failed, but continuing with local cleanup", error, "auth");
    }

    // Clear stored tokens
    await clearTokens();

    logger.info("User logged out successfully", undefined, "auth");

    try {
      events.emit("auth:signed_out", null);
    } catch (err) {
      logger.warn("auth.service: failed to emit auth:signed_out", err, "auth");
    }

    return {
      success: true,
      user: null,
      session: null,
      message: "Logged out successfully",
    };
  } catch (error) {
    logger.error("Logout error", error, "auth");
    // Even if logout fails, clear local data
    await clearTokens();

    return {
      success: false,
      error: {
        code: "LOGOUT_FAILED",
        message: "Logout completed with errors",
        type: "network",
      },
    };
  }
}

/**
 * Refresh authentication tokens - let Supabase handle this automatically
 */
export async function refreshSession(): Promise<AuthResponse> {
  try {
    logger.info("Refreshing authentication tokens", undefined, "auth");

    // Get current session - Supabase will refresh automatically if needed
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      logger.error("Token refresh failed", error, "auth");
      await clearTokens();
      return {
        success: false,
        error: {
          code: "REFRESH_FAILED",
          message: "Token refresh failed",
          type: "auth",
        },
      };
    }

    // Store new tokens
    await handleSuccessfulAuth(session);

    logger.info("Tokens refreshed successfully", undefined, "auth", session.user?.id);

    return {
      success: true,
      user: session.user,
      session: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: new Date(session.expires_at! * 1000).toISOString(),
        user: session.user,
      },
    };
  } catch (error) {
    logger.error("Token refresh error", error, "auth");
    await clearTokens();
    return {
      success: false,
      error: {
        code: "REFRESH_ERROR",
        message: "Token refresh failed",
        type: "network",
      },
    };
  }
}

/**
 * Reset user password
 */
export async function resetPassword(request: PasswordResetRequest): Promise<AuthResponse> {
  try {
    logger.info("Attempting password reset", { email: request.email }, "auth");

    const { error } = await supabase.auth.resetPasswordForEmail(request.email, {
      redirectTo: `${ENV_CONFIG.apiUrl}/auth/reset-password`,
    });

    if (error) {
      logger.error("Password reset failed", error, "auth");
      return {
        success: false,
        error: mapSupabaseError(error),
      };
    }

    logger.info("Password reset email sent successfully", { email: request.email }, "auth");

    return {
      success: true,
      user: null,
      session: null,
      message: SUCCESS_MESSAGES.auth.passwordReset,
    };
  } catch (error) {
    logger.error("Password reset error", error, "auth");
    return {
      success: false,
      error: {
        code: "PASSWORD_RESET_FAILED",
        message: "Password reset failed",
        type: "network",
      },
    };
  }
}

/**
 * Resend email verification
 */
export async function resendEmailVerification(request: EmailVerificationRequest): Promise<AuthResponse> {
  try {
    logger.info("Resending email verification", { email: request.email }, "auth");

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: request.email,
    });

    if (error) {
      logger.error("Email verification resend failed", error, "auth");
      return {
        success: false,
        error: mapSupabaseError(error),
      };
    }

    logger.info("Email verification resent successfully", { email: request.email }, "auth");

    return {
      success: true,
      user: null,
      session: null,
      message: "Verification email sent successfully",
    };
  } catch (error) {
    logger.error("Email verification resend error", error, "auth");
    return {
      success: false,
      error: {
        code: "EMAIL_VERIFICATION_FAILED",
        message: "Failed to resend verification email",
        type: "network",
      },
    };
  }
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Get current session
 */
export async function getCurrentSession() {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      logger.error("Session retrieval error", error, "auth");
      return null;
    }

    return session;
  } catch (error) {
    logger.error("Get session error", error, "auth");
    return null;
  }
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  try {
    // First check if a session exists so we avoid triggering AuthSessionMissingError
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      // Non-fatal: log and return null (no session available)
      logger.warn("Session retrieval error while getting user", sessionError, "auth");
      return null;
    }

    if (!session || !session.access_token) {
      // No active session — attempt to rehydrate user from stored tokens as a fallback.
      try {
        const tokens = await getTokens();
        if (tokens && tokens.accessToken) {
          try {
            const {
              data: { user: tokenUser },
              error: tokenUserError,
            } = await supabase.auth.getUser(tokens.accessToken);

            if (!tokenUserError && tokenUser) {
              logger.info("Rehydrated user from stored access token", { userId: tokenUser.id }, "auth", tokenUser.id);
              return tokenUser;
            }
          } catch (rehydErr) {
            logger.warn("Failed to get user using stored access token", rehydErr, "auth");
          }
        }
      } catch (err) {
        logger.warn("Error reading stored tokens during user rehydrate", err, "auth");
      }

      // Final fallback: no session available
      logger.debug("No active session found when attempting to get current user", undefined, "auth");
      return null;
    }

    // Use the access token to fetch the user (prevents internal session-missing throws)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(session.access_token);

    if (error) {
      logger.warn("User retrieval error", error, "auth");
      return null;
    }

    return user;
  } catch (error) {
    logger.error("Get user error", error, "auth");
    return null;
  }
}

/**
 * Initialize authentication state from stored tokens
 *
 * Enhanced behavior:
 * - On session restoration, if user's email is verified and profile is missing,
 *   attempt to create the profile once. If creation fails, clear local tokens
 *   and return a failure to avoid leaving user authenticated without profile.
 */
export async function initializeAuth(): Promise<AuthResponse> {
  try {
    logger.info("Initializing authentication state", undefined, "auth");

    // TokenManager handles migration and rehydration of stored tokens on initialization.
    // Avoid ad-hoc supabase.auth.setSession calls here to prevent race conditions.
    // TokenManager's initialization (import side-effect) will rehydrate the shared Supabase client.

    // Get current session - Supabase handles token validation automatically
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      logger.error("Failed to get session during initialization", error, "auth");
      await clearTokens();
      return {
        success: true,
        user: null,
        session: null,
      };
    }

    if (!session) {
      logger.info("No valid session found", undefined, "auth");
      // Ensure local tokens are cleared to avoid inconsistent state
      await clearTokens();
      return {
        success: true,
        user: null,
        session: null,
      };
    }

    // Only attempt profile creation if email is confirmed
    const user = session.user;
    const emailVerified =
      Boolean(user.email_confirmed_at) || Boolean((user as any).email_verified) || Boolean((user as any).confirmed_at);

    if (emailVerified) {
      const exists = await checkProfileExists(user.id);
      if (!exists) {
        try {
          await createProfileFromAuthUser(user, session.access_token);
        } catch (profileErr) {
          // If profile creation fails during initialization, clear tokens and return error
          logger.error(
            "initializeAuth: profile creation failed during initialization; clearing tokens and aborting",
            profileErr,
            "auth",
            user.id
          );
          await clearTokens();
          try {
            await supabase.auth.signOut();
          } catch (signOutErr) {
            logger.warn("initializeAuth: signOut after profile creation failure failed", signOutErr, "auth", user.id);
          }
          return {
            success: false,
            error: {
              code: "PROFILE_CREATE_FAILED",
              message: "Failed to create user profile during session initialization",
              type: "server",
            },
          };
        }
      }
    } else {
      logger.info(
        "initializeAuth: user email not verified; skipping profile creation during initialization",
        { userId: user.id },
        "auth",
        user.id
      );
    }

    // Store tokens (keep tokenManager/storage in sync)
    await handleSuccessfulAuth(session);

    logger.info("Authentication initialized successfully", undefined, "auth", session.user?.id);

    return {
      success: true,
      user: session.user,
      session: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: new Date(session.expires_at! * 1000).toISOString(),
        user: session.user,
      },
    };
  } catch (error) {
    logger.error("Authentication initialization failed", error, "auth");
    await clearTokens();
    return {
      success: false,
      error: {
        code: "INIT_FAILED",
        message: "Failed to initialize authentication",
        type: "network",
      },
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Handle successful authentication - simplified
 */
async function handleSuccessfulAuth(session: any): Promise<void> {
  // Store tokens — TokenManager will rehydrate Supabase and schedule refresh.
  await storeTokens({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: new Date(session.expires_at! * 1000).toISOString(),
  });

  // Do not call supabase.auth.setSession here; TokenManager centralizes session rehydration.
}

/**
 * Create user profile after successful signup
 *
 * Kept for backward compatibility during signup flows. For the single-point
 * profile creation strategy we now favor createProfileFromAuthUser() called at
 * signIn / initializeAuth time when the user's email is verified.
 */
async function createUserProfile(userId: string, signupData: SignupData): Promise<void> {
  // Use the central transform for the core profile fields, but avoid passing
  // fields not declared on Partial<UserProfile> to prevent type errors.
  const dbProfile = transformUserProfileToDb({
    id: userId,
    email: signupData.email,
    displayName: signupData.profile.displayName,
    experienceLevel: signupData.profile.experienceLevel,
  } as any);

  // Build the final insert payload explicitly (snake_case) and cast to any to
  // satisfy Supabase typings while keeping transforms centralized.
  const insertPayload: any = {
    ...dbProfile,
    fitness_goals: signupData.profile.fitnessGoals || [],
    height_cm: signupData.profile.heightCm ?? null,
    weight_kg: signupData.profile.weightKg ?? null,
    id: userId,
    email: signupData.email,
    // ensure display_name is present for the DB row
    display_name: (dbProfile as any).display_name ?? signupData.profile.displayName,
  };

  const { error } = await supabase.from("user_profiles").insert(insertPayload);

  if (error) {
    throw error;
  }
}

/**
 * Map Supabase errors to user-friendly messages - simplified
 */
function mapSupabaseError(error: any): AuthError {
  const errorCode = error.message?.toLowerCase() || "";

  if (errorCode.includes("invalid login credentials")) {
    return {
      code: "INVALID_CREDENTIALS",
      message: ERROR_MESSAGES.auth.invalidCredentials,
      type: "auth",
    };
  }

  if (errorCode.includes("user already registered")) {
    return {
      code: "EMAIL_EXISTS",
      message: ERROR_MESSAGES.auth.emailExists,
      type: "auth",
    };
  }

  if (errorCode.includes("password")) {
    return {
      code: "WEAK_PASSWORD",
      message: ERROR_MESSAGES.auth.weakPassword,
      type: "validation",
    };
  }

  // Default error
  return {
    code: "UNKNOWN_ERROR",
    message: error.message || "An unexpected error occurred",
    type: "server",
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

// Create a service object for backward compatibility
export const authService = {
  signUp,
  signIn,
  signOut,
  refreshSession,
  resetPassword,
  resendEmailVerification,
  getCurrentSession,
  getCurrentUser,
  initializeAuth,
};

export default authService;
