// ============================================================================
// AUTHENTICATION SLICE
// ============================================================================
// Authentication state management with secure token handling,
// user profile management, and session persistence

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { createClient } from "@supabase/supabase-js";
import { ENV_CONFIG } from "../../config/constants";
import { getTokens, storeTokens, clearTokens, areTokensExpired } from "../../utils/storage";
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
};

// Global flag to prevent multiple concurrent initializations
let isInitializationInProgress = false;

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

const supabase = createClient(ENV_CONFIG.supabaseUrl, ENV_CONFIG.supabaseAnonKey, {
  auth: {
    autoRefreshToken: false, // We handle this manually
    persistSession: false, // We handle persistence manually
    detectSessionInUrl: false,
  },
});

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
      // Create authenticated client for RLS policies
      const authenticatedClient = createClient(ENV_CONFIG.supabaseUrl, ENV_CONFIG.supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });

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
        profileResult = {
          success: false,
          error: {
            code: "PROFILE_NOT_FOUND",
            message: "User profile not found",
          },
        };
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

    // Check if already initialized
    const state = getState() as any;
    if (state.auth.isInitialized) {
      logger.info("Authentication already initialized, skipping", undefined, "auth");
      return { user: state.auth.user, session: state.auth.session };
    }

    isInitializationInProgress = true;
    logger.info("Initializing authentication state", undefined, "auth");

    const tokens = await getTokens();
    if (!tokens) {
      logger.info("No stored tokens found", undefined, "auth");
      return { user: null, session: null };
    }

    // Check if tokens are expired
    const expired = await areTokensExpired();
    if (expired) {
      logger.warn("Stored tokens are expired, attempting refresh", undefined, "auth");

      // Attempt to refresh tokens
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: tokens.refreshToken,
      });

      if (error || !data.session) {
        logger.error("Token refresh failed during initialization", error, "auth");
        await clearTokens();
        return { user: null, session: null };
      }

      // Store new tokens
      await storeTokens({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
      });

      // Ensure we have a valid user before proceeding
      if (!data.user) {
        logger.error("Token refresh during initialization succeeded but no user data returned", undefined, "auth");
        await clearTokens();
        return { user: null, session: null };
      }

      // Merge user with profile data from database
      const mergedUser = await mergeUserWithProfile(data.user, data.session.access_token);

      logger.info("Tokens refreshed successfully during initialization", undefined, "auth", data.user.id);

      return {
        user: mergedUser,
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
          user: mergedUser,
        },
      };
    }

    // Tokens are valid, get user data
    const { data: userData, error: userError } = await supabase.auth.getUser(tokens.accessToken);

    if (userError || !userData.user) {
      logger.error("Failed to get user data during initialization", userError, "auth");
      await clearTokens();
      return { user: null, session: null };
    }

    // Merge user with profile data from database
    const mergedUser = await mergeUserWithProfile(userData.user, tokens.accessToken);

    logger.info("Authentication initialized successfully", undefined, "auth", userData.user.id);

    return {
      user: mergedUser,
      session: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        user: mergedUser,
      },
    };
  } catch (error) {
    logger.error("Authentication initialization failed", error, "auth");
    await clearTokens();
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
    await storeTokens({
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
      await storeTokens({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
      });

      logger.info("User signed up and logged in successfully", { userId: data.user.id }, "auth", data.user.id);

      return {
        user: data.user,
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
          user: data.user,
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
    await clearTokens();

    logger.info("User logged out successfully", undefined, "auth");

    return null;
  } catch (error) {
    logger.error("Logout error", error, "auth");
    // Even if logout fails, clear local tokens
    await clearTokens();
    return rejectWithValue("Logout failed");
  }
});

/**
 * Refresh authentication tokens
 */
export const refreshTokens = createAsyncThunk("auth/refreshTokens", async (_, { rejectWithValue, getState }) => {
  try {
    const state = getState() as any;
    const currentSession = state.auth.session;
    const currentUser = state.auth.user;

    if (!currentSession?.refreshToken) {
      logger.warn("No refresh token available", undefined, "auth");
      return rejectWithValue("No refresh token available");
    }

    // Preserve existing user metadata before refresh
    const existingUserMetadata = currentUser?.user_metadata || {};

    logger.info("Refreshing authentication tokens", undefined, "auth");

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: currentSession.refreshToken,
    });

    if (error || !data.session) {
      logger.error("Token refresh failed", error, "auth");
      await clearTokens();
      return rejectWithValue("Token refresh failed");
    }

    // Store new tokens
    await storeTokens({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
    });

    // Ensure we have a valid user before proceeding
    if (!data.user) {
      logger.error("Token refresh succeeded but no user data returned", undefined, "auth");
      await clearTokens();
      return rejectWithValue("Token refresh failed: No user data returned");
    }

    // Merge existing user metadata with refreshed user data
    // This preserves onboarding_complete and other custom metadata
    const mergedUser = {
      ...data.user,
      user_metadata: {
        ...existingUserMetadata, // Preserve existing metadata
        ...data.user.user_metadata, // Allow server-side updates if any
      },
    };

    logger.info("Tokens refreshed successfully", undefined, "auth", data.user.id);

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
    logger.error("Token refresh error", error, "auth");
    await clearTokens();
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
        state.loading = true;
        state.error = undefined;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.loading = false;
        state.isInitialized = true;
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
        state.loading = false;
        state.isInitialized = true;
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

export default authSlice.reducer;
