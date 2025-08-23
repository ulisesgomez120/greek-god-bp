import { useCallback, useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { STORAGE_KEYS } from "@/config/constants";
import { getAsyncItem, setAsyncItem } from "@/utils/storage";
import { profileService } from "@/services/profile.service";
import { selectUser, updateUserProfile } from "@/store/auth/authSlice";
import type { ProfilePreferences } from "@/types/profile";
import { DEFAULT_PROFILE_PREFERENCES } from "@/types/profile";

/**
 * Hook: useUnitPreferences (simplified)
 *
 * Responsibilities:
 * - Load a simplified `useMetric: boolean` preference from server -> local storage -> defaults
 * - Provide helpers to read/update the single unit preference (useMetric)
 * - Maintain backward compatibility with legacy per-unit `units` object for migration
 *
 * Public API:
 *  - preferences: ProfilePreferences
 *  - setPreferences(prefs)
 *  - setUseMetric(boolean)
 *  - setUnits(legacyUnits) // best-effort compatibility layer
 *  - isMetric(), isImperial(), isImperialWeight(), isImperialHeight()
 *  - reloadPreferences()
 *  - loading
 */

type UseUnitPreferencesResult = {
  preferences: ProfilePreferences;
  setPreferences: (p: ProfilePreferences) => Promise<void>;
  setUseMetric: (useMetric: boolean) => Promise<void>;
  isMetric: () => boolean;
  isImperial: () => boolean;
  reloadPreferences: () => Promise<void>;
  loading: boolean;
};

const STORAGE_KEY = STORAGE_KEYS.async.userPreferences;

export default function useUnitPreferences(): UseUnitPreferencesResult {
  const dispatch = useDispatch();
  const user = useSelector(selectUser) as any | null;

  const [preferences, setPreferencesState] = useState<ProfilePreferences>(DEFAULT_PROFILE_PREFERENCES);
  const [loading, setLoading] = useState<boolean>(true);

  const normalizeServerPrefs = (p: any): ProfilePreferences => {
    // Accept both new shape (useMetric) and legacy shape (units)
    if (!p) return DEFAULT_PROFILE_PREFERENCES;

    const hasUseMetric = typeof p.useMetric === "boolean";
    if (hasUseMetric) {
      return { ...DEFAULT_PROFILE_PREFERENCES, ...p };
    }

    // Legacy: try to infer useMetric from units object if present
    const units = p.units as any | undefined;
    if (units) {
      const weightIsKg = units.weight === "kg";
      const heightIsCm = units.height === "cm";
      const useMetric = weightIsKg && heightIsCm;
      return { ...DEFAULT_PROFILE_PREFERENCES, ...(p as Partial<ProfilePreferences>), useMetric };
    }

    // Fall back to defaults
    return { ...DEFAULT_PROFILE_PREFERENCES, ...(p as Partial<ProfilePreferences>) };
  };

  // Load preferences: prefer server profile if possible, fallback to async storage, then defaults
  const loadPreferences = useCallback(async () => {
    setLoading(true);
    try {
      // 1) If authenticated, try fetching server-side profile and use its preferences if present
      if (user && user.id) {
        try {
          const profileResult = await profileService.getProfile(user.id, true);
          if (profileResult.success && profileResult.data && (profileResult.data as any).preferences) {
            const serverPrefsRaw = (profileResult.data as any).preferences as any;
            const serverPrefs = normalizeServerPrefs(serverPrefsRaw);
            setPreferencesState(serverPrefs);
            // Cache locally
            await setAsyncItem(STORAGE_KEY, serverPrefs);
            setLoading(false);
            return;
          }
        } catch (err) {
          // Best-effort only; swallow and continue to local fallback
          // eslint-disable-next-line no-console
          console.warn("useUnitPreferences: failed to load server preferences", err);
        }
      }

      // 2) Try async storage
      try {
        const stored = await getAsyncItem<ProfilePreferences>(STORAGE_KEY);
        if (stored) {
          const normalized = normalizeServerPrefs(stored as any);
          setPreferencesState(normalized);
          setLoading(false);
          return;
        }
      } catch (err) {
        // Ignore and continue
        // eslint-disable-next-line no-console
        console.warn("useUnitPreferences: failed to read local preferences", err);
      }

      // 3) Fallback to defaults
      setPreferencesState(DEFAULT_PROFILE_PREFERENCES);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Load on mount and whenever user changes
    void loadPreferences();
  }, [loadPreferences]);

  const persistPreferencesLocally = useCallback(async (prefs: ProfilePreferences) => {
    try {
      await setAsyncItem(STORAGE_KEY, prefs);
    } catch (err) {
      // non-fatal
      // eslint-disable-next-line no-console
      console.warn("useUnitPreferences: failed to persist preferences locally", err);
    }
  }, []);

  const setPreferences = useCallback(
    async (prefs: ProfilePreferences) => {
      // Update local state
      setPreferencesState(prefs);
      await persistPreferencesLocally(prefs);

      // Update redux auth user metadata for immediate UI reflection (local-only).
      // Persisting to the server is handled centrally by profile update flows (ProfileEditScreen -> profileService).
      try {
        dispatch(
          updateUserProfile({
            user_metadata: {
              ...(user?.user_metadata || {}),
              preferences: prefs,
            },
          } as any)
        );
      } catch (err) {
        // non-fatal
      }
    },
    [persistPreferencesLocally, dispatch, user]
  );

  const setUseMetric = useCallback(
    async (useMetric: boolean) => {
      const newPrefs = { ...preferences, useMetric };
      await setPreferences(newPrefs);
    },
    [preferences, setPreferences]
  );

  // NOTE: Legacy setUnits helper removed — the app now uses a single useMetric flag.

  const isMetric = useCallback(() => {
    return Boolean(preferences?.useMetric);
  }, [preferences]);

  const isImperial = useCallback(() => {
    return !preferences?.useMetric;
  }, [preferences]);

  const reloadPreferences = useCallback(async () => {
    await loadPreferences();
  }, [loadPreferences]);

  return {
    preferences,
    setPreferences,
    setUseMetric,
    isMetric,
    isImperial,
    reloadPreferences,
    loading,
  };
}
