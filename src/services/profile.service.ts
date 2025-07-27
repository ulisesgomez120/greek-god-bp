// ============================================================================
// PROFILE SERVICE
// ============================================================================
// Complete profile management service with Supabase integration,
// experience level assessment, and offline support

import { createClient } from "@supabase/supabase-js";
import { ENV_CONFIG } from "@/config/constants";
import { logger } from "@/utils/logger";
import type { Database } from "@/types/database";
import type {
  UserProfile,
  ProfileSetupData,
  ProfileEditData,
  ProfileServiceResponse,
  ProfileUpdateOptions,
  ProfileValidationResult,
  ProfileCompletionStatus,
  ExperienceLevelAssessment,
  ExperienceLevelRecommendation,
  ProfilePictureUpload,
  ProfilePictureState,
  PrivacySettings,
  ProfilePreferences,
} from "@/types/profile";
import {
  DEFAULT_PRIVACY_SETTINGS,
  DEFAULT_PROFILE_PREFERENCES,
  getExperienceLevelInfo,
  EXPERIENCE_LEVELS,
} from "@/types/profile";
import type { ExperienceLevel } from "@/types/database";

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

const supabase = createClient<Database>(ENV_CONFIG.supabaseUrl, ENV_CONFIG.supabaseAnonKey);

// ============================================================================
// PROFILE SERVICE CLASS
// ============================================================================

export class ProfileService {
  private static instance: ProfileService;
  private profileCache = new Map<string, UserProfile>();
  private uploadProgress = new Map<string, ProfilePictureState>();

  private constructor() {}

  public static getInstance(): ProfileService {
    if (!ProfileService.instance) {
      ProfileService.instance = new ProfileService();
    }
    return ProfileService.instance;
  }

  // ============================================================================
  // PROFILE CRUD OPERATIONS
  // ============================================================================

  /**
   * Get user profile by ID
   */
  async getProfile(userId: string, useCache: boolean = true): Promise<ProfileServiceResponse<UserProfile>> {
    try {
      // Check cache first
      if (useCache && this.profileCache.has(userId)) {
        const cachedProfile = this.profileCache.get(userId)!;
        logger.debug("Profile retrieved from cache", { userId }, "profile");
        return { success: true, data: cachedProfile };
      }

      logger.info("Fetching user profile", { userId }, "profile");

      const { data, error } = await supabase.from("user_profiles").select("*").eq("id", userId).single();

      if (error) {
        logger.error("Failed to fetch profile", error, "profile", userId);
        return {
          success: false,
          error: {
            code: "PROFILE_FETCH_FAILED",
            message: "Failed to fetch user profile",
            details: error,
          },
        };
      }

      if (!data) {
        logger.warn("Profile not found", { userId }, "profile");
        return {
          success: false,
          error: {
            code: "PROFILE_NOT_FOUND",
            message: "User profile not found",
          },
        };
      }

      // Transform database row to UserProfile
      const profile: UserProfile = {
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
        privacySettings: (data.privacy_settings as unknown as PrivacySettings) || DEFAULT_PRIVACY_SETTINGS,
        role: data.role || "user",
        stripeCustomerId: data.stripe_customer_id || undefined,
        onboardingCompleted: data.onboarding_completed || false,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      // Cache the profile
      this.profileCache.set(userId, profile);

      logger.info("Profile fetched successfully", { userId }, "profile", userId);
      return { success: true, data: profile };
    } catch (error) {
      logger.error("Profile fetch error", error, "profile", userId);
      return {
        success: false,
        error: {
          code: "PROFILE_FETCH_ERROR",
          message: "An unexpected error occurred while fetching profile",
          details: error,
        },
      };
    }
  }

  /**
   * Create initial user profile during signup
   */
  async createProfile(userId: string, profileData: ProfileSetupData): Promise<ProfileServiceResponse<UserProfile>> {
    try {
      logger.info("Creating user profile", { userId }, "profile");

      // Validate profile data
      const validation = this.validateProfileSetup(profileData);
      if (!validation.isValid) {
        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: validation.errors.map((e) => e.message).join(", "),
            details: validation.errors,
          },
        };
      }

      // Prepare database insert
      const insertData = {
        id: userId,
        email: profileData.email || "", // Will be set by auth trigger
        display_name: profileData.displayName,
        height_cm: profileData.heightCm,
        weight_kg: profileData.weightKg,
        birth_date: profileData.birthDate,
        gender: profileData.gender,
        experience_level: profileData.experienceLevel,
        fitness_goals: profileData.fitnessGoals,
        available_equipment: [], // Default empty array since we're not collecting equipment
        privacy_settings: DEFAULT_PRIVACY_SETTINGS as any, // Cast to Json type
        onboarding_completed: true,
      };

      const { data, error } = await supabase.from("user_profiles").insert(insertData).select().single();

      if (error) {
        logger.error("Failed to create profile", error, "profile", userId);
        return {
          success: false,
          error: {
            code: "PROFILE_CREATE_FAILED",
            message: "Failed to create user profile",
            details: error,
          },
        };
      }

      // Transform to UserProfile
      const profile: UserProfile = {
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
        privacySettings: (data.privacy_settings as unknown as PrivacySettings) || DEFAULT_PRIVACY_SETTINGS,
        role: data.role || "user",
        stripeCustomerId: data.stripe_customer_id || undefined,
        onboardingCompleted: data.onboarding_completed || false,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      // Cache the profile
      this.profileCache.set(userId, profile);

      logger.info("Profile created successfully", { userId }, "profile", userId);
      return { success: true, data: profile };
    } catch (error) {
      logger.error("Profile creation error", error, "profile", userId);
      return {
        success: false,
        error: {
          code: "PROFILE_CREATE_ERROR",
          message: "An unexpected error occurred while creating profile",
          details: error,
        },
      };
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updates: ProfileEditData,
    options: ProfileUpdateOptions = {}
  ): Promise<ProfileServiceResponse<UserProfile>> {
    try {
      logger.info("Updating user profile", { userId, updates }, "profile");

      // Validate updates if not skipped
      if (!options.skipValidation) {
        const validation = this.validateProfileEdit(updates);
        if (!validation.isValid) {
          return {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: validation.errors.map((e) => e.message).join(", "),
              details: validation.errors,
            },
          };
        }
      }

      // Prepare database update
      const updateData: any = {};
      if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
      if (updates.heightCm !== undefined) updateData.height_cm = updates.heightCm;
      if (updates.weightKg !== undefined) updateData.weight_kg = updates.weightKg;
      if (updates.birthDate !== undefined) updateData.birth_date = updates.birthDate;
      if (updates.gender !== undefined) updateData.gender = updates.gender;
      if (updates.fitnessGoals !== undefined) updateData.fitness_goals = updates.fitnessGoals;
      if (updates.privacySettings !== undefined) {
        // Merge with existing privacy settings
        const currentProfile = await this.getProfile(userId);
        if (currentProfile.success && currentProfile.data) {
          updateData.privacy_settings = {
            ...currentProfile.data.privacySettings,
            ...updates.privacySettings,
          } as any;
        }
      }

      // Optimistic update to cache
      if (options.optimistic && this.profileCache.has(userId)) {
        const cachedProfile = this.profileCache.get(userId)!;
        const optimisticProfile = {
          ...cachedProfile,
          ...updates,
          privacySettings: updates.privacySettings
            ? { ...cachedProfile.privacySettings, ...updates.privacySettings }
            : cachedProfile.privacySettings,
        };
        this.profileCache.set(userId, optimisticProfile);
      }

      const { data, error } = await supabase
        .from("user_profiles")
        .update(updateData)
        .eq("id", userId)
        .select()
        .single();

      if (error) {
        // Revert optimistic update on error
        if (options.optimistic) {
          this.profileCache.delete(userId);
        }

        logger.error("Failed to update profile", error, "profile", userId);
        return {
          success: false,
          error: {
            code: "PROFILE_UPDATE_FAILED",
            message: "Failed to update user profile",
            details: error,
          },
        };
      }

      // Transform to UserProfile
      const profile: UserProfile = {
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
        privacySettings: (data.privacy_settings as unknown as PrivacySettings) || DEFAULT_PRIVACY_SETTINGS,
        role: data.role || "user",
        stripeCustomerId: data.stripe_customer_id || undefined,
        onboardingCompleted: data.onboarding_completed || false,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      // Update cache
      this.profileCache.set(userId, profile);

      logger.info("Profile updated successfully", { userId }, "profile", userId);
      return { success: true, data: profile };
    } catch (error) {
      logger.error("Profile update error", error, "profile", userId);
      return {
        success: false,
        error: {
          code: "PROFILE_UPDATE_ERROR",
          message: "An unexpected error occurred while updating profile",
          details: error,
        },
      };
    }
  }

  // ============================================================================
  // PROFILE PICTURE MANAGEMENT (PLACEHOLDER)
  // ============================================================================

  /**
   * Upload profile picture (placeholder - will be implemented with image picker)
   */
  async uploadProfilePicture(
    userId: string,
    imageUri: string,
    onProgress?: (progress: number) => void
  ): Promise<ProfileServiceResponse<string>> {
    // TODO: Implement with expo-image-picker and expo-image-manipulator
    return {
      success: false,
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Profile picture upload not yet implemented",
      },
    };
  }

  /**
   * Get profile picture upload state
   */
  getUploadState(userId: string): ProfilePictureState | null {
    return this.uploadProgress.get(userId) || null;
  }

  /**
   * Select and prepare image for upload (placeholder)
   */
  async selectProfilePicture(): Promise<ProfileServiceResponse<ProfilePictureUpload>> {
    // TODO: Implement with expo-image-picker
    return {
      success: false,
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Image selection not yet implemented",
      },
    };
  }

  /**
   * Take photo with camera for profile picture (placeholder)
   */
  async takeProfilePicture(): Promise<ProfileServiceResponse<ProfilePictureUpload>> {
    // TODO: Implement with expo-image-picker
    return {
      success: false,
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Camera capture not yet implemented",
      },
    };
  }

  // ============================================================================
  // EXPERIENCE LEVEL ASSESSMENT
  // ============================================================================

  /**
   * Assess user's experience level based on questionnaire
   */
  assessExperienceLevel(assessment: ExperienceLevelAssessment): ExperienceLevelRecommendation {
    const scores = {
      untrained: 0,
      beginner: 0,
      early_intermediate: 0,
      intermediate: 0,
      advanced: 0,
    };

    const reasoning: string[] = [];

    // Training duration (most important factor)
    if (assessment.monthsTraining !== undefined) {
      if (assessment.monthsTraining < 3) {
        scores.untrained += 40;
        reasoning.push(`Training for ${assessment.monthsTraining} months indicates untrained level`);
      } else if (assessment.monthsTraining < 9) {
        scores.beginner += 40;
        reasoning.push(`Training for ${assessment.monthsTraining} months indicates beginner level`);
      } else if (assessment.monthsTraining < 18) {
        scores.early_intermediate += 40;
        reasoning.push(`Training for ${assessment.monthsTraining} months indicates early intermediate level`);
      } else if (assessment.monthsTraining < 36) {
        scores.intermediate += 40;
        reasoning.push(`Training for ${assessment.monthsTraining} months indicates intermediate level`);
      } else {
        scores.advanced += 40;
        reasoning.push(`Training for ${assessment.monthsTraining} months indicates advanced level`);
      }
    }

    // Form confidence
    if (assessment.formConfidence !== undefined) {
      if (assessment.formConfidence <= 4) {
        scores.untrained += 15;
        reasoning.push("Low form confidence suggests focus on technique needed");
      } else if (assessment.formConfidence <= 6) {
        scores.beginner += 15;
      } else if (assessment.formConfidence <= 8) {
        scores.early_intermediate += 15;
      } else {
        scores.intermediate += 10;
        scores.advanced += 5;
      }
    }

    // Progression knowledge
    if (assessment.progressionKnowledge !== undefined) {
      if (assessment.progressionKnowledge <= 4) {
        scores.untrained += 10;
        scores.beginner += 5;
      } else if (assessment.progressionKnowledge <= 6) {
        scores.beginner += 10;
      } else if (assessment.progressionKnowledge <= 8) {
        scores.early_intermediate += 10;
      } else {
        scores.intermediate += 10;
        scores.advanced += 5;
      }
    }

    // Strength standards (if provided)
    if (assessment.bodyWeight && assessment.benchPressWeight) {
      const benchRatio = assessment.benchPressWeight / assessment.bodyWeight;
      if (benchRatio < 0.75) {
        scores.untrained += 10;
        scores.beginner += 5;
      } else if (benchRatio < 1.0) {
        scores.beginner += 10;
      } else if (benchRatio < 1.25) {
        scores.early_intermediate += 10;
      } else if (benchRatio < 1.5) {
        scores.intermediate += 10;
      } else {
        scores.advanced += 10;
      }
      reasoning.push(`Bench press to body weight ratio: ${benchRatio.toFixed(2)}`);
    }

    // Training frequency
    if (assessment.trainingFrequency !== undefined) {
      if (assessment.trainingFrequency < 3) {
        scores.untrained += 5;
        scores.beginner += 5;
      } else if (assessment.trainingFrequency <= 4) {
        scores.beginner += 5;
        scores.early_intermediate += 5;
      } else {
        scores.early_intermediate += 5;
        scores.intermediate += 5;
        scores.advanced += 5;
      }
    }

    // Find the highest scoring level
    const maxScore = Math.max(...Object.values(scores));
    const recommendedLevel = (Object.keys(scores) as ExperienceLevel[]).find((level) => scores[level] === maxScore)!;

    // Calculate confidence (0-1)
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    const confidence = totalScore > 0 ? maxScore / totalScore : 0.5;

    // Generate alternatives
    const alternatives = (Object.keys(scores) as ExperienceLevel[])
      .filter((level) => level !== recommendedLevel && scores[level] > 0)
      .sort((a, b) => scores[b] - scores[a])
      .slice(0, 2)
      .map((level) => ({
        level,
        reason: `Score: ${scores[level]} - Consider if ${getExperienceLevelInfo(level).description.toLowerCase()}`,
      }));

    return {
      recommendedLevel,
      confidence,
      reasoning,
      alternatives,
    };
  }

  // ============================================================================
  // PROFILE ANALYTICS
  // ============================================================================

  /**
   * Calculate profile completion status
   */
  calculateProfileCompletion(profile: Partial<UserProfile>): ProfileCompletionStatus {
    const sections = {
      basicInfo: 0,
      fitnessProfile: 0,
      goals: 0,
      equipment: 0,
      privacy: 0,
    };

    const missingFields: string[] = [];
    const recommendations: string[] = [];

    // Basic info (30% weight)
    let basicInfoFields = 0;
    let basicInfoCompleted = 0;

    if (profile.displayName) basicInfoCompleted++;
    else missingFields.push("displayName");
    basicInfoFields++;

    if (profile.email) basicInfoCompleted++;
    else missingFields.push("email");
    basicInfoFields++;

    if (profile.avatarUrl) basicInfoCompleted++;
    else recommendations.push("Add a profile picture to personalize your account");
    basicInfoFields++;

    if (profile.heightCm) basicInfoCompleted++;
    else recommendations.push("Add your height for better program recommendations");
    basicInfoFields++;

    if (profile.weightKg) basicInfoCompleted++;
    else recommendations.push("Add your weight for strength ratio calculations");
    basicInfoFields++;

    if (profile.birthDate) basicInfoCompleted++;
    else recommendations.push("Add your birth date for age-appropriate programming");
    basicInfoFields++;

    if (profile.gender) basicInfoCompleted++;
    basicInfoFields++;

    sections.basicInfo = (basicInfoCompleted / basicInfoFields) * 100;

    // Fitness profile (25% weight)
    let fitnessFields = 0;
    let fitnessCompleted = 0;

    if (profile.experienceLevel) fitnessCompleted++;
    else missingFields.push("experienceLevel");
    fitnessFields++;

    sections.fitnessProfile = (fitnessCompleted / fitnessFields) * 100;

    // Goals (20% weight)
    if (profile.fitnessGoals && profile.fitnessGoals.length > 0) {
      sections.goals = 100;
    } else {
      missingFields.push("fitnessGoals");
      recommendations.push("Set your fitness goals to get personalized recommendations");
      sections.goals = 0;
    }

    // Equipment (15% weight)
    if (profile.availableEquipment && profile.availableEquipment.length > 0) {
      sections.equipment = 100;
    } else {
      missingFields.push("availableEquipment");
      recommendations.push("Tell us what equipment you have access to");
      sections.equipment = 0;
    }

    // Privacy (10% weight)
    if (profile.privacySettings) {
      sections.privacy = 100;
    } else {
      sections.privacy = 0;
    }

    // Calculate overall completion
    const overall =
      sections.basicInfo * 0.3 +
      sections.fitnessProfile * 0.25 +
      sections.goals * 0.2 +
      sections.equipment * 0.15 +
      sections.privacy * 0.1;

    return {
      overall: Math.round(overall),
      sections,
      missingFields,
      recommendations,
    };
  }

  // ============================================================================
  // VALIDATION METHODS
  // ============================================================================

  /**
   * Validate profile setup data
   */
  private validateProfileSetup(data: ProfileSetupData): ProfileValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    // Display name validation
    if (!data.displayName || data.displayName.trim().length < 2) {
      errors.push({
        field: "displayName",
        message: "Display name must be at least 2 characters",
        code: "DISPLAY_NAME_TOO_SHORT",
      });
    }

    if (data.displayName && data.displayName.length > 50) {
      errors.push({
        field: "displayName",
        message: "Display name must be less than 50 characters",
        code: "DISPLAY_NAME_TOO_LONG",
      });
    }

    // Experience level validation
    if (!data.experienceLevel) {
      errors.push({
        field: "experienceLevel",
        message: "Experience level is required",
        code: "EXPERIENCE_LEVEL_REQUIRED",
      });
    }

    // Height validation
    if (data.heightCm !== undefined) {
      if (data.heightCm < 100 || data.heightCm > 250) {
        errors.push({
          field: "heightCm",
          message: "Height must be between 100cm and 250cm",
          code: "INVALID_HEIGHT",
        });
      }
    }

    // Weight validation
    if (data.weightKg !== undefined) {
      if (data.weightKg < 30 || data.weightKg > 300) {
        errors.push({
          field: "weightKg",
          message: "Weight must be between 30kg and 300kg",
          code: "INVALID_WEIGHT",
        });
      }
    }

    // Birth date validation
    if (data.birthDate) {
      const birthDate = new Date(data.birthDate);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();

      if (age < 13) {
        errors.push({
          field: "birthDate",
          message: "You must be at least 13 years old",
          code: "TOO_YOUNG",
        });
      }

      if (age > 100) {
        warnings.push({
          field: "birthDate",
          message: "Please verify your birth date",
          suggestion: "Double-check the year you entered",
        });
      }
    }

    // Fitness goals validation
    if (!data.fitnessGoals || data.fitnessGoals.length === 0) {
      warnings.push({
        field: "fitnessGoals",
        message: "Consider setting at least one fitness goal",
        suggestion: "Goals help us provide better recommendations",
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate profile edit data
   */
  private validateProfileEdit(data: ProfileEditData): ProfileValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    // Display name validation
    if (data.displayName !== undefined) {
      if (data.displayName.trim().length < 2) {
        errors.push({
          field: "displayName",
          message: "Display name must be at least 2 characters",
          code: "DISPLAY_NAME_TOO_SHORT",
        });
      }

      if (data.displayName.length > 50) {
        errors.push({
          field: "displayName",
          message: "Display name must be less than 50 characters",
          code: "DISPLAY_NAME_TOO_LONG",
        });
      }
    }

    // Height validation
    if (data.heightCm !== undefined && data.heightCm !== null) {
      if (data.heightCm < 100 || data.heightCm > 250) {
        errors.push({
          field: "heightCm",
          message: "Height must be between 100cm and 250cm",
          code: "INVALID_HEIGHT",
        });
      }
    }

    // Weight validation
    if (data.weightKg !== undefined && data.weightKg !== null) {
      if (data.weightKg < 30 || data.weightKg > 300) {
        errors.push({
          field: "weightKg",
          message: "Weight must be between 30kg and 300kg",
          code: "INVALID_WEIGHT",
        });
      }
    }

    // Birth date validation
    if (data.birthDate) {
      const birthDate = new Date(data.birthDate);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();

      if (age < 13) {
        errors.push({
          field: "birthDate",
          message: "You must be at least 13 years old",
          code: "TOO_YOUNG",
        });
      }

      if (age > 100) {
        warnings.push({
          field: "birthDate",
          message: "Please verify your birth date",
          suggestion: "Double-check the year you entered",
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  /**
   * Clear profile cache
   */
  clearCache(userId?: string): void {
    if (userId) {
      this.profileCache.delete(userId);
    } else {
      this.profileCache.clear();
    }
  }

  /**
   * Get cached profile
   */
  getCachedProfile(userId: string): UserProfile | null {
    return this.profileCache.get(userId) || null;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const profileService = ProfileService.getInstance();
export default profileService;
