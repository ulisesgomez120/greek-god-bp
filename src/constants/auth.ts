// ============================================================================
// AUTHENTICATION CONSTANTS
// ============================================================================
// Authentication constants, error messages, and configuration values

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERROR_MESSAGES = {
  auth: {
    // Validation Errors
    invalidEmail: "Please enter a valid email address",
    weakPassword: "Password must be at least 12 characters with uppercase, lowercase, numbers, and special characters",
    passwordsDontMatch: "Passwords do not match",
    displayNameRequired: "Display name is required",
    experienceLevelRequired: "Please select your experience level",

    // Authentication Errors
    invalidCredentials: "Invalid email or password. Please check your credentials and try again.",
    emailNotConfirmed: "Please check your email and click the confirmation link before signing in",
    accountLocked: "Your account has been temporarily locked due to too many failed attempts",
    tooManyAttempts: "Too many login attempts. Please try again in a few minutes",

    // Registration Errors
    emailExists: "An account with this email already exists. Please sign in instead.",
    signupFailed: "Account creation failed. Please try again.",
    profileCreationFailed: "Failed to create user profile. Please contact support.",

    // Session Errors
    sessionExpired: "Your session has expired. Please sign in again.",
    noSession: "No active session found. Please sign in.",
    invalidSession: "Invalid session. Please sign in again.",

    // Token Errors
    noRefreshToken: "Authentication expired. Please sign in again.",
    refreshFailed: "Failed to refresh authentication. Please sign in again.",
    tokenExpired: "Authentication token has expired",
    invalidToken: "Invalid authentication token",

    // Generic Errors
    unknownError: "An unexpected error occurred. Please try again.",
    initFailed: "Failed to initialize authentication. Please restart the app.",
  },

  network: {
    timeout: "Request timed out. Please check your internet connection and try again.",
    offline: "You appear to be offline. Please check your internet connection.",
    serverError: "Server error occurred. Please try again later.",
    connectionFailed: "Failed to connect to server. Please try again.",
  },

  validation: {
    required: "This field is required",
    emailFormat: "Please enter a valid email address",
    passwordTooShort: "Password must be at least 12 characters long",
    passwordTooWeak: "Password is too weak. Please use a stronger password.",
    nameTooShort: "Name must be at least 2 characters long",
    invalidCharacters: "Contains invalid characters",
  },
} as const;

// ============================================================================
// SUCCESS MESSAGES
// ============================================================================

export const SUCCESS_MESSAGES = {
  auth: {
    loginSuccess: "Welcome back! You've been signed in successfully.",
    signupSuccess: "Account created successfully! Please check your email for verification.",
    signupSuccessNoVerification: "Account created and signed in successfully!",
    logoutSuccess: "You've been signed out successfully.",
    passwordReset: "Password reset email sent. Please check your inbox.",
    emailVerificationSent: "Verification email sent. Please check your inbox.",
    profileUpdated: "Profile updated successfully.",
    passwordChanged: "Password changed successfully.",
    emailConfirmed: "Email confirmed successfully! You can now sign in.",
  },

  general: {
    saved: "Changes saved successfully",
    updated: "Updated successfully",
    deleted: "Deleted successfully",
    synced: "Data synced successfully",
  },
} as const;

// ============================================================================
// AUTHENTICATION CONFIGURATION
// ============================================================================

export const AUTH_CONFIG = {
  // Password Requirements
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxLength: 128,
  },

  // Email Configuration
  email: {
    maxLength: 254,
    allowedDomains: [], // Empty array means all domains allowed
    blockedDomains: ["tempmail.org", "10minutemail.com", "guerrillamail.com", "mailinator.com"],
  },

  // Session Configuration
  session: {
    refreshBufferMinutes: 5, // Refresh token 5 minutes before expiry
    maxRetryAttempts: 3,
    retryDelayMs: 1000,
    autoRefreshEnabled: true,
    sessionTimeoutMinutes: 60 * 24, // 24 hours
  },

  // Token Configuration
  tokens: {
    accessTokenKey: "trainsmart_access_token",
    refreshTokenKey: "trainsmart_refresh_token",
    expiresAtKey: "trainsmart_expires_at",
    keychainService: "trainsmart-keychain",
    requireAuthentication: false, // For biometric unlock
  },

  // Rate Limiting
  rateLimiting: {
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 15,
    maxSignupAttempts: 3,
    signupCooldownMinutes: 5,
    maxPasswordResetAttempts: 3,
    passwordResetCooldownMinutes: 10,
  },

  // Validation
  validation: {
    displayNameMinLength: 2,
    displayNameMaxLength: 50,
    allowedSpecialChars: '!@#$%^&*(),.?":{}|<>',
    emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },

  // Security
  security: {
    enableBiometric: true,
    enableTwoFactor: false, // Future enhancement
    maxConcurrentSessions: 3,
    requireEmailVerification: true,
    passwordChangeIntervalDays: 90, // Optional password change reminder
  },
} as const;

// ============================================================================
// AUTH FLOW CONSTANTS
// ============================================================================

export const AUTH_FLOWS = {
  login: {
    title: "Welcome Back",
    subtitle: "Sign in to continue your fitness journey",
    submitText: "Sign In",
    switchText: "Don't have an account? Sign up",
  },
  signup: {
    title: "Join TrainSmart",
    subtitle: "Start your personalized fitness journey",
    submitText: "Create Account",
    switchText: "Already have an account? Sign in",
  },
  forgotPassword: {
    title: "Reset Password",
    subtitle: "Enter your email to receive reset instructions",
    submitText: "Send Reset Email",
    switchText: "Remember your password? Sign in",
  },
  emailVerification: {
    title: "Verify Your Email",
    subtitle: "Check your email and click the verification link",
    resendText: "Resend Verification Email",
    switchText: "Wrong email? Sign up again",
  },
} as const;

// ============================================================================
// LOADING STATES
// ============================================================================

export const LOADING_MESSAGES = {
  auth: {
    signingIn: "Signing you in...",
    signingUp: "Creating your account...",
    signingOut: "Signing you out...",
    refreshing: "Refreshing session...",
    resettingPassword: "Sending reset email...",
    verifyingEmail: "Verifying email...",
    updatingProfile: "Updating profile...",
    initializing: "Initializing app...",
  },
  security: {
    securingData: "Securing your data...",
    encryptingTokens: "Encrypting authentication tokens...",
    validatingSession: "Validating session...",
    checkingBiometric: "Checking biometric authentication...",
  },
} as const;

// ============================================================================
// SECURITY NOTICES
// ============================================================================

export const SECURITY_NOTICES = {
  tokenStorage: "Securing your data with industry-standard encryption...",
  biometricSetup: "Enable biometric authentication for enhanced security",
  sessionExpiry: "Your session will expire in {minutes} minutes",
  passwordStrength: "Use a strong password to protect your account",
  twoFactorRecommendation: "Consider enabling two-factor authentication for added security",
  deviceTrust: "This device will be remembered for faster sign-ins",
} as const;

// ============================================================================
// REGEX PATTERNS
// ============================================================================

export const REGEX_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  password: {
    minLength: /.{12,}/,
    uppercase: /[A-Z]/,
    lowercase: /[a-z]/,
    numbers: /\d/,
    specialChars: /[!@#$%^&*(),.?":{}|<>]/,
  },
  displayName: /^[a-zA-Z\s'-]{2,50}$/,
  phoneNumber: /^\+?[\d\s\-\(\)]{10,}$/,
} as const;

// ============================================================================
// STORAGE KEYS
// ============================================================================

export const STORAGE_KEYS = {
  secure: {
    accessToken: "trainsmart_access_token",
    refreshToken: "trainsmart_refresh_token",
    biometricKey: "trainsmart_biometric_key",
  },
  async: {
    expiresAt: "token_expires_at",
    storedAt: "token_stored_at",
    userPreferences: "user_preferences",
    authConfig: "auth_config",
    lastLoginDate: "last_login_date",
    loginStreak: "login_streak",
  },
} as const;

// ============================================================================
// BIOMETRIC AUTHENTICATION
// ============================================================================

export const BIOMETRIC_CONFIG = {
  promptMessage: "Use your biometric to sign in",
  fallbackTitle: "Use Password",
  cancelTitle: "Cancel",
  disableDeviceFallback: false,
  requireConfirmation: true,
  authenticatePrompt: "Authenticate to access your account",
} as const;

// ============================================================================
// WEBHOOK EVENTS
// ============================================================================

export const WEBHOOK_EVENTS = {
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_DELETED: "user.deleted",
  EMAIL_CONFIRMED: "email.confirmed",
  PASSWORD_RESET: "password.reset",
  LOGIN_SUCCESS: "login.success",
  LOGIN_FAILED: "login.failed",
  LOGOUT: "logout",
  TOKEN_REFRESHED: "token.refreshed",
} as const;

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type FitnessGoal = string;
export type AuthFlow = keyof typeof AUTH_FLOWS;
export type WebhookEvent = keyof typeof WEBHOOK_EVENTS;
