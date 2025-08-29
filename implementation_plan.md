# Implementation Plan

[Overview]
Fix two UI bugs in the exercise logging flow: (1) navigation/footer buttons appearing above the keyboard while typing/scrolling in the exercise logger, and (2) the rest timer display changing unexpectedly after app background/foreground or when the parent updates the timer prop. The approach is to (A) add robust keyboard handling to the ExerciseDetail screen so the footer and tab bar do not clash with the on-screen keyboard, and (B) make CompactRestTimer display stable when a native timer has been launched (preserve the shown duration after user starts the native timer) while preserving the existing native deep-link approach and PWA fallback.

This change is targeted and small-scope: no new dependencies, only focused edits to UI components used during active exercise logging. The fix preserves the existing app behavior (native timers via deep links on iOS/Android; web notifications for PWA) while ensuring visual stability and preventing overlay conflicts with the keyboard. It fits into the current architecture by modifying two components/screens:

- src/screens/workout/ExerciseDetailScreen.tsx (keyboard handling + footer/tab bar coordination)
- src/components/workout/CompactRestTimer.tsx (stabilize displayed duration after launch)

These fixes reduce user confusion and accidental interactions (e.g., pressing "Next Exercise" when the user intends to log a set) and keep the native timer-first behavior requested.

[Types]  
Add a lightweight UI state field used by ExerciseDetailScreen: keyboardVisible boolean on the ExerciseLoggerState shape.

Detailed type definitions:

- ExerciseLoggerState (existing) — additions:
  - keyboardVisible: boolean
    - Purpose: track whether the keyboard is currently visible to hide navigation footer / ensure tab bar remains hidden.
    - Validation: boolean (true when keyboard is visible, otherwise false).
    - Relationship: local UI-only state used only inside ExerciseDetailScreen; not persisted.

No explicit TypeScript interface changes are required project-wide (we will update the local inline state initialization in ExerciseDetailScreen to include keyboardVisible). No new global types or exported interfaces are required.

[Files]  
Single sentence describing file modifications.
Modify ExerciseDetailScreen and CompactRestTimer to add keyboard event handling and stabilize the timer display; no new files are required.

Detailed breakdown:

- New files to be created:

  - None.

- Existing files to be modified:

  1. src/screens/workout/ExerciseDetailScreen.tsx

  - Purpose: hide the in-screen navigation footer (Next/Complete) while the keyboard is visible; ensure bottom tab bar remains hidden while this screen is focused and when the keyboard is open.
  - Changes:
    - Add import: Keyboard from "react-native".
    - Add local state: const [keyboardVisible, setKeyboardVisible] = useState(false);
    - Add useEffect: register listeners for keyboardDidShow and keyboardDidHide (and keyboardWillShow/keyboardWillHide on iOS if desired) to set keyboardVisible.
    - When keyboardVisible becomes true:
      - Hide the in-screen footer by returning null from renderNavigationFooter() while keyboard visible.
      - Additionally, if parent navigator is available (the same parent used for tabBarStyle hiding already), call parent.setOptions({ tabBarStyle: { display: "none" } }) to enforce that the native tab bar remains hidden while the keyboard is visible.
    - When keyboardVisible becomes false:
      - Restore footer rendering and restore parent tabBarStyle to undefined (consistent with existing showTabBar logic).
    - Update the ExerciseLoggerState initial object to include keyboardVisible: false.
    - Add cleanup to remove keyboard listeners on unmount.
    - No change to the shape of navigation parameters or persisted data.
    - Files lines/functions touched:
      - Top-level imports
      - The useEffect that hides/shows the tabBar on focus/blur will remain; add keyboard listener effect in addition.
      - renderNavigationFooter() — guard return value with if (keyboardVisible) return null.

  2. src/components/workout/CompactRestTimer.tsx

  - Purpose: preserve the displayed timer duration after launching a native timer (prevent prop-driven changes from altering the displayed label after the user has started the native timer), while keeping native deep-link behavior for iOS/Android and PWA fallback.
  - Changes:
    - Add a ref: initialDurationRef = useRef<number>(duration). This stores the display duration at the moment the timer is launched.
    - Modify existing useEffect([duration]) behavior:
      - Do not forcibly reset nativeTimerLaunched to false whenever the parent `duration` prop changes.
      - Update initialDurationRef.current = duration only when the timer has NOT been launched (i.e., when nativeTimerLaunched === false). This ensures the shown "Rest: X" will update as the user navigates and parent sets different rest durations, but once the user starts a native timer the displayed value stays fixed to what was launched.
      - Still clear any scheduled web notification when duration changes as before (maintain webCancelRef behavior).
    - Change displayed text to use initialDurationRef.current rather than the duration prop (i.e., Rest: {formatMinutes(initialDurationRef.current)}).
    - Keep existing behavior that sets nativeTimerLaunched true when a native timer or web notification is scheduled/opened, and set it back to false on manual complete (handleManualComplete).
    - Files lines/functions touched:
      - Top-level local state/ref declarations
      - the useEffect that currently resets nativeTimerLaunched on duration changes (remove that reset)
      - format/display lines in the JSX return

- Files to be deleted or moved:

  - None.

- Configuration file updates:
  - None (no new packages or env changes).

[Functions]  
Single sentence describing function modifications.
Add keyboard listener logic in ExerciseDetailScreen to toggle footer/tab bar visibility; adjust CompactRestTimer internal logic to preserve the shown duration after native timer launch.

Detailed breakdown:

- New functions:

  - No additional exported functions. Changes are component-level logic and useEffect handlers.

- Modified functions:

  1. ExerciseDetailScreen (component function defined in src/screens/workout/ExerciseDetailScreen.tsx)

     - New additions:
       - useState hook: keyboardVisible.
       - useEffect: setup:
         - const showSub = Keyboard.addListener('keyboardDidShow', () => { setKeyboardVisible(true); /_ optionally hide parent tab bar _/});
         - const hideSub = Keyboard.addListener('keyboardDidHide', () => { setKeyboardVisible(false); /_ restore parent tab bar _/});
         - Cleanup: showSub.remove(); hideSub.remove();
       - renderNavigationFooter(): add early return when keyboardVisible true.
       - When keyboard Visible, also enforce parent.setOptions({ tabBarStyle: { display: 'none' } }) to guard against tab bar reappearing during keyboard show.
     - Rationale: This is localized, small, and uses standard React Native APIs.

  2. CompactRestTimer (component function defined in src/components/workout/CompactRestTimer.tsx)
     - Modified hooks:
       - Add initialDurationRef (useRef) and update it only when nativeTimerLaunched is false.
       - Modify the existing useEffect that ran on duration changes: remove the unconditional setNativeTimerLaunched(false) call; instead only update initialDurationRef when timer not launched.
     - Change render text: use initialDurationRef.current.

- Removed functions:
  - None.

[Classes]  
Single sentence describing class modifications.
No classes are added or removed; changes are limited to functional React components and their hooks.

Detailed breakdown:

- New classes:

  - None.

- Modified classes:

  - None.

- Removed classes:
  - None.

[Dependencies]  
Single sentence describing dependency modifications.
No new dependencies required; changes use built-in React Native APIs and existing utilities.

Details:

- No new npm packages.
- No package.json edits required.
- No native platform changes (we keep the existing Linking-based deep links and web Notification fallback).

[Testing]  
Single sentence describing testing approach.
Perform focused manual and automated tests: unit-level React component tests where feasible, plus end-to-end/manual QA steps covering typing, keyboard show/hide, starting native timers, background/foreground transitions, and navigation.

Test file requirements, existing test modifications, and validation strategies:

- Automated:
  - If present, add or update unit tests for CompactRestTimer to assert:
    - displayed duration updates when nativeTimerLaunched is false and prop changes
    - displayed duration remains unchanged after handleNativeLaunch sets nativeTimerLaunched true
    - webCancelRef is set/cleared appropriately
    - You may implement these with react-native-testing-library and jest mocking for Linking and Notification.
  - For ExerciseDetailScreen:
    - A unit/renderer test that simulates keyboard events and verifies the footer (renderNavigationFooter) is hidden when keyboard shown (this can be a shallow-render style test).
- Manual QA checklist (recommended, required before merge):
  1. Start a workout, open an exercise (ExerciseDetailScreen).
  2. Focus weight/reps/RPE inputs; ensure footer (Next/Complete button) is not visible above keyboard and bottom tab does not appear.
  3. Type into fields and scroll - the footer should remain hidden (or off-screen) and keyboard interactions should not cause accidental taps on navigation.
  4. Log a working set that shows rest timer; press the CompactRestTimer start button to launch native timer on device (or schedule web notification on web).
  5. Confirm the rest display text remains on the launched duration even if you background the app, unlock phone, or parent state updates the rest duration.
  6. Manually press the timer widget again (when active) to mark complete — ensure nativeTimerLaunched resets and the component accepts new durations.
  7. Navigate to next exercise and confirm rest text updates appropriately when not launched.
  8. Verify on Android/iOS devices that clock intent/deeplink opens the native timer appropriately (existing behavior preserved).
- Edge cases to validate:
  - Rapid start/stop of timers
  - Parent updates restDuration while native timer active (display should not change)
  - Navigating away while timer active and coming back (display should still reflect the launched duration or reset if user completed timer)
  - Keyboard shows on both iOS and Android (keyboardWillShow vs keyboardDidShow differences) — implementation should use keyboardDidShow/keyboardDidHide which are widely supported.

[Implementation Order]  
Single sentence describing the implementation sequence.
Implement keyboard handling changes first (ExerciseDetailScreen), then stabilize CompactRestTimer, run tests and QA, then deploy.

Numbered steps:

1. Create a short-lived feature branch from main (e.g., fix/keyboard-timer-stability).
2. Update src/screens/workout/ExerciseDetailScreen.tsx:
   - Add Keyboard import and keyboardVisible state
   - Add keyboard event listeners (keyboardDidShow/keyboardDidHide)
   - Ensure renderNavigationFooter returns null while keyboardVisible
   - Enforce parent tabBarStyle hide when keyboardVisible (mirror existing focus/blur approach)
   - Add cleanup for listeners on unmount
   - Adjust state initialization to include keyboardVisible: false
3. Update src/components/workout/CompactRestTimer.tsx:
   - Add initialDurationRef and only reassign it when native timer is not started
   - Remove unconditional nativeTimerLaunched reset on duration prop change
   - Display initialDurationRef.current as the rest label
   - Ensure webCancelRef clearing behavior remains intact
4. Run unit tests and add tests if available:
   - CompactRestTimer: test display stability after launch
   - ExerciseDetailScreen: test keyboard hiding logic (snapshot/render test)
5. Run the app on a device/emulator and perform manual QA checklist (see Testing section)
6. Iterate on any discovered edge cases or platform-specific issues (iOS keyboardWillShow vs keyboardDidShow)
7. Create a PR with description, screenshots (if relevant), and QA checklist; request review from a teammate
8. Merge and deploy after approval
