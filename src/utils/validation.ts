// ============================================================================
// VALIDATION UTILITIES
// ============================================================================
// Zod schemas and validation rules for TrainSmart authentication forms
// with comprehensive error messages and type safety

import { z } from "zod";
import { REGEX_PATTERNS, AUTH_CONFIG } from "@/constants/auth";
import type { ExperienceLevel } from "@/types/auth";

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

// Email validation schema
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .max(AUTH_CONFIG.email.maxLength, `Email must be less than ${AUTH_CONFIG.email.maxLength} characters`)
  .refine((email) => {
    // Check against blocked domains
    const domain = email.split("@")[1]?.toLowerCase();
    return !domain || !AUTH_CONFIG.email.blockedDomains.includes(domain as any);
  }, "This email domain is not allowed");

// Password validation schema
export const passwordSchema = z
  .string()
  .min(1, "Password is required")
  .min(AUTH_CONFIG.password.minLength, `Password must be at least ${AUTH_CONFIG.password.minLength} characters`)
  .max(AUTH_CONFIG.password.maxLength, `Password must be less than ${AUTH_CONFIG.password.maxLength} characters`)
  .refine((password) => {
    if (!AUTH_CONFIG.password.requireUppercase) return true;
    return REGEX_PATTERNS.password.uppercase.test(password);
  }, "Password must contain at least one uppercase letter")
  .refine((password) => {
    if (!AUTH_CONFIG.password.requireLowercase) return true;
    return REGEX_PATTERNS.password.lowercase.test(password);
  }, "Password must contain at least one lowercase letter")
  .refine((password) => {
    if (!AUTH_CONFIG.password.requireNumbers) return true;
    return REGEX_PATTERNS.password.numbers.test(password);
  }, "Password must contain at least one number")
  .refine((password) => {
    if (!AUTH_CONFIG.password.requireSpecialChars) return true;
    return REGEX_PATTERNS.password.specialChars.test(password);
  }, "Password must contain at least one special character");

// Display name validation schema
export const displayNameSchema = z
  .string()
  .min(1, "Display name is required")
  .min(
    AUTH_CONFIG.validation.displayNameMinLength,
    `Display name must be at least ${AUTH_CONFIG.validation.displayNameMinLength} characters`
  )
  .max(
    AUTH_CONFIG.validation.displayNameMaxLength,
    `Display name must be less than ${AUTH_CONFIG.validation.displayNameMaxLength} characters`
  )
  .regex(REGEX_PATTERNS.displayName, "Display name can only contain letters, spaces, hyphens, and apostrophes");

// Experience level validation schema
export const experienceLevelSchema = z.enum(["untrained", "beginner", "early_intermediate", "intermediate"], {
  errorMap: () => ({ message: "Please select your experience level" }),
});

// Fitness goals validation schema
export const fitnessGoalsSchema = z
  .array(z.string())
  .min(1, "Please select at least one fitness goal")
  .max(5, "Please select no more than 5 fitness goals");

// Physical stats validation schemas
export const heightSchema = z
  .number()
  .min(100, "Height must be at least 100cm")
  .max(250, "Height must be less than 250cm")
  .optional();

export const weightSchema = z
  .number()
  .min(30, "Weight must be at least 30kg")
  .max(300, "Weight must be less than 300kg")
  .optional();

// ============================================================================
// FORM SCHEMAS
// ============================================================================

// Login form schema
export const loginFormSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

// Registration form schema
export const registrationFormSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
    displayName: displayNameSchema,
    experienceLevel: experienceLevelSchema,
    fitnessGoals: fitnessGoalsSchema,
    heightCm: heightSchema,
    weightKg: weightSchema,
    agreeToTerms: z.boolean().refine((val) => val === true, "You must agree to the terms and conditions"),
    subscribeToNewsletter: z.boolean().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// Password reset form schema
export const passwordResetFormSchema = z.object({
  email: emailSchema,
});

// Password update form schema
export const passwordUpdateFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmNewPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

// Profile update form schema
export const profileUpdateFormSchema = z.object({
  displayName: displayNameSchema,
  experienceLevel: experienceLevelSchema,
  fitnessGoals: fitnessGoalsSchema,
  heightCm: heightSchema,
  weightKg: weightSchema,
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type LoginFormData = z.infer<typeof loginFormSchema>;
export type RegistrationFormData = z.infer<typeof registrationFormSchema>;
export type PasswordResetFormData = z.infer<typeof passwordResetFormSchema>;
export type PasswordUpdateFormData = z.infer<typeof passwordUpdateFormSchema>;
export type ProfileUpdateFormData = z.infer<typeof profileUpdateFormSchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate email format and domain restrictions
 */
export const validateEmail = (email: string): { isValid: boolean; error?: string } => {
  try {
    emailSchema.parse(email);
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { isValid: false, error: error.errors[0]?.message };
    }
    return { isValid: false, error: "Invalid email" };
  }
};

/**
 * Validate password strength with detailed feedback
 */
export const validatePassword = (
  password: string
): {
  isValid: boolean;
  errors: string[];
  strength: "weak" | "fair" | "good" | "strong";
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
  };
} => {
  const requirements = {
    minLength: password.length >= AUTH_CONFIG.password.minLength,
    hasUppercase: REGEX_PATTERNS.password.uppercase.test(password),
    hasLowercase: REGEX_PATTERNS.password.lowercase.test(password),
    hasNumbers: REGEX_PATTERNS.password.numbers.test(password),
    hasSpecialChars: REGEX_PATTERNS.password.specialChars.test(password),
  };

  const errors: string[] = [];

  if (!requirements.minLength) {
    errors.push(`Password must be at least ${AUTH_CONFIG.password.minLength} characters`);
  }
  if (!requirements.hasUppercase) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!requirements.hasLowercase) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!requirements.hasNumbers) {
    errors.push("Password must contain at least one number");
  }
  if (!requirements.hasSpecialChars) {
    errors.push("Password must contain at least one special character");
  }

  // Calculate strength
  const metRequirements = Object.values(requirements).filter(Boolean).length;
  let strength: "weak" | "fair" | "good" | "strong";

  if (metRequirements <= 2) {
    strength = "weak";
  } else if (metRequirements === 3) {
    strength = "fair";
  } else if (metRequirements === 4) {
    strength = "good";
  } else {
    strength = "strong";
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength,
    requirements,
  };
};

/**
 * Validate display name format
 */
export const validateDisplayName = (name: string): { isValid: boolean; error?: string } => {
  try {
    displayNameSchema.parse(name);
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { isValid: false, error: error.errors[0]?.message };
    }
    return { isValid: false, error: "Invalid display name" };
  }
};

/**
 * Validate form data against schema
 */
export const validateFormData = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { isValid: boolean; errors: Record<string, string>; data?: T } => {
  try {
    const validatedData = schema.parse(data);
    return { isValid: true, errors: {}, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.errors.forEach((err) => {
        const path = err.path.join(".");
        errors[path] = err.message;
      });
      return { isValid: false, errors };
    }
    return { isValid: false, errors: { general: "Validation failed" } };
  }
};

/**
 * Check if password is commonly used (basic check)
 */
export const isCommonPassword = (password: string): boolean => {
  const commonPasswords = [
    "password",
    "123456",
    "123456789",
    "12345678",
    "12345",
    "1234567",
    "password123",
    "admin",
    "qwerty",
    "abc123",
    "Password1",
    "password1",
    "123123",
    "welcome",
    "login",
    "guest",
    "hello",
    "admin123",
    "root",
    "toor",
  ];

  return commonPasswords.includes(password.toLowerCase());
};

/**
 * Generate password strength indicator text
 */
export const getPasswordStrengthText = (strength: "weak" | "fair" | "good" | "strong"): string => {
  const strengthTexts = {
    weak: "Weak - Add more characters and variety",
    fair: "Fair - Consider adding more character types",
    good: "Good - Strong password",
    strong: "Strong - Excellent password security",
  };

  return strengthTexts[strength];
};

/**
 * Get password strength color
 */
export const getPasswordStrengthColor = (strength: "weak" | "fair" | "good" | "strong"): string => {
  const strengthColors = {
    weak: "#FF3B30",
    fair: "#FF9500",
    good: "#64D2FF",
    strong: "#34C759",
  };

  return strengthColors[strength];
};
