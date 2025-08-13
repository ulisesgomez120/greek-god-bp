// ============================================================================
// AUTHENTICATION THUNKS
// ============================================================================
// Async authentication actions for Redux Toolkit with comprehensive error
// handling, token management, and session persistence

import { createAsyncThunk } from "@reduxjs/toolkit";
import { authService } from "@/services/auth.service";
import { tokenManager } from "@/utils/tokenManager";
import { logger } from "@/utils/logger";
import supabase from "@/lib/supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { LoginCredentials, SignupData, Session, AuthError, TokenData, AuthResponse } from "@/types/auth";

// ============================================================================
// THUNK TYPES
// ============================================================================

interface LoginResult {
  user: SupabaseUser;
  session: Session;
}

interface SignupResult {
  user: SupabaseUser;
  session: Session | null;
  requiresEmailConfirmation?: boolean;
}

interface RefreshResult {
  user: SupabaseUser | null;
  session: Session;
}

interface InitializeResult {
  user: SupabaseUser | null;
  session: Session | null;
}

interface ResetPasswordResult {
  success: boolean;
}

// ============================================================================
// AUTHENTICATION THUNKS
// ============================================================================

/**
 * Login user with email and password
 */
export const loginUser = createAsyncThunk<LoginResult, LoginCredentials, { rejectValue: AuthError }>(
  "auth/loginUser",
  async (credentials, { rejectWithValue }) => {
    try {
      logger.info("authThunks: Login attempt", { email: credentials.email }, "auth");

      const result = await authService.signIn(credentials);

      if (!result.success || !result.user || !result.session) {
        logger.error("authThunks: Login failed", result.error, "auth");
        return rejectWithValue(
          result.error || {
            code: "LOGIN_FAILED",
            message: "Login failed",
            type: "auth",
          }
        );
      }

      // Store tokens securely
      const tokenData: TokenData = {
        accessToken: result.session.accessToken,
        refreshToken: result.session.refreshToken,
        expiresAt: result.session.expiresAt,
      };

      await tokenManager.storeTokens(tokenData);

      logger.info("authThunks: Login successful", { userId: result.user.id }, "auth", result.user.id);

      // Emit event for signed in so other services (e.g., workoutService) can react
      try {
        const { events } = await import("@/utils/events");
        events.emit("auth:signed_in", { userId: result.user.id });
      } catch (err) {
        logger.warn("authThunks: failed to emit auth:signed_in", err, "auth");
      }

      return {
        user: result.user,
        session: result.session,
      };
    } catch (error: any) {
      logger.error("authThunks: Login error", error, "auth");
      return rejectWithValue({
        code: "LOGIN_ERROR",
        message: error.message || "Login failed",
        type: "network",
      });
    }
  }
);

/**
 * Sign up new user
 */
export const signupUser = createAsyncThunk<SignupResult, SignupData, { rejectValue: AuthError }>(
  "auth/signupUser",
  async (data, { rejectWithValue }) => {
    try {
      logger.info("authThunks: Signup attempt", { email: data.email }, "auth");

      const result = await authService.signUp(data);

      if (!result.success || !result.user) {
        logger.error("authThunks: Signup failed", result.error, "auth");
        return rejectWithValue(
          result.error || {
            code: "SIGNUP_FAILED",
            message: "Signup failed",
            type: "auth",
          }
        );
      }

      // Store tokens if session is available (not requiring email confirmation)
      if (result.session) {
        const tokenData: TokenData = {
          accessToken: result.session.accessToken,
          refreshToken: result.session.refreshToken,
          expiresAt: result.session.expiresAt,
        };

        await tokenManager.storeTokens(tokenData);
      }

      logger.info(
        "authThunks: Signup successful",
        {
          userId: result.user.id,
          requiresConfirmation: result.requiresEmailConfirmation,
        },
        "auth",
        result.user.id
      );

      return {
        user: result.user,
        session: result.session || null,
        requiresEmailConfirmation: result.requiresEmailConfirmation,
      };
    } catch (error: any) {
      logger.error("authThunks: Signup error", error, "auth");
      return rejectWithValue({
        code: "SIGNUP_ERROR",
        message: error.message || "Signup failed",
        type: "network",
      });
    }
  }
);

/**
 * Logout user and clear session
 */
export const logoutUser = createAsyncThunk<null, void, { rejectValue: AuthError }>(
  "auth/logoutUser",
  async (_, { rejectWithValue }) => {
    try {
      logger.info("authThunks: Logout attempt", undefined, "auth");

      // Clear tokens first (even if logout API call fails)
      await tokenManager.clearTokens();

      // Attempt to logout from server
      const result = await authService.signOut();

      if (!result.success) {
        logger.warn("authThunks: Server logout failed, but tokens cleared", result.error, "auth");
        // Don't reject here - local logout is more important
      }

      logger.info("authThunks: Logout successful", undefined, "auth");
      return null;
    } catch (error: any) {
      logger.error("authThunks: Logout error", error, "auth");

      // Even if there's an error, we should clear local state
      try {
        await tokenManager.clearTokens();
      } catch (clearError) {
        logger.error("authThunks: Failed to clear tokens during logout error", clearError, "auth");
      }

      return rejectWithValue({
        code: "LOGOUT_ERROR",
        message: error.message || "Logout failed",
        type: "network",
      });
    }
  }
);

/**
 * Refresh authentication tokens
 */
export const refreshTokens = createAsyncThunk<RefreshResult, void, { rejectValue: AuthError }>(
  "auth/refreshTokens",
  async (_, { rejectWithValue }) => {
    try {
      logger.info("authThunks: Token refresh attempt", undefined, "auth");

      const tokens = await tokenManager.refreshTokens();

      if (!tokens) {
        logger.error("authThunks: Token refresh failed - no tokens returned", undefined, "auth");
        return rejectWithValue({
          code: "REFRESH_FAILED",
          message: "Token refresh failed",
          type: "auth",
        });
      }

      // Rehydrate Supabase auth client with tokens so GoTrue has a session
      try {
        await supabase.auth.setSession({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
        });
      } catch (setSessionError) {
        logger.warn("authThunks: supabase.auth.setSession failed", setSessionError, "auth");
      }

      // Get user info with new tokens
      const user = await authService.getCurrentUser();

      if (!user) {
        logger.error("authThunks: Failed to get user after token refresh", undefined, "auth");
        return rejectWithValue({
          code: "USER_FETCH_FAILED",
          message: "Failed to get user information",
          type: "auth",
        });
      }

      const session: Session = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        user: user,
      };

      logger.info("authThunks: Token refresh successful", { userId: user.id }, "auth", user.id);

      // Emit token refreshed event for other services to react (dynamic import to avoid cycles)
      try {
        const { events } = await import("@/utils/events");
        events.emit("auth:token_refreshed", { userId: user?.id });
      } catch (err) {
        logger.warn("authThunks: failed to emit auth:token_refreshed", err, "auth");
      }

      return {
        user: user,
        session,
      };
    } catch (error: any) {
      logger.error("authThunks: Token refresh error", error, "auth");
      return rejectWithValue({
        code: "REFRESH_ERROR",
        message: error.message || "Token refresh failed",
        type: "network",
      });
    }
  }
);

/**
 * Initialize authentication state from stored tokens
 */
export const initializeAuth = createAsyncThunk<InitializeResult, void, { rejectValue: AuthError }>(
  "auth/initializeAuth",
  async (_, { rejectWithValue }) => {
    try {
      logger.info("authThunks: Authentication initialization", undefined, "auth");

      // Check if we have stored tokens
      const tokens = await tokenManager.getTokens();

      if (!tokens) {
        logger.info("authThunks: No stored tokens found", undefined, "auth");
        return {
          user: null,
          session: null,
        };
      }

      // Check if tokens are expired
      const areExpired = await tokenManager.areTokensExpired();

      if (areExpired) {
        logger.info("authThunks: Stored tokens are expired, attempting refresh", undefined, "auth");

        const refreshedTokens = await tokenManager.refreshTokens();

        if (!refreshedTokens) {
          logger.info("authThunks: Token refresh failed, clearing stored tokens", undefined, "auth");
          await tokenManager.clearTokens();
          return {
            user: null,
            session: null,
          };
        }

        // Update tokens reference
        tokens.accessToken = refreshedTokens.accessToken;
        tokens.refreshToken = refreshedTokens.refreshToken;
        tokens.expiresAt = refreshedTokens.expiresAt;
      }

      // Get current user with valid tokens
      const user = await authService.getCurrentUser();

      if (!user) {
        logger.warn("authThunks: Failed to get current user, clearing tokens", undefined, "auth");
        await tokenManager.clearTokens();
        return {
          user: null,
          session: null,
        };
      }

      const session: Session = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        user: user,
      };

      logger.info("authThunks: Authentication initialized successfully", { userId: user.id }, "auth", user.id);

      // Emit signed_in event so services depending on auth can react after init
      try {
        const { events } = await import("@/utils/events");
        events.emit("auth:signed_in", { userId: user.id });
      } catch (err) {
        logger.warn("authThunks: failed to emit auth:signed_in during initializeAuth", err, "auth");
      }

      return {
        user: user,
        session,
      };
    } catch (error: any) {
      logger.error("authThunks: Authentication initialization error", error, "auth");

      // Clear potentially corrupted tokens
      try {
        await tokenManager.clearTokens();
      } catch (clearError) {
        logger.error("authThunks: Failed to clear tokens during init error", clearError, "auth");
      }

      return rejectWithValue({
        code: "INIT_ERROR",
        message: error.message || "Authentication initialization failed",
        type: "network",
      });
    }
  }
);

/**
 * Reset user password
 */
export const resetPassword = createAsyncThunk<ResetPasswordResult, string, { rejectValue: AuthError }>(
  "auth/resetPassword",
  async (email, { rejectWithValue }) => {
    try {
      logger.info("authThunks: Password reset attempt", { email }, "auth");

      const result = await authService.resetPassword({ email });

      if (!result.success) {
        logger.error("authThunks: Password reset failed", result.error, "auth");
        return rejectWithValue(
          result.error || {
            code: "PASSWORD_RESET_FAILED",
            message: "Password reset failed",
            type: "auth",
          }
        );
      }

      logger.info("authThunks: Password reset successful", { email }, "auth");

      return {
        success: true,
      };
    } catch (error: any) {
      logger.error("authThunks: Password reset error", error, "auth");
      return rejectWithValue({
        code: "PASSWORD_RESET_ERROR",
        message: error.message || "Password reset failed",
        type: "network",
      });
    }
  }
);
