# Implementation Plan

[Overview]
Fix web/mobile scrolling on the onboarding flow by applying web-specific layout constraints and navigator card styles so ScrollView can properly calculate content height on mobile browsers.

This change targets the onboarding screens which currently render a ScrollView inside SafeAreaView and KeyboardAvoidingView without robust web-specific flex/height constraints. On web (desktop mobile emulation and real mobile browsers) the body is set to overflow: hidden (react-native-web recommended), but the ScrollView and several parent containers do not consistently occupy the available height; as a result the browser does not allow internal scrolling and bottom controls (e.g., "Get Started") are cut off. The solution is to add Platform.OS === 'web' conditional styling and ensure stack navigators use cardStyle: { flex: 1 } in their screenOptions so screens occupy available space. These changes preserve native behavior on iOS/Android while fixing web layout.

[Types]
Minimal to no changes to the TypeScript types; add a small helper boolean constant and augment component props only where necessary.

Introduce a single runtime helper:

- isWeb: boolean — derived from Platform.OS === 'web' and used inside components to apply platform-specific style variants.

No changes to existing interfaces or exported types are required.

[Files]
Single sentence describing file modifications.

Detailed breakdown:

- New files to be created

  - None required.

- Existing files to be modified

  - src/screens/auth/OnboardingScreen.tsx

    - Add `const isWeb = Platform.OS === 'web'` at the top of the component function.
    - Update the JSX for each step renderer (renderWelcomeStep, renderProfileStep, renderGoalsStep, renderCompleteStep) to apply web-safe styles:
      - SafeAreaView: `style={[styles.safeArea, isWeb && styles.webSafeArea, { backgroundColor: colors.background }]}` (or analogous usage where SafeAreaView currently receives styles).
      - KeyboardAvoidingView: `style={[styles.keyboardAvoidingView, isWeb && styles.webKeyboardAvoiding]}`.
      - ScrollView: ensure `style={[styles.scrollView, isWeb && styles.webScrollView]}` and `contentContainerStyle={[styles.scrollContent, isWeb && styles.webScrollContent]}`. Ensure padding/bottom spacing is provided in contentContainerStyle, not style.
      - Container/View elements: ensure top-level container inside ScrollView uses styles that allow flex behavior to expand and push the bottom button into ScrollView content, e.g., `styles.container` updated to `minHeight: '100%'` for web or `flex: 1`.
    - Add new style entries to the StyleSheet at the bottom:
      - webSafeArea: { minHeight: '100%', display: 'flex', flex: 1 }
      - webKeyboardAvoiding: { minHeight: '100%', display: 'flex', flex: 1 }
      - webScrollView: { flex: 1 }
      - webScrollContent: { flexGrow: 1, paddingBottom: 32 } (ensure contentContainerStyle contains padding)
    - Replace any ScrollView style-based padding with contentContainerStyle equivalents (e.g., move paddingBottom/paddingHorizontal into contentContainerStyle).
    - Minor JSX adjustments: add explicit style arrays where currently simple style prop used (so we can conditionally add web styles).

  - src/navigation/AuthNavigator.tsx

    - Update the `AuthStack.Navigator`'s `screenOptions` to include `cardStyle: { flex: 1 }`.
    - This ensures the navigator's screen container stretches to full height on web and allows child ScrollView to size correctly.

  - src/navigation/AppNavigator.tsx (and other stack navigators in src/navigation/\* that use createStackNavigator)
    - OPTIONAL but recommended: add `cardStyle: { flex: 1 }` to each stack navigator's `screenOptions` where missing:
      - src/navigation/AppNavigator.tsx
      - src/navigation/WorkoutNavigator.tsx
      - src/navigation/ProfileNavigator.tsx
      - src/navigation/ProgressNavigator.tsx
      - src/navigation/AICoachNavigator.tsx
      - src/navigation/ProgressNavigator.tsx
    - If some navigators already have cardStyle set, verify value is `flex: 1` and unify.

- Files to be deleted or moved

  - None.

- Configuration file updates
  - No changes to public/index.html are required (it already contains the Expo/react-native-web style reset with `body { overflow: hidden }` and #root height). Keep as-is.

[Functions]
Single sentence describing function modifications.

Detailed breakdown:

- New functions

  - None global; changes are purely local to components and styles. No new exported functions required.

- Modified functions

  - OnboardingScreen component (export const OnboardingScreen: React.FC<OnboardingScreenProps>)

    - Add `const isWeb = Platform.OS === 'web'` immediately after hooks initialization.
    - Update renderWelcomeStep, renderProfileStep, renderGoalsStep, renderCompleteStep to apply style arrays with web variants as described in Files section.
    - Ensure ScrollView uses `contentContainerStyle` for layout/padding and `style` only for container-level sizing like `flex: 1`.
    - Move any direct padding from ScrollView.style to contentContainerStyle.

  - AuthNavigator component (export default AuthNavigator)
    - Add `cardStyle: { flex: 1 }` to the `screenOptions` object passed to `<AuthStack.Navigator>`.

- Removed functions
  - None.

[Classes]
Single sentence describing class modifications.

Detailed breakdown:

- New classes

  - None.

- Modified classes

  - None (React functional components only; style object changes only).

- Removed classes
  - None.

[Dependencies]
Single sentence describing dependency modifications.

No new npm packages are required. Changes rely on existing react-native and react-native-web behavior. No version updates are planned. If edge-case polyfills are needed for specific browsers, we will document and pull them later, but initial fix should not require additional dependencies.

[Testing]
Single sentence describing testing approach.

Testing will include local web dev server checks and mobile browser verification steps, using Chrome DevTools mobile emulation and a real mobile browser (Safari/Chrome) if available.

Test file requirements, existing test modifications, and validation strategies:

- Manual tests:
  - Start the app in web mode (e.g., `expo start --web` or `npm run web`) and open in desktop Chrome.
  - Enable mobile device emulation in DevTools (e.g., iPhone X) and verify the Onboarding welcome screen:
    - Confirm the "Get Started" button is visible and the screen scrolls to reveal it.
    - Verify ScrollView scrolls when content exceeds viewport.
    - Go through steps (press "Get Started", then "Continue" on profile step, etc.) to ensure subsequent screens also scroll.
  - Open in a real mobile browser (Safari on iPhone and Chrome on Android if available) and verify the same behaviors.
  - Verify PWA and iPhone simulator behavior remains unchanged.
- Automated tests:
  - No unit tests required for style-only change. If desired, add a snapshot test to confirm OnboardingScreen renders with the new style props on web, but this is optional.

[Implementation Order]
Single sentence describing the implementation sequence.

Apply small, reversible changes in a specific order to minimize regressions and make rollback easy.

Numbered steps:

1. Create the implementation_plan.md (this document) and create the implementation task (new_task) so the work is tracked.
2. Update `src/navigation/AuthNavigator.tsx` to add `cardStyle: { flex: 1 }` in `screenOptions`. Commit this small change and run the web app to see if layout improves (quick verification).
3. Modify `src/screens/auth/OnboardingScreen.tsx`:
   - Add `const isWeb = Platform.OS === 'web'`.
   - Add web-specific styles to StyleSheet and apply them to SafeAreaView, KeyboardAvoidingView, ScrollView (style + contentContainerStyle), and top-level container.
   - Move padding from ScrollView.style into contentContainerStyle where appropriate.
   - Commit changes.
4. (Optional) Add `cardStyle: { flex: 1 }` to other stack navigators in `src/navigation/` that use createStackNavigator if step 2 shows incomplete coverage.
5. Run the web app (`npm run web` or `expo start --web`) and perform manual verification in Chrome DevTools mobile emulation and a real device browser.
6. If issues remain, iterate:
   - Add `minHeight: '100%'` to problematic containers
   - Ensure no nested FlatList or other virtualized lists are inside ScrollView
   - Re-check contentContainerStyle usage
7. Finalize and push commits with descriptive messages and update release notes if required.
