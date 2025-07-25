// ============================================================================
// AUTHENTICATION SERVICE
// ============================================================================
// Complete Supabase Auth integration with comprehensive error handling,
// profile management, and secure token operations

import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { ENV_CONFIG } from "@/config/constants";
import { ERROR_MESSAGES, SUCCESS_MESSAGES, STORAGE_KEYS } from "@/constants/auth";
import { logger } from "@/utils/logger";
import { storeTokens, clearTokens, getTokens, areTokensExpired } from "@/utils/storage";
import type { Database } from "@/types/database";
import type {
  LoginCredentials,
  SignupData,
  AuthResponse,
  UserProfile,
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
    autoRefreshToken: true,
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
// AUTHENTICATION SERVICE CLASS
// ============================================================================

export class AuthService {
  private static instance: AuthService;
  private refreshTimer?: NodeJS.Timeout;
  private readonly REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes before expiry

  private constructor() {
    this.initializeAuthStateListener();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // ============================================================================
  // AUTHENTICATION METHODS
  // ============================================================================

  /**
   * Sign up new user with profile creation
   */
  async signUp(signupData: SignupData): Promise<AuthResponse> {
    try {
      logger.info("Attempting user signup", { email: signupData.email }, "auth");

      // Validate input data
      const validation = this.validateSignupData(signupData);
      if (!validation.isValid) {
        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: validation.errors.join(", "),
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
          error: this.mapSupabaseError(error),
        };
      }

      if (!data.user) {
        logger.error("Signup succeeded but no user data returned", undefined, "auth");
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
          await this.createUserProfile(data.user.id, signupData);
        } catch (profileError) {
          logger.error("Profile creation failed", profileError, "auth", data.user.id);
          // Don't fail the signup if profile creation fails
        }
      }

      // Handle session based on email confirmation requirement
      if (data.session) {
        // User is immediately logged in (email confirmation not required)
        await this.handleSuccessfulAuth(data.session, data.user);

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
  async signIn(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      logger.info("Attempting user login", { email: credentials.email }, "auth");

      // Validate credentials
      const validation = this.validateLoginCredentials(credentials);
      if (!validation.isValid) {
        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: validation.errors.join(", "),
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
          error: this.mapSupabaseError(error),
        };
      }

      if (!data.user || !data.session) {
        logger.error("Login succeeded but no user/session data returned", undefined, "auth");
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
      await this.handleSuccessfulAuth(data.session, data.user);

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
  async signOut(): Promise<AuthResponse> {
    try {
      logger.info("Attempting user logout", undefined, "auth");

      // Clear refresh timer
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = undefined;
      }

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        logger.warn("Supabase logout failed, but continuing with local cleanup", error, "auth");
      }

      // Clear stored tokens and cache
      await this.clearAuthData();

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
      await this.clearAuthData();

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
   * Refresh authentication tokens
   */
  async refreshSession(): Promise<AuthResponse> {
    try {
      const tokens = await getTokens();
      if (!tokens?.refreshToken) {
        logger.warn("No refresh token available", undefined, "auth");
        return {
          success: false,
          error: {
            code: "NO_REFRESH_TOKEN",
            message: "No refresh token available",
            type: "auth",
          },
        };
      }

      logger.info("Refreshing authentication tokens", undefined, "auth");

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: tokens.refreshToken,
      });

      if (error || !data.session) {
        logger.error("Token refresh failed", error, "auth");
        await this.clearAuthData();
        return {
          success: false,
          error: {
            code: "REFRESH_FAILED",
            message: "Token refresh failed",
            type: "auth",
          },
        };
      }

      // Store new tokens and schedule next refresh
      await this.handleSuccessfulAuth(data.session, data.user);

      logger.info("Tokens refreshed successfully", undefined, "auth", data.user?.id);

      return {
        success: true,
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
      await this.clearAuthData();
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
  async resetPassword(request: PasswordResetRequest): Promise<AuthResponse> {
    try {
      logger.info("Attempting password reset", { email: request.email }, "auth");

      const { error } = await supabase.auth.resetPasswordForEmail(request.email, {
        redirectTo: `${ENV_CONFIG.apiUrl}/auth/reset-password`,
      });

      if (error) {
        logger.error("Password reset failed", error, "auth");
        return {
          success: false,
          error: this.mapSupabaseError(error),
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
  async resendEmailVerification(request: EmailVerificationRequest): Promise<AuthResponse> {
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
          error: this.mapSupabaseError(error),
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
  async getCurrentSession() {
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
  async getCurrentUser() {
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
  async initializeAuth(): Promise<AuthResponse> {
    try {
      logger.info("Initializing authentication state", undefined, "auth");

      const tokens = await getTokens();
      if (!tokens) {
        logger.info("No stored tokens found", undefined, "auth");
        return {
          success: true,
          user: null,
          session: null,
        };
      }

      // Check if tokens are expired
      const expired = await areTokensExpired();
      if (expired) {
        logger.warn("Stored tokens are expired, attempting refresh", undefined, "auth");
        return await this.refreshSession();
      }

      // Tokens are valid, get user data
      const { data: userData, error: userError } = await supabase.auth.getUser(tokens.accessToken);

      if (userError || !userData.user) {
        logger.error("Failed to get user data during initialization", userError, "auth");
        await this.clearAuthData();
        return {
          success: true,
          user: null,
          session: null,
        };
      }

      // Schedule token refresh
      this.scheduleTokenRefresh(tokens.expiresAt);

      logger.info("Authentication initialized successfully", undefined, "auth", userData.user.id);

      return {
        success: true,
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
      await this.clearAuthData();
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
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Handle successful authentication
   */
  private async handleSuccessfulAuth(session: any, user: any): Promise<void> {
    // Store tokens securely
    await storeTokens({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: new Date(session.expires_at! * 1000).toISOString(),
    });

    // Schedule token refresh
    this.scheduleTokenRefresh(new Date(session.expires_at! * 1000).toISOString());
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(expiresAt: string): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const expirationTime = new Date(expiresAt).getTime();
    const refreshTime = expirationTime - this.REFRESH_BUFFER;
    const delay = Math.max(0, refreshTime - Date.now());

    this.refreshTimer = setTimeout(async () => {
      logger.info("Automatic token refresh triggered", undefined, "auth");
      await this.refreshSession();
    }, delay);

    logger.debug(`Token refresh scheduled in ${Math.round(delay / 1000)} seconds`, undefined, "auth");
  }

  /**
   * Create user profile after successful signup
   */
  private async createUserProfile(userId: string, signupData: SignupData): Promise<void> {
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
   * Clear all authentication data
   */
  private async clearAuthData(): Promise<void> {
    await clearTokens();
    // Clear any cached user data
    // This will be expanded when we implement caching
  }

  /**
   * Initialize auth state listener
   */
  private initializeAuthStateListener(): void {
    supabase.auth.onAuthStateChange(async (event, session) => {
      logger.debug(`Auth state changed: ${event}`, { session: !!session }, "auth");

      switch (event) {
        case "SIGNED_IN":
          if (session) {
            this.scheduleTokenRefresh(new Date(session.expires_at! * 1000).toISOString());
          }
          break;
        case "SIGNED_OUT":
          if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = undefined;
          }
          await this.clearAuthData();
          break;
        case "TOKEN_REFRESHED":
          if (session) {
            await this.handleSuccessfulAuth(session, session.user);
          }
          break;
      }
    });
  }

  // ============================================================================
  // VALIDATION METHODS
  // ============================================================================

  /**
   * Validate signup data
   */
  private validateSignupData(data: SignupData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Email validation
    if (!data.email || !this.isValidEmail(data.email)) {
      errors.push("Please enter a valid email address");
    }

    // Password validation
    if (!data.password || !this.isValidPassword(data.password)) {
      errors.push(ERROR_MESSAGES.auth.weakPassword);
    }

    // Profile validation
    if (!data.profile.displayName || data.profile.displayName.trim().length < 2) {
      errors.push("Display name must be at least 2 characters");
    }

    if (!data.profile.experienceLevel) {
      errors.push("Please select your experience level");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate login credentials
   */
  private validateLoginCredentials(credentials: LoginCredentials): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!credentials.email || !this.isValidEmail(credentials.email)) {
      errors.push("Please enter a valid email address");
    }

    if (!credentials.password || credentials.password.length === 0) {
      errors.push("Please enter your password");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Validate password strength
   */
  private isValidPassword(password: string): boolean {
    return (
      password.length >= 12 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /\d/.test(password) &&
      /[!@#$%^&*(),.?":{}|<>]/.test(password)
    );
  }

  /**
   * Map Supabase errors to user-friendly messages
   */
  private mapSupabaseError(error: any): AuthError {
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

    if (errorCode.includes("network") || errorCode.includes("fetch")) {
      return {
        code: "NETWORK_ERROR",
        message: ERROR_MESSAGES.network.timeout,
        type: "network",
      };
    }

    return {
      code: "UNKNOWN_ERROR",
      message: error.message || "An unexpected error occurred",
      type: "server",
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const authService = AuthService.getInstance();
export default authService;
