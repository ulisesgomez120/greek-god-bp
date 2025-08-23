import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { Appearance, useColorScheme } from "react-native";
import type { ReactNode } from "react";
import type { Theme as AppTheme, ThemeMode } from "@/types/theme";
import { getTheme } from "@/styles/themes";

let AsyncStorage: any = null;
try {
  // Try to load AsyncStorage if it's installed. If not available, persistence is gracefully disabled.
  // We use require so this file doesn't fail at module-evaluation time in environments without the package.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AsyncStorage = require("@react-native-async-storage/async-storage").default;
} catch (e) {
  AsyncStorage = null;
}

const THEME_PERSIST_KEY = "app_theme_override";

/**
 * Context value exposed by ThemeProvider.
 */
export type ThemeContextValue = {
  mode: ThemeMode;
  theme: AppTheme;
  isDark: boolean;
  setMode: (mode: ThemeMode, persist?: boolean) => Promise<void>;
  toggleMode: (persist?: boolean) => Promise<void>;
  clearOverride: () => Promise<void>;
  usingSystemTheme: boolean;
};

const defaultMode: ThemeMode = "light";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

type ThemeProviderProps = {
  children: ReactNode;
  /**
   * If true, attempt to read persisted user override from AsyncStorage on mount.
   * If AsyncStorage is not found, this is a no-op and the provider falls back to system theme.
   */
  enablePersistence?: boolean;
};

export const ThemeProvider = ({ children, enablePersistence = true }: ThemeProviderProps) => {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [usingSystemTheme, setUsingSystemTheme] = useState<boolean>(true);
  const [mode, setModeState] = useState<ThemeMode>((systemScheme as ThemeMode) || defaultMode);

  // Resolve AppTheme from concrete mode
  const theme = useMemo(() => getTheme(mode), [mode]);

  // Initialize from AsyncStorage (if enabled)
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (enablePersistence && AsyncStorage) {
        try {
          const stored = await AsyncStorage.getItem(THEME_PERSIST_KEY);
          if (!mounted) return;
          if (stored === "light" || stored === "dark") {
            setModeState(stored);
            setUsingSystemTheme(false);
            return;
          }
        } catch (e) {
          // ignore persistence errors and fall back to system
        }
      }

      // No persisted value: use system theme if available
      const resolved = (systemScheme as ThemeMode) || defaultMode;
      setModeState(resolved);
      setUsingSystemTheme(true);
    };

    init();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enablePersistence]); // systemScheme isn't included here intentionally; we'll listen to Appearance changes separately

  // Listen to system appearance changes when we're using the system theme (no override)
  useEffect(() => {
    const listener = (preferences: Appearance.AppearancePreferences) => {
      const colorScheme = preferences.colorScheme ?? null;
      if (usingSystemTheme) {
        const resolved = (colorScheme === "dark" ? "dark" : "light") as ThemeMode;
        setModeState(resolved);
      }
    };

    const subscription = Appearance.addChangeListener(listener);
    return () => subscription.remove();
  }, [usingSystemTheme]);

  // If the user has chosen to follow system and systemScheme changes on mount, apply it.
  useEffect(() => {
    if (usingSystemTheme && systemScheme) {
      setModeState(systemScheme as ThemeMode);
    }
  }, [systemScheme, usingSystemTheme]);

  const persistMode = useCallback(
    async (newMode: ThemeMode | null) => {
      if (!enablePersistence || !AsyncStorage) return;
      try {
        if (newMode === null) {
          await AsyncStorage.removeItem(THEME_PERSIST_KEY);
        } else {
          await AsyncStorage.setItem(THEME_PERSIST_KEY, newMode);
        }
      } catch (e) {
        // swallow persistence errors; app should continue to function
      }
    },
    [enablePersistence]
  );

  const setMode = useCallback(
    async (newMode: ThemeMode, persist = true) => {
      setModeState(newMode);
      if (persist) {
        await persistMode(newMode);
        setUsingSystemTheme(false);
      } else {
        // If caller requested non-persistent set, keep the usingSystemTheme flag unchanged
      }
    },
    [persistMode]
  );

  const toggleMode = useCallback(
    async (persist = true) => {
      const next: ThemeMode = mode === "dark" ? "light" : "dark";
      await setMode(next, persist);
    },
    [mode, setMode]
  );

  const clearOverride = useCallback(async () => {
    await persistMode(null);
    // revert to system theme
    const resolved = (useColorScheme() as ThemeMode) || defaultMode;
    setModeState(resolved);
    setUsingSystemTheme(true);
  }, [persistMode]);

  const value: ThemeContextValue = useMemo(
    () => ({
      mode,
      theme,
      isDark: mode === "dark",
      setMode,
      toggleMode,
      clearOverride,
      usingSystemTheme,
    }),
    [mode, theme, setMode, toggleMode, clearOverride, usingSystemTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeContext = () => {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within a ThemeProvider");
  }
  return ctx;
};

export default ThemeContext;
