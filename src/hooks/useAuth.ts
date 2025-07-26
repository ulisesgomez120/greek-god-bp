// ============================================================================
// USE AUTH HOOK
// ============================================================================
// Authentication hook with loading states, error management, and automatic
// token refresh handling for React components

import { useEffect, useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "./redux";
import { authService } from "@/services/auth.service";
import { logger } from "@/utils/logger";
import { getTokens, areTokensExpired } from "@/utils/storage";
import type {
  UseAuthReturn,
  LoginCredentials,
  SignupData,
  PasswordResetRequest,
  EmailVerificationRequest,
  ProfileUpdateRequest,
  AuthResponse,
  AuthLoadingStates,
  Session,
} from "@/types/auth";
import {
  initializeAuth,
  loginUser,
  signupUser,
  logoutUser,
  refreshTokens,
  resetPassword,
  clearError,
  updateUserProfile,
  setLoading,
} from "@/store/auth/authSlice";

// ============================================================================
// USE AUTH HOOK
// ============================================================================

export function useAuth(): UseAuthReturn {
  const dispatch = useAppDispatch();

  // Select auth state from Redux store
  const { isAuthenticated, user, session, loading: globalLoading, error } = useAppSelector((state) => state.auth);

  // Create detailed loading states
  const loading: AuthLoadingStates = useMemo(
    () => ({
      login: globalLoading,
      signup: globalLoading,
      logout: globalLoading,
      refresh: false, // Token refresh happens in background
      passwordReset: globalLoading,
      emailVerification: globalLoading,
      profileUpdate: globalLoading,
      initialization: globalLoading,
    }),
    [globalLoading]
  );

  // ============================================================================
  // AUTHENTICATION ACTIONS
  // ============================================================================

  /**
   * Login user with credentials
   */
  const login = useCallback(
    async (credentials: LoginCredentials): Promise<AuthResponse> => {
      try {
        logger.info("useAuth: Login attempt", { email: credentials.email }, "auth");

        const result = await dispatch(loginUser(credentials) as any).unwrap();

        if (result.user && result.session) {
          logger.info("useAuth: Login successful", { userId: result.user.id }, "auth", result.user.id);
          return {
            success: true,
            user: result.user,
            session: result.session,
            message: "Login successful",
          };
        } else {
          logger.error("useAuth: Login failed - no user/session data", undefined, "auth");
          return {
            success: false,
            error: {
              code: "LOGIN_FAILED",
              message: "Login failed",
              type: "auth",
            },
          };
        }
      } catch (error: any) {
        logger.error("useAuth: Login error", error, "auth");
        return {
          success: false,
          error: {
            code: "LOGIN_ERROR",
            message: error.message || "Login failed",
            type: "network",
          },
        };
      }
    },
    [dispatch]
  );

  /**
   * Sign up new user
   */
  const signup = useCallback(
    async (data: SignupData): Promise<AuthResponse> => {
      try {
        logger.info("useAuth: Signup attempt", { email: data.email }, "auth");

        const result = await dispatch(signupUser(data) as any).unwrap();

        if (result.user) {
          logger.info(
            "useAuth: Signup successful",
            {
              userId: result.user.id,
              requiresConfirmation: result.requiresEmailConfirmation,
            },
            "auth",
            result.user.id
          );

          return {
            success: true,
            user: result.user,
            session: result.session,
            requiresEmailConfirmation: result.requiresEmailConfirmation,
            message: "Account created successfully",
          };
        } else {
          logger.error("useAuth: Signup failed - no user data", undefined, "auth");
          return {
            success: false,
            error: {
              code: "SIGNUP_FAILED",
              message: "Signup failed",
              type: "auth",
            },
          };
        }
      } catch (error: any) {
        logger.error("useAuth: Signup error", error, "auth");
        return {
          success: false,
          error: {
            code: "SIGNUP_ERROR",
            message: error.message || "Signup failed",
            type: "network",
          },
        };
      }
    },
    [dispatch]
  );

  /**
   * Logout user
   */
  const logout = useCallback(async (): Promise<AuthResponse> => {
    try {
      logger.info("useAuth: Logout attempt", undefined, "auth");

      await dispatch(logoutUser() as any).unwrap();

      logger.info("useAuth: Logout successful", undefined, "auth");
      return {
        success: true,
        user: null,
        session: null,
        message: "Logged out successfully",
      };
    } catch (error: any) {
      logger.error("useAuth: Logout error", error, "auth");
      // Even if logout fails, we should clear local state
      return {
        success: false,
        error: {
          code: "LOGOUT_ERROR",
          message: error.message || "Logout failed",
          type: "network",
        },
      };
    }
  }, [dispatch]);

  /**
   * Refresh authentication session
   */
  const refreshSession = useCallback(async (): Promise<AuthResponse> => {
    try {
      logger.info("useAuth: Session refresh attempt", undefined, "auth");

      const result = await dispatch(refreshTokens() as any).unwrap();

      if (result.user && result.session) {
        logger.info("useAuth: Session refresh successful", { userId: result.user.id }, "auth", result.user.id);
        return {
          success: true,
          user: result.user,
          session: result.session,
          message: "Session refreshed successfully",
        };
      } else {
        logger.error("useAuth: Session refresh failed - no user/session data", undefined, "auth");
        return {
          success: false,
          error: {
            code: "REFRESH_FAILED",
            message: "Session refresh failed",
            type: "auth",
          },
        };
      }
    } catch (error: any) {
      logger.error("useAuth: Session refresh error", error, "auth");
      return {
        success: false,
        error: {
          code: "REFRESH_ERROR",
          message: error.message || "Session refresh failed",
          type: "network",
        },
      };
    }
  }, [dispatch]);

  /**
   * Reset user password
   */
  const resetPasswordAction = useCallback(
    async (request: PasswordResetRequest): Promise<AuthResponse> => {
      try {
        logger.info("useAuth: Password reset attempt", { email: request.email }, "auth");

        await dispatch(resetPassword(request.email) as any).unwrap();

        logger.info("useAuth: Password reset successful", { email: request.email }, "auth");
        return {
          success: true,
          user: null,
          session: null,
          message: "Password reset email sent successfully",
        };
      } catch (error: any) {
        logger.error("useAuth: Password reset error", error, "auth");
        return {
          success: false,
          error: {
            code: "PASSWORD_RESET_ERROR",
            message: error.message || "Password reset failed",
            type: "network",
          },
        };
      }
    },
    [dispatch]
  );

  /**
   * Resend email verification
   */
  const resendEmailVerification = useCallback(async (request: EmailVerificationRequest): Promise<AuthResponse> => {
    try {
      logger.info("useAuth: Email verification resend attempt", { email: request.email }, "auth");

      const result = await authService.resendEmailVerification(request);

      if (result.success) {
        logger.info("useAuth: Email verification resend successful", { email: request.email }, "auth");
      } else {
        logger.error("useAuth: Email verification resend failed", result.error, "auth");
      }

      return result;
    } catch (error: any) {
      logger.error("useAuth: Email verification resend error", error, "auth");
      return {
        success: false,
        error: {
          code: "EMAIL_VERIFICATION_ERROR",
          message: error.message || "Failed to resend verification email",
          type: "network",
        },
      };
    }
  }, []);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(
    async (data: ProfileUpdateRequest): Promise<AuthResponse> => {
      try {
        logger.info("useAuth: Profile update attempt", { userId: user?.id }, "auth", user?.id);

        // Update profile in Redux store
        dispatch(updateUserProfile(data as any));

        // TODO: Implement server-side profile update when backend is ready
        // For now, we just update the local state

        logger.info("useAuth: Profile update successful", { userId: user?.id }, "auth", user?.id);
        return {
          success: true,
          user,
          session,
          message: "Profile updated successfully",
        };
      } catch (error: any) {
        logger.error("useAuth: Profile update error", error, "auth", user?.id);
        return {
          success: false,
          error: {
            code: "PROFILE_UPDATE_ERROR",
            message: error.message || "Profile update failed",
            type: "network",
          },
        };
      }
    },
    [dispatch, user, session]
  );

  /**
   * Clear authentication error
   */
  const clearAuthError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Check if current token is expired
   */
  const isTokenExpired = useCallback(async (): Promise<boolean> => {
    try {
      return await areTokensExpired();
    } catch (error) {
      logger.error("useAuth: Error checking token expiration", error, "auth");
      return true; // Assume expired on error
    }
  }, []);

  /**
   * Get token expiration time
   */
  const getTokenExpirationTime = useCallback(async (): Promise<Date | null> => {
    try {
      const tokens = await getTokens();
      if (!tokens?.expiresAt) return null;

      return new Date(tokens.expiresAt);
    } catch (error) {
      logger.error("useAuth: Error getting token expiration time", error, "auth");
      return null;
    }
  }, []);

  /**
   * Check if user has specific permission
   * TODO: Implement role-based permissions when backend is ready
   */
  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!isAuthenticated || !user) return false;

      // For now, return true for authenticated users
      // This will be expanded when we implement role-based access control
      return true;
    },
    [isAuthenticated, user]
  );

  // ============================================================================
  // INITIALIZATION EFFECT
  // ============================================================================

  /**
   * Initialize authentication state on hook mount
   */
  useEffect(() => {
    let isMounted = true;
    let hasInitialized = false;

    const initializeAuthentication = async () => {
      try {
        // Prevent multiple initializations
        if (hasInitialized) {
          return;
        }
        hasInitialized = true;

        logger.info("useAuth: Initializing authentication", undefined, "auth");

        // Initialize auth state from stored tokens
        const result = await dispatch(initializeAuth() as any).unwrap();

        if (isMounted) {
          if (result.user && result.session) {
            logger.info(
              "useAuth: Authentication initialized successfully",
              { userId: result.user.id },
              "auth",
              result.user.id
            );
          } else {
            logger.info("useAuth: No valid session found", undefined, "auth");
          }
        }
      } catch (error) {
        if (isMounted) {
          logger.error("useAuth: Authentication initialization failed", error, "auth");
        }
      }
    };

    initializeAuthentication();

    return () => {
      isMounted = false;
    };
  }, [dispatch]); // Only depend on dispatch to prevent infinite loop

  // ============================================================================
  // AUTOMATIC TOKEN REFRESH
  // ============================================================================

  /**
   * Set up automatic token refresh
   */
  useEffect(() => {
    if (!isAuthenticated || !session) return;

    const checkAndRefreshToken = async () => {
      try {
        const expired = await areTokensExpired();
        if (expired) {
          logger.info("useAuth: Token expired, attempting refresh", undefined, "auth");
          await refreshSession();
        }
      } catch (error) {
        logger.error("useAuth: Error in automatic token refresh", error, "auth");
      }
    };

    // Check token expiration every 5 minutes
    const interval = setInterval(checkAndRefreshToken, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isAuthenticated, session, refreshSession]);

  // ============================================================================
  // RETURN HOOK INTERFACE
  // ============================================================================

  return {
    // State
    isAuthenticated,
    user,
    session,
    loading,
    error: error || null,
    isInitialized: !loading.initialization,

    // Actions
    login,
    signup,
    logout,
    refreshSession,
    resetPassword: resetPasswordAction,
    resendEmailVerification,
    updateProfile,
    clearError: clearAuthError,

    // Utilities
    isTokenExpired,
    getTokenExpirationTime,
    hasPermission,
  };
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default useAuth;
