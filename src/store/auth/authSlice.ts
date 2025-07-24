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
import type { UserProfile, Session, AuthState, LoginCredentials, SignupData } from "../../types";
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
};

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
// ASYNC THUNKS
// ============================================================================

/**
 * Initialize authentication state from stored tokens
 */
export const initializeAuth = createAsyncThunk("auth/initialize", async (_, { rejectWithValue }) => {
  try {
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

      logger.info("Tokens refreshed successfully during initialization", undefined, "auth", data.user?.id);

      return {
        user: data.user,
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
          user: data.user,
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

    logger.info("Authentication initialized successfully", undefined, "auth", userData.user.id);

    return {
      user: userData.user,
      session: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        user: userData.user,
      },
    };
  } catch (error) {
    logger.error("Authentication initialization failed", error, "auth");
    await clearTokens();
    return rejectWithValue("Failed to initialize authentication");
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

    logger.info("User logged in successfully", { userId: data.user.id }, "auth", data.user.id);

    return {
      user: data.user,
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
        user: data.user,
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

    if (!currentSession?.refreshToken) {
      logger.warn("No refresh token available", undefined, "auth");
      return rejectWithValue("No refresh token available");
    }

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

    logger.info("Tokens refreshed successfully", undefined, "auth", data.user?.id);

    return {
      user: data.user,
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
        user: data.user,
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
