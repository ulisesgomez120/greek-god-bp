import lightTheme from "./light";
import darkTheme from "./dark";
import type { ThemeMode } from "@/types/theme";

/**
 * Theme exports and helper.
 * Use getTheme(mode) to resolve a concrete theme object.
 */

const themes = {
  light: lightTheme,
  dark: darkTheme,
};

export { lightTheme, darkTheme, themes };

export function getTheme(mode: ThemeMode) {
  return mode === "dark" ? darkTheme : lightTheme;
}

export default themes;
