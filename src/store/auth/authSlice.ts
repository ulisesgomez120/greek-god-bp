// ============================================================================
// AUTHENTICATION SLICE
// ============================================================================
// Authentication state management with secure token handling,
// user profile management, and session persistence

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { ENV_CONFIG } from "../../config/constants";
import { getAuthenticatedClient } from "@/lib/supabase";
import { logger } from "../../utils/logger";
import { profileService } from "../../services/profile.service";
import type { UserProfile, Session, AuthState, LoginCredentials, SignupData } from "../../types/auth";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  session: null,
  loading: false,
  error: undefined,
  isInitialized: false,
  // Stable initialization flags to prevent re-initialization/remount cycles
  hasBeenInitialized: false,
  isInitializing: false,
};

// Global flag to prevent multiple concurrent initializations
let isInitializationInProgress = false;

import supabase from "@/lib/supabase";
import tokenManager from "@/utils/tokenManager";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Merge user profile data from database with Supabase user metadata
 */
async function mergeUserWithProfile(user: SupabaseUser, accessToken?: string): Promise<SupabaseUser> {
  try {
    let profileResult;

    if (accessToken) {
      // Use cached/shared authenticated client to avoid creating multiple GoTrueClient instances
      const authenticatedClient = getAuthenticatedClient(accessToken);

      // Use authenticated client to fetch profile
      const { data, error } = await authenticatedClient.from("user_profiles").select("*").eq("id", user.id).single();

      if (error) {
        profileResult = {
          success: false,
          error: {
            code: "PROFILE_FETCH_FAILED",
            message: "Failed to fetch user profile",
            details: error,
          },
        };
      } else if (data) {
        // Transform database row to UserProfile format
        const profile = {
          id: data.id,
          email: data.email,
          displayName: data.display_name,
          avatarUrl: data.avatar_url || undefined,
          heightCm: data.height_cm || undefined,
          weightKg: data.weight_kg ? Number(data.weight_kg) : undefined,
          birthDate: data.birth_date || undefined,
          gender: data.gender || undefined,
          experienceLevel: data.experience_level,
          fitnessGoals: data.fitness_goals || [],
          availableEquipment: data.available_equipment || [],
          privacySettings: data.privacy_settings || {},
          role: data.role || "user",
          stripeCustomerId: data.stripe_customer_id || undefined,
          onboardingCompleted: data.onboarding_completed || false,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };

        profileResult = { success: true, data: profile };
      } else {
        // Profile missing - attempt client-side creation if email is verified.
        profileResult = {
          success: false,
          error: {
            code: "PROFILE_NOT_FOUND",
            message: "User profile not found",
          },
        };

        try {
          const isEmailConfirmed =
            !!(user as any).email_confirmed_at ||
            !!(user as any).confirmed_at ||
            !!user.user_metadata?.email_confirmed_at;

          if (isEmailConfirmed) {
            logger.info(
              "Profile missing for verified user - attempting to create profile",
              { userId: user.id },
              "auth"
            );

            // Build minimal profile payload from available user metadata
            let displayNameCandidate =
              (user.user_metadata && (user.user_metadata.display_name || user.user_metadata.displayName)) ||
              (user as any).raw_user_meta_data?.display_name ||
              "";

            // Normalize and trim candidate
            displayNameCandidate = (displayNameCandidate || "").toString().trim();

            // If displayName is missing or too short, try deriving from email local-part
            if (!displayNameCandidate || displayNameCandidate.length < 2) {
              const emailLocal = (user.email || "").split("@")[0] || "";
              if (emailLocal && emailLocal.length >= 2) {
                displayNameCandidate = emailLocal;
              } else if (user.email && user.email.length >= 2) {
                // fallback to entire email if it meets length requirement
                displayNameCandidate = user.email;
              } else {
                // last-resort fallback using user id
                displayNameCandidate = `user-${(user.id || "").slice(0, 8)}`;
              }

              logger.warn(
                "mergeUserWithProfile: displayName was missing/too-short — using fallback",
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

            // Use authenticated client to create profile so RLS allows it
            const createResult = await profileService.createProfile(
              user.id,
              profilePayload as any,
              authenticatedClient
            );

            if (createResult.success && createResult.data) {
              logger.info("Auto-created user profile successfully", { userId: user.id }, "auth", user.id);
              profileResult = { success: true, data: createResult.data };
            } else {
              logger.warn(
                "Auto-create profile attempt failed",
                {
                  userId: user.id,
                  errorMessage: createResult.error?.message,
                  errorDetails: createResult.error?.details,
                },
                "auth",
                user.id
              );
              // keep PROFILE_NOT_FOUND result — caller will handle it gracefully
            }
          } else {
            logger.info("Profile missing but email not verified; skipping auto-create", { userId: user.id }, "auth");
          }
        } catch (createErr) {
          logger.error("Error attempting to auto-create user profile", createErr, "auth", user.id);
          // Don't throw — fail gracefully and let caller handle absence of profile
        }
      }
    } else {
      // Fallback to profile service (less reliable due to RLS)
      profileResult = await profileService.getProfile(user.id, false);
    }

    if (profileResult.success && profileResult.data) {
      const profile = profileResult.data;

      // Merge profile data into user metadata
      const mergedUser = {
        ...user,
        user_metadata: {
          ...user.user_metadata,
          onboarding_complete: profile.onboardingCompleted,
          display_name: profile.displayName,
          experience_level: profile.experienceLevel,
        },
      };

      logger.debug(
        "User profile merged with auth data",
        {
          userId: user.id,
          onboardingComplete: profile.onboardingCompleted,
        },
        "auth",
        user.id
      );

      return mergedUser;
    } else {
      logger.warn(
        "Could not fetch user profile, using auth data only",
        {
          userId: user.id,
          error: profileResult.error?.message,
        },
        "auth",
        user.id
      );

      return user;
    }
  } catch (error) {
    logger.error("Error merging user profile with auth data", error, "auth", user.id);
    return user;
  }
}

// ============================================================================
// ASYNC THUNKS
// ============================================================================

/**
 * Initialize authentication state from stored tokens
 */
export const initializeAuth = createAsyncThunk("auth/initialize", async (_, { rejectWithValue, getState }) => {
  try {
    // Prevent multiple concurrent initializations
    if (isInitializationInProgress) {
      logger.info("Authentication initialization already in progress, skipping", undefined, "auth");
      return rejectWithValue("Initialization already in progress");
    }

    // Check if already initialized (use stable flag to avoid re-initialization)
    const state = getState() as any;
    if (state.auth.isInitialized || state.auth.hasBeenInitialized) {
      logger.info("Authentication already initialized or completed previously, skipping", undefined, "auth");
      return { user: state.auth.user, session: state.auth.session };
    }

    isInitializationInProgress = true;
    logger.info("Initializing authentication state", undefined, "auth");

    // Prefer TokenManager as the canonical source of truth for token storage and refresh.
    const tokens = await tokenManager.getTokens();
    if (!tokens) {
      logger.info("No stored tokens found", undefined, "auth");
      return { user: null, session: null };
    }

    // Try to read current session from Supabase shared client.
    let {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    // If no session available, delegate refresh to TokenManager (network-aware + retries).
    if (!session) {
      logger.info("No active Supabase session; delegating refresh to TokenManager", undefined, "auth");
      await tokenManager.refreshTokensIfOnline();

      // Attempt to read session again after TokenManager refresh attempt.
      const {
        data: { session: refreshedSession },
        error: refreshedError,
      } = await supabase.auth.getSession();

      session = refreshedSession;
      sessionError = refreshedError;
    }

    if (!session) {
      // Do not clear tokens here; TokenManager will classify errors and clear only for permanent failures.
      logger.info("No valid session after TokenManager refresh; leaving tokens intact for now", undefined, "auth");
      return { user: null, session: null };
    }

    // Ensure we have a valid user before proceeding
    if (!session.user) {
      logger.error("Session available but no user returned", undefined, "auth");
      return { user: null, session: null };
    }

    // Merge user with profile data from database
    const mergedUser = await mergeUserWithProfile(session.user, session.access_token);

    // Make sure TokenManager knows about these tokens and schedules refresh timers/re-hydration
    try {
      await tokenManager.storeTokens({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: new Date(session.expires_at! * 1000).toISOString(),
      });
    } catch (storeErr) {
      // Non-fatal: log and continue — TokenManager may already have the tokens
      logger.warn("Failed to store tokens into TokenManager during initialization", storeErr, "auth");
    }

    logger.info("Authentication initialized successfully", undefined, "auth", session.user.id);

    return {
      user: mergedUser,
      session: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: new Date(session.expires_at! * 1000).toISOString(),
        user: mergedUser,
      },
    };
  } catch (error) {
    logger.error("Authentication initialization failed", error, "auth");
    // Delegate token clearing to TokenManager (it handles error classification)
    try {
      await tokenManager.clearTokens();
    } catch (err) {
      logger.warn("Failed to clear tokens during initialization failure handling", err, "auth");
    }
    return rejectWithValue("Failed to initialize authentication");
  } finally {
    isInitializationInProgress = false;
  }
});

/**
 * Login user with email and password
 */
export const loginUser = createAsyncThunk("auth/login", async (credentials: LoginCredentials, { rejectWithValue }) => {
  try {
    logger.info("Attempting user login", { email: credentials.email }, "auth");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      logger.error("Login failed", error, "auth");
      return rejectWithValue(error.message);
    }

    if (!data.user || !data.session) {
      logger.error("Login succeeded but no user/session data returned", undefined, "auth");
      return rejectWithValue("Login failed: No user data returned");
    }

    // Store tokens securely
    await tokenManager.storeTokens({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
    });

    // Merge user with profile data from database
    const mergedUser = await mergeUserWithProfile(data.user, data.session.access_token);

    logger.info("User logged in successfully", { userId: data.user.id }, "auth", data.user.id);

    return {
      user: mergedUser,
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
        user: mergedUser,
      },
    };
  } catch (error) {
    logger.error("Login error", error, "auth");
    return rejectWithValue("Login failed");
  }
});

/**
 * Sign up new user
 */
export const signupUser = createAsyncThunk("auth/signup", async (signupData: SignupData, { rejectWithValue }) => {
  try {
    logger.info("Attempting user signup", { email: signupData.email }, "auth");

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
      return rejectWithValue(error.message);
    }

    if (!data.user) {
      logger.error("Signup succeeded but no user data returned", undefined, "auth");
      return rejectWithValue("Signup failed: No user data returned");
    }

    // If session is available (email confirmation not required), store tokens
    if (data.session) {
      await tokenManager.storeTokens({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
      });

      // Attempt to merge/create profile for the newly signed-up user using the active session.
      // This ensures users who are auto-signed-in after signup get a profile created when appropriate.
      let returnedUser = data.user;
      try {
        const merged = await mergeUserWithProfile(data.user, data.session.access_token);
        returnedUser = merged || data.user;
      } catch (mergeErr) {
        logger.warn(
          "Failed to merge/create profile after signup; continuing with auth state",
          mergeErr,
          "auth",
          data.user.id
        );
      }

      logger.info("User signed up and logged in successfully", { userId: data.user.id }, "auth", data.user.id);

      return {
        user: returnedUser,
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
          user: returnedUser,
        },
      };
    } else {
      // Email confirmation required
      logger.info("User signed up, email confirmation required", { userId: data.user.id }, "auth", data.user.id);

      return {
        user: data.user,
        session: null,
        requiresEmailConfirmation: true,
      };
    }
  } catch (error) {
    logger.error("Signup error", error, "auth");
    return rejectWithValue("Signup failed");
  }
});

/**
 * Logout user
 */
export const logoutUser = createAsyncThunk("auth/logout", async (_, { rejectWithValue }) => {
  try {
    logger.info("Attempting user logout", undefined, "auth");

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.warn("Supabase logout failed, but continuing with local cleanup", error, "auth");
    }

    // Clear stored tokens
    await tokenManager.clearTokens();

    logger.info("User logged out successfully", undefined, "auth");

    return null;
  } catch (error) {
    logger.error("Logout error", error, "auth");
    // Even if logout fails, clear local tokens
    await tokenManager.clearTokens();
    return rejectWithValue("Logout failed");
  }
});

/**
 * Refresh authentication tokens
 */
export const refreshTokens = createAsyncThunk("auth/refreshTokens", async (_, { rejectWithValue, getState }) => {
  try {
    const state = getState() as any;
    const currentUser = state.auth.user;

    // Preserve existing user metadata before refresh
    const existingUserMetadata = currentUser?.user_metadata || {};

    logger.info("Refreshing authentication tokens via TokenManager", undefined, "auth");

    // Delegate canonical refresh to TokenManager (network-aware + retry/backoff)
    const tokens = await tokenManager.refreshTokensIfOnline();

    if (!tokens) {
      logger.warn(
        "TokenManager: refresh did not return tokens (refresh may have failed or been skipped)",
        undefined,
        "auth"
      );
      return rejectWithValue("Token refresh failed");
    }

    // After TokenManager stores tokens, Supabase client session should be rehydrated.
    // Read back the session from the shared Supabase client.
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      logger.error("Failed to read session from Supabase after TokenManager refresh", sessionError, "auth");
      return rejectWithValue("Token refresh failed: no session");
    }

    // Ensure we have a valid user before proceeding
    if (!session.user) {
      logger.error("Token refresh succeeded but no user data returned in session", undefined, "auth");
      return rejectWithValue("Token refresh failed: No user data returned");
    }

    // Merge existing user metadata with refreshed user data
    const mergedUser = {
      ...session.user,
      user_metadata: {
        ...existingUserMetadata, // Preserve existing metadata
        ...session.user.user_metadata, // Allow server-side updates if any
      },
    };

    logger.info("Tokens refreshed successfully (via TokenManager)", undefined, "auth", session.user.id);

    return {
      user: mergedUser,
      session: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: new Date(session.expires_at! * 1000).toISOString(),
        user: mergedUser,
      },
    };
  } catch (error) {
    logger.error("Token refresh error", error, "auth");
    // Do not aggressively clear tokens here; TokenManager handles permanent error clearing.
    return rejectWithValue("Token refresh failed");
  }
});

/**
 * Reset password
 */
export const resetPassword = createAsyncThunk("auth/resetPassword", async (email: string, { rejectWithValue }) => {
  try {
    logger.info("Attempting password reset", { email }, "auth");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${ENV_CONFIG.apiUrl}/auth/reset-password`,
    });

    if (error) {
      logger.error("Password reset failed", error, "auth");
      return rejectWithValue(error.message);
    }

    logger.info("Password reset email sent successfully", { email }, "auth");
    return { success: true };
  } catch (error) {
    logger.error("Password reset error", error, "auth");
    return rejectWithValue("Password reset failed");
  }
});

// ============================================================================
// AUTH SLICE
// ============================================================================

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Clear error state
    clearError: (state) => {
      state.error = undefined;
    },

    // Update user profile data
    updateUserProfile: (state, action: PayloadAction<Partial<SupabaseUser>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload } as any;
        logger.info("User profile updated in auth state", action.payload, "auth", state.user?.id);
      }
    },

    // Set loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    // Force logout (for critical errors)
    forceLogout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.session = null;
      state.loading = false;
      state.error = "Session expired";
      logger.warn("Force logout triggered", undefined, "auth");
    },
  },
  extraReducers: (builder) => {
    // Initialize Auth
    builder
      .addCase(initializeAuth.pending, (state) => {
        // Track only the initialization-specific loading state to avoid
        // other auth-related operations (login/signup) from toggling this flag
        state.isInitializing = true;
        state.error = undefined;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        // Initialization finished successfully
        state.isInitializing = false;
        state.isInitialized = true;
        state.hasBeenInitialized = true;
        if (action.payload.user && action.payload.session) {
          state.isAuthenticated = true;
          state.user = action.payload.user as any;
          state.session = action.payload.session as any;
        } else {
          state.isAuthenticated = false;
          state.user = null;
          state.session = null;
        }
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        // Initialization attempted but failed — mark as initialized to avoid retry loops
        state.isInitializing = false;
        state.isInitialized = true;
        state.hasBeenInitialized = true;
        state.isAuthenticated = false;
        state.user = null;
        state.session = null;
        state.error = action.payload as string;
      });

    // Login
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.session = action.payload.session;
        state.error = undefined;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.session = null;
        state.error = action.payload as string;
      });

    // Signup
    builder
      .addCase(signupUser.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(signupUser.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.session) {
          state.isAuthenticated = true;
          state.user = action.payload.user;
          state.session = action.payload.session;
        } else {
          // Email confirmation required
          state.isAuthenticated = false;
          state.user = action.payload.user;
          state.session = null;
        }
        state.error = undefined;
      })
      .addCase(signupUser.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.session = null;
        state.error = action.payload as string;
      });

    // Logout
    builder
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.session = null;
        state.error = undefined;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.loading = false;
        // Even if logout fails, clear the state
        state.isAuthenticated = false;
        state.user = null;
        state.session = null;
        state.error = action.payload as string;
      });

    // Refresh Tokens
    builder
      .addCase(refreshTokens.pending, (state) => {
        // Don't set loading for token refresh to avoid UI flicker
      })
      .addCase(refreshTokens.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.session = action.payload.session;
        state.isAuthenticated = true;
        state.error = undefined;
      })
      .addCase(refreshTokens.rejected, (state, action) => {
        // Token refresh failed, logout user
        state.isAuthenticated = false;
        state.user = null;
        state.session = null;
        state.error = action.payload as string;
      });

    // Reset Password
    builder
      .addCase(resetPassword.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.loading = false;
        state.error = undefined;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

// ============================================================================
// ACTIONS AND SELECTORS
// ============================================================================

export const { clearError, updateUserProfile, setLoading, forceLogout } = authSlice.actions;

// Selectors
export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectSession = (state: { auth: AuthState }) => state.auth.session;
export const selectAuthLoading = (state: { auth: AuthState }) => state.auth.loading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;

// Computed selectors
export const selectUserRole = (state: { auth: AuthState }) => {
  const user = state.auth.user;
  if (!user) return "user";

  // Determine role based on user metadata or subscription
  return (user as any).user_metadata?.role || "user";
};

export const selectIsEmailConfirmed = (state: { auth: AuthState }) => {
  const user = state.auth.user;
  return user ? !!(user as any).email_confirmed_at : false;
};

export const selectTokensExpiringSoon = (state: { auth: AuthState }) => {
  const session = state.auth.session;
  if (!session?.expiresAt) return false;

  const expirationTime = new Date(session.expiresAt).getTime();
  const currentTime = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  return currentTime >= expirationTime - fiveMinutes;
};

// Stable initialization selectors
export const selectHasBeenInitialized = (state: { auth: AuthState }) => !!state.auth.hasBeenInitialized;
export const selectIsInitializing = (state: { auth: AuthState }) => !!state.auth.isInitializing;

// Expose session health for diagnostics (returns a Promise)
export const selectSessionHealth = () => {
  return tokenManager.getSessionHealth();
};

export default authSlice.reducer;
