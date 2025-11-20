# Implementation Plan

[Overview]
Single sentence describing the overall goal.

Implement three progress-focused screens (Volume Progression Chart — Exercise Detail View, Workout Frequency Heatmap — Analytics Tab, and Last vs. This Session Comparison — Post-Workout View) plus shared infrastructure (lookup/cache, date utilities, aggregation utilities, data fetching/caching, error handling and accessibility) so the app can compute, cache and render per-exercise and per-session analytics using existing Supabase tables and the app's DatabaseService and ProgressService.

The work will add a small set of UI components and screens, a couple of service and util files, and tie them into the existing databaseService/progressService architecture so the endpoints are reusable across all three screens. We will favor server-side scoped queries (planned_exercise_id) already present in exercise_sets, use react-native-gifted-charts for line charts, and react-native-heatmap-calendar-sb for the heatmap. The approach emphasises minimal breaking changes: add new files and augment existing services with clearly-named functions, include unit tests for utilities, and keep UI components encapsulated so they can be re-used or replaced later.

[Types]
Single sentence describing the type system changes.

Add a small set of progress-specific TypeScript interfaces and extend existing Progress types to ensure all new services/components accept well-defined inputs and outputs.

Detailed types (to be added/updated in src/types/index.ts and src/types/progression.ts):

- VolumeDataPoint

  - date: string (ISO timestamp)
  - totalVolume: number (kg)
  - sessionCount: number
  - sets?: number
  - averageRpe?: number | null
  - sessionId?: string | null
  - plannedExerciseId?: string | null

- StrengthDataPoint

  - date: string (ISO timestamp)
  - exerciseId: string
  - plannedExerciseId?: string
  - oneRepMax: number
  - weight?: number
  - reps?: number
  - rpe?: number | null

- PersonalRecord

  - exerciseId: string
  - plannedExerciseId?: string
  - type: 'weight' | 'reps' | 'volume'
  - value: number
  - achievedAt: string (ISO date)
  - sessionId: string

- ExerciseSessionSummary

  - sessionId: string
  - sessionName?: string
  - date: string
  - sets: Array<{ setNumber: number; weight: number; reps: number; rpe?: number | null; isWarmup: boolean; notes?: string }>
  - bestSet: { weight: number; reps: number; volume: number; estimatedOneRepMax: number }
  - totalVolume: number
  - averageRpe?: number | null

- ExerciseLookupCacheEntry

  - exerciseId: string
  - name: string
  - updatedAt: string

- TimeframeOption = '4w' | '8w' | '3m' | '6m' | 'all'

Validation rules and notes:

- weight, reps, volume must be >= 0
- date strings must be ISO 8601
- plannedExerciseId must be present for scoped queries; components should gracefully handle absence (show CTA or fallback)
- RPE values may be null — aggregation utilities should ignore nulls when averaging

[Files]
Single sentence describing file modifications.

Add new screens and components, a couple of service and util files, and minor updates to navigation and existing service APIs.

Detailed breakdown:

New files to create (full path + purpose):

- src/screens/progress/ProgressLanding.tsx — Landing page for Progress tab with links to the three screens and small summary cards.
- src/screens/progress/ExerciseDetailProgress.tsx — Screen 1: Volume Progression Chart and exercise detail analytics.
- src/screens/progress/WorkoutFrequencyHeatmap.tsx — Screen 2: Calendar heatmap showing workout frequency (session count per day/week).
- src/screens/progress/SessionComparison.tsx — Screen 3: Post-workout Last vs This Session comparison UI.
- src/components/progress/VolumeChart.tsx — Thin wrapper around react-native-gifted-charts LineChart configured to our data types and touch interactions.
- src/components/progress/PRBox.tsx — Personal record summary box with tappable details.
- src/components/progress/LastSessionsList.tsx — Scrollable list of last N sessions for an exercise.
- src/components/progress/TimeframeSelector.tsx — Pill selector for timeframe (4w/8w/3m/6m/all).
- src/services/exerciseLookup.service.ts — Exercise lookup and cache (Task A).
- src/utils/dateUtils.ts — Date utilities (Task B): startOfWeek, formatRelative, weeksBetween, generateMonthRange, timezone helpers.
- src/utils/aggregationUtils.ts — Aggregation helpers (Task C): aggregateWeeklyVolume, computePRsFromSets, computeMonthVolume, averageRpe, sessionDurations.
- src/hooks/useExerciseProgress.ts — Data fetching hook that composes progress.service + lookup + caching for the Exercise Detail screen.
- src/screens/progress/\_styles.ts — Shared styling constants for progress screens (optional for consistency).

Existing files to modify (with specific changes):

- src/navigation/ProgressNavigator.tsx — Replace (or extend) current navigator to route to ProgressLanding and new screens (update ProgressStackParamList). Keep header styles consistent.
- src/services/progress.service.ts — Add orchestration methods used by screens: getExerciseVolumeProgress(plannedExerciseId, timeframe, options) and getExercisePRs(plannedExerciseId), getLastSessionsForExercise.
- src/services/database.service.ts — (small) add optional query caching TTL arguments for queryVolumeProgression and queryExerciseHistory calls and make sure timezone/startDate logic accepts explicit startOfWeek convention (Sunday start). Also add helper methods used by exerciseLookup service (getExercises for batch lookups is already present).
- src/hooks/useProgressData.ts — extend to support new fetch methods used by UI (or create new hook useExerciseProgress to avoid large changes).
- src/types/index.ts — add/extend the types listed above.
- src/components/progress/ProgressChart.tsx — either remove the placeholder or refactor to import new VolumeChart wrapper.

Files to be deleted or moved:

- Optionally remove the old placeholder ProgressChart or keep it as fallback. No mandatory deletes.

Configuration file updates:

- package.json already contains react-native-gifted-charts and react-native-heatmap-calendar-sb; ensure native modules are configured for expo-dev-client where necessary. Add a note in README / PR that devs should run: npm install && npx pod-install (iOS native deps) when running on device.

[Functions]
Single sentence describing function modifications.

Add focused service and util functions (well-documented) and augment ProgressService/DatabaseService with new query wrappers that accept timeframe and plannedExerciseId.

Detailed breakdown:

New functions (name, signature, file path, purpose):

- ExerciseLookupService.preloadCache(userId: string): Promise<void> — src/services/exerciseLookup.service.ts — Preloads exercise id→name mapping into in-memory cache from databaseService.getExercises; run at app init/profile load.
- ExerciseLookupService.getName(exerciseId: string): string | null — returns cached name or null if unknown.
- dateUtils.startOfWeek(date: string | Date, weekStartsOn: 0|1 = 0): Date — return Sunday-started week date.
- dateUtils.getWeekLabel(startDate: Date): string — formatted label e.g., "Oct 21–27".
- aggregationUtils.aggregateWeeklyVolume(sets: ExerciseSet[], weekStartsOn?: 0|1): Map<string /_weekStartISO_/, { totalVolume: number; sessionCount: number }>
- aggregationUtils.computeCurrentMonthVolume(sets: ExerciseSet[], monthDate: Date): { totalVolume: number }
- aggregationUtils.computePRs(sets: ExerciseSet[]): PersonalRecord[] — returns top PRs by weight/reps/volume.
- VolumeChart.transformForGiftedChart(data: VolumeDataPoint[], timeframe: TimeframeOption): { labels: string[]; datasets: { data: number[] } }
- ProgressService.getExerciseVolumeProgress(userId: string, exerciseId: string, plannedExerciseId: string, timeframe: TimeframeOption): Promise<VolumeDataPoint[]> — orchestrates databaseService.queryVolumeProgression + aggregationUtils to return weekly/monthly points.
- ProgressService.getExercisePRs(userId: string, plannedExerciseId: string): Promise<PersonalRecord[]> — wrapper over databaseService.queryPersonalRecords with post-processing.
- ProgressService.getLastSessionsForExercise(userId, exerciseId, plannedExerciseId, limit=5): Promise<ExerciseSessionSummary[]> — small wrapper that calls databaseService.queryExerciseHistory and maps response (similar to existing getExerciseHistory but with session-level aggregation).

Modified functions (exact name, current file path, required changes):

- databaseService.queryVolumeProgression (src/services/database.service.ts): accept optional params { weekStartsOn?: 0|1, cacheTTL?: number, startDateOverride?: string } and return consistent VolumeDataPoint[] (dates normalized to week start). Add caching on a per-user+plannedExerciseId+timeframe key.
- databaseService.queryExerciseHistory: ensure it returns planned_exercise_id-aware grouping and include session_name when available (database already does most of this — add small normalization). Add cacheTTL parameter.
- progress.service.ts methods getVolumeProgression/getExerciseHistory/getPersonalRecords: refine parameter names to accept timeframe options (e.g., TimeframeOption) and delegate to databaseService with cache options.

Removed functions: none expected. If a placeholder ProgressChart is kept, comment it as deprecated and point to VolumeChart.

[Classes]
Single sentence describing class modifications.

Introduce two small classes to encapsulate lookup caching and chart transformation responsibilities.

Detailed breakdown:

New classes:

- ExerciseLookupService (src/services/exerciseLookup.service.ts)

  - private cache: Map<string, ExerciseLookupCacheEntry>
  - preloadCache(userId: string): Promise<void>
  - getName(exerciseId: string): string | null
  - invalidate(exerciseId?: string): void
  - syncWithDb(): Promise<void> (periodic refresh)

- ChartDataAdapter (src/components/progress/VolumeChart.tsx)
  - static transformVolumePointsToGifted(data: VolumeDataPoint[], opts?: { timeframe: TimeframeOption; maxPoints?: number }): { labels: string[]; datasets: { data: number[] } }
  - static formatTooltip(index: number, data: VolumeDataPoint[]): string

Modified classes:

- None required. If any existing classes are added to (e.g., DatabaseService) keep modifications minimal and backward-compatible.

Removed classes:

- None.

[Dependencies]
Single sentence describing dependency modifications.

No new external dependencies beyond those already added; we will use react-native-gifted-charts for charts and react-native-heatmap-calendar-sb for the heatmap; ensure installed versions are compatible with Expo and documented.

Details:

- react-native-gifted-charts — already in package.json (v1.4.65). Use LineChart and Tooltip configuration. No additional TS types required; add a small wrapper TSX file to adapt types.
- react-native-heatmap-calendar-sb — already in package.json (v0.0.3). Use for heatmap grid; adapt date input format.
- If any native linking issues on iOS / Android appear, advise running: npx pod-install and rebuilding dev client.

[Testing]
Single sentence describing testing approach.

Add unit tests for utilities and service logic and small component snapshot/interaction tests for UI components.

Test file requirements and validation strategies:

- Unit tests (Jest) under **tests**/utils/dateUtils.test.ts and **tests**/utils/aggregationUtils.test.ts covering week boundary calculations, timezone handling, weekly aggregation, PR detection, and month comparisons.
- Service tests: **tests**/services/exerciseLookup.service.test.ts — mock databaseService to verify cache population and lookups.
- Component tests: **tests**/components/VolumeChart.test.tsx and PRBox.test.tsx — use @testing-library/react-native for basic render and interaction tests (touch tooltips, pill selector state changes).
- Integration test (optional): small test verifying ProgressLanding navigation links route to screens (use mocked navigation prop).
- Validation: include edge cases (no data, incomplete sets with null weight/reps, large volumes) and assert graceful fallbacks.

[Implementation Order]
Single sentence describing the implementation sequence.

Make incremental, localizable changes: add types and utils first, then services and unit tests, then UI components, then screens and navigation wiring, finally integration, QA and accessibility fixes.

Numbered steps:

1. Types: Add the types listed to src/types/index.ts (and src/types/progression.ts if preferred). Commit as separate change.
2. Utilities: Implement src/utils/dateUtils.ts and src/utils/aggregationUtils.ts with unit tests. Keep pure functions and well-covered edge cases.
3. Exercise lookup service: Add src/services/exerciseLookup.service.ts and call preloadCache in app initialization (e.g., in useSplashScreen or a top-level hook). Add tests.
4. ProgressService wrappers: Add getExerciseVolumeProgress, getExercisePRs, getLastSessionsForExercise in src/services/progress.service.ts that delegate to databaseService query helpers. Add any small databaseService adjustments (cacheTTL, weekStart param).
5. Components: Implement VolumeChart, PRBox, LastSessionsList, TimeframeSelector components. Each should be self-contained and accept props documented with types.
6. Screens: Create ProgressLanding, ExerciseDetailProgress, WorkoutFrequencyHeatmap, SessionComparison. Initially wire to mocked data or use ProgressService stubs, then connect to real services.
7. Navigation: Update src/navigation/ProgressNavigator.tsx to use ProgressLanding as initial route and add new routes to the stack.
8. Integration & Caching: Connect ExerciseDetailProgress to useExerciseProgress hook which composes lookup, progressService and aggregation utils; ensure caching TTL used and loading/error states are implemented.
9. Accessibility & UX polish: Ensure touch targets, color contrast, pinch/zoom protection, skeleton loaders and fallback UIs.
10. Testing & CI: Run unit tests and add snapshot tests. Fix issues and iterate.
11. Documentation: Add README section and a small developer note explaining how to run and debug charts and the heatmap, and mention dev steps for native modules.

---

Notes and rationale:

- planned_exercise_id is the canonical scoping field—queries and UI should require it for detailed per-exercise charts. When not available, screens should show a friendly CTA prompting the user to open the exercise from a plan or run a workout.
- Keep heavy DB filtering server-side when possible; databaseService already contains many useful helper queries—reuse them and add small options instead of duplicating SQL logic.
- Prefer small, well-tested pure functions for date/aggregation logic to avoid repeating subtle timezone bugs.

[Progress Update]
This document was updated to reflect work completed during the current implementation sprint focused on Screen 1 (Exercise Detail View). Below is a concise summary of what was added, modified and what remains.

Summary of completed work (high level)

- Added typed models and new progress-specific TypeScript interfaces.
- Implemented pure date and aggregation utilities used by charts and boxes.
- Added an ExerciseLookupService (caching exerciseId -> name) and a small hook to preload/look up names.
- Implemented aggregation helpers to compute weekly volume, monthly volume and basic PR detection.
- Created a composable hook useExerciseProgress that orchestrates ExerciseLookupService + ProgressService calls.
- Built UI components used by Screen 1: VolumeChart (wrapper), PRBox, LastSessionsList, TimeframeSelector.
- Scaffolded and implemented the Exercise Detail screen (src/screens/progress/ExerciseDetailProgress.tsx).
- Created a small ProgressLanding screen and wired it into the ProgressNavigator as the initial route.
- Added ProgressService wrapper methods for friendly timeframe usage and small DatabaseService cache options on exercise history & volume progression queries.

Files added or significantly changed in this iteration

- Added

  - src/screens/progress/ProgressLanding.tsx (landing page)
  - src/screens/progress/ExerciseDetailProgress.tsx (exercise detail screen scaffold)
  - src/components/progress/VolumeChart.tsx (chart wrapper)
  - src/components/progress/PRBox.tsx
  - src/components/progress/LastSessionsList.tsx
  - src/components/progress/TimeframeSelector.tsx
  - src/services/exerciseLookup.service.ts (exercise id → name cache)
  - src/hooks/useExerciseProgress.ts (hook composing services + lookup)
  - src/utils/dateUtils.ts
  - src/utils/aggregationUtils.ts

- Modified
  - src/types/index.ts — added VolumeDataPoint, ExerciseSessionSummary, PersonalRecord, ExerciseLookupCacheEntry, TimeframeOption
  - src/services/progress.service.ts — added wrapper helpers: getExerciseVolumeProgress, getExercisePRs, getLastSessionsForExercise
  - src/services/database.service.ts — added optional cache-aware behaviour to queryExerciseHistory and queryVolumeProgression (useCache/cacheTTL params)
  - src/navigation/ProgressNavigator.tsx — wired ProgressLanding and ExerciseDetailProgress (ProgressLanding set as initialRoute)

Notes on outstanding issues

- VolumeChart: I implemented a working wrapper around react-native-gifted-charts. The library's TypeScript definitions in this project raised some typing warnings for the onDataPoint press handler and data shape. These are non-blocking for runtime — we can either adapt to the library's exact types (preferred) or add a small local shim/casts to silence TS until we add stricter typings.
- DatabaseService changes: small optional cache params were added; these are backward-compatible. Extra caution taken to avoid large SQL or behaviour changes.

Current task checklist (status)

- [x] Step 1: Add TypeScript types to src/types/index.ts
- [x] Step 2: Implement dateUtils.ts and aggregationUtils.ts
- [x] Step 3: Create ExerciseLookupService and integrate (service created)
- [x] Step 4: Add ProgressService wrapper methods and DatabaseService small enhancements
- [x] Step 5: Build UI components (VolumeChart, PRBox, LastSessionsList, TimeframeSelector)
- [x] Step 6: Create ExerciseDetailProgress screen (Screen 1 scaffold & wiring)
- [x] Step 7: Create ProgressLanding screen with link to Screen 1
- [x] Step 8: Update ProgressNavigator with new routes and set ProgressLanding as initial route
- [x] Step 9: Create useExerciseProgress hook (composed hook created; caching options plumbed)
- [ ] Step 10: Add accessibility features and UX polish (touch targets, contrast, skeletons)
- [ ] Step 11: Run tests and add snapshot tests (unit tests not yet added)
- [ ] Step 12: Update documentation and README (developer notes)

Next recommended actions (pick one)

1. Improve VolumeChart TypeScript typings so it's fully type-safe with react-native-gifted-charts (preferred for long-term maintainability).
2. Add unit tests for dateUtils and aggregationUtils (Jest) to lock aggregation behaviour.
3. Add accessibility polish and finalize UX details for ExerciseDetailProgress (touch target sizes, empty states, localized labels).
4. Add documentation notes to README describing new files and how to run the app after native dependency changes (pod install etc.).

If you want me to continue now, pick which of the next recommended actions I should start with and I'll proceed (I'll update this plan after each major change).

[Exercise Search — Planned Exercise Selector]
Single sentence describing the overall goal.

Add an exercise selection screen that lets users search and pick a planned_exercise_id (from their workout plans) using the database autocomplete/ search capabilities; the selector will only show planned exercises the user has actually performed (has exercise_sets rows) and will surface plan context (plan name, session name, target sets/reps, last performed date).

Scope and rationale:

- This screen is added as a lightweight step before navigating to the existing ExerciseDetailProgress screen so users can select the exact planned exercise instance they want to view progress for.
- We will use the database autocomplete_exercises function to power typeahead on base exercise names, and then resolve matches to planned_exercises the user has performed by joining exercise_sets -> planned_exercises -> workout_plan_sessions -> workout_plans -> exercises.
- Showing only performed planned_exercises keeps the selector focused on items that have progress data; it reduces noise and makes the ExerciseDetailProgress chart immediately meaningful.

Types (small additions):

- PlannedExerciseSearchResult
  - plannedExerciseId: string
  - exerciseId: string
  - exerciseName: string
  - planName?: string
  - sessionName?: string
  - targetSets?: number
  - targetRepsMin?: number
  - targetRepsMax?: number
  - timesPerformed: number
  - lastPerformed?: string (ISO)

Files (new / modified):

- New: src/screens/progress/ExerciseSearch.tsx — Screen: searchable list + autocomplete input; displays results grouped by exercise name with plan/session context and a small metadata row (sets, reps, last performed). Selecting one navigates to ExerciseDetailProgress with { exerciseId, plannedExerciseId }.
- Modified: src/navigation/ProgressNavigator.tsx — add 'ExerciseSearch' route and wire navigation (ExerciseSearch becomes the route invoked when user taps to change planned exercise from ProgressLanding or ExerciseDetailProgress if plannedExerciseId is missing).
- Modified: src/services/database.service.ts — add helper method queryPerformedPlannedExercises(userId: string, searchQuery?: string, limit?: number, offset?: number, options?: QueryOptions) that executes the server-side query joining exercise_sets -> planned_exercises -> workout_plan_sessions -> workout_plans -> exercises and returns PlannedExerciseSearchResult[].
- Modified: src/services/progress.service.ts — add wrapper getPerformedPlannedExercises(userId, searchQuery, options) that calls databaseService.queryPerformedPlannedExercises and applies a small client-side mapping.
- New (optional): src/hooks/usePerformedPlannedExercises.ts — hook for debounced search + loading/error state used by ExerciseSearch.tsx.

Database query (server-side / supabase SQL outline):

We will reuse the pattern used in migrations for search (fitness_search config) but scope to planned_exercise instances with history. Example SQL:

SELECT
pe.id AS planned_exercise_id,
pe.exercise_id,
e.name AS exercise_name,
wp.name AS plan_name,
wps.name AS session_name,
pe.target_sets,
pe.target_reps_min,
pe.target_reps_max,
COUNT(DISTINCT es.session_id) AS times_performed,
MAX(ws.started_at) AS last_performed
FROM exercise_sets es
JOIN planned_exercises pe ON es.planned_exercise_id = pe.id
JOIN workout_plan_sessions wps ON pe.session_id = wps.id
JOIN workout_plans wp ON wps.plan_id = wp.id
JOIN exercises e ON pe.exercise_id = e.id
JOIN workout_sessions ws ON es.session_id = ws.id
WHERE ws.user_id = $1
AND ws.completed_at IS NOT NULL
AND (e.name ILIKE $2 || '%' OR e.search_vector @@ plainto_tsquery('fitness_search', $2) OR COALESCE(pe.target_sets::text, '') ILIKE $2 || '%')
GROUP BY pe.id, pe.exercise_id, e.name, wp.name, wps.name, pe.target_sets, pe.target_reps_min, pe.target_reps_max
ORDER BY last_performed DESC, times_performed DESC
LIMIT $3 OFFSET $4;

Notes:

- Use prepared parameters for userId, searchQuery, limit, offset. When searchQuery is empty, return most recently performed planned exercises ordered by last_performed.
- Use e.search_vector for broader matching and ILIKE for quick prefix matches (auto-complete). The migrations already create GIN indexes to make this efficient.

UI/UX details:

- Top: Autocomplete text input that uses the existing autocomplete_exercises() DB function to provide exercise name suggestions as the user types. On selecting a suggestion or submitting text, call the performed-planned-exercises query to list only the planned_exercises the user has performed matching that exercise name / search.
- Result row: Exercise name (bold), small badge with plan/session (e.g., "Push Day A — Plan: 12-week Strength"), metadata row: "3×8-12 • last: Nov 15 • done 6x".
- Empty state: If no performed planned exercises match, show CTA: "No performed instances found — show all planned exercises instead" with a toggle to list all planned exercises (Option B fallback).
- Accessibility: ensure input has accessible label, result rows are focusable and have sufficient hit area.

Routing and navigation:

- New route: ProgressStackParamList['ExerciseSearch'] = { onSelect?: (plannedExerciseId: string, exerciseId: string) => void } — optional callback for inline selection flows. Default behavior: navigate to ExerciseDetailProgress with params { exerciseId, plannedExerciseId }.
- From ExerciseDetailProgress: if route.params.plannedExerciseId is missing, show a button "Select Planned Exercise" that navigates to ExerciseSearch.
- From ProgressLanding: add a shortcut card/button "View Exercise Progress" → opens ExerciseSearch.

Functions and service changes (details):

- databaseService.queryPerformedPlannedExercises(userId, searchQuery, limit=20, offset=0, options) — executes the SQL above via supabase.rpc or supabase.from().select with proper joins. Returns PlannedExerciseSearchResult[] and caches results using DatabaseService queryCache when options.useCache !== false.
- progressService.getPerformedPlannedExercises(userId, searchQuery, options) — wrapper that calls databaseService.queryPerformedPlannedExercises and maps fields into frontend-friendly names.
- hooks/usePerformedPlannedExercises.ts — implements debounced search (300ms), paging support and returns { results, loading, error, fetchMore, refresh }.

Types/Validation:

- searchQuery: nullable string; trim and treat empty string as listing recent performed planned exercises.
- timesPerformed: integer >= 0
- lastPerformed: ISO timestamp or null

Testing:

- Unit tests for databaseService.queryPerformedPlannedExercises with mocked supabase responses verifying grouping, ordering, and empty result behaviors.
- Hook tests for usePerformedPlannedExercises: debounce, loading state, paging behavior.
- Component tests: ExerciseSearch snapshot; keyboard navigation and selection behavior using @testing-library/react-native.

Implementation Order (where this addition fits):

1. Add PlannedExerciseSearchResult type to src/types/index.ts.
2. Implement databaseService.queryPerformedPlannedExercises — add server-side SQL or supabase RPC wrapper and local cache.
3. Add progressService.getPerformedPlannedExercises wrapper.
4. Create hook src/hooks/usePerformedPlannedExercises.ts for debounced search and paging.
5. Implement src/screens/progress/ExerciseSearch.tsx and wire navigation in ProgressNavigator.
6. Update ExerciseDetailProgress to navigate here if plannedExerciseId is missing and to accept params from selection.
7. Add unit & component tests.
8. QA accessibility and edge-cases (no data, lots of duplicates across plans).

Current focus note:

- This Exercise Search (planned exercise selector) is the current focus for the next implementation step; it should be added to the top of the implementation backlog and completed before finalizing ExerciseDetailProgress UX polish. Keep all other plan content intact.

[End of Exercise Search — Planned Exercise Selector]

---

Addendum — ExerciseSearch progress update (automatically appended)

- Work completed since last plan update:

  - [x] Implemented UI screen: src/screens/progress/ExerciseSearch.tsx (search input, list, selection navigation).
  - [x] Implemented debounced, cancellable hook: src/hooks/usePerformedPlannedExercises.ts (300ms debounce, paging, abort handling).
  - [x] Added ProgressService.getPerformedPlannedExercises wrapper and databaseService.queryPerformedPlannedExercises implementation (client-side grouping & caching).
  - [x] Wired navigation: added ExerciseSearch route to src/navigation/ProgressNavigator.tsx and updated ProgressLanding to navigate to ExerciseSearch.
  - [x] Hook now receives authenticated userId from useAuth in ExerciseSearch screen to avoid missing-user errors.
  - [x] Added a basic test scaffold for the hook at src/**tests**/usePerformedPlannedExercises.test.tsx.
  - [x] Addressed a TypeScript parameter mismatch by ensuring userId passed as string to service calls.

- Current runtime issue observed:

  - [ ] PGRST100 parse error coming from Supabase/PostgREST: "failed to parse order (workout_sessions.started_at.desc)". This arises when PostgREST interprets an order clause referencing a joined column in the generated SQL. Log sample: { code: "PGRST100", details: "unexpected \"s\" expecting \"asc\", \"desc\", \"nullsfirst\" or \"nullslast\"", message: '"failed to parse order (workout_sessions.started_at.desc)" (line 1, column 18)' }
  - Action taken: removed explicit .order(...) on the joined column in the queryPerformedPlannedExercises flow and moved sorting to client-side after grouping. This prevents the server-side parse error while keeping deterministic ordering (client sorts by lastPerformed / timesPerformed).

- Remaining work to resolve and finalize ExerciseSearch:
  - [ ] Run full TypeScript and unit test suite (npx tsc --noEmit, npm test) and fix any remaining issues.
  - [ ] Add unit tests for queryPerformedPlannedExercises (mock supabase) to ensure grouping, sorting and paging behavior are covered and prevent regression.
  - [ ] Manual QA across platforms: verify typing, debounced search, selection navigation, and that selecting an item navigates to ExerciseDetailProgress with correct params.
  - [ ] Once QA passes, add documentation notes and open a PR with screenshots and test results.

If you want me to continue now I can (pick one):

- Run the TypeScript check and tests locally (requires approval to run commands).
- Add unit tests for queryPerformedPlannedExercises.
- Re-run manual QA steps you described and iterate on any remaining runtime errors.
