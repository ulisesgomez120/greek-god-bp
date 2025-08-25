/**
 * Theme type definitions used across the app.
 * Keep these minimal and typed to the existing design constants where useful.
 */

import { TYPOGRAPHY, SPACING, BORDER_RADIUS } from "@/config/constants";

export type ThemeMode = "light" | "dark";

export type ThemeColors = {
  background: string; // app background
  surface: string; // surfaces/cards
  card: string; // card backgrounds
  text: string; // primary text
  subtext: string; // secondary text
  primary: string;
  primaryVariant?: string;
  secondary: string;
  accent: string;
  border: string;
  placeholder: string;
  success: string;
  error: string;
  warning: string;
  // Buttons and actionable text
  buttonText: string;
  buttonTextOnPrimary?: string;
  // Colors tuned for dark surfaces
  primaryOnDark?: string;
  surfaceElevated: string;
  lightBackground?: string;
  // add other semantic colors as needed
};

export type Theme = {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  typography: typeof TYPOGRAPHY;
  spacing: typeof SPACING;
  borderRadius: typeof BORDER_RADIUS;
  // StatusBar barStyle strings used by react-native
  statusBarStyle: "dark-content" | "light-content" | "default";
};

/**
 * Splash screen configuration & state used by the splash hook/component.
 */
export type SplashScreenState = "loading" | "ready" | "hidden";

export interface SplashScreenConfig {
  minimumDisplayTimeMs: number;
  showProgressIndicator?: boolean;
}
