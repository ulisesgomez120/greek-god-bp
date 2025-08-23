import { useThemeContext } from "@/contexts/ThemeContext";
import type { Theme } from "@/types/theme";

/**
 * useTheme hook
 * Provides easy access to the typed theme and helper functions.
 */
export const useTheme = () => {
  const ctx = useThemeContext();

  return {
    theme: ctx.theme as Theme,
    colors: ctx.theme.colors,
    mode: ctx.mode,
    isDark: ctx.isDark,
    usingSystemTheme: ctx.usingSystemTheme,
    statusBarStyle: ctx.theme.statusBarStyle,
    setMode: ctx.setMode,
    toggleMode: ctx.toggleMode,
    clearOverride: ctx.clearOverride,
  };
};

export default useTheme;
