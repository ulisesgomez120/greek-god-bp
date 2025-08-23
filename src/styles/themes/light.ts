import { Theme } from "@/types/theme";
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from "@/config/constants";

/**
 * Light theme definition.
 * Map semantic tokens to the constants defined in src/config/constants.ts where appropriate.
 */

const lightTheme: Theme = {
  mode: "light",
  isDark: false,
  colors: {
    background: COLORS.backgrounds.backgroundLight, // app background
    surface: COLORS.primary.white, // surfaces/cards
    card: COLORS.primary.white,
    text: COLORS.functional.darkText,
    subtext: COLORS.functional.neutralGray,
    primary: COLORS.primary.blue,
    primaryVariant: COLORS.secondary.blueDeep,
    secondary: COLORS.secondary.blueDeep,
    accent: COLORS.accent.progressTeal,
    border: COLORS.secondary.gray,
    placeholder: COLORS.functional.neutralGray,
    success: COLORS.accent.successGreen,
    error: COLORS.accent.errorRed,
    warning: COLORS.accent.warningAmber,
  },
  typography: TYPOGRAPHY,
  spacing: SPACING,
  borderRadius: BORDER_RADIUS,
  statusBarStyle: "dark-content",
};

export default lightTheme;
