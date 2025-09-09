# Implementation Plan

[Overview]
Add a compact "workout controls" section to the top of src/screens/workout/ExerciseListScreen.tsx that exposes: a Complete Workout button (wired to the existing workoutService.completeWorkout API), a small multi-line notes input for session/workout notes, and a button that opens a modal with general warmup instructions. The new UI must be compact, visually consistent with the app's design system, and should not disrupt the existing exercise list layout.

This change is needed so users can finish a workout, add session notes, and view warmup guidance without scrolling to the last exercise. It fits into the existing architecture by reusing the current Button, Modal, and workoutService APIs and by introducing small, focused UI components which are easy to test and maintain.

[Types]  
Add a small set of thin, local TypeScript types for the new components.

- WorkoutControlsProps

  - file: src/components/workout/WorkoutControlsSection.tsx
  - fields:
    - programId: string
    - phaseId: string
    - dayId: string
    - workoutName?: string
    - session?: any (optional session object; existing code uses typing loosely)
    - navigation?: any (React Navigation prop; used to navigate to WorkoutSummary)
  - validation rules: all ids must be non-empty strings; component should accept undefined optional fields gracefully.

- WarmupItem
  - file: src/components/workout/WarmupModal.tsx
  - fields:
    - id: string
    - title: string
    - description?: string
    - durationMinutes?: number
  - validation: title and id required.

No global changes to existing navigation types or core DB types are required. The local prop types should be exported only if needed by other workout components.

[Files]
Single sentence describing file modifications.
Create two new small components and update ExerciseListScreen to render them; no database schema changes.

Detailed breakdown:

- New files to be created (with full paths and purpose)

  - src/components/workout/WorkoutControlsSection.tsx

    - Purpose: Render the compact top section containing:
      - Complete Workout button (primary variant)
      - Notes TextInput (multi-line, small, single row visually)
      - Warmup button (secondary or text variant) which opens WarmupModal
    - Behavior: Manage notes state, call workoutService.completeWorkout(notes) when Complete pressed, show loading state, navigate to WorkoutSummary on success.

  - src/components/workout/WarmupModal.tsx
    - Purpose: Present a simple Modal with general warmup exercises/instructions (static list of 4-6 items).
    - Behavior: Accept visible: boolean and onClose: () => void props, simple scrollable content, close button.

- Existing files to be modified (with specific changes)

  - src/screens/workout/ExerciseListScreen.tsx
    - Insert import: import WorkoutControlsSection from "@/components/workout/WorkoutControlsSection";
    - Add a new state prop if needed to pass session: either pass the local `session` state or call workoutService.getCurrentSession() from the new component.
    - Render the new <WorkoutControlsSection .../> immediately below the header block (after error note and before the Exercises section). This keeps the controls at top without displacing the header content.
    - No client-side logic changes beyond passing props.

- Files to be deleted or moved

  - None.

- Configuration file updates
  - None required. No new npm packages needed.

[Functions]
Single sentence describing function modifications.
Introduce a few small, focused functions in new components for handling notes, opening the modal, and completing the workout; no changes to existing service functions.

Detailed breakdown:

- New functions (name, signature, file path, purpose)

  - handleCompleteWorkout(notes: string): Promise<void>
    - file: src/components/workout/WorkoutControlsSection.tsx
    - Purpose: Call workoutService.completeWorkout(notes), handle loading and errors, navigate to WorkoutSummary on success.
  - openWarmupModal(): void
    - file: src/components/workout/WorkoutControlsSection.tsx
    - Purpose: set modal visible.
  - closeWarmupModal(): void
    - file: src/components/workout/WarmupModal.tsx
    - Purpose: call onClose prop.
  - renderWarmupList(): JSX.Element
    - file: src/components/workout/WarmupModal.tsx
    - Purpose: return a small static list of warmup items.

- Modified functions (exact name, current file path, required changes)

  - ExerciseListScreen component render function
    - file: src/screens/workout/ExerciseListScreen.tsx
    - Change: After the header view and optional error message, insert:
      <WorkoutControlsSection
      programId={programId}
      phaseId={phaseId}
      dayId={dayId}
      workoutName={sessionName || workoutName}
      session={session}
      navigation={navigation}
      />
    - No other behavior changes.

- Removed functions
  - None.

[Classes]
Single sentence describing class modifications.
No class-level changes required; components will be functional React components and the existing WorkoutService class will be used as-is.

Detailed breakdown:

- New classes (none — use functional components).
- Modified classes
  - None.
- Removed classes
  - None.

[Dependencies]
Single sentence describing dependency modifications.
No new package dependencies required; reuse existing UI components and services.

Details:

- New packages: none
- Version changes: none
- Integration requirements: ensure imports use project path aliases (e.g., "@/components/workout/...") consistent with the project configuration.

[Testing]
Single sentence describing testing approach.
Add basic unit/integration checks and manual QA steps: verify UI layout, notes persistence on completion, and that the warmup modal opens/closes.

Details:

- Test file requirements

  - If the repo uses Jest/RTL: add tests under src/components/workout/**tests**/
    - workoutControls.test.tsx:
      - Renders component, toggles warmup modal, simulates typing notes, simulates tap on Complete and asserts workoutService.completeWorkout called with the notes.
    - warmupModal.test.tsx:
      - Renders modal, asserts static warmup content visible, onClose works.
  - If no test infra currently in the repo, include manual QA checklist in PR description:
    - Verify the controls render under the header on phones and tablets.
    - Verify notes input accepts text and Complete button becomes loading while calling service.
    - Verify success navigates to WorkoutSummary with the session ID.
    - Verify warmup modal opens/closes and is scrollable.

- Validation strategies
  - Use dependency injection / jest mocks for workoutService in unit tests and assert calls.
  - During manual QA, use network logs to ensure DatabaseService.updateWorkoutSession is triggered.

[Implementation Order]
Single sentence describing the implementation sequence.
Implement new components first, wire them into ExerciseListScreen second, then test and finalize.

Numbered steps:

1. Create src/components/workout/WarmupModal.tsx with a small static list of warmup steps and a close button.
2. Create src/components/workout/WorkoutControlsSection.tsx:
   - Local state: notes: string, loading: boolean, warmupVisible: boolean
   - UI: small, compact layout using existing Button and Text components and a TextInput
   - Behavior: call workoutService.completeWorkout(notes) and navigate to WorkoutSummary on success.
3. Update src/screens/workout/ExerciseListScreen.tsx:
   - Import and render WorkoutControlsSection below the header (after error message).
   - Pass programId, phaseId, dayId, workoutName, session, and navigation props.
4. Add basic unit tests or manual QA instructions (see Testing).
5. Run app locally and verify on Android/iOS emulators; adjust styling for small screens if needed.
6. Create PR with implementation details, screenshots, and QA checklist.
