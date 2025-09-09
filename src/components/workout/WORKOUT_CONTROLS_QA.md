Workout Controls — QA Checklist

Files added

- src/components/workout/WarmupModal.tsx
- src/components/workout/WorkoutControlsSection.tsx
- Modified: src/screens/workout/ExerciseListScreen.tsx (renders WorkoutControlsSection below header)

Purpose

- WarmupModal: static, scrollable warmup instructions with Close button.
- WorkoutControlsSection: compact controls directly under the header:
  - Notes TextInput
  - Warmup button (opens WarmupModal)
  - Complete button (calls workoutService.completeWorkout(notes) and navigates to WorkoutSummary)

Manual QA steps (recommended to run on device/emulator; test both light/dark theme if possible)

1. Launch app and navigate to a workout -> Exercise List screen.
2. Verify WorkoutControlsSection appears immediately under the header (below the header note/error and above "Exercises").
3. Notes input
   - Tap the notes input and type a short note. Verify text appears and does not obstruct UI.
   - Leave notes empty and proceed to Complete flow as well.
4. Warmup modal
   - Tap "Warmup" button.
   - Confirm the WarmupModal slides in.
   - Verify warmup items are visible and scrollable if content overflows.
   - Tap "Close" in the modal and confirm the modal dismisses.
5. Complete button — success path
   - With an active workout session started in the app (the app must have an active session; if not, start a session first), tap "Complete".
   - Confirm the button shows loading state (spinner) while completeWorkout is running.
   - On success, confirm navigation to "WorkoutSummary" and that the navigation param contains sessionId returned by workoutService.completeWorkout.
6. Complete button — failure path
   - Simulate failure (e.g., network off) and tap Complete.
   - Confirm loading state is shown and then an alert appears with an error message.
   - Confirm app remains stable (no crash).
7. Accessibility / small screens
   - Verify the controls remain compact on small screens; text doesn't overflow buttons or input.
   - Verify buttons are large enough to tap.
8. Theming
   - Switch theme (if app supports light/dark) and confirm colors of controls and modal use theme colors correctly.
9. Navigation context
   - From ExerciseList -> press an exercise to go to ExerciseDetail and return; confirm WorkoutControlsSection still behaves normally.
10. PlannedExerciseId handling (indirect / regression check)

- Confirm existing ExerciseDetail navigation still receives plannedExerciseId when session data is available (unchanged behavior).

Basic unit test suggestions (if test infra exists)

- Snapshot tests
  - Snapshot WorkoutControlsSection renders with initial state (no notes, warmup hidden).
  - Snapshot WarmupModal when visible.
- Interaction tests (component)
  - Simulate typing in notes input and assert value updated.
  - Simulate pressing Warmup button opens modal.
  - Simulate pressing Close in modal hides it.
  - Mock workoutService.completeWorkout:
    - When resolved: assert navigation.navigate called with correct route and sessionId.
    - When rejected or returns success: false: assert Alert.alert called.

Notes / Caveats

- workoutService.completeWorkout uses workoutService.getCurrentSession() internally; the app must have an active current session for complete to succeed.
- The Complete flow depends on databaseService and network; when testing offline expect warnings or alerts.
- If snapshot tests run in CI and theme hook depends on native modules, mock useTheme to return stable colors.

Suggested PR checklist (to include in PR)

- [ ] Screenshots of WorkoutControlsSection in light and dark theme
- [ ] Short video (or steps) of Warmup modal open/close
- [ ] Manual QA checklist completed
- [ ] If tests added, confirm they pass: npm test
