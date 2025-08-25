# Implementation Plan

[Overview]
Add a "Sign Out" button to the Preferences tab of the profile edit screen that immediately signs the user out using the app's existing Supabase singleton and auth services/hooks, shows an appropriate loading state, and relies on existing Redux/auth flows to clear local state and navigate back to unauthenticated routes.

This change is small, scoped to the profile edit UI, and uses existing auth primitives (the supabase client, authService/logout thunk, and useAuth hook). The implementation will add a sign-out control to the Preferences section of `src/screens/profile/ProfileEditScreen.tsx`, call the existing logout flow, show a loading state while logout is in progress, and avoid duplicating token/session cleanup logic. No server-side changes are required. The UI will not show a confirmation dialog per the user's instruction; sign-out should occur immediately.

[Types]  
Single sentence describing the type system changes.

Additions to the type system are not required; the existing types and hooks already expose the necessary logout function and loading state.

Detailed type definitions, interfaces, enums, or data structures with complete specifications:

- No new interfaces, enums, or types required.
- Will use existing `UseAuthReturn` and `AuthLoadingStates` from `src/types/auth.ts`.
- Validation rules: none required for the sign-out action.

[Files]  
Single sentence describing file modifications.

Modify the existing ProfileEditScreen to import the auth hook and add a Sign Out control in the Preferences section.

Detailed breakdown:

- New files to be created (with full paths and purpose)
  - None.
- Existing files to be modified (with specific changes)
  - src/screens/profile/ProfileEditScreen.tsx
    - Imports:
      - Add `import useAuth from "@/hooks/useAuth";`
    - Inside component:
      - Destructure `logout` and `loading` from `useAuth()`:
        - `const { logout, loading: authLoading } = useAuth();`
      - Add a new handler:
        - `const handleSignOut = useCallback(async () => { const result = await logout(); if (!result.success) Alert.alert("Error", result.error?.message || "Failed to sign out"); }, [logout]);`
      - Add a Sign Out button to the Preferences section UI (below the Units switch). Use existing `LoadingButton` or `Button`:
        - Example:
          ```tsx
          <LoadingButton
            loading={Boolean(authLoading.logout)}
            onPress={handleSignOut}
            style={styles.signOutButton}
            testID='profile-signout-button'>
            Sign Out
          </LoadingButton>
          ```
      - Add a small style entry `signOutButton` to the `styles` object for spacing and optional destructive color.
    - Rationale:
      - Use the central `useAuth` hook and Redux flow for sign-out to ensure consistent behavior and centralized token cleanup.
- Files to be deleted or moved
  - None.
- Configuration file updates
  - None.

[Functions]  
Single sentence describing function modifications.

Add a local `handleSignOut` async function in `ProfileEditScreen` and wire the Sign Out button to call it; no existing functions need internal modifications.

Detailed breakdown:

- New functions
  - handleSignOut(): Promise<void>
    - Signature: `const handleSignOut = useCallback(async () => Promise<void>, [logout])`
    - File path: `src/screens/profile/ProfileEditScreen.tsx`
    - Purpose: Call the `logout` method from `useAuth()`; display an Alert on failure; rely on global state changes for navigation and cleanup.
    - Behavior:
      - Call `await logout()`.
      - If result.success is true: do nothing further (global auth state drives navigation).
      - If result.success is false: display an Alert.alert with the error message or a generic message.
    - Loading state: Use `authLoading.logout` to disable the button and show spinner.
- Modified functions
  - None.
- Removed functions
  - None.

[Classes]  
Single sentence describing class modifications.

No new classes or class modifications are required.

Detailed breakdown:

- New classes
  - None.
- Modified classes
  - None.
- Removed classes
  - None.

[Dependencies]  
Single sentence describing dependency modifications.

No new package dependencies; changes use existing dependencies (React, React Native, Supabase, Redux).

Details of new packages, version changes, and integration requirements:

- No new npm packages.
- No supabase or backend changes required.
- Integration: Ensure `useAuth` is imported correctly (default export).

[Testing]  
Single sentence describing testing approach.

Manual and basic unit/integration checks to verify the Sign Out button calls logout, shows loading, and results in unauthenticated UI state; include test instructions and an optional simple unit test stub.

Test file requirements, existing test modifications, and validation strategies:

- Manual QA steps:
  1. Launch app and sign in with a test user.
  2. Open Profile > Edit Profile > Preferences.
  3. Confirm the Sign Out button is visible below Units toggle.
  4. Tap Sign Out.
     - The button should show loading immediately.
     - After sign-out completes, app should navigate to Auth flow (or show unauthenticated UI).
     - No confirmation dialog should appear.
  5. Verify tokens/local data cleared (e.g., re-open app should require sign-in).
- Automated tests (optional):
  - Add a test file: `src/screens/profile/__tests__/ProfileEditScreen.signout.test.tsx`
  - Test outline:
    - Mock `useAuth` to provide `logout` (jest.fn()) and `loading.logout`.
    - Render `ProfileEditScreen` with necessary providers/mocks.
    - Press the Sign Out button and assert `logout` was called.
    - Assert LoadingButton receives `loading` prop while pending (mocked).
  - Add test only if project test infra is already in place.

[Implementation Order]  
Single sentence describing the implementation sequence.

Make a small incremental change: import the auth hook, add sign-out handler, add button UI, run manual tests, then add automated test (optional) and commit.

Numbered steps showing the logical order of changes:

1. Add import for `useAuth` at top of `src/screens/profile/ProfileEditScreen.tsx`.
   - `import useAuth from "@/hooks/useAuth";`
2. Inside the `ProfileEditScreen` component, add:
   - `const { logout, loading: authLoading } = useAuth();`
   - `const handleSignOut = useCallback(async () => { const result = await logout(); if (!result.success) Alert.alert("Error", result.error?.message || "Failed to sign out"); }, [logout]);`
3. Update `renderPreferencesSection` to include a Sign Out control placed below the Units switch:
   - Use `LoadingButton` with `loading={Boolean(authLoading.logout)}` and `onPress={handleSignOut}`.
   - Add `testID="profile-signout-button"` for e2e testing.
   - Add `styles.signOutButton` to `styles` for spacing and optional destructive coloring.
4. Run TypeScript/ESLint checks and build the app to validate compilation.
5. Perform manual QA steps described above.
6. (Optional) Add unit test at `src/screens/profile/__tests__/ProfileEditScreen.signout.test.tsx` mocking `useAuth`.
7. Commit changes with message: `feat(profile): add Sign Out button to ProfileEditScreen (Preferences tab)`.

Additional notes and rationale:

- Use the central `useAuth` hook instead of calling `authService` directly to preserve Redux flow and show a consistent loading state.
- Avoid adding navigation logic in the handler; the app's auth state change should drive navigation to the unauthenticated flow.
- The button triggers immediate sign-out with no confirmation per the user's instruction.
- If a destructive style is desired, reuse `Button` props or add a style override.

Plan Document Navigation Commands (for the implementation agent)

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

Task Progress Items:

- [x] Step 1: Create implementation_plan.md
- [ ] Step 2: Add `useAuth` import and destructure `logout` & `loading` in ProfileEditScreen
- [ ] Step 3: Implement handleSignOut in ProfileEditScreen
- [ ] Step 4: Add Sign Out button in Preferences section (wire to handleSignOut)
- [ ] Step 5: Run TypeScript/ESLint and manual QA
- [ ] Step 6: (Optional) Add unit test for sign-out behavior
- [ ] Step 7: Commit changes and push branch
