// ============================================================================
// AUTHENTICATION SERVICE
// ============================================================================
// Simplified Supabase Auth integration with essential functionality only

import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { ENV_CONFIG } from "@/config/constants";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "@/constants/auth";
import { logger } from "@/utils/logger";
import { storeTokens, clearTokens, getTokens, areTokensExpired } from "@/utils/storage";
import type { Database } from "@/types/database";
import type {
  LoginCredentials,
  SignupData,
  AuthResponse,
  PasswordResetRequest,
  EmailVerificationRequest,
  AuthError,
} from "../types/auth";

// ============================================================================
// SUPABASE CLIENT CONFIGURATION
// ============================================================================

// Custom storage adapter for Supabase Auth
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
  },
};

// Create Supabase client with secure configuration
const supabase = createClient<Database>(ENV_CONFIG.supabaseUrl, ENV_CONFIG.supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true, // Let Supabase handle token refresh automatically
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      "X-Client-Info": "trainsmart-mobile",
    },
  },
});

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

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

    // Create user profile if signup successful
    if (data.user) {
      try {
        await createUserProfile(data.user.id, signupData);
      } catch (profileError) {
        logger.error("Profile creation failed", profileError, "auth", data.user.id);
        // Don't fail the signup if profile creation fails
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

    // Handle successful authentication
    await handleSuccessfulAuth(data.session);

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
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      logger.error("User retrieval error", error, "auth");
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
 */
export async function initializeAuth(): Promise<AuthResponse> {
  try {
    logger.info("Initializing authentication state", undefined, "auth");

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
      return {
        success: true,
        user: null,
        session: null,
      };
    }

    // Store tokens
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
  // Store tokens securely
  await storeTokens({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: new Date(session.expires_at! * 1000).toISOString(),
  });
}

/**
 * Create user profile after successful signup
 */
async function createUserProfile(userId: string, signupData: SignupData): Promise<void> {
  const { error } = await supabase.from("user_profiles").insert({
    id: userId,
    email: signupData.email,
    display_name: signupData.profile.displayName,
    experience_level: signupData.profile.experienceLevel,
    fitness_goals: signupData.profile.fitnessGoals || [],
    height_cm: signupData.profile.heightCm,
    weight_kg: signupData.profile.weightKg,
  });

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
