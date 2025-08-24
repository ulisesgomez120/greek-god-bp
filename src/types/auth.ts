// ============================================================================
// AUTHENTICATION TYPES
// ============================================================================
// Comprehensive TypeScript interfaces and enums for authentication system

import type { User as SupabaseUser, Session as SupabaseSession } from "@supabase/supabase-js";

// ============================================================================
// CORE AUTH TYPES
// ============================================================================

export type ExperienceLevel = "untrained" | "beginner" | "early_intermediate" | "intermediate" | "advanced";

export type AuthErrorType = "auth" | "validation" | "network" | "server";

export interface AuthError {
  code: string;
  message: string;
  type: AuthErrorType;
  details?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: SupabaseUser | null;
  session?: Session | null;
  error?: AuthError;
  message?: string;
  requiresEmailConfirmation?: boolean;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: SupabaseUser | null;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  experienceLevel: ExperienceLevel;
  fitnessGoals?: string[];
  heightCm?: number;
  weightKg?: number;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// AUTHENTICATION STATE
// ============================================================================

export interface AuthState {
  isAuthenticated: boolean;
  user: SupabaseUser | null;
  session: Session | null;
  loading: boolean;
  error?: string;
  isInitialized: boolean;
  // Stable initialization flags used by the auth slice to avoid remount loops
  hasBeenInitialized?: boolean;
  isInitializing?: boolean;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignupData {
  email: string;
  password: string;
  profile: {
    displayName: string;
    experienceLevel: ExperienceLevel;
    fitnessGoals?: string[];
    heightCm?: number;
    weightKg?: number;
  };
}

export interface PasswordResetRequest {
  email: string;
}

export interface EmailVerificationRequest {
  email: string;
}

export interface PasswordUpdateRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ProfileUpdateRequest {
  displayName?: string;
  experienceLevel?: ExperienceLevel;
  fitnessGoals?: string[];
  heightCm?: number;
  weightKg?: number;
  avatarUrl?: string;
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface TokenValidationResult {
  isValid: boolean;
  isExpired: boolean;
  expiresIn: number; // milliseconds
  needsRefresh: boolean;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PasswordValidation {
  isValid: boolean;
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
    notCommon: boolean;
  };
  strength: "weak" | "fair" | "good" | "strong";
}

export interface EmailValidation {
  isValid: boolean;
  error?: string;
}

// ============================================================================
// BIOMETRIC AUTHENTICATION
// ============================================================================

export interface BiometricAuthConfig {
  enabled: boolean;
  type: "fingerprint" | "face" | "iris" | "voice" | null;
  fallbackToPassword: boolean;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  biometricType?: string;
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

export interface SessionConfig {
  autoRefresh: boolean;
  refreshBuffer: number; // minutes before expiry to refresh
  maxRetries: number;
  retryDelay: number; // milliseconds
}

export interface SessionMetrics {
  loginTime: string;
  lastActivity: string;
  refreshCount: number;
  deviceInfo?: {
    platform: string;
    version: string;
    model?: string;
  };
}

// ============================================================================
// SECURITY TYPES
// ============================================================================

export interface SecurityEvent {
  type: "login" | "logout" | "password_change" | "failed_login" | "token_refresh";
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    country?: string;
    city?: string;
  };
  success: boolean;
  error?: string;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  biometricEnabled: boolean;
  sessionTimeout: number; // minutes
  maxConcurrentSessions: number;
  requirePasswordChange: boolean;
  passwordChangeInterval: number; // days
}

// ============================================================================
// OAUTH TYPES (Future Enhancement)
// ============================================================================

export type OAuthProvider = "google" | "apple" | "facebook" | "github";

export interface OAuthConfig {
  provider: OAuthProvider;
  clientId: string;
  redirectUrl: string;
  scopes: string[];
}

export interface OAuthResponse {
  success: boolean;
  provider: OAuthProvider;
  user?: SupabaseUser;
  session?: Session;
  error?: AuthError;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface SignupFormData {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  experienceLevel: ExperienceLevel;
  fitnessGoals: string[];
  heightCm?: number;
  weightKg?: number;
  agreeToTerms: boolean;
  subscribeToNewsletter: boolean;
}

export interface PasswordResetFormData {
  email: string;
}

export interface PasswordUpdateFormData {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export interface AuthErrorMap {
  [key: string]: {
    message: string;
    type: AuthErrorType;
    recoverable: boolean;
    action?: string;
  };
}

export const AUTH_ERROR_CODES = {
  // Validation Errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_EMAIL: "INVALID_EMAIL",
  WEAK_PASSWORD: "WEAK_PASSWORD",
  PASSWORDS_DONT_MATCH: "PASSWORDS_DONT_MATCH",

  // Authentication Errors
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  EMAIL_NOT_CONFIRMED: "EMAIL_NOT_CONFIRMED",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  TOO_MANY_ATTEMPTS: "TOO_MANY_ATTEMPTS",

  // Registration Errors
  EMAIL_EXISTS: "EMAIL_EXISTS",
  SIGNUP_FAILED: "SIGNUP_FAILED",
  PROFILE_CREATION_FAILED: "PROFILE_CREATION_FAILED",

  // Session Errors
  SESSION_EXPIRED: "SESSION_EXPIRED",
  NO_SESSION: "NO_SESSION",
  INVALID_SESSION: "INVALID_SESSION",

  // Token Errors
  NO_REFRESH_TOKEN: "NO_REFRESH_TOKEN",
  REFRESH_FAILED: "REFRESH_FAILED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  INVALID_TOKEN: "INVALID_TOKEN",

  // Network Errors
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT: "TIMEOUT",
  SERVER_ERROR: "SERVER_ERROR",

  // Generic Errors
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
  INIT_FAILED: "INIT_FAILED",
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERROR_CODES;

// ============================================================================
// LOADING STATES
// ============================================================================

export interface AuthLoadingStates {
  login: boolean;
  signup: boolean;
  logout: boolean;
  refresh: boolean;
  passwordReset: boolean;
  emailVerification: boolean;
  profileUpdate: boolean;
  initialization: boolean;
}

// ============================================================================
// HOOKS TYPES
// ============================================================================

export interface UseAuthReturn {
  // State
  isAuthenticated: boolean;
  user: SupabaseUser | null;
  session: Session | null;
  loading: AuthLoadingStates;
  error: string | null;
  isInitialized: boolean;

  // Actions
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  signup: (data: SignupData) => Promise<AuthResponse>;
  logout: () => Promise<AuthResponse>;
  refreshSession: () => Promise<AuthResponse>;
  resetPassword: (request: PasswordResetRequest) => Promise<AuthResponse>;
  resendEmailVerification: (request: EmailVerificationRequest) => Promise<AuthResponse>;
  updateProfile: (data: ProfileUpdateRequest) => Promise<AuthResponse>;
  clearError: () => void;

  // Utilities
  isTokenExpired: () => Promise<boolean>;
  getTokenExpirationTime: () => Promise<Date | null>;
  hasPermission: (permission: string) => boolean;
}

// ============================================================================
// MIDDLEWARE TYPES
// ============================================================================

export interface AuthMiddlewareConfig {
  requireAuth: boolean;
  redirectTo?: string;
  allowedRoles?: string[];
  requireEmailVerification?: boolean;
}

export interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface AuthAnalytics {
  loginAttempts: number;
  successfulLogins: number;
  failedLogins: number;
  signupAttempts: number;
  successfulSignups: number;
  passwordResets: number;
  sessionDuration: number;
  lastLoginDate: string;
  loginStreak: number;
}

// ============================================================================
// EXPORT ALL TYPES
// ============================================================================

// All types are exported individually above
