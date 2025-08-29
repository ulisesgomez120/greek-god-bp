// ============================================================================
// USE AUTH HOOK
// ============================================================================
// Authentication hook with loading states, error management, and automatic
// token refresh handling for React components

import { useEffect, useCallback, useMemo } from "react";
import { getAuthenticatedClient } from "@/lib/supabase";
import { useAppDispatch, useAppSelector } from "./redux";
import { authService } from "@/services/auth.service";
import { profileService } from "@/services/profile.service";
import { logger } from "@/utils/logger";
import { getTokens, areTokensExpired } from "@/utils/storage";
import { ENV_CONFIG } from "@/config/constants";
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
  selectIsAuthenticated,
  selectUser,
  selectSession,
  selectAuthLoading,
  selectAuthError,
  selectHasBeenInitialized,
  selectIsInitializing,
} from "@/store/auth/authSlice";
import store from "@/store";
import { syncAuthState } from "@/utils/authValidation";

// ============================================================================
// USE AUTH HOOK
// ============================================================================

export function useAuth(): UseAuthReturn {
  const dispatch = useAppDispatch();

  // Select auth state from Redux store using stable selectors
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectUser);
  const session = useAppSelector(selectSession);
  const globalLoading = useAppSelector(selectAuthLoading);
  const error = useAppSelector(selectAuthError);
  const isInitializing = useAppSelector(selectIsInitializing);
  const hasBeenInitialized = useAppSelector(selectHasBeenInitialized);

  // Create stable loading states - memoize to prevent unnecessary rerenders
  const loading: AuthLoadingStates = useMemo(
    () => ({
      login: globalLoading,
      signup: globalLoading,
      logout: globalLoading,
      refresh: false, // Token refresh happens in background
      passwordReset: globalLoading,
      emailVerification: globalLoading,
      profileUpdate: globalLoading,
      initialization: isInitializing,
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
  const resendEmailVerification = async (request: EmailVerificationRequest): Promise<AuthResponse> => {
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
  };

  /**
   * Update user profile
   */
  const updateProfile = useCallback(
    async (data: ProfileUpdateRequest): Promise<AuthResponse> => {
      try {
        if (!user?.id) {
          logger.error("useAuth: Profile update failed - no user ID", undefined, "auth");
          return {
            success: false,
            error: {
              code: "NO_USER_ID",
              message: "User ID not available",
              type: "auth",
            },
          };
        }

        // Ensure a profile already exists. If missing, attempt client-side creation
        // for users with verified emails (fallback in case creation didn't occur earlier).
        const existingProfileResp = await profileService.getProfile(user.id, false);

        if (!existingProfileResp.success || !existingProfileResp.data) {
          logger.warn(
            "useAuth: Profile not found during update; attempting auto-create where possible",
            existingProfileResp.error,
            "auth",
            user.id
          );

          const isEmailConfirmed = !!(user as any).email_confirmed_at || !!user.user_metadata?.email_confirmed_at;

          if (!isEmailConfirmed) {
            logger.error(
              "useAuth: Profile not found and email not verified; blocking update",
              existingProfileResp.error,
              "auth",
              user.id
            );
            return {
              success: false,
              error: {
                code: "PROFILE_NOT_FOUND",
                message:
                  "User profile not found. Profiles are created automatically after email verification; please verify your email and reauthenticate.",
                type: "auth",
              },
            };
          }

          // Build minimal profile payload from available user metadata
          // Normalize/trim and provide safe fallbacks so validation doesn't fail.
          let displayNameCandidate =
            (user.user_metadata && (user.user_metadata.display_name || user.user_metadata.displayName)) ||
            (user as any).raw_user_meta_data?.display_name ||
            "";

          // Normalize and trim
          displayNameCandidate = (displayNameCandidate || "").toString().trim();

          // If displayName is missing or too short, derive from email local-part or fallback to user id
          if (!displayNameCandidate || displayNameCandidate.length < 2) {
            const emailLocal = (user.email || "").split("@")[0] || "";
            if (emailLocal && emailLocal.length >= 2) {
              displayNameCandidate = emailLocal;
            } else if (user.email && user.email.length >= 2) {
              displayNameCandidate = user.email;
            } else {
              displayNameCandidate = `user-${(user.id || "").slice(0, 8)}`;
            }

            logger.warn(
              "useAuth: displayName missing/too-short during auto-create; using fallback",
              { userId: user.id, chosenDisplayName: displayNameCandidate },
              "auth",
              user.id
            );
          }

          const profilePayload = {
            email: user.email || "",
            displayName: displayNameCandidate,
            experienceLevel:
              (user.user_metadata && (user.user_metadata.experience_level || user.user_metadata.experienceLevel)) ||
              "untrained",
          };

          // Keep a lightweight info log for production (avoid logging user payloads)
          logger.info("useAuth: auto-create profile payload prepared", { userId: user.id }, "auth", user.id);

          try {
            const authenticatedClient = getAuthenticatedClient(session?.accessToken);
            const createResp = await profileService.createProfile(user.id, profilePayload as any, authenticatedClient);

            if (createResp.success && createResp.data) {
              logger.info("useAuth: Auto-created profile during update", { userId: user.id }, "auth", user.id);
            } else {
              logger.error("useAuth: Auto-create profile failed during update", createResp.error, "auth", user.id);
              return {
                success: false,
                error: {
                  code: "PROFILE_CREATE_FAILED",
                  message: createResp.error?.message || "Failed to create user profile",
                  type: "network",
                },
              };
            }
          } catch (createErr) {
            logger.error("useAuth: Exception while auto-creating profile during update", createErr, "auth", user.id);
            return {
              success: false,
              error: {
                code: "PROFILE_CREATE_ERROR",
                message: "Failed to create user profile",
                type: "network",
              },
            };
          }
        }

        // Prepare update payload mapping from ProfileUpdateRequest to ProfileEditData
        const updates: any = {};
        if (data.displayName !== undefined) updates.displayName = data.displayName;
        if (data.heightCm !== undefined) updates.heightCm = data.heightCm;
        if (data.weightKg !== undefined) updates.weightKg = data.weightKg;
        if (data.experienceLevel !== undefined) updates.experienceLevel = data.experienceLevel;
        if (data.fitnessGoals !== undefined) updates.fitnessGoals = data.fitnessGoals;

        // Use ProfileService.updateProfile for onboarding edits (no creation)
        const response = await profileService.updateProfile(user.id, updates, { optimistic: true });

        if (!response.success || !response.data) {
          logger.error("useAuth: Profile update failed", response.error, "auth", user.id);
          return {
            success: false,
            error: {
              code: "PROFILE_UPDATE_FAILED",
              message: response.error?.message || "Failed to update profile",
              type: "network",
            },
          };
        }

        // Sync display name and experience level in user metadata (do NOT mark onboarding as complete here)
        const updatedUser = {
          ...user,
          user_metadata: {
            ...user.user_metadata,
            display_name: response.data.displayName,
            experience_level: response.data.experienceLevel,
          },
        };

        // Update profile in Redux store with the updated user metadata
        dispatch(updateUserProfile(updatedUser as any));

        logger.info("useAuth: Profile updated successfully", { userId: user.id }, "auth", user.id);
        return {
          success: true,
          user: updatedUser,
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
   * Complete onboarding - persist onboarding_completed = true to the canonical profile row,
   * then update auth user metadata and Redux store to reflect the canonical state.
   *
   * This ensures the "You're All Set!" screen remains visible until the DB confirms completion.
   */
  const completeOnboarding = useCallback(async (): Promise<AuthResponse> => {
    try {
      if (!user?.id) {
        logger.error("useAuth: completeOnboarding failed - no user ID", undefined, "auth");
        return {
          success: false,
          error: {
            code: "NO_USER_ID",
            message: "User ID not available",
            type: "auth",
          },
        };
      }

      logger.info("useAuth: completeOnboarding attempt", { userId: user.id }, "auth", user.id);

      // Use an authenticated client to avoid RLS permission issues when writing the profile row
      const authenticatedClient = getAuthenticatedClient(session?.accessToken);

      // Persist canonical onboarding flag to DB. We purposely skip optimistic updates here so
      // the "complete" screen remains until the DB confirms completion.
      const resp = await profileService.updateProfile(
        user.id,
        { onboardingCompleted: true } as any,
        { optimistic: false, skipValidation: true },
        authenticatedClient
      );

      if (!resp.success || !resp.data) {
        logger.error("useAuth: completeOnboarding failed", resp.error, "auth", user.id);
        return {
          success: false,
          error: {
            code: "ONBOARDING_COMPLETE_FAILED",
            message: resp.error?.message || "Failed to complete onboarding",
            type: "network",
          },
        };
      }

      // Update auth user metadata to reflect canonical DB state
      const updatedUser = {
        ...user,
        user_metadata: {
          ...user.user_metadata,
          onboarding_complete: true,
          display_name: resp.data.displayName,
          experience_level: resp.data.experienceLevel,
        },
      };

      // Update profile in Redux store with the updated user metadata
      dispatch(updateUserProfile(updatedUser as any));

      logger.info("useAuth: completeOnboarding succeeded", { userId: user.id }, "auth", user.id);
      return {
        success: true,
        user: updatedUser,
        session,
        message: "Onboarding completed successfully",
      };
    } catch (error: any) {
      logger.error("useAuth: completeOnboarding error", error, "auth", user?.id);
      return {
        success: false,
        error: {
          code: "ONBOARDING_COMPLETE_ERROR",
          message: error.message || "Failed to complete onboarding",
          type: "network",
        },
      };
    }
  }, [dispatch, user, session]);

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
  const isTokenExpired = async (): Promise<boolean> => {
    try {
      return await areTokensExpired();
    } catch (error) {
      logger.error("useAuth: Error checking token expiration", error, "auth");
      return true; // Assume expired on error
    }
  };

  /**
   * Get token expiration time
   */
  const getTokenExpirationTime = async (): Promise<Date | null> => {
    try {
      const tokens = await getTokens();
      if (!tokens?.expiresAt) return null;

      return new Date(tokens.expiresAt);
    } catch (error) {
      logger.error("useAuth: Error getting token expiration time", error, "auth");
      return null;
    }
  };

  /**
   * Check if user has specific permission
   * TODO: Implement role-based permissions when backend is ready
   */
  const hasPermission = (permission: string): boolean => {
    if (!isAuthenticated || !user) return false;

    // For now, return true for authenticated users
    // This will be expanded when we implement role-based access control
    return true;
  };

  // ============================================================================
  // INITIALIZATION EFFECT
  // ============================================================================

  /**
   * Initialize authentication state on hook mount
   * Only runs once when the hook is first mounted
   */
  useEffect(() => {
    let isMounted = true;

    const initializeAuthentication = async () => {
      try {
        // Prevent initializing if another initialization has already run or is running
        if (hasBeenInitialized || isInitializing) {
          logger.info("useAuth: Initialization already in progress or completed, skipping", undefined, "auth");
          return;
        }

        logger.info("useAuth: Initializing authentication", undefined, "auth");

        // Ensure local client + Redux auth state are in sync before initialization.
        // This will attempt a token refresh if necessary and force logout on failure.
        try {
          await syncAuthState(store);
        } catch (err) {
          logger.warn("useAuth: syncAuthState failed", err, "auth");
        }

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
          // Don't log "already in progress" as an error
          if (error !== "Initialization already in progress") {
            logger.error("useAuth: Authentication initialization failed", error, "auth");
          }
        }
      }
    };

    // Only initialize once globally (do not re-run per-hook)
    if (!hasBeenInitialized && !isInitializing && !error) {
      initializeAuthentication();
    }

    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array - only run once on mount

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

  // Return hook interface - simplified memoization to prevent cascade rerenders
  return useMemo(
    () => ({
      // State
      isAuthenticated,
      user,
      session,
      loading,
      error: error || null,
      // Consider the stable "hasBeenInitialized" flag so once initialization
      // has completed we don't flip back to false if a brief re-init occurs.
      isInitialized: hasBeenInitialized || !loading.initialization,

      // Actions
      login,
      signup,
      logout,
      refreshSession,
      resetPassword: resetPasswordAction,
      resendEmailVerification,
      updateProfile,
      completeOnboarding,
      clearError: clearAuthError,

      // Utilities
      isTokenExpired,
      getTokenExpirationTime,
      hasPermission,
    }),
    [
      // Simplified dependencies - only core state that should trigger rerenders
      isAuthenticated,
      user,
      session,
      loading,
      error,
      hasBeenInitialized,
      // Stable functions - these shouldn't change unless dispatch changes
      login,
      signup,
      logout,
      refreshSession,
      resetPasswordAction,
      updateProfile,
      completeOnboarding,
      clearAuthError,
    ]
  );
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default useAuth;
