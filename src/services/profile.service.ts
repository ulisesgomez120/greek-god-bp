// ============================================================================
// PROFILE SERVICE
// ============================================================================
// Complete profile management service with Supabase integration,
// experience level assessment, and offline support

import type { SupabaseClient } from "@supabase/supabase-js";
import supabase from "@/lib/supabase";
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
import { transformUserProfile, transformUserProfileToDb } from "@/types/transforms";

// SUPABASE CLIENT
// (using shared client from src/lib/supabase)

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

      const { data, error } = await supabase.from("user_profiles").select("*").eq("id", userId).maybeSingle();

      if (error) {
        logger.error("Failed to fetch profile", error, "profile", userId);

        // Classify authentication/permission errors (RLS) separately so callers
        // can react (e.g., trigger session validation or logout).
        const status = (error as any)?.status;
        const message = ((error as any)?.message || "").toString().toLowerCase();

        if (status === 401 || status === 403 || message.includes("permission") || message.includes("forbidden")) {
          return {
            success: false,
            error: {
              code: "AUTH_FAILURE",
              message: "Authentication or permission error when fetching profile",
              details: error,
            },
          };
        }

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

      // Transform database row to UserProfile using canonical transform for core fields
      // and augment with additional profile-specific fields not yet covered by the transform.
      const profileCore = transformUserProfile(data as any);
      const row = data as any;

      const privacySettingsFromRow: PrivacySettings = {
        dataSharing:
          row.privacy_data_sharing !== undefined
            ? row.privacy_data_sharing
            : row.privacy_settings
            ? (row.privacy_settings.data_sharing as boolean)
            : DEFAULT_PRIVACY_SETTINGS.dataSharing,
        analytics:
          row.privacy_analytics !== undefined
            ? row.privacy_analytics
            : row.privacy_settings
            ? (row.privacy_settings.analytics as boolean)
            : DEFAULT_PRIVACY_SETTINGS.analytics,
        aiCoaching:
          row.privacy_ai_coaching !== undefined
            ? row.privacy_ai_coaching
            : row.privacy_settings
            ? (row.privacy_settings.ai_coaching as boolean)
            : DEFAULT_PRIVACY_SETTINGS.aiCoaching,
        workoutSharing:
          row.privacy_workout_sharing !== undefined
            ? row.privacy_workout_sharing
            : row.privacy_settings
            ? (row.privacy_settings.workout_sharing as boolean)
            : DEFAULT_PRIVACY_SETTINGS.workoutSharing,
        progressSharing:
          row.privacy_progress_sharing !== undefined
            ? row.privacy_progress_sharing
            : row.privacy_settings
            ? (row.privacy_settings.progress_sharing as boolean)
            : DEFAULT_PRIVACY_SETTINGS.progressSharing,
      };

      const profile: UserProfile = {
        ...profileCore,
        avatarUrl: row.avatar_url || undefined,
        heightCm: row.height_cm || undefined,
        weightKg: row.weight_kg ? Number(row.weight_kg) : undefined,
        birthDate: row.birth_date || undefined,
        gender: row.gender || undefined,
        fitnessGoals: row.fitness_goals || [],
        availableEquipment: row.available_equipment || [],
        preferences:
          row.use_metric !== undefined
            ? { ...DEFAULT_PROFILE_PREFERENCES, useMetric: Boolean(row.use_metric) }
            : (row.preferences as unknown as ProfilePreferences) || DEFAULT_PROFILE_PREFERENCES,
        privacySettings: privacySettingsFromRow,
        role: row.role || "user",
        stripeCustomerId: row.stripe_customer_id || undefined,
        onboardingCompleted: row.onboarding_completed || false,
        // createdAt/updatedAt already provided by transformUserProfile
      };

      // Cache the profile
      this.profileCache.set(userId, profile);

      logger.info("Profile fetched successfully", { userId }, "profile", userId);
      return { success: true, data: profile };
    } catch (error) {
      logger.error("Profile fetch error", error, "profile", userId);

      const msg = (error as any)?.message?.toString?.().toLowerCase?.() || "";

      if (msg.includes("permission") || msg.includes("forbidden")) {
        return {
          success: false,
          error: {
            code: "AUTH_FAILURE",
            message: "Permission or authentication error when fetching profile",
            details: error,
          },
        };
      }

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
  async createProfile(
    userId: string,
    profileData: ProfileSetupData,
    authenticatedClient?: SupabaseClient<Database>
  ): Promise<ProfileServiceResponse<UserProfile>> {
    try {
      logger.info("Creating user profile", { userId }, "profile");

      // Validate profile data
      const validation = this.validateProfileSetup(profileData);
      if (!validation.isValid) {
        // Reduce verbosity in production: log validation errors without including payload preview
        logger.warn(
          "Profile validation failed during createProfile",
          { userId, validationErrors: validation.errors?.map((e: any) => e.code) || validation.errors },
          "profile"
        );

        return {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: validation.errors.map((e) => e.message).join(", "),
            details: validation.errors,
          },
        };
      }

      // Prepare database insert using centralized transform for core fields
      const dbProfileCore = transformUserProfileToDb({
        id: userId,
        email: profileData.email,
        displayName: profileData.displayName,
        experienceLevel: profileData.experienceLevel,
      } as any);

      const insertData: any = {
        ...dbProfileCore,
        id: userId,
        email: profileData.email || "", // Will be set by auth trigger if empty
        height_cm: profileData.heightCm ?? null,
        weight_kg: profileData.weightKg ?? null,
        birth_date: profileData.birthDate ?? null,
        gender: profileData.gender ?? null,
        fitness_goals: profileData.fitnessGoals || [],
        available_equipment: [], // Default empty array since we're not collecting equipment
        // Persist normalized privacy columns instead of the (dropped) privacy_settings JSONB.
        privacy_data_sharing: DEFAULT_PRIVACY_SETTINGS.dataSharing,
        privacy_analytics: DEFAULT_PRIVACY_SETTINGS.analytics,
        privacy_ai_coaching: DEFAULT_PRIVACY_SETTINGS.aiCoaching,
        privacy_workout_sharing: DEFAULT_PRIVACY_SETTINGS.workoutSharing,
        privacy_progress_sharing: DEFAULT_PRIVACY_SETTINGS.progressSharing,
        use_metric: DEFAULT_PROFILE_PREFERENCES.useMetric,
        onboarding_completed: false,
        // ensure display_name is present
        display_name: (dbProfileCore as any).display_name ?? profileData.displayName,
      };

      // Use authenticated client if provided, otherwise fall back to global client
      const client = authenticatedClient || supabase;
      const { data, error } = await client.from("user_profiles").insert(insertData).select().single();

      if (error) {
        // Log rich debug info to help diagnose why profile creation failed
        const errStatus = (error as any)?.status ?? null;
        const errMessage = ((error as any)?.message || "").toString();
        logger.error(
          "Failed to create profile (DB insert failed)",
          {
            userId,
            status: errStatus,
            message: errMessage,
            insertPayloadPreview: {
              id: insertData.id,
              email: insertData.email,
              display_name: insertData.display_name,
              experience_level: insertData.experience_level,
              onboarding_completed: insertData.onboarding_completed,
            },
          },
          "profile"
        );
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
      const row = data as any;

      const privacySettingsFromRow: PrivacySettings = {
        dataSharing:
          row.privacy_data_sharing !== undefined
            ? row.privacy_data_sharing
            : row.privacy_settings
            ? (row.privacy_settings.data_sharing as boolean)
            : DEFAULT_PRIVACY_SETTINGS.dataSharing,
        analytics:
          row.privacy_analytics !== undefined
            ? row.privacy_analytics
            : row.privacy_settings
            ? (row.privacy_settings.analytics as boolean)
            : DEFAULT_PRIVACY_SETTINGS.analytics,
        aiCoaching:
          row.privacy_ai_coaching !== undefined
            ? row.privacy_ai_coaching
            : row.privacy_settings
            ? (row.privacy_settings.ai_coaching as boolean)
            : DEFAULT_PRIVACY_SETTINGS.aiCoaching,
        workoutSharing:
          row.privacy_workout_sharing !== undefined
            ? row.privacy_workout_sharing
            : row.privacy_settings
            ? (row.privacy_settings.workout_sharing as boolean)
            : DEFAULT_PRIVACY_SETTINGS.workoutSharing,
        progressSharing:
          row.privacy_progress_sharing !== undefined
            ? row.privacy_progress_sharing
            : row.privacy_settings
            ? (row.privacy_settings.progress_sharing as boolean)
            : DEFAULT_PRIVACY_SETTINGS.progressSharing,
      };

      const profile: UserProfile = {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        avatarUrl: row.avatar_url || undefined,
        heightCm: row.height_cm || undefined,
        weightKg: row.weight_kg ? Number(row.weight_kg) : undefined,
        birthDate: row.birth_date || undefined,
        gender: row.gender || undefined,
        experienceLevel: row.experience_level,
        fitnessGoals: row.fitness_goals || [],
        availableEquipment: row.available_equipment || [],
        preferences:
          row.use_metric !== undefined
            ? { ...DEFAULT_PROFILE_PREFERENCES, useMetric: Boolean(row.use_metric) }
            : (row.preferences as unknown as ProfilePreferences) || DEFAULT_PROFILE_PREFERENCES,
        privacySettings: privacySettingsFromRow,
        role: row.role || "user",
        stripeCustomerId: row.stripe_customer_id || undefined,
        onboardingCompleted: row.onboarding_completed || false,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
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

      // Prepare database update using centralized transform where applicable.
      const appLevelUpdates: any = {};
      if (updates.displayName !== undefined) appLevelUpdates.displayName = updates.displayName;
      if (updates.heightCm !== undefined) appLevelUpdates.heightCm = updates.heightCm;
      if (updates.weightKg !== undefined) appLevelUpdates.weightKg = updates.weightKg;
      if (updates.birthDate !== undefined) appLevelUpdates.birthDate = updates.birthDate;
      if (updates.gender !== undefined) appLevelUpdates.gender = updates.gender;
      if (updates.fitnessGoals !== undefined) appLevelUpdates.fitnessGoals = updates.fitnessGoals;

      // Transform camelCase app updates to DB format
      const dbUpdatesFromTransforms = transformUserProfileToDb(appLevelUpdates as any) as any;

      // Handle privacy settings merge separately
      const updateData: any = { ...dbUpdatesFromTransforms };

      if (updates.preferences !== undefined) {
        // Do not write the dropped `preferences` JSONB column.
        // Persist only the `use_metric` boolean which is the canonical DB column.
        if (typeof updates.preferences.useMetric !== "undefined") {
          updateData.use_metric = updates.preferences.useMetric;
        }
      }

      if (updates.privacySettings !== undefined) {
        // Persist normalized privacy boolean columns only (avoid writing dropped JSONB column).
        const ps = updates.privacySettings as PrivacySettings;
        if (ps.dataSharing !== undefined) updateData.privacy_data_sharing = ps.dataSharing;
        if (ps.analytics !== undefined) updateData.privacy_analytics = ps.analytics;
        if (ps.aiCoaching !== undefined) updateData.privacy_ai_coaching = ps.aiCoaching;
        if (ps.workoutSharing !== undefined) updateData.privacy_workout_sharing = ps.workoutSharing;
        if (ps.progressSharing !== undefined) updateData.privacy_progress_sharing = ps.progressSharing;
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
      const row = data as any;
      const privacySettingsFromRow: PrivacySettings = {
        dataSharing:
          row.privacy_data_sharing !== undefined
            ? row.privacy_data_sharing
            : row.privacy_settings
            ? (row.privacy_settings.data_sharing as boolean)
            : DEFAULT_PRIVACY_SETTINGS.dataSharing,
        analytics:
          row.privacy_analytics !== undefined
            ? row.privacy_analytics
            : row.privacy_settings
            ? (row.privacy_settings.analytics as boolean)
            : DEFAULT_PRIVACY_SETTINGS.analytics,
        aiCoaching:
          row.privacy_ai_coaching !== undefined
            ? row.privacy_ai_coaching
            : row.privacy_settings
            ? (row.privacy_settings.ai_coaching as boolean)
            : DEFAULT_PRIVACY_SETTINGS.aiCoaching,
        workoutSharing:
          row.privacy_workout_sharing !== undefined
            ? row.privacy_workout_sharing
            : row.privacy_settings
            ? (row.privacy_settings.workout_sharing as boolean)
            : DEFAULT_PRIVACY_SETTINGS.workoutSharing,
        progressSharing:
          row.privacy_progress_sharing !== undefined
            ? row.privacy_progress_sharing
            : row.privacy_settings
            ? (row.privacy_settings.progress_sharing as boolean)
            : DEFAULT_PRIVACY_SETTINGS.progressSharing,
      };

      const profile: UserProfile = {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        avatarUrl: row.avatar_url || undefined,
        heightCm: row.height_cm || undefined,
        weightKg: row.weight_kg ? Number(row.weight_kg) : undefined,
        birthDate: row.birth_date || undefined,
        gender: row.gender || undefined,
        experienceLevel: row.experience_level,
        fitnessGoals: row.fitness_goals || [],
        availableEquipment: row.available_equipment || [],
        preferences:
          row.use_metric !== undefined
            ? { ...DEFAULT_PROFILE_PREFERENCES, useMetric: Boolean(row.use_metric) }
            : (row.preferences as unknown as ProfilePreferences) || DEFAULT_PROFILE_PREFERENCES,
        privacySettings: privacySettingsFromRow,
        role: row.role || "user",
        stripeCustomerId: row.stripe_customer_id || undefined,
        onboardingCompleted: row.onboarding_completed || false,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
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
