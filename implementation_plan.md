# Implementation Plan

[Overview]
Standardize fitness goal definitions across onboarding and profile-edit flows by using the single source of truth `DEFAULT_FITNESS_GOALS` from `src/types/profile.ts`, update the onboarding UI to match the profile edit UI, and remove/deprecate legacy `FITNESS_GOALS` constants so IDs, labels, and persistence remain consistent across the app.

This change addresses a runtime/data-consistency bug discovered during end-to-end testing: the onboarding flow and the profile edit flow used two separate goal definitions (different IDs, labels and icon formats), which could produce mismatched goal IDs in user profiles and inconsistent UI. The implementation will:

- Make `src/types/profile.ts` the authoritative source for all fitness goal definitions.
- Update `OnboardingScreen` to render and persist goals using `DEFAULT_FITNESS_GOALS` with the same visual style (card-based) used by `ProfileEditScreen`.
- Remove or mark deprecated any legacy `FITNESS_GOALS` constants and update all references to use the default list.
- Run type-check, automated tests and manual verification steps to ensure no regressions.

[Types]  
Use the existing typed `FitnessGoal` and `DEFAULT_FITNESS_GOALS` from `src/types/profile.ts` as the canonical types and runtime list.

Detailed type definitions and constraints:

- FitnessGoal (from src/types/profile.ts)
  - id: string (canonical identifier used in user profiles; must be stable)
  - name: string (display label)
  - description: string (short description for UI)
  - category: "strength" | "muscle" | "endurance" | "weight_loss" | "general"
  - icon: string (icon name or emoji string; UI will accept either)
  - popular: boolean
- Validation rules:
  - id must be kebab_case or snake_case (consistent with existing DEFAULT_FITNESS_GOALS values: e.g., "build_muscle", "get_stronger")
  - name non-empty, <= 60 chars
  - description <= 160 chars
  - category must be one of the allowed enums
  - icon is optional but encouraged for consistent visual display
- Backwards compatibility:
  - When migrating from legacy goal IDs, map legacy IDs to the new canonical IDs if necessary (see Migration section below).

[Files]
Single sentence describing file modifications:
Modify onboarding UI and constants, ensure all references use DEFAULT_FITNESS_GOALS, and optionally remove legacy constants.

Detailed breakdown:

- New files to be created:

  - (none required for this change)

- Existing files to be modified (exact path + specific changes):

  - src/screens/auth/OnboardingScreen.tsx
    - Replace import of legacy `FITNESS_GOALS` with `DEFAULT_FITNESS_GOALS` from `src/types/profile`.
    - Update EXPERIENCE_LEVELS consumption to use the array/object shape exported from `src/types/profile` (or call helper `getExperienceLevelInfo`) so rendering and labels are consistent.
    - Rework the "goals" step renderer:
      - Replace grid Button-based rendering that used `FITNESS_GOALS` entries with card/button layout consistent with ProfileEditScreen (use same styles or copy structure).
      - Use `goal.id`, `goal.name`, `goal.description`, `goal.popular`, `goal.icon`.
    - Ensure state uses the same IDs `string[]` that profile edit uses and `updateProfile` payload includes `fitnessGoals: selectedGoals`.
    - Use `getExperienceLevelInfo` to display experience-level name where appropriate.
  - src/constants/auth.ts
    - Remove or mark deprecated the legacy `FITNESS_GOALS` data structure.
    - If removing, ensure any types referencing `keyof typeof FITNESS_GOALS` are updated to appropriate types (e.g., `string` or to the canonical type exported from src/types/profile).
    - Option chosen here: deprecate by replacing value with an empty object and add a clear comment indicating the canonical list is in `src/types/profile.ts`.
  - src/types/profile.ts
    - No structural change required for types themselves; confirm `DEFAULT_FITNESS_GOALS` contains desired IDs and labels (it currently does).
  - src/screens/profile/ProfileEditScreen.tsx
    - No changes required for behavior/style (source of design). Confirm listens to `DEFAULT_FITNESS_GOALS` (already does).
  - src/screens/profile/ProfileSetupScreen.tsx
    - Confirm it already uses `DEFAULT_FITNESS_GOALS` (no change required) but run a grep/check and update if needed.

- Files to be deleted or moved:

  - Optionally remove legacy `FITNESS_GOALS` entries from `src/constants/auth.ts` once all references are updated across the repo and external packages are verified not to rely on it. For safety, prefer deprecation + empty export first, then permanent removal in a follow-up PR.

- Configuration file updates:
  - None required.

[Functions]
Single sentence describing function modifications:
Update the goal rendering and toggling functions in onboarding so they operate on canonical goal IDs and adopt the same interaction semantics as profile edit.

Detailed breakdown:

- Modified functions (file path and exact change):
  - src/screens/auth/OnboardingScreen.tsx
    - handleGoalToggle(goalKey: string)
      - No logic change required (toggle semantics identical) but ensure it receives goal.id strings and updates local state `selectedGoals: string[]` accordingly.
    - renderGoalsStep()
      - Replace map over legacy FITNESS_GOALS with DEFAULT_FITNESS_GOALS.map and adopt card structure identical to ProfileEditScreen (show Popular badge, name, description, icon).
    - onSubmit()
      - Ensure payload uses `fitnessGoals: selectedGoals` and that `updateProfile` call persists the canonical goal IDs.
    - Rendering of experience level labels — replace any usage of EXPERIENCE_LEVELS object keyed by string with `getExperienceLevelInfo` (or map from array) for consistent label/description.
- New helper functions:

  - (optional) mapLegacyGoalIdToCanonical(legacyId: string): string | null — used only if user DB contains legacy IDs and you need to convert them on the fly (only implement after discovery of legacy values; recommended as a follow-up).

- Removed functions:
  - None.

[Classes]
Single sentence describing class modifications:
No classes are modified; only functional React components are changed.

Detailed breakdown:

- New classes: none
- Modified classes: none
- Removed classes: none

[Dependencies]
Single sentence describing dependency modifications:
No new npm packages required; changes are internal imports and type updates.

Details:

- New import lines:
  - OnboardingScreen.tsx: import { DEFAULT_FITNESS_GOALS, getExperienceLevelInfo, EXPERIENCE_LEVELS } from "@/types/profile";
  - Replace any import of FITNESS_GOALS from "@/constants/auth" with the types/profile import.
- No new package additions or version bumps.

[Testing]
Single sentence describing testing approach:
Run TypeScript type-check, run unit tests, and perform manual e2e validation covering onboarding → profile flows to confirm goal IDs, labels and UI are consistent and persist correctly.

Test file requirements and validation strategy:

- Automated:
  - Run `npm run type-check` (tsc --noEmit).
  - Run unit tests: `npm test` (if relevant tests exist).
  - Run linting: `npm run lint` (optional).
- Manual end-to-end tests:
  1. Fresh user sign-up → complete onboarding:
     - On the "Goals" step, select multiple goals (e.g., Build Muscle, Get Stronger).
     - Complete onboarding and verify onboarding completion screen/state.
  2. Navigate to Edit Profile:
     - Confirm the goals selected during onboarding appear and are checked/selected in the Profile Edit view.
     - Toggle goals in Profile Edit, save, and verify saved state persists (reload app if necessary).
  3. Back-compat check:
     - If older users exist with legacy goal IDs (pre-change), login with a test user that has legacy IDs (if available) and ensure goal rendering falls back or is mapped correctly. If mapping is required, create a mapping test.
  4. Visual regression:
     - Compare Onboarding Goals UI to Profile Edit Goals UI to confirm card appearance, badge, and styles match (colors, spacing).
  5. Accessibility:
     - Ensure buttons are reachable by accessibility tools (labels, testIDs). Preserve existing `testID` props where present.

[Implementation Order]
Single sentence describing the implementation sequence:
Apply changes in small, verifiable steps: update onboarding imports and UI, deprecate legacy constants, run type-check and tests, then remove legacy code after verification.

Numbered steps:

1. Update imports in OnboardingScreen
   - Replace `FITNESS_GOALS` import from `src/constants/auth.ts` with `DEFAULT_FITNESS_GOALS` (and related helpers) from `src/types/profile.ts`.
2. Update EXPERIENCE_LEVELS usage in OnboardingScreen
   - Use the array/object shape provided in `src/types/profile.ts` and `getExperienceLevelInfo` when rendering labels/descriptions.
3. Replace renderGoalsStep() in OnboardingScreen
   - Re-implement using the card layout pattern from `src/screens/profile/ProfileEditScreen.tsx`.
   - Ensure `onPress` toggles use `goal.id` and that UI shows `goal.popular` badge.
4. Persist canonical IDs
   - Ensure `onSubmit()` sends `fitnessGoals: selectedGoals` to `updateProfile`.
5. Deprecate legacy constant
   - Replace `FITNESS_GOALS` in `src/constants/auth.ts` with an empty export and a comment pointing to `src/types/profile.ts`.
6. Search and update remaining references
   - Run a repo-wide search for `FITNESS_GOALS` and `FitnessGoal` references; replace with `DEFAULT_FITNESS_GOALS` or the canonical type.
7. Type-check and tests
   - Run `npm run type-check`, `npm test`, and `npm run lint`.
8. Manual verification
   - Perform the end-to-end tests described in [Testing].
9. Final cleanup (optional)
   - After verification, remove the deprecated `FITNESS_GOALS` export entirely and update any types that referenced it (make a separate commit/PR).
10. Release

- Merge changes and run a smoke test in staging.

Migration notes:

- If you find user data using legacy goal IDs in production, prepare a small migration mapping legacy IDs to canonical IDs, or add runtime mapping in the profile read layer to normalize data on load. Avoid silent data loss — prefer mapping or logging unmapped IDs for manual review.
