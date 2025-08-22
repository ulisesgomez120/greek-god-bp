import { useCallback, useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import supabase from "@/lib/supabase";
import { STORAGE_KEYS } from "@/config/constants";
import { getAsyncItem, setAsyncItem } from "@/utils/storage";
import { profileService } from "@/services/profile.service";
import { selectUser, updateUserProfile } from "@/store/auth/authSlice";
import type { ProfilePreferences } from "@/types/profile";
import { DEFAULT_PROFILE_PREFERENCES } from "@/types/profile";

/**
 * Hook: useUnitPreferences
 *
 * Responsibilities:
 * - Load preferences from (in order): server profile (if authenticated) -> async storage -> defaults
 * - Provide helpers to read/update units (weight/height/distance)
 * - Persist preferences locally (async storage) and attempt server update (best-effort) when authenticated
 *
 * Usage:
 * const { preferences, setPreferences, setUnits, isImperialWeight, isImperialHeight } = useUnitPreferences();
 */

type UseUnitPreferencesResult = {
  preferences: ProfilePreferences;
  setPreferences: (p: ProfilePreferences) => Promise<void>;
  setUnits: (units: ProfilePreferences["units"]) => Promise<void>;
  isImperialWeight: () => boolean;
  isImperialHeight: () => boolean;
  reloadPreferences: () => Promise<void>;
  loading: boolean;
};

const STORAGE_KEY = STORAGE_KEYS.async.userPreferences;

export default function useUnitPreferences(): UseUnitPreferencesResult {
  const dispatch = useDispatch();
  const user = useSelector(selectUser) as any | null;

  const [preferences, setPreferencesState] = useState<ProfilePreferences>(DEFAULT_PROFILE_PREFERENCES);
  const [loading, setLoading] = useState<boolean>(true);

  // Load preferences: prefer server profile if possible, fallback to async storage, then defaults
  const loadPreferences = useCallback(async () => {
    setLoading(true);
    try {
      // 1) If authenticated, try fetching server-side profile and use its preferences if present
      if (user && user.id) {
        try {
          const profileResult = await profileService.getProfile(user.id, true);
          if (profileResult.success && profileResult.data && (profileResult.data as any).preferences) {
            const serverPrefs = (profileResult.data as any).preferences as ProfilePreferences;
            setPreferencesState({ ...DEFAULT_PROFILE_PREFERENCES, ...serverPrefs });
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
          setPreferencesState({ ...DEFAULT_PROFILE_PREFERENCES, ...stored });
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

  const persistPreferencesServer = useCallback(
    async (prefs: ProfilePreferences) => {
      if (!user || !user.id) return;

      try {
        // Attempt to write to user_profiles.preferences JSON column (best-effort).
        // If your DB doesn't have this column, this will likely error; we catch and ignore.
        const { data, error } = await supabase
          .from("user_profiles")
          .update({ preferences: prefs } as any)
          .eq("id", user.id);
        if (error) {
          // eslint-disable-next-line no-console
          console.warn("useUnitPreferences: server prefs update failed", error);
        } else {
          // Update auth user metadata in redux (optimistic local copy)
          try {
            dispatch(
              updateUserProfile({
                user_metadata: {
                  ...(user.user_metadata || {}),
                  preferences: prefs,
                },
              } as any)
            );
          } catch (err) {
            // ignore
          }
        }
      } catch (err) {
        // ignore network/db errors (best-effort)
        // eslint-disable-next-line no-console
        console.warn("useUnitPreferences: error updating server preferences", err);
      }
    },
    [user, dispatch]
  );

  const setPreferences = useCallback(
    async (prefs: ProfilePreferences) => {
      setPreferencesState(prefs);
      await persistPreferencesLocally(prefs);

      // Best-effort server update (do not block)
      void persistPreferencesServer(prefs);
    },
    [persistPreferencesLocally, persistPreferencesServer]
  );

  const setUnits = useCallback(
    async (units: ProfilePreferences["units"]) => {
      const newPrefs = { ...preferences, units };
      await setPreferences(newPrefs);
    },
    [preferences, setPreferences]
  );

  const isImperialWeight = useCallback(() => {
    return preferences?.units?.weight === "lbs";
  }, [preferences]);

  const isImperialHeight = useCallback(() => {
    return preferences?.units?.height === "ft_in";
  }, [preferences]);

  const reloadPreferences = useCallback(async () => {
    await loadPreferences();
  }, [loadPreferences]);

  return {
    preferences,
    setPreferences,
    setUnits,
    isImperialWeight,
    isImperialHeight,
    reloadPreferences,
    loading,
  };
}
