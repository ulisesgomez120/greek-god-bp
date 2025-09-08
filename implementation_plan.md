# Implementation Plan

[Overview]
Integrate the progression-strategy guidance progressively across the app to give critical, experience-level-specific tips during onboarding, before first workouts, and in-context during workouts.

This plan describes adding dedicated guidance screens and small contextual UI components so users (all experience levels) receive short, critical guidance progressively (not all at once). The guidance will lean on the existing progression rules and education already defined in `src/constants/progressionRules.ts` and the authored markdown in `context/progression-strategy.md`. The goal is to provide concise, actionable guidance: safety reminders, what to expect per experience level, and short progression rules (e.g., "same weight for 3+ weeks if untrained", "linear progression for beginners", "RPE for early-intermediates"), surfaced at the most useful moments to avoid overwhelming beginner users.

[Types]
Minimal type additions to support guidance content and onboarding navigation.

- GuidanceContent
  - file: `src/types/guidance.ts`
  - definition:
    - export interface GuidanceContent {
      id: string; // unique id like "post_onboarding_untrained"
      level?: "untrained" | "beginner" | "early_intermediate" | "intermediate" | "advanced" | "all";
      title: string; // short heading
      bullets: string[]; // array of short bullet points
      severity?: "info" | "important" | "safety";
      linkTo?: string; // optional deep link (screen name) for more help
      }
  - validation rules:
    - id must be kebab-case, no spaces
    - bullets must be 1-6 items; each <= 140 characters
    - level "all" means shown to all users
  - relationships:
    - GuidanceContent is read-only content referenced by screens and ProgressionTip component
    - Will be populated from `src/constants/progressionRules.ts` and short extracts from `context/progression-strategy.md`

[Files]
Modify navigation and onboarding flow; add two screens and three UI components.

- New files to be created:

  - `src/screens/guidance/PostOnboardingGuidanceScreen.tsx` — Dedicated screen shown immediately after onboarding to present critical, level-specific tips and safety reminders. Provides a "Start First Workout" button which either starts the first planned workout or navigates to ProgramSelection.
  - `src/screens/guidance/FirstWorkoutPrepScreen.tsx` — Lightweight modal-like screen displayed before a user's first workout (or first N workouts) that highlights 3–5 critical points and a short checklist (warm-up, safety, form-first).
  - `src/components/guidance/GuidanceScreen.tsx` — Reusable presentation component used by both guidance screens for consistent layout, headings, bullets, illustration placeholder, and CTA.
  - `src/components/guidance/ProgressionTip.tsx` — Small inline tip component that can be embedded in `ExerciseDetailScreen` and other places; accepts GuidanceContent or a few simple props (title, bullets, severity).
  - `src/components/guidance/ExperienceLevelCard.tsx` — Enhanced experience level card used in `OnboardingScreen.tsx` to include 1–2 critical progression lines and a "Why this matters" toggle.
  - `src/types/guidance.ts` — Type definitions described above.

- Existing files to be modified:

  - `src/screens/auth/OnboardingScreen.tsx`
    - Add import for `ExperienceLevelCard` and update the experience level listing to use it.
    - After successful onboarding completion (in `handleCompleteOnboarding`), navigate to `PostOnboardingGuidance` instead of directly completing the flow (or call navigation.replace('PostOnboardingGuidance')) so the guidance screen is shown once.
    - Minor accessibility and copy updates to add a link to "Tips to get started" which opens `PostOnboardingGuidance` if the user taps it mid-flow.
  - `src/navigation/AuthNavigator.tsx`
    - Add a new route: `PostOnboardingGuidance` -> `PostOnboardingGuidanceScreen`.
    - Optionally add `FirstWorkoutPrep` route if shown via navigation.
  - `src/screens/workout/ExerciseDetailScreen.tsx`
    - Import and render `ProgressionTip` inside the expanded `formCues` or just below it when `showFormCuesExpanded` is true.
    - Pull user experience level via existing user/profile hooks (e.g., `useAuth()` or `useProfile()`).
  - `src/navigation/MainAppNavigator.tsx` (or where workout entry is handled)
    - Ensure the "first workout prep" is shown before the very first workout session as needed (trigger when user has no workout history or onboardingNew flag).
  - `src/components/workout/SetLogger.tsx`
    - Small UI hook (optional): show a one-line tip (via `ProgressionTip`) when logging the first set if user is untrained.

- Files to be deleted or moved:

  - None.

- Configuration file updates:
  - None required. No new dependencies required beyond existing stack.
  - Add `src/types/guidance.ts` to TypeScript project (tsconfig already includes src).

[Functions]
Add small helper functions and modify a few handlers.

- New functions:

  - `getGuidanceForLevel(level: ExperienceLevel): GuidanceContent[]`
    - file: `src/utils/guidance.ts`
    - signature: export function getGuidanceForLevel(level: ExperienceLevel, context?: { stage?: 'postOnboarding'|'firstWorkout'|'exercise' }): GuidanceContent[]
    - purpose: Return the small set of GuidanceContent to show for a given level and stage. Uses `PROGRESSION_EDUCATION` from `src/constants/progressionRules.ts` as fallback content.
  - `shouldShowFirstWorkoutPrep(userProfile: Partial<UserProfile>, historyCount: number): boolean`
    - file: `src/utils/guidance.ts`
    - signature: export function shouldShowFirstWorkoutPrep(profile, historyCount): boolean
    - purpose: Decide whether to show the FirstWorkoutPrep screen. Logic: show when historyCount === 0 and onboarding recently completed OR when profile.onboardingCompleted === false & experience untrained.
  - `formatGuidanceBullets(bullets: string[], maxLen?: number): string[]`
    - small utility to trim or reflow bullets to meet UI length constraints.

- Modified functions:

  - `handleCompleteOnboarding` in `src/screens/auth/OnboardingScreen.tsx`
    - change: on successful `completeOnboarding()` call, instead of only calling `onOnboardingComplete?.()` or returning to root, call `navigation.replace('PostOnboardingGuidance')` or `navigation.navigate('PostOnboardingGuidance')`. If preserving `onOnboardingComplete` is important, pass a callback or make sure the guidance screen will redirect to main app after pressing CTA.
    - reason: guarantees the guidance screen appears once after onboarding and avoids race conditions with root navigation.
  - `login`/post-login flow in `src/navigation/AuthNavigator.tsx`
    - change: no large changes, but ensure post-onboarding route exists so the navigator won't fail.

- Removed functions:
  - None.

[Classes]
No new classes required; implement as functional components and utility functions.

- New components (functional components rather than classes):
  - `GuidanceScreen` (file: `src/components/guidance/GuidanceScreen.tsx`) — key props: title:string, bullets:string[], severity?:string, ctaLabel?:string, onCTAPress?:() => void
  - `ProgressionTip` (file: `src/components/guidance/ProgressionTip.tsx`) — key props: title?:string, bullets?:string[], compact?:boolean, severity?:string
  - `ExperienceLevelCard` (file: `src/components/guidance/ExperienceLevelCard.tsx`) — accepts `ExperienceLevelInfo` and `onSelect: (level) => void`
- Modified components:

  - `OnboardingScreen` — integrate `ExperienceLevelCard` to replace the plain Button list for experience levels and add an info toggle.
  - `ExerciseDetailScreen` — add inline `ProgressionTip` when `showFormCuesExpanded` is true.

- Removed classes:
  - None.

[Dependencies]
No new npm packages are required.

- Use existing `src/constants/progressionRules.ts` for canonical content (RPE, progressive overload, safety).
- No external UI library needed. Keep to existing components and styling tokens.
- If you prefer richer UI (e.g., illustrations), add a small image under `assets/` and reference it in the `GuidanceScreen` (optional).

[Testing]
Unit and integration testing approach.

- Single-sentence summary: Add component-level unit tests for the guidance components and an integration test that verifies the onboarding -> post-guidance -> first-workout flow.
- Test files to add:
  - `__tests__/components/guidance/GuidanceScreen.test.tsx` — render snapshot and accessibility checks.
  - `__tests__/components/guidance/ProgressionTip.test.tsx` — ensure conditional rendering and severity styles.
  - `__tests__/screens/PostOnboardingGuidanceScreen.test.tsx` — navigation behavior: pressing CTA calls navigation.
  - `__tests__/screens/OnboardingScreen.integration.test.tsx` — simulate onboarding flow and assert that `PostOnboardingGuidance` is pushed/replaced.
- Validation strategy:
  - Manual QA across experience levels to ensure content is correct.
  - Accessibility (a11y) scan for buttons and headings.
  - Small user acceptance test: create 3 test users (untrained, beginner, early_intermediate) and validate guidance content displayed matches level.
  - Add a smoke test ensuring `src/constants/progressionRules.ts` PROGRESSION_EDUCATION keys are referenced without runtime errors (mock constants in tests).

[Implementation Order]
Single sentence: Implement minimal UI components, wire them into onboarding and workout flows, then add tests and QA.

1. Create types and small utils:
   - Add `src/types/guidance.ts`
   - Add `src/utils/guidance.ts` with `getGuidanceForLevel` and `shouldShowFirstWorkoutPrep`
2. Create presentation components:
   - `src/components/guidance/GuidanceScreen.tsx`
   - `src/components/guidance/ProgressionTip.tsx`
   - `src/components/guidance/ExperienceLevelCard.tsx`
3. Add guidance screens:
   - `src/screens/guidance/PostOnboardingGuidanceScreen.tsx`
   - `src/screens/guidance/FirstWorkoutPrepScreen.tsx`
4. Wire navigation:
   - Add routes in `src/navigation/AuthNavigator.tsx` and `src/navigation/MainAppNavigator.tsx` as needed.
5. Update onboarding flow:
   - Modify `src/screens/auth/OnboardingScreen.tsx` `handleCompleteOnboarding` to navigate to PostOnboardingGuidance on success, replace experience level UI with `ExperienceLevelCard`.
6. Add in-context tips:
   - Insert `ProgressionTip` into `src/screens/workout/ExerciseDetailScreen.tsx` inside `formCues` when expanded, and optionally into `SetLogger` for first sets.
7. Add tests:
   - Implement unit tests and an integration test for onboarding -> guidance -> first workout.
8. QA & polish:
   - Verify copy uses short bullets (max 6) and is not overwhelming.
   - Confirm navigation behavior across platforms (web, iOS, Android).
9. Release:
   - Merge, and perform a small beta test with beginner users before full release.
