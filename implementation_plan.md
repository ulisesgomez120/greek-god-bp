# Implementation Plan

[Overview]
Implement a theme system and apply dark/light mode throughout the React Native app, and update the React-level splash screen to use the provided image asset so the app respects system dark mode and displays the correct splash icon.

The app currently sets `userInterfaceStyle: "automatic"` in Expo config (native splash), but most React components use hardcoded light-mode colors and an emoji logo in the React splash component. This causes the native splash to look correct while the React UI (including the splash replacement) displays white backgrounds and white text when the device is in dark mode. The plan adds a ThemeContext (provider + hook), concrete theme definitions that follow the provided TrainSmart style guide, and makes systematic, minimal modifications to core UI components, navigation, and constants so the app reacts to system color scheme changes. The plan also replaces the emoji in `SplashScreen.tsx` with the actual image asset (`assets/splash-icon.png`), updates StatusBar handling, and lists tests to validate behavior on devices and simulators.

[Types]  
Add a typed theme system and small helper types for color-scheme-aware styling.

Detailed type definitions (TypeScript):

- File: src/styles/theme.types.ts
  - Description: central theme-related type definitions.
  - Content (complete specs):
    - export type ColorScheme = "light" | "dark";
    - export interface ThemeColors {
      // primary
      primaryBlue: string; // e.g. "#B5CFF8"
      primaryWhite: string; // "#FFFFFF"
      primaryDark: string; // "#1C1C1E"
      // background/surface
      background: string;
      backgroundLight: string;
      surface: string;
      card: string;
      // text
      textPrimary: string;
      textSecondary: string;
      textTertiary: string;
      // semantic
      success: string;
      warning: string;
      error: string;
      coach: string;
      // accents
      accent: string;
      }
    - export interface Theme {
      colorScheme: ColorScheme;
      colors: ThemeColors;
      // optional helpers
      statusBarStyle: "light" | "dark";
      }
    - export interface ThemeContextType {
      theme: Theme;
      colorScheme: ColorScheme;
      setColorScheme: (scheme: ColorScheme) => void;
      toggleColorScheme: () => void;
      }

Validation rules:

- Color values are 7-character hex strings `^#[0-9A-Fa-f]{6}$`.
- colorScheme must be "light" or "dark".
- statusBarStyle must match the bar style appropriate for the theme.

[Files]
Single sentence describing file modifications: create theme files and update UI components, navigation files, and constants with explicit file paths and changes.

Detailed breakdown:

- New files to be created (with full paths and purpose):
  - src/styles/theme.types.ts
    - Purpose: Type definitions for theme system (ColorScheme, Theme, ThemeContextType).
  - src/styles/themes.ts
    - Purpose: Exports two concrete Theme objects: lightTheme and darkTheme. Implements colors per style-guide (light and dark variants).
  - src/contexts/ThemeContext.tsx
    - Purpose: React Context provider that:
      - Detects system color scheme with Appearance/useColorScheme
      - Persists user's explicit override in async storage key `async.userPreferences.theme` or in Redux if desired (this plan references AsyncStorage for simplicity)
      - Provides theme object and toggle/set functions.
  - src/hooks/useTheme.ts
    - Purpose: Hook wrapper to consume ThemeContext (returns ThemeContextType).
  - src/contexts/**tests**/ThemeContext.test.tsx
    - Purpose: Unit tests verifying provider reacts to system scheme + toggle behavior.
  - src/hooks/**tests**/useTheme.test.tsx
    - Purpose: Unit tests for hook usage (basic render checks).
- Existing files to be modified (with specific changes):
  - src/components/ui/SplashScreen.tsx
    - Replace emoji logo with Image using the actual asset `assets/splash-icon.png`.
    - Make container background use theme.colors.background instead of hardcoded "#FFFFFF".
    - Make logo background and text colors theme-aware.
    - Ensure Image uses `resizeMode="contain"` and correct sizing; use require("../../../assets/splash-icon.png") from this file's path.
  - src/components/ui/Text.tsx
    - Replace static COLORS map with useTheme hook usage.
    - Map TextColor tokens ("primary", "secondary", "coach", "white", etc.) to theme.colors values.
    - Keep existing API (variant, color props) but implement fallback to theme values.
  - src/components/ui/Button.tsx
    - Swap hardcoded styles to read from theme (background, text color, border colors).
    - Provide explicit variants for primary/secondary/text and adapt shadow colors to theme.
  - App.tsx
    - Wrap top-level app tree with ThemeProvider from src/contexts/ThemeContext.tsx.
    - Replace StatusBar usage to honor theme.statusBarStyle (expo-status-bar supports `style` prop with "auto" / "light" / "dark") — set accordingly.
    - Ensure initial SplashScreen used during rehydration receives theme or renders neutral background matching native splash to avoid white flash.
  - src/config/constants.ts
    - Add a new exported object `THEME_OVERRIDES` or extend existing COLORS to include explicit dark-mode variants (mirroring style-guide dark mode colors).
    - Example additions: backgrounds.backgroundDark, backgrounds.surfaceDark, semantic coachingPrimaryDark => "#87B1F3", etc.
  - Navigation files (update list):
    - src/navigation/AppNavigator.tsx
    - src/navigation/MainAppNavigator.tsx
    - src/navigation/TabNavigator.tsx
    - src/navigation/WorkoutNavigator.tsx
    - src/navigation/ProgressNavigator.tsx
    - Change: Replace hardcoded `backgroundColor: "#FFFFFF"` and other hardcoded colors with theme.colors.background, theme.colors.card, and theme-derived text colors.
  - Select screen components:
    - src/screens/auth/OnboardingScreen.tsx (if it uses backgroundColor)
    - src/screens/progress/WorkoutHistory.tsx
    - Any screen that currently sets style backgroundColor="#FFFFFF" — search and replace with theme usage (plan lists exact files to update after search/replace).
- Files to be deleted or moved:
  - None.
- Configuration file updates:
  - app.config.ts: leave `userInterfaceStyle: "automatic"` as-is (native splash is correct); ensure splash.backgroundColor is consistent with light theme or change to neutral if required. No required changes in this plan.
  - metro.config.js / asset handling: no changes expected.

[Functions]
Single sentence describing function modifications: add theme factory and provider functions; update component render functions to read theme via hook.

Detailed breakdown:

- New functions (name, signature, file path, purpose):

  - createTheme(colorScheme: ColorScheme): Theme
    - File: src/styles/themes.ts
    - Signature: export function createTheme(scheme: ColorScheme): Theme
    - Purpose: returns Theme object for given scheme (light/dark).
  - getInitialColorScheme(): Promise<ColorScheme>
    - File: src/contexts/ThemeContext.tsx
    - Signature: async function getInitialColorScheme(): Promise<ColorScheme>
    - Purpose: checks persisted preference (AsyncStorage) and falls back to Appearance.getColorScheme() or "light".
  - setPersistedColorScheme(scheme: ColorScheme): Promise<void>
    - File: src/contexts/ThemeContext.tsx
    - Purpose: saves user override to AsyncStorage key `async.userPreferences.theme`.
  - useTheme(): ThemeContextType
    - File: src/hooks/useTheme.ts
    - Signature: export default function useTheme(): ThemeContextType
    - Purpose: Read ThemeContext and throw helpful error if missing.
  - mapTextColor(colorToken: TextColor, theme: Theme): string
    - File: src/components/ui/Text.tsx (internal helper)
    - Purpose: translate logical tokens to theme colors.

- Modified functions (exact name, current file path, required changes):

  - SplashScreen component render (src/components/ui/SplashScreen.tsx)
    - Replace the emoji View block with:
      - import { Image } from "react-native";
      - <Image source={require('../../../assets/splash-icon.png')} style={styles.splashImage} />
    - Use theme.colors.background for container and theme.colors.coach or theme.colors.primaryBlue for logo accents.
    - Keep animations intact.
  - Text component (export default in src/components/ui/Text.tsx)
    - Instead of using the hardcoded COLORS constant, call useTheme() and map the color prop to theme values.
    - Maintain existing variant/weight props and accessibility settings.
  - Button component render (src/components/ui/Button.tsx)
    - Update styles to read from theme where appropriate (background, text, border).
  - AppContent initialization flow in App.tsx
    - Ensure SplashScreen is wrapped or receives a theme (or make SplashScreen default to light/dark neutral until ThemeProvider resolves to avoid flashes).
    - Set StatusBar style: <StatusBar style={theme.statusBarStyle} /> or using expo-status-bar's props.

- Removed functions (name, file path, reason, migration strategy):
  - None removed.

[Classes]
Single sentence describing class modifications: no new classes; update functional components to use theme.

Detailed breakdown:

- New classes: none (functional components + hooks).
- Modified components (exact name, file path, specific modifications):
  - SplashScreen (src/components/ui/SplashScreen.tsx) — switch to Image splash + theme-based container/background/text colors; keep animation logic.
  - Text (src/components/ui/Text.tsx) — map color tokens to theme values using useTheme.
  - Button (src/components/ui/Button.tsx) — add theme variants and adapt shadows/contrast.
  - Navigation components — use theme values for background and card colors.

[Dependencies]
Single sentence describing dependency modifications: no new npm packages required; rely on built-in React/React Native/Expo APIs.

Details:

- No new packages required.
- Use existing APIs:
  - react (Context, hooks)
  - react-native (Appearance, useColorScheme, Image, StatusBar-related APIs)
  - expo-status-bar (StatusBar component style)
  - @react-native-async-storage/async-storage (if already present) — if not present, either use redux or add this dependency; plan assumes AsyncStorage (this is optional, see question below).
- Integration requirements:
  - Ensure Metro bundler resolves image asset; use require('../../../assets/splash-icon.png') in components to include asset in bundle.
  - Confirm `expo` app.config splash.image` already points to assets/splash-icon.png (already configured).

[Testing]
Single sentence describing testing approach: unit tests for provider/hook and visual/manual checks on devices for dark/light mode consistency (with automated visual regression where available).

Test file requirements and validation strategies:

- Unit test files:
  - src/contexts/**tests**/ThemeContext.test.tsx
    - Test: provider chooses system color scheme when no persisted override, toggles setColorScheme, persists override (mock AsyncStorage).
  - src/hooks/**tests**/useTheme.test.tsx
    - Test: hook returns context values, throws when used outside provider.
  - src/components/ui/**tests**/SplashScreen.test.tsx
    - Test: Renders Image instead of emoji; uses theme container style mapping.
  - src/components/ui/**tests**/Text.test.tsx
    - Test: color mapping returns expected theme colors given token.
  - src/components/ui/**tests**/Button.test.tsx
    - Test: primary/secondary variants map to correct theme colors in both schemes.
- Manual device checks:
  - On iOS device: set system Appearance to dark and light; verify app startup, native splash, React splash, and screens show correct colors and readable text.
  - On Android device: repeat tests, including adaptive icon visibility.
- Visual/regression:
  - If the project uses a visual regression tool (Chromatic, Percy), add baseline snapshots for light and dark themes for key screens (Splash, Onboarding, Main Dashboard).
- StatusBar checks:
  - Confirm text/icons in status bar are readable in both modes (use theme.statusBarStyle to set "light" or "dark" appropriately).

[Implementation Order]
Single sentence describing the implementation sequence: implement the theme foundation, convert core components to consume the theme, integrate provider at app root, update navigation/screens, then test and validate on devices.

Numbered steps:

1. Create theme types and concrete themes
   - Add `src/styles/theme.types.ts` and `src/styles/themes.ts`.
   - Define `createTheme()` and export `lightTheme` and `darkTheme` constants matching the style guide values.
2. Implement ThemeContext and hook
   - Add `src/contexts/ThemeContext.tsx` with provider using `Appearance`/`useColorScheme`, persisted override via AsyncStorage, and context methods `toggleColorScheme`/`setColorScheme`.
   - Add `src/hooks/useTheme.ts` for consumer convenience.
3. Wire ThemeProvider into App.tsx
   - Wrap `<Provider>` tree so theme is available during initial render and during PersistGate loading.
   - Set `StatusBar` style according to theme.statusBarStyle.
4. Update `Text` and `Button` components to use theme
   - Replace static color maps with theme lookups; keep public prop API unchanged.
5. Update `SplashScreen.tsx` to use image asset and theme-aware container style
   - Use `require('../../../assets/splash-icon.png')` for the image source and theme background for container.
   - Ensure the initial rehydration splash shows correct background to avoid white-on-white bursts in dark mode.
6. Update navigation files and screens
   - Replace hardcoded `backgroundColor`/`card` colors in navigation options and screen styles with theme colors. Search for `backgroundColor: "#FFFFFF"` and replace per file list above.
7. Add unit tests and run them
   - Implement the tests listed in [Testing].
8. Manual validation on devices (iOS + Android)
   - Confirm native splash, React splash, status bar, and screens render correctly in both modes.
9. Address any discovered contrast issues and tweak theme color shades to match style guide and accessibility targets.

Notes and edge-cases:

- When ThemeProvider needs to read persisted preference, the initial render may use a default scheme; ensure SplashScreen uses neutral background matching native splash (or the provider delays rendering the app tree until resolved).
- Metro bundle must include `assets/splash-icon.png` — using require in components ensures bundling.
- If AsyncStorage is not present, the plan can persist theme to Redux persist or skip persistence, falling back to system scheme only. If you want persistence, confirm `@react-native-async-storage/async-storage` is present; if not, I can add it in a follow-up change.
- Keep API backwards-compatible: existing components using Text variant/color props should still work after the change.
