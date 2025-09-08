# Implementation Plan

[Overview]
Single sentence describing the overall goal.

Update ExerciseDetailScreen to make the "Form Cues" section into a single collapsible container titled "Form Cues & Tutorials" (default collapsed). When expanded it will display the exercise notes (form cues) followed by a list of tutorial videos. Each tutorial entry is tappable: it first attempts to open the video in the native YouTube app (when possible) and falls back to opening the URL in the device browser. The container header should include the "Form Cues & Tutorials" title and a YouTube logo icon from the existing Icon component.

Multiple paragraphs outlining the scope, context, and high-level approach. Explain why this implementation is needed and how it fits into the existing system.

Scope and context:

- Modify only the UI and event handling in `src/screens/workout/ExerciseDetailScreen.tsx`.
- Use the already-available `TutorialVideo` type and `databaseService.getTutorialsForExercise` that the screen already calls.
- Use the existing Icon component wrapper (`src/components/ui/Icon.tsx`) which standardizes on Ionicons.
- Leverage React Native Linking APIs already used in the project.

High-level approach:

- Add local state to control collapsed/expanded state for the new "Form Cues & Tutorials" container.
- Replace the current separate `renderHeader` and `renderTutorials` outputs with a single combined container rendered inside the header area (preserves current visual layout but supports collapse behavior).
- Make the container header show "Form Cues & Tutorials" (default collapsed). The header is tappable to toggle expansion. The header will include a YouTube icon on the right.
- When expanded show exercise notes then the tutorial list (the list itself is not collapsible).
- Tutorials are rendered with readable title and a secondary row showing the URL. Each tutorial entry is rendered as a TouchableOpacity opening the video with a helper function that prefers the YouTube app when possible and falls back to the browser.
- Keep the rest of the screen behavior (SetLogger, timers, navigation footer) unchanged.

Why this is needed:

- Improves screen real estate by hiding form cues and tutorials when not needed.
- Groups related content into a single discoverable control, improving UX.
- Reuses existing services/types and the Icon component to maintain consistency and avoid new dependencies.

[Types]  
Single sentence describing the type system changes.

No application-level type changes required; the existing `TutorialVideo` type is sufficient for storing ids, titles and urls.

Detailed type definitions, interfaces, enums, or data structures with complete specifications. Include field names, types, validation rules, and relationships.

- TutorialVideo (existing):

  - id: string (required) — primary key
  - exerciseId: string (required) — FK to exercise
  - title: string (required) — display title for the tutorial
  - url: string (required) — full URL to tutorial (typically YouTube)
  - createdBy?: string | null
  - createdAt: string
  - updatedAt?: string | null

- Local UI state additions (inside ExerciseDetailScreen only — not exported):
  - showFormCuesExpanded: boolean — controls collapsed/expanded state. Default false (collapsed).
  - helper functions will parse URLs (no type additions required).

Validation rules:

- On press of a tutorial: if url is falsy, present an Alert "No URL available".
- If url is non-YouTube, still attempt open via Linking.openURL fallback.

[Files]
Single sentence describing file modifications.

Modify `src/screens/workout/ExerciseDetailScreen.tsx` to add collapse state, header/toggle behavior, YouTube icon, and a robust open-link helper; add the `implementation_plan.md` document at project root. No other files need modification.

Detailed breakdown:

- New files to be created (with full paths and purpose)

  - implementation_plan.md — this document (project root).
  - None else.

- Existing files to be modified (with specific changes)

  - src/screens/workout/ExerciseDetailScreen.tsx
    - Add new import:
      - `import Icon from "../../components/ui/Icon";`
    - Add new state:
      - `const [showFormCuesExpanded, setShowFormCuesExpanded] = useState<boolean>(false);`
    - Add helper functions:
      - `handleToggleFormCues()` — toggles expanded state.
      - `extractYouTubeId(url: string): string | null` — returns video id or null.
      - `openTutorialUrl(url: string): Promise<void>` — tries app scheme then fallback to browser; shows Alert on failure.
    - Replace and/or augment `renderHeader()` to render:
      - The main exercise name (existing).
      - A tappable header row labeled "Form Cues & Tutorials" with a YouTube icon at the right that indicates tappable area.
      - A collapsible content area that, when expanded, shows:
        - exerciseData.notes (if present) rendered as primary body text.
        - tutorial list rendered beneath notes (if tutorialVideos exist) — the list itself is not collapsible.
    - Refactor `renderTutorials()` to use `openTutorialUrl()` for onPress and to match the new visuals (moved under collapse).
    - Add new styles:
      - `formCuesHeader`, `formCuesHeaderText`, `formCuesIcon`, `tutorialItem`, `tutorialUrlText`, and minor accessibility-related style tweaks.

- Files to be deleted or moved

  - None.

- Configuration file updates
  - None.

[Functions]
Single sentence describing function modifications.

Add new helper functions for toggling the collapse and opening tutorial URLs; modify `renderHeader` and `renderTutorials` to use them and to render the new collapsible container.

Detailed breakdown:

- New functions (name, signature, file path, purpose)

  - src/screens/workout/ExerciseDetailScreen.tsx
    - handleToggleFormCues(): void
      - Signature: const handleToggleFormCues = useCallback(() => void, [setShowFormCuesExpanded]);
      - Purpose: toggles `showFormCuesExpanded` boolean state.
    - extractYouTubeId(url: string): string | null
      - Signature: const extractYouTubeId = (url: string): string | null => { ... }
      - Purpose: parse a YouTube URL (youtube.com/watch?v=ID, youtu.be/ID) and return ID or null.
    - openTutorialUrl(url: string): Promise<void>
      - Signature: const openTutorialUrl = useCallback(async (url: string) => Promise<void>, [Linking]);
      - Purpose: Attempt to open in native YouTube app using app URL scheme when a YouTube id is extracted; fallback to Linking.openURL(url). On failure, show Alert.
    - renderFormCuesContainer(): JSX.Element | null
      - Purpose: returns the collapsible container markup including header row, notes (if present), and tutorial list. Consumed by `renderHeader()`.

- Modified functions (exact name, current file path, required changes)

  - src/screens/workout/ExerciseDetailScreen.tsx
    - renderHeader()
      - Change: Add the toggling header row "Form Cues & Tutorials" (TouchableOpacity) under the exercise name and call `renderFormCuesContainer()` within the header area.
      - Behavior: default collapsed. If expanded, show notes and tutorial list. Keep `exerciseData.notes` display but nested under collapse.
    - renderTutorials()
      - Change: Move tutorial list rendering inside the collapsible container and replace direct Linking.openURL usage with `openTutorialUrl()` which prefers the YouTube app.

- Removed functions (name, file path, reason, migration strategy)
  - None removed.

[Classes]
Single sentence describing class modifications.

No class-level changes required; ExerciseDetailScreen is a functional component and all changes are local UI state and helper functions.

Detailed breakdown:

- New classes (name, file path, key methods, inheritance)

  - None.

- Modified classes (exact name, file path, specific modifications)

  - None.

- Removed classes (name, file path, replacement strategy)
  - None.

[Dependencies]
Single sentence describing dependency modifications.

No new third-party packages required; use existing Ionicons via the Icon wrapper and React Native's Linking.

Details of new packages, version changes, and integration requirements.

- No package.json changes are required.
- Confirm Ionicons is available (Icon.tsx already wraps Ionicons).
- No linking or native install steps required.

[Testing]
Single sentence describing testing approach.

Add tests for the new collapsible behavior (toggling) and a mocked Linking behavior test for `openTutorialUrl`, and run manual verification on device/emulator.

Test file requirements, existing test modifications, and validation strategies.

- New tests:
  - tests/screens/ExerciseDetailScreen.test.tsx (or update existing tests)
    - Verify initial collapsed state (notes and tutorial titles not visible).
    - Simulate press on "Form Cues & Tutorials" header — assert notes and tutorial titles appear.
    - Simulate press on a tutorial entry with mocked Linking:
      - Mock Linking.canOpenURL to return true for app scheme -> assert Linking.openURL called with app-scheme.
      - Mock Linking.canOpenURL to return false -> assert Linking.openURL called with original URL.
    - Snapshot tests: collapsed and expanded renderings.
- Integration / manual validation:
  - Run the app on device/emulator and manually verify:
    - Container toggles collapsed / expanded.
    - Tapping tutorial entries opens the YouTube app when installed; otherwise opens browser.

[Implementation Order]
Single sentence describing the implementation sequence.

Implement UI state and helpers first, then integrate them into the header render, add styles, add tests, and finally run manual verification and commit.

Numbered steps showing the logical order of changes to minimize conflicts and ensure successful integration.

1. Create a feature branch: `git checkout -b feat/exercise-form-cues-collapsible`.
2. Add `implementation_plan.md` to the repo (this document).
3. Edit `src/screens/workout/ExerciseDetailScreen.tsx`:
   - Add Icon import and `showFormCuesExpanded` state.
   - Add `extractYouTubeId`, `openTutorialUrl`, and `handleToggleFormCues` helpers.
   - Render a tappable header row "Form Cues & Tutorials" with YouTube Icon and collapse/expand state.
   - Move `renderTutorials()` under the collapsible container and ensure tutorial entries use `openTutorialUrl`.
   - Add styles and accessibility labels.
4. Run the project to verify compilation and UI:
   - `npm run web` or `expo start` depending on local workflow.
5. Implement tests for the toggle and open behavior; run test suite.
6. Manual validation on device/emulator.
7. Commit changes and open PR.
