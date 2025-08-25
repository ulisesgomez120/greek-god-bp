import { Theme } from "@/types/theme";
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from "@/config/constants";

/**
 * Dark theme definition.
 * Map semantic tokens to the constants defined in src/config/constants.ts where appropriate.
 */

const darkTheme: Theme = {
  mode: "dark",
  isDark: true,
  colors: {
    background: COLORS.backgrounds.backgroundDark, // app background (very dark)
    surface: COLORS.backgrounds.surfaceDark, // surfaces/cards
    card: COLORS.backgrounds.surfaceDark,
    text: COLORS.functional.lightText,
    subtext: COLORS.functional.neutralGray,
    primary: COLORS.primary.blue,
    primaryVariant: COLORS.primary.dark,
    secondary: COLORS.secondary.blueDeep,
    accent: COLORS.accent.progressTeal,
    border: COLORS.backgrounds.surfaceDark,
    placeholder: COLORS.functional.neutralGray,
    success: COLORS.accent.successGreen,
    error: COLORS.accent.errorRed,
    warning: COLORS.accent.warningAmber,
    // Additional semantic tokens (new)
    buttonText: COLORS.functional.lightText,
    buttonTextOnPrimary: COLORS.functional.buttonText,
    primaryOnDark: COLORS.primary.primaryOnDark,
    surfaceElevated: COLORS.backgrounds.surfaceElevated,
    lightBackground: COLORS.backgrounds.lightBackground,
  },
  typography: TYPOGRAPHY,
  spacing: SPACING,
  borderRadius: BORDER_RADIUS,
  statusBarStyle: "light-content",
};

export default darkTheme;
