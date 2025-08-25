# Implementation Plan

[Overview]
Fix dark-mode theming issues on the authentication screens and implement a PWA-friendly splash screen display (minimum 2s) while preserving the existing design system and accessibility requirements. The work will replace hardcoded colors in auth screens and input styles with theme tokens, adjust the dark palette for improved legibility, add deterministic button text-contrast behavior, and add a splash-screen timing hook that ensures the PWA splash shows for at least two seconds while the app initializes.

This change is needed because multiple auth screens currently use hardcoded hex values (white backgrounds, cornflower blue links/buttons, and black labels) which bypass the centralized Theme system. That leads to visual inconsistencies and poor contrast in dark mode. The plan keeps the ThemeProvider and theme shapes intact, expands semantic tokens where necessary, updates components to be theme-aware, and provides automated contrast rules so button text remains readable across light/dark modes and palette changes. The splash-screen implementation will be deterministic and reusable for both native and web (PWA) flows.

[Types]  
Add/adjust theme and splash-screen related types for consistent, typed usage across the app.

- Expand `src/types/theme.ts` (ThemeColors) with the following new semantic tokens:
  - `buttonText: string` — recommended text color to use on primary button backgrounds.
  - `buttonTextOnPrimary?: string` — explicit override for primary button text when needed.
  - `primaryOnDark?: string` — color to use for primary elements when on dark surfaces.
  - `surfaceElevated: string` — for cards and elevated surfaces in dark mode.
  - `lightBackground?: string` — small lighter background variant for dark mode groups.
- Add a new type file or extend an existing types file for splash config:
  - In `src/types/theme.ts` (or add `src/types/splash.ts`):
    - export type `SplashScreenState = 'loading' | 'ready' | 'hidden'`
    - export interface `SplashScreenConfig { minimumDisplayTimeMs: number; showProgressIndicator?: boolean; }`

Validation / rules:

- All new color fields are required in concrete theme objects (light/dark) to avoid runtime undefined access.
- Color strings must be valid 6- or 8-digit hex (#RRGGBB or #RRGGBBAA). The implementation should not enforce hex format at runtime but tests will assert valid tokens.

[Files]  
All changes reference exact paths. The plan modifies existing files and adds a small reusable hook file and tests.

- New files to create:
  - `src/hooks/useSplashScreen.ts` - Hook to coordinate splash-screen minimum display time and loading state. Exports `useSplashScreen(config?: Partial<SplashScreenConfig>)`.
  - `__tests__/hooks/useSplashScreen.test.tsx` - Unit tests for the hook.
  - `__tests__/components/SplashScreen.test.tsx` - Component tests ensuring minimum display time and theme integration.
- Existing files to be modified (exact edits listed under Functions and Classes):

  - `src/types/theme.ts` — add new theme tokens and exports (buttonText, surfaceElevated, lightBackground, splash config types).
  - `src/config/constants.ts` — update `COLORS` block to include new semantic tokens and add a tuned dark palette (lighter dark background).
  - `src/styles/themes/dark.ts` — replace color mappings to include the new tokens and lighten background from `#0D1117` to `#15171B` (or `#1A1A1A`) and add `surfaceElevated`.
  - `src/styles/themes/light.ts` — ensure new semantic tokens are present, clarify button text behavior (primary button uses dark text).
  - `src/styles/inputStyles.ts` — convert hardcoded color constants to dynamic functions accepting a `colors` theme object (or switch to exported functions `getInputStyle(colors, variant?, state?)`).
  - `src/components/ui/Button.tsx` — refine color computation, use a new `getButtonTextColor(backgroundColor, colors)` helper; remove concatenation tricks relying on hex alpha strings where hex may be 6-digit; ensure ActivityIndicator color and disabled state compute colors from theme tokens.
  - `src/components/ui/Text.tsx` — ensure color map uses `colors` fields and remove any hardcoded `"#FFFFFF"` fallback for `white` mapping (use `colors.functional.lightText`).
  - `src/components/ui/SplashScreen.tsx` — integrate `useSplashScreen` and use theme tokens for background/logo color; export an optional `minimumDisplayTimeMs` prop.
  - `App.tsx` — update app initialization to coordinate with `useSplashScreen` and ensure the `PersistGate` loading splash and AppContent splash respect the minimum display time. The `SplashScreen` component used in `PersistGate` will remain but we will ensure it is shown for at least the configured time on web.
  - Authentication screens (replace exact hardcoded color usage with theme tokens):
    - `src/screens/auth/LoginScreen.tsx`
    - `src/screens/auth/RegisterScreen.tsx`
    - `src/screens/auth/ForgotPasswordScreen.tsx`
    - `src/screens/auth/EmailVerificationScreen.tsx`
    - `src/screens/auth/OnboardingScreen.tsx`
  - `src/styles/themes/index.ts` — no path changes, but ensure exported `getTheme` returns object satisfying new type.

- Files to be deleted: None.
- Files to be moved: None.
- Configuration updates:
  - No new dependencies required. If you prefer an external contrast library (e.g., `tinycolor2`), this plan intentionally avoids new runtime deps and implements a small contrast helper in `src/utils/colorUtils.ts`.
  - Add tests to jest config if not already included; update test-runner to include new tests.

[Functions]  
Precise function signatures and responsibilities. Include new helper utilities.

- New functions/hooks:

  - `export function useSplashScreen(config?: Partial<SplashScreenConfig>): { state: SplashScreenState; show: () => void; hide: () => void; }`
    - File: `src/hooks/useSplashScreen.ts`
    - Purpose: Centralize logic to ensure the splash is shown for at least `minimumDisplayTimeMs` while app initialization (or PWA hydration) happens. Should support `show()` and `hide()` calls. The hook will internally track startedAt timestamp and defer `hide()` until `startedAt + minimumDisplayTimeMs`.
  - `export function getButtonTextColor(backgroundHex: string, colors: ThemeColors): string`
    - File: `src/utils/colorUtils.ts` (create new)
    - Purpose: Return either `colors.buttonText` or `colors.text` or `#000`/`#FFF` depending on computed contrast ratio. Implementation: compute luminance/contrast using standard WCAG formula; threshold at 4.5:1 for normal text; if `colors.buttonTextOnPrimary` is defined use that override.
  - `export function adjustHexAlpha(hex: string, alphaDecimal: number): string`
    - File: `src/utils/colorUtils.ts`
    - Purpose: Helper to produce 8-digit hex for disabled states; prefer to compute rgba strings for clarity when necessary.

- Modified functions:

  - `getInputStyle(variant, state)` → `getInputStyle(colors, variant?, state?)`
    - File: `src/styles/inputStyles.ts`
    - Changes:
      - Accept `colors: ThemeColors` as first arg, return TextStyle[] using theme tokens (e.g., backgroundColor: colors.surface or colors.card depending on mode).
      - Use `colors.primary` for focused border color instead of hardcoded `#B5CFF8`.
  - Button internals:
    - In `src/components/ui/Button.tsx`, the internal color maps become dynamic:
      - `variantStyles.primary.backgroundColor = colors.primary;`
      - `textColorMap.primary = getButtonTextColor(colors.primary, colors);`
      - Disabled styles should use `adjustHexAlpha` or rgba strings using `colors` tokens to produce consistent disabled appearances.
  - `SplashScreen`:
    - Add props: `minimumDisplayTimeMs?: number` (default 2000), `message?: string`.
    - Use `useSplashScreen` to prevent unmounting before minimum time.

- Removed functions:
  - None. Existing small helpers remain but will be updated to accept `colors` where necessary.

[Classes]  
No new ES6 classes will be introduced; changes are functional component and hook oriented.

- New components/hook classes (functional components):
  - New hook `useSplashScreen` (file: `src/hooks/useSplashScreen.ts`).
- Modified components (file path + exact modifications):
  - `src/components/ui/Button.tsx`:
    - Replace inline `textColorMap` with `getButtonTextColor` to ensure proper contrast per user's preference (for pale blue background use dark text instead of white).
    - Ensure `Text` child uses `color` prop derived from `textColor`.
    - Use theme `colors.surface` for `danger` text fallback rather than `"#FFFFFF"` hardcoding.
  - `src/components/ui/Text.tsx`:
    - Ensure `white` color alias maps to `colors.functional.lightText` rather than hardcoded "#FFFFFF".
  - Auth screens:
    - Remove all hardcoded hex color strings in style objects (e.g., `backgroundColor: "#FFFFFF"`) and change to theme usage:
      - e.g., `safeArea` style becomes `style={[styles.safeArea, { backgroundColor: colors.background }]}` (as already used in some screens).
      - Any static style referencing `#B5CFF8` should use `colors.primary` or `colors.primaryVariant` depending on desired background vs emphasis.
    - Ensure link-like text uses `colors.primary` token and uses `Text` component with proper variant so color is applied theme-wise.

[Dependencies]  
Single-sentence summary: no external packages needed; implement all behavior using existing React Native / Expo APIs.

- No new npm packages will be added by default.
- Optional (developer choice): `tinycolor2` or `color` for robust color manipulation and contrast calculations if you prefer an external library. If accepted, add to package.json: `tinycolor2@^1.4.2`.
- Use existing `@react-native-async-storage/async-storage` and `expo-splash-screen` already present in repo (the ThemeContext already conditionally uses AsyncStorage).

[Testing]  
Single-sentence summary: add unit tests for new hook and component behavior, and integration tests for auth screens in both modes.

- Unit tests:
  - `__tests__/hooks/useSplashScreen.test.tsx`:
    - Test that `hide()` is deferred until `minimumDisplayTimeMs` has elapsed.
    - Simulate `show()` then immediate `hide()` and validate deferred hide logic.
  - `__tests__/utils/colorUtils.test.ts`:
    - Test `getButtonTextColor` returns dark text for `#B5CFF8` and white text for darker blue variants; test edge contrast cases.
- Component tests:
  - `__tests__/components/SplashScreen.test.tsx`:
    - Render the splash component, assert initial render and that it remains visible for at least minimum time.
- Manual testing checklist:
  - Switch app to dark mode (web and native) and verify:
    - Labels are not black; they use `colors.text` mapped from theme.
    - Login page buttons and link colors are consistent across Login/Register pages.
    - Primary button on pale blue background uses dark text for good contrast (specifically change button text to `#1C1C1E` when background is `#B5CFF8`).
    - Forgot password & confirm email pages use dark backgrounds/surfaces as per theme (not white).
    - Dark background lighten change is visible and improves legibility.
    - PWA behavior: splash screen displays on initial load for at least 2000ms while the app begins initialization.

[Implementation Order]  
Single-sentence summary: apply theme/type changes first, then component updates, then splash timing, then tests and verification.

1. Update theme and constants
   - Edit `src/types/theme.ts` to add new tokens and splash types.
   - Edit `src/config/constants.ts` to include new color tokens and tuned dark palette. Use `#15171B` or `#1A1A1A` as the new `backgroundDark` and add `surfaceElevated: "#23262B"` or `#21262D` variant.
   - Update `src/styles/themes/dark.ts` and `src/styles/themes/light.ts` to include required tokens and ensure `buttonText` is set to `#1C1C1E` for pale blue primary backgrounds.
2. Make input styles theme-aware
   - Modify `src/styles/inputStyles.ts` to accept `colors` as first parameter and replace hardcoded colors with theme tokens. Update imports in auth screens to pass `colors` from `useTheme()`.
3. Fix button text contrast
   - Add `src/utils/colorUtils.ts` with `getButtonTextColor` and `adjustHexAlpha`.
   - Update `src/components/ui/Button.tsx` to use `getButtonTextColor(colors.primary, colors)` for primary variant text color; ensure the `Text` child uses the computed text color.
   - Replace any direct white-on-blue text in auth screens with theme-driven `Button` usage.
4. Update auth screens
   - For each auth screen listed earlier:
     - Replace style fields using hardcoded hex values with theme-based values (use the `colors` object from `useTheme()`).
     - Move inline style properties to use style arrays when they depend on runtime theme (e.g., `style={[styles.safeArea, { backgroundColor: colors.background }]}`).
     - Ensure label text uses the `Text` component color tokens (primary/subtext) rather than raw style color text.
5. Implement splash timing
   - Add `src/hooks/useSplashScreen.ts`.
   - Update `src/components/ui/SplashScreen.tsx` to accept `minimumDisplayTimeMs` prop and use `useSplashScreen`.
   - Update `App.tsx` to coordinate `PersistGate` and `AppContent` with `useSplashScreen` so splash is shown at least 2000ms on web/PWA init.
6. Tests and validation
   - Add the tests described earlier and run the test suite.
   - Manually test on web in dark mode (PWA) to verify 2s splash and theming.
7. Polish & PR
   - Run lint/format; update any snapshots; add a short comment in changelog/PR describing changes and the reasoning behind contrast decisions.

---

Notes on specific contrast decision (your requested minor detail):

- For the primary button on the default (light) theme the background is `#B5CFF8` (pale cornflower) and the plan will set the button text color to `#1C1C1E` (dark) to satisfy WCAG AA (contrast target >= 4.5:1 for normal text). This will be computed by `getButtonTextColor` so if the primary color changes in the future the function will pick the appropriate text color automatically.
- In dark mode, if `colors.primary` is the lighter adapted primary (e.g., `#87B1F3`), we will compute contrast and fall back to white (`colors.functional.lightText`) when that yields better contrast. The `buttonTextOnPrimary` token can be provided per-theme for overrides.

---

Plan Document Navigation Commands

# Read Overview section

sed -n '/[Overview]/,/[Types]/p' implementation_plan.md | head -n 1 | cat

# Read Types section

sed -n '/[Types]/,/[Files]/p' implementation_plan.md | head -n 1 | cat

# Read Files section

sed -n '/[Files]/,/[Functions]/p' implementation_plan.md | head -n 1 | cat

# Read Functions section

sed -n '/[Functions]/,/[Classes]/p' implementation_plan.md | head -n 1 | cat

# Read Classes section

sed -n '/[Classes]/,/[Dependencies]/p' implementation_plan.md | head -n 1 | cat

# Read Dependencies section

sed -n '/[Dependencies]/,/[Testing]/p' implementation_plan.md | head -n 1 | cat

# Read Testing section

sed -n '/[Testing]/,/[Implementation Order]/p' implementation_plan.md | head -n 1 | cat

# Read Implementation Order section

sed -n '/[Implementation Order]/,$p' implementation_plan.md | cat
