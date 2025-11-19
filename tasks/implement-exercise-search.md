Task: Implement ExerciseSearch (Planned Exercise Selector)

Reference plan file:

- Relative path: implementation_plan.md
- Absolute path: /Users/ulisesgomez/Documents/code/Workout Apps/greek-god-bp/app/implementation_plan.md

Goal

- Build the ExerciseSearch feature ("Planned Exercise Selector") according to the design & requirements in implementation_plan.md. This task covers design, implementation, integration, tests, and documentation.

Quick navigation commands (run from project root):

- Open the plan in VSCode: code implementation_plan.md
- Search for the feature header(s):
  - grep -n "ExerciseSearch" implementation_plan.md || grep -n "Planned Exercise Selector" implementation_plan.md
- Show the plan section once you have a line number L (replace M with an estimated end line):
  - sed -n 'L,Mp' implementation_plan.md
- Alternatively extract the heading block (approx):
  - awk '/ExerciseSearch/{flag=1} /^## / && flag && !/ExerciseSearch/{flag=0} flag{print}' implementation_plan.md

Implementation instructions for the agent

1. Read the ExerciseSearch / Planned Exercise Selector section in implementation_plan.md and any referenced files. Use the navigation commands above to locate the section quickly.
2. Design: produce a short design doc (1-2 paragraphs) describing the expected user flow, UI components, data model changes, and API/service calls required. Put this doc in tasks/implement-exercise-search.md (append) and in implementation_plan.md under a new subsection titled "ExerciseSearch implementation notes" if appropriate.
3. Create or update services: if exercise lookup logic needs extension, update src/services/exerciseLookup.service.ts and add any new helper modules under src/services/ or src/utils/. Keep network/db calls isolated in service layer.
4. UI: Add a new screen and components under src/screens/progress/ and src/components/progress/ (e.g., ExerciseSearchScreen.tsx, ExerciseSearchInput.tsx, ExerciseResultItem.tsx). Follow existing code patterns and styling conventions.
5. Navigation: add route & navigation entry in src/navigation/ProgressNavigator.tsx (and any other navigator as necessary). Ensure deep linking & back navigation behavior matches existing patterns.
6. State & hooks: add an appropriate hook (e.g., useExerciseSearch) under src/hooks/ or extend existing hooks (useExerciseProgress) to provide search state, debouncing, caching, and result selection.
7. Tests: add unit tests for service logic (jest) and basic component snapshot / behavior tests. Put tests in **tests** alongside modules or in src/**tests**.
8. QA: run the app (web / emulator) and verify search works end-to-end: typing, debounced queries, selecting an exercise, and that selection returns the planned exercise to the calling flow.
9. Documentation: update implementation_plan.md with notes about decisions, and update README or context files if needed.
10. PR: create a focused commit/branch and open a PR including the design note, screenshots, and test results.

Important implementation hints & conventions

- Follow existing project conventions (TypeScript, React Navigation, hooks). Reuse existing components where possible (search for similar UI patterns in src/components).
- Debounce user input (200-350ms) to avoid excessive lookups.
- Keep service calls cancellable (e.g., use AbortController or track latest request token) to avoid race conditions.
- Respect feature flags and permission checks used across the app.

Switch request

- Requesting: SWITCH TO ACT MODE to implement the steps above. (Note: this agent is currently in ACT MODE; include this explicit instruction for the implementer.)

Deliverables

- New/updated files implementing ExerciseSearch (UI, services, hooks).
- Tests covering service logic and main UI flow.
- Short design note appended to this task file and a short update in implementation_plan.md.
- PR with changes and screenshots.

If anything in the plan is ambiguous, open a short clarifying issue or ask for a design decision before implementing.

---

Design notes — ExerciseSearch (Planned Exercise Selector)

User flow (summary):
The user opens ExerciseSearch from ProgressLanding or when a planned_exercise_id is missing on ExerciseDetailProgress. The screen presents an autocomplete input at the top. As the user types, the client calls a debounced hook (usePerformedPlannedExercises) which first queries exercise name suggestions (autocomplete_exercises) and then calls the performed-planned-exercises query to return only planned_exercise instances the user has performed. Results are shown grouped by exercise name with plan/session context and metadata (target sets/reps, times performed, last performed). Selecting a row either invokes an onSelect callback (if provided) or navigates to ExerciseDetailProgress with { exerciseId, plannedExerciseId }.

Components, services and data model (summary):
UI components: src/screens/progress/ExerciseSearch.tsx (screen) plus small components src/components/progress/ExerciseSearchInput.tsx (autocomplete input wrapper) and src/components/progress/ExerciseResultItem.tsx (result row). Hook: src/hooks/usePerformedPlannedExercises.ts implements debounced search (≈300ms), cancellable requests, paging and simple client-side caching. Service: add databaseService.queryPerformedPlannedExercises(userId, searchQuery, limit, offset, options) and progressService.getPerformedPlannedExercises wrapper that returns PlannedExerciseSearchResult[]. Data model addition: PlannedExerciseSearchResult type (plannedExerciseId, exerciseId, exerciseName, planName?, sessionName?, targetSets?, targetRepsMin?, targetRepsMax?, timesPerformed, lastPerformed?). No DB schema changes required; the server-side query joins exercise_sets -> planned_exercises -> workout_plan_sessions -> workout_plans -> exercises and can be implemented as a supabase RPC or a joined select. Requests should support cacheTTL and be cancelable; results should fall back to an option to "Show all planned exercises" if no performed instances exist for a search.

Path to implementation plan: /Users/ulisesgomez/Documents/code/Workout Apps/greek-god-bp/app/implementation_plan.md

Next step (switch to ACT MODE and begin):

- I have appended the design notes above. If you confirm, I will begin implementing the service wrapper and the hook next ("Implement/update service layer (exercise lookup)"), update task_progress below, and create the new hook file and a scaffolded ExerciseSearch screen.
