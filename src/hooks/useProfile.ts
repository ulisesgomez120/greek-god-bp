// ============================================================================
// PROFILE MANAGEMENT HOOK
// ============================================================================
// React hook for profile management with caching, optimistic updates,
// and comprehensive state management

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { profileService } from "@/services/profile.service";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/utils/logger";
import store from "@/store";
import { syncAuthState } from "@/utils/authValidation";
import type {
  UserProfile,
  ProfileSetupData,
  ProfileEditData,
  ProfileServiceResponse,
  ProfileCompletionStatus,
  ExperienceLevelAssessment,
  ExperienceLevelRecommendation,
  ProfilePictureState,
  ProfileUpdateOptions,
} from "@/types/profile";
import type { RootState } from "@/store";

// ============================================================================
// HOOK STATE TYPES
// ============================================================================

interface UseProfileState {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  updating: boolean;
  uploadState: ProfilePictureState | null;
  completionStatus: ProfileCompletionStatus | null;
  lastSyncAt: string | null;
}

interface UseProfileActions {
  // Profile CRUD
  fetchProfile: (useCache?: boolean) => Promise<void>;
  createProfile: (data: ProfileSetupData) => Promise<boolean>;
  updateProfile: (updates: ProfileEditData, options?: ProfileUpdateOptions) => Promise<boolean>;
  refreshProfile: () => Promise<void>;

  // Profile picture management
  uploadProfilePicture: (imageUri: string, onProgress?: (progress: number) => void) => Promise<boolean>;
  selectProfilePicture: () => Promise<string | null>;
  takeProfilePicture: () => Promise<string | null>;

  // Experience level assessment
  assessExperienceLevel: (assessment: ExperienceLevelAssessment) => ExperienceLevelRecommendation;
  updateExperienceLevel: (level: string) => Promise<boolean>;

  // Profile analytics
  calculateCompletion: () => ProfileCompletionStatus | null;
  getProfileInsights: () => any;

  // Cache management
  clearCache: () => void;
  syncProfile: () => Promise<void>;
}

interface UseProfileReturn extends UseProfileState, UseProfileActions {
  // Computed properties
  isProfileComplete: boolean;
  completionPercentage: number;
  missingFields: string[];
  recommendations: string[];
  canUpgrade: boolean;
  experienceLevelInfo: any;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useProfile(): UseProfileReturn {
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useAuth();

  // Local state
  const [state, setState] = useState<UseProfileState>({
    profile: null,
    loading: false,
    error: null,
    updating: false,
    uploadState: null,
    completionStatus: null,
    lastSyncAt: null,
  });

  // ============================================================================
  // PROFILE CRUD OPERATIONS
  // ============================================================================

  // Track per-user retry attempts to prevent infinite loops when auth is inconsistent
  const fetchRetryCountsRef = useRef<Record<string, number>>({});
  const MAX_PROFILE_FETCH_RETRIES = 3;

  const fetchProfile = useCallback(
    async (useCache: boolean = true): Promise<void> => {
      if (!user?.id) {
        logger.warn("Cannot fetch profile: user not authenticated", {}, "profile");
        return;
      }

      const userId = user.id;

      // Prevent repeated concurrent fetches
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const response = await profileService.getProfile(userId, useCache);

        if (response.success && response.data) {
          // Reset retry count on success
          fetchRetryCountsRef.current[userId] = 0;

          setState((prev) => ({
            ...prev,
            profile: response.data!,
            loading: false,
            lastSyncAt: new Date().toISOString(),
          }));

          logger.info("Profile fetched successfully", { userId }, "profile");
          return;
        }

        // Handle categorized errors from ProfileService
        const errorCode = response.error?.code;

        if (errorCode === "AUTH_FAILURE") {
          // Authentication/permission issue — attempt to sync auth state once or retry a few times
          const attempts = (fetchRetryCountsRef.current[userId] || 0) + 1;
          fetchRetryCountsRef.current[userId] = attempts;

          logger.warn(
            "Profile fetch blocked by auth/permission error — attempting auth sync",
            { userId, attempt: attempts },
            "profile"
          );

          // Attempt to sync auth state (this may dispatch forceLogout if tokens are invalid)
          try {
            await syncAuthState(store);
          } catch (syncErr) {
            logger.warn("syncAuthState failed during profile fetch handling", syncErr, "profile", userId);
          }

          // If we still haven't exceeded retries, try fetching again (force server fetch)
          if (attempts < MAX_PROFILE_FETCH_RETRIES) {
            // Delay slightly before retrying to avoid tight loops
            await new Promise((resolve) => setTimeout(resolve, 300 * attempts));
            await fetchProfile(false);
            return;
          }

          // Exceeded retries — surface auth error and stop retrying to avoid infinite loop.
          setState((prev) => ({
            ...prev,
            loading: false,
            error: response.error?.message || "Authentication failed while fetching profile",
          }));

          logger.error("Profile fetch aborted after repeated auth failures", response.error, "profile", userId);
          return;
        } else if (errorCode === "PROFILE_NOT_FOUND") {
          // Profile genuinely missing — surface a helpful message but do not logout
          setState((prev) => ({
            ...prev,
            loading: false,
            error: response.error?.message || "Profile not found",
          }));

          logger.warn("Profile not found", response.error, "profile", userId);
          return;
        } else {
          // Generic fetch failure (network/other) — surface error but avoid retries to prevent loops
          setState((prev) => ({
            ...prev,
            loading: false,
            error: response.error?.message || "Failed to fetch profile",
          }));

          logger.error("Failed to fetch profile", response.error, "profile", userId);
          return;
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "An unexpected error occurred",
        }));

        logger.error("Profile fetch error", error, "profile", user?.id);
        return;
      }
    },
    [user?.id]
  );

  const createProfile = useCallback(async (_data: ProfileSetupData): Promise<boolean> => {
    // Manual profile creation from the client is disabled.
    // Profiles are created automatically during the authentication flow
    // (on sign-in/initializeAuth) for users with verified emails.
    logger.warn(
      "createProfile: manual profile creation is disabled. Profiles are created automatically after email verification.",
      {},
      "profile"
    );
    // Surface an actionable error via state so callers / UI can react if needed.
    setState((prev) => ({
      ...prev,
      error: "Profile creation is automated; please verify your email and reauthenticate.",
    }));
    return false;
  }, []);

  const updateProfile = useCallback(
    async (updates: ProfileEditData, options: ProfileUpdateOptions = {}): Promise<boolean> => {
      if (!user?.id) {
        logger.warn("Cannot update profile: user not authenticated", {}, "profile");
        return false;
      }

      setState((prev) => ({ ...prev, updating: true, error: null }));

      try {
        const response = await profileService.updateProfile(user.id, updates, options);

        if (response.success && response.data) {
          setState((prev) => ({
            ...prev,
            profile: response.data!,
            updating: false,
            lastSyncAt: new Date().toISOString(),
          }));

          logger.info("Profile updated successfully", { userId: user.id, updates }, "profile");
          return true;
        } else {
          setState((prev) => ({
            ...prev,
            updating: false,
            error: response.error?.message || "Failed to update profile",
          }));

          logger.error("Failed to update profile", response.error, "profile");
          return false;
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          updating: false,
          error: "An unexpected error occurred",
        }));

        logger.error("Profile update error", error, "profile");
        return false;
      }
    },
    [user?.id]
  );

  const refreshProfile = useCallback(async (): Promise<void> => {
    await fetchProfile(false); // Force refresh from server
  }, [fetchProfile]);

  // ============================================================================
  // PROFILE PICTURE MANAGEMENT
  // ============================================================================

  const uploadProfilePicture = useCallback(
    async (imageUri: string, onProgress?: (progress: number) => void): Promise<boolean> => {
      if (!user?.id) {
        logger.warn("Cannot upload profile picture: user not authenticated", {}, "profile");
        return false;
      }

      setState((prev) => ({ ...prev, error: null }));

      try {
        const response = await profileService.uploadProfilePicture(user.id, imageUri, onProgress);

        if (response.success && response.data) {
          // Update profile with new avatar URL
          setState((prev) => ({
            ...prev,
            profile: prev.profile
              ? {
                  ...prev.profile,
                  avatarUrl: response.data!,
                }
              : null,
            uploadState: null,
          }));

          logger.info("Profile picture uploaded successfully", { userId: user.id }, "profile");
          return true;
        } else {
          setState((prev) => ({
            ...prev,
            error: response.error?.message || "Failed to upload profile picture",
            uploadState: null,
          }));

          logger.error("Failed to upload profile picture", response.error, "profile");
          return false;
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: "An unexpected error occurred during upload",
          uploadState: null,
        }));

        logger.error("Profile picture upload error", error, "profile");
        return false;
      }
    },
    [user?.id]
  );

  const selectProfilePicture = useCallback(async (): Promise<string | null> => {
    try {
      const response = await profileService.selectProfilePicture();

      if (response.success && response.data) {
        return response.data.uri;
      } else {
        setState((prev) => ({
          ...prev,
          error: response.error?.message || "Failed to select image",
        }));
        return null;
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: "An unexpected error occurred",
      }));
      logger.error("Image selection error", error, "profile");
      return null;
    }
  }, []);

  const takeProfilePicture = useCallback(async (): Promise<string | null> => {
    try {
      const response = await profileService.takeProfilePicture();

      if (response.success && response.data) {
        return response.data.uri;
      } else {
        setState((prev) => ({
          ...prev,
          error: response.error?.message || "Failed to capture photo",
        }));
        return null;
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: "An unexpected error occurred",
      }));
      logger.error("Camera capture error", error, "profile");
      return null;
    }
  }, []);

  // ============================================================================
  // EXPERIENCE LEVEL MANAGEMENT
  // ============================================================================

  const assessExperienceLevel = useCallback((assessment: ExperienceLevelAssessment): ExperienceLevelRecommendation => {
    return profileService.assessExperienceLevel(assessment);
  }, []);

  const updateExperienceLevel = useCallback(
    async (level: string): Promise<boolean> => {
      if (!state.profile) return false;

      return await updateProfile({ experienceLevel: level as any }, { optimistic: true });
    },
    [state.profile, updateProfile]
  );

  // ============================================================================
  // PROFILE ANALYTICS
  // ============================================================================

  const calculateCompletion = useCallback((): ProfileCompletionStatus | null => {
    if (!state.profile) return null;

    const completion = profileService.calculateProfileCompletion(state.profile);
    setState((prev) => ({ ...prev, completionStatus: completion }));
    return completion;
  }, [state.profile]);

  const getProfileInsights = useCallback(() => {
    if (!state.profile) return null;

    // Calculate various insights
    const insights = {
      strengthToWeightRatio:
        state.profile.weightKg && state.profile.heightCm
          ? state.profile.weightKg / (state.profile.heightCm / 100) ** 2
          : null,
      experienceLevelAccuracy: 0.85, // Placeholder - would be calculated based on performance
      goalAlignment: state.profile.fitnessGoals.length > 0 ? 0.9 : 0.3,
      progressPotential: state.profile.experienceLevel === "untrained" ? 0.95 : 0.7,
    };

    return insights;
  }, [state.profile]);

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  const clearCache = useCallback(() => {
    if (user?.id) {
      profileService.clearCache(user.id);
    }
  }, [user?.id]);

  const syncProfile = useCallback(async (): Promise<void> => {
    await refreshProfile();
  }, [refreshProfile]);

  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================

  const isProfileComplete = useMemo(() => {
    if (!state.profile) return false;
    return !!(state.profile.displayName && state.profile.experienceLevel && state.profile.fitnessGoals.length > 0);
  }, [state.profile]);

  const completionPercentage = useMemo(() => {
    return state.completionStatus?.overall || 0;
  }, [state.completionStatus]);

  const missingFields = useMemo(() => {
    return state.completionStatus?.missingFields || [];
  }, [state.completionStatus]);

  const recommendations = useMemo(() => {
    return state.completionStatus?.recommendations || [];
  }, [state.completionStatus]);

  const canUpgrade = useMemo(() => {
    return state.profile?.role === "user" && isProfileComplete;
  }, [state.profile?.role, isProfileComplete]);

  const experienceLevelInfo = useMemo(() => {
    if (!state.profile?.experienceLevel) return null;

    // Import the function dynamically to avoid circular dependencies
    const { getExperienceLevelInfo } = require("@/types/profile");
    return getExperienceLevelInfo(state.profile.experienceLevel);
  }, [state.profile?.experienceLevel]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Auto-fetch profile when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id && !state.profile && !state.loading) {
      fetchProfile();
    }
  }, [isAuthenticated, user?.id, state.profile, state.loading, fetchProfile]);

  // Update upload state from service
  useEffect(() => {
    if (user?.id) {
      const uploadState = profileService.getUploadState(user.id);
      setState((prev) => ({ ...prev, uploadState }));
    }
  }, [user?.id]);

  // Calculate completion status when profile changes
  useEffect(() => {
    if (state.profile && !state.completionStatus) {
      calculateCompletion();
    }
  }, [state.profile, state.completionStatus, calculateCompletion]);

  // ============================================================================
  // RETURN HOOK INTERFACE
  // ============================================================================

  return {
    // State
    ...state,

    // Actions
    fetchProfile,
    createProfile,
    updateProfile,
    refreshProfile,
    uploadProfilePicture,
    selectProfilePicture,
    takeProfilePicture,
    assessExperienceLevel,
    updateExperienceLevel,
    calculateCompletion,
    getProfileInsights,
    clearCache,
    syncProfile,

    // Computed properties
    isProfileComplete,
    completionPercentage,
    missingFields,
    recommendations,
    canUpgrade,
    experienceLevelInfo,
  };
}

// ============================================================================
// PROFILE COMPLETION HOOK
// ============================================================================

export function useProfileCompletion() {
  const { profile, completionStatus, calculateCompletion } = useProfile();

  const completion = useMemo(() => {
    if (!profile) return null;
    return completionStatus || calculateCompletion();
  }, [profile, completionStatus, calculateCompletion]);

  const getCompletionColor = useCallback((percentage: number): string => {
    if (percentage >= 80) return "#34C759"; // Green
    if (percentage >= 60) return "#FF9500"; // Orange
    return "#FF3B30"; // Red
  }, []);

  const getNextStep = useCallback((): string | null => {
    if (!completion) return null;

    const { missingFields, recommendations } = completion;

    if (missingFields.includes("displayName")) return "Add your display name";
    if (missingFields.includes("experienceLevel")) return "Set your experience level";
    if (missingFields.includes("fitnessGoals")) return "Choose your fitness goals";
    if (recommendations.length > 0) return recommendations[0];

    return null;
  }, [completion]);

  return {
    completion,
    getCompletionColor,
    getNextStep,
    isComplete: completion?.overall === 100,
    percentage: completion?.overall || 0,
  };
}

// ============================================================================
// EXPERIENCE LEVEL HOOK
// ============================================================================

export function useExperienceLevel() {
  const { profile, assessExperienceLevel, updateExperienceLevel } = useProfile();

  const currentLevel = profile?.experienceLevel;
  const levelInfo = useMemo(() => {
    if (!currentLevel) return null;

    const { getExperienceLevelInfo } = require("@/types/profile");
    return getExperienceLevelInfo(currentLevel);
  }, [currentLevel]);

  const canProgress = useMemo(() => {
    if (!currentLevel) return false;

    const levels = ["untrained", "beginner", "early_intermediate", "intermediate", "advanced"];
    const currentIndex = levels.indexOf(currentLevel);
    return currentIndex < levels.length - 1;
  }, [currentLevel]);

  const nextLevel = useMemo(() => {
    if (!canProgress || !currentLevel) return null;

    const { getNextExperienceLevel } = require("@/types/profile");
    return getNextExperienceLevel(currentLevel);
  }, [canProgress, currentLevel]);

  return {
    currentLevel,
    levelInfo,
    canProgress,
    nextLevel,
    assessExperienceLevel,
    updateExperienceLevel,
  };
}

export default useProfile;
