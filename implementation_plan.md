# Implementation Plan

[Overview]
Fix onboarding persistence and ensure the final onboarding "You're All Set!" screen is shown before the app navigates away. Scope includes: persist onboarding fields (display name, experience level, fitness goals, other edited fields) to the `user_profiles` table, persist the `onboarding_completed` boolean to the DB, ensure Redux/auth metadata is updated only when onboarding is truly finished (so the UI can show the "complete" screen), and add the minimal type & transform changes required to safely pass onboarding completion through the profile update pipeline.

This change is needed because currently onboarding edits (experience level, goals, display name, etc.) appear to be applied in memory/auth metadata but are not persisted to the `user_profiles` table (or are persisted inconsistently), and the UI often navigates away before the final onboarding screen is visible. Fixing this will ensure users' choices are durable and the onboarding UX behaves as expected.

[Types]  
Add a single optional field to the profile update request type to signal final onboarding completion and ensure transforms map it to the DB column.

Detailed type changes:

- src/types/auth.ts

  - Modify `ProfileUpdateRequest` (or the specific type used by `useAuth.updateProfile`) to include:
    - onboardingCompleted?: boolean
      - type: boolean | undefined
      - validation rules: optional; when present, must be boolean
      - purpose: request that the service mark onboarding as completed (persist onboarding_completed = true to DB)

- src/types/profile.ts

  - Confirm `UserProfile` already contains `onboardingCompleted: boolean` (exists in codebase). No change needed unless missing; keep as-is.

- src/types/transforms.ts
  - Ensure `transformUserProfileToDb` supports mapping of `onboardingCompleted` -> `onboarding_completed`:
    - Input key: onboardingCompleted?: boolean
    - Output key: onboarding_completed: boolean | null
    - Validation: if value === true or false, set DB column accordingly; if undefined, leave unspecified so UPDATE won't touch the column.

[Files]  
This section lists files to create/modify, with exact paths and purpose.

- New files to be created:

  - None required.

- Existing files to be modified:

  1. src/hooks/useAuth.ts

     - Change: stop setting `onboarding_complete: true` in auth user metadata inside the general `updateProfile` flow.
     - Add: a new exported function `completeOnboarding()` that:
       - Calls profileService.updateProfile(user.id, { onboardingCompleted: true })
       - On success updates the auth user metadata and Redux store exactly the same way existing `updateUserProfile` dispatch is used today.
       - Returns the result (success/error) so callers (UI) can react and navigate.
     - Rationale: avoid prematurely flipping `user.user_metadata.onboarding_complete` which currently causes navigation away from the onboarding flow before the "complete" screen is shown.

  2. src/screens/auth/OnboardingScreen.tsx

     - Change: `onSubmit` should update the profile with the user-entered fields but NOT mark onboarding as completed.
       - No change to the current call to `updateProfile({...})` for displayName, experienceLevel, fitnessGoals etc, except ensure it does not include any `onboardingCompleted` flag.
     - Change: `renderCompleteStep` / `completeOnboarding`:
       - Replace the `completeOnboarding` implementation to call the new `useAuth.completeOnboarding()` function.
       - On success of `completeOnboarding()` call `onOnboardingComplete?.()` or trigger navigation. On failure show appropriate error UI (Alert).
       - Ensure the complete screen is shown and the Start Training button waits for the DB/auth update to complete before proceeding.

  3. src/services/profile.service.ts

     - Change: Add mapping in `updateProfile` handler to accept and persist `updates.onboardingCompleted`:
       - If (updates.onboardingCompleted !== undefined) set updateData.onboarding_completed = updates.onboardingCompleted;
     - Rationale: persist onboarding completion to the `user_profiles` table.

  4. src/types/transforms.ts

     - Change: If `transformUserProfileToDb` is used generically, extend it to map `onboardingCompleted` -> `onboarding_completed` so transforms are consistent.
     - If not feasible, add explicit mapping in `profile.service.updateProfile` (see above). Prefer adding to transforms to keep mapping central.

  5. src/store/auth/authSlice.ts
     - Change: Verify the reducer that handles `updateUserProfile` respects `user.user_metadata.onboarding_complete` and that the store shape still matches components in navigation checks.
     - Likely no code change required, but add a small unit/integration test or manual verification step.

- Files to be deleted or moved:

  - None.

- Configuration file updates:
  - None.

[Functions]  
Single sentence: Add a new completion function, and modify the existing profile update flow to avoid premature onboarding metadata updates.

Detailed breakdown:

- New functions:

  1. completeOnboarding
     - Signature: async function completeOnboarding(): Promise<AuthResponse>
     - File: src/hooks/useAuth.ts
     - Purpose: Persist onboarding_completed = true to database via profileService.updateProfile and update Redux user metadata (dispatch updateUserProfile). Return an AuthResponse-like object indicating success/error similar to other hook methods.
     - Behavior:
       - If no user id, return error { code: "NO_USER_ID" }.
       - Call profileService.updateProfile(user.id, { onboardingCompleted: true }).
       - If success: produce updatedUser with user_metadata onboarding_complete: true and dispatch(updateUserProfile(updatedUser)).
       - Return success or error accordingly.

- Modified functions:

  1. updateProfile
     - File: src/hooks/useAuth.ts
     - Required changes:
       - Do NOT set onboarding_complete: true in the `updatedUser` metadata after a regular profile update. Continue to sync display_name and experience_level, but omit onboarding metadata changes.
       - Continue returning the updated user/profile info as before (except for onboarding metadata).
  2. onSubmit
     - File: src/screens/auth/OnboardingScreen.tsx
     - Required changes:
       - Keep the existing behavior of calling updateProfile for displayName/experienceLevel/fitnessGoals.
       - After success: set currentStep('complete') as today.
       - Do not attempt to set onboarding metadata here.
  3. completeOnboarding (UI)
     - File: src/screens/auth/OnboardingScreen.tsx
     - Replace current `completeOnboarding` stub to call `useAuth().completeOnboarding()` and handle success/failure (show Alert on failure). On success call onOnboardingComplete or let navigation react to updated auth state.

- Removed functions:
  - None.

[Classes]  
Single sentence: No new classes; small procedural changes to existing services and hooks.

Detailed breakdown:

- New classes: None.
- Modified classes:
  - ProfileService (class at src/services/profile.service.ts)
    - Modify method `updateProfile` to map `updates.onboardingCompleted` to `updateData.onboarding_completed`.
- Removed classes: None.

[Dependencies]  
Single sentence: No external package dependency changes required.

Details:

- No new npm packages.
- No database schema changes (the `onboarding_completed` column already exists).
- No changes to Supabase client usage.

[Testing]  
Single sentence: Add light integration checks and manual test steps; no heavy unit test suite required for this patch.

Test file requirements and strategies:

- Manual verification steps:

  1. Fresh sign-up flow:
     - Sign up a new user; proceed through the onboarding flow.
     - On the profile step, set a display name, experience level and goals.
     - Press Continue (goals) -> Complete Setup.
     - Confirm the app shows the "You're All Set!" (complete) screen.
     - On the complete screen press Start Training.
     - Confirm navigation into the main app and that the `user_profiles` row for the user has:
       - onboarding_completed = true
       - display_name set to chosen value
       - experience_level set properly
       - fitness_goals persisted
  2. Existing user profile update:
     - Update profile from profile edit screen (not onboarding) and verify onboarding_completed is not toggled and fields persist.
  3. Error handling:
     - Simulate DB failure (or force supabase error) and verify the complete button surfaces an error and does not navigate.

- Automated tests (optional, recommended):
  - Add a small integration test for profileService.updateProfile mapping, if an existing test harness is present.
  - Add a unit test for useAuth.completeOnboarding to verify it calls profileService.updateProfile and dispatches updateUserProfile (mocking supabase/service).

[Implementation Order]  
Single sentence: Apply minimal API-safe changes in a specific sequence to avoid partial states and keep navigation stable.

Numbered steps:

1. Add type field for onboardingCompleted

   - Edit src/types/auth.ts: add `onboardingCompleted?: boolean` to the appropriate update/request type.
   - Edit src/types/transforms.ts (or confirm mapping) so `transformUserProfileToDb` includes `onboardingCompleted -> onboarding_completed` mapping, or plan to add explicit mapping in the service in next step.

2. Persist onboardingCompleted in profile service

   - Edit src/services/profile.service.ts:
     - In `updateProfile`, add:
       - if (updates.onboardingCompleted !== undefined) updateData.onboarding_completed = updates.onboardingCompleted;
     - Ensure this mapping is applied before calling supabase.from(...).update(updateData)...

3. Add completeOnboarding helper in useAuth

   - Edit src/hooks/useAuth.ts:
     - Remove code that injects `onboarding_complete: true` into user metadata in the general `updateProfile` flow (stop auto-marking onboarding there).
     - Add exported async function `completeOnboarding()` with behavior described above: call profileService.updateProfile(user.id, { onboardingCompleted: true }) and dispatch updateUserProfile(updatedUser) on success.

4. Update onboarding screen to call completeOnboarding

   - Edit src/screens/auth/OnboardingScreen.tsx:
     - Change `onSubmit` to keep current behavior (persist edits) and setCurrentStep("complete").
     - Replace `completeOnboarding()` implementation used by the Start Training button to call useAuth().completeOnboarding(), await result, show error on failure, call onOnboardingComplete on success (or rely on navigation reacting to updated auth state).

5. Verify auth reducer behavior

   - Inspect src/store/auth/authSlice.ts to confirm updateUserProfile action accepts an updated user object with user_metadata.onboarding_complete and updates store accordingly. Make adjustments only if necessary.

6. Manual testing

   - Run the manual test checklist described under Testing. Confirm fixes.

7. Small cleanup and documentation
   - Add developer note in code comments near useAuth.completeOnboarding explaining why the split exists (so future contributors don't re-introduce premature metadata updates).

Notes and edge cases:

- Concurrency: When marking onboarding complete, ensure the update is done with the authenticated supabase client (use session token if required). The `profileService.updateProfile` call uses the global client; for safety from within `useAuth`, call profileService.updateProfile with authenticated client when available (the existing code uses getAuthenticatedClient(session?.accessToken) in some spots when creating profile; the new completeOnboarding can use the same pattern if needed).
- Race condition: The app's AuthNavigator uses user metadata for navigation. Because we now delay setting onboarding metadata until the user taps Start Training, the user will see the complete screen. If the app still navigates away (e.g., auth state rehydration sets onboarding_complete from server), that will still preempt the screen; however this is the intended behavior since the server state already indicates completed.
- No DB schema migrations required — `onboarding_completed` exists already in migrations.

Implementation estimation and roll-back:

- Estimated time: 1–2 hours of developer time to implement and verify.
- Roll-back strategy: Revert the changes to the three edited files (use VCS) if issues arise.
