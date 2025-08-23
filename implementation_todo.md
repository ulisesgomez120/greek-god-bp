# Theme Implementation TODO

Summary:
This file captures the actionable checklist for implementing theme support (light/dark) across the app per the implementation_plan.md. It tracks steps from creating theme types to manual device validation and accessibility fixes.

Context:

- Investigation already completed: located splash, theme constants, core UI components, and navigation files that need updates.
- Goal: Introduce typed theme system, ThemeProvider + hook, update core UI components & navigation to consume theme values, and replace React-level splash emoji with `assets/splash-icon.png`. Ensure StatusBar and initial splash match native splash to avoid flashes.

Master Checklist:

- [x] Analyze requirements and repo (investigation completed)
- [x] Create this todo list / plan tracker (implementation_todo.md)

- [ ] Step 1: Create theme types and concrete theme definitions

  - [ ] Add TS types: Theme, ThemeColors, ThemeTypography, ThemeSpacing
  - [ ] Create `src/styles/themes/light.ts` and `src/styles/themes/dark.ts`
  - [ ] Export a single `src/styles/themes/index.ts` for easy imports

- [ ] Step 2: Implement ThemeContext and useTheme hook

  - [ ] Create `src/contexts/ThemeContext.tsx` with provider that:
    - Detects system theme using `useColorScheme()` initially
    - Optionally supports a persisted override (AsyncStorage) if available
  - [ ] Create `src/hooks/useTheme.ts` that wraps useContext and returns typed theme + toggle functions
  - [ ] Add types in `src/types/theme.ts` if needed

- [ ] Step 3: Wire ThemeProvider into App.tsx and update StatusBar

  - [ ] Wrap app root with <ThemeProvider>
  - [ ] Ensure `PersistGate` rehydration interacts correctly with splash display
  - [ ] Set `StatusBar` style based on current theme (e.g., `barStyle={theme.statusBarStyle}`)

- [ ] Step 4: Update core UI components to use theme

  - [ ] `src/components/ui/Text.tsx`:
    - Map existing color tokens to theme.colors
    - Keep existing public API (variant, color props) intact
  - [ ] `src/components/ui/Button.tsx`:
    - Use theme for backgrounds, borders, shadows, and text color
    - Maintain current props and behavior
  - [ ] Other shared UI components:
    - `Toast`, `LoadingButton`, `SkeletonLoader` — update as needed

- [ ] Step 5: Update SplashScreen to use assets and theme background

  - [ ] Replace emoji with:
    ```
    <Image source={require('../../../../assets/splash-icon.png')} />
    ```
    (use correct relative path)
  - [ ] Use `theme.colors.background` for container background
  - [ ] Ensure animations/sizing remain intact and responsive
  - [ ] Make sure this React-level splash matches `app.config.ts` native splash background to avoid flashes

- [ ] Step 6: Replace hardcoded background colors across navigation and screens

  - [ ] Search for `backgroundColor: "#FFFFFF"`, `#fff`, and similar hardcoded light backgrounds
  - [ ] Replace with `theme.colors.background` (or theme token)
  - [ ] Update:
    - `src/navigation/AppNavigator.tsx`
    - `src/navigation/MainAppNavigator.tsx`
    - `src/navigation/TabNavigator.tsx`
    - `src/navigation/WorkoutNavigator.tsx`
    - `src/navigation/ProgressNavigator.tsx`
  - [ ] Check screens in `src/screens/**` for any hard-coded backgrounds

- [ ] Step 7: Add unit tests and run test suite

  - [ ] Add tests for ThemeContext and useTheme hook (light/dark and override behavior)
  - [ ] Update component tests to assert dark/light styles where practical
  - [ ] Run the test suite and fix failures

- [ ] Step 8: Manual device validation (iOS + Android dark/light)

  - [ ] Validate native splash and React-level splash alignment (no white flash in dark mode)
  - [ ] Validate StatusBar colors, navigation backgrounds, and text contrast
  - [ ] Validate splash image visibility and sizing

- [ ] Step 9: Fix accessibility/contrast issues and finalize
  - [ ] Run accessibility checks for contrast ratio
  - [ ] Adjust theme colors if needed to meet accessibility standards
  - [ ] Finalize PR with description and testing notes

Notes & Constraints:

- Use `require(...)` for including `assets/splash-icon.png` so Metro bundles it.
- If `@react-native-async-storage/async-storage` is not available, default to system-only theme detection; gate persistence behind availability.
- Keep component public APIs unchanged where possible to minimize downstream modifications.
- Re-run implementation_plan.md sections periodically for detailed implementation order and types.

Implementation file pointers:

- Themes: `src/styles/themes/`
- Context: `src/contexts/ThemeContext.tsx`
- Hook: `src/hooks/useTheme.ts`
- Core components: `src/components/ui/Text.tsx`, `src/components/ui/Button.tsx`, `src/components/ui/SplashScreen.tsx`
- App root: `App.tsx`

Created by: automation (Cline assistant)
Date: 2025-08-23
