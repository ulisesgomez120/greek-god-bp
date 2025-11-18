# Implementation Plan

[Overview]
Single sentence describing the overall goal.

Implement three progress-focused screens (Volume Progression Chart — Exercise Detail View, Workout Frequency Heatmap — Analytics Tab, and Last vs. This Session Comparison — Post-Workout View) plus shared infrastructure (lookup/cache, date utilities, aggregation utilities, data fetching/caching, error handling and accessibility) so the app can compute, cache and render per-exercise and per-session analytics using existing Supabase tables and the app's DatabaseService and ProgressService.

The work will add a small set of UI components and screens, new utility/services for lookups and aggregations, and tie them into the existing databaseService/progressService architecture so the endpoints are reusable across all three screens. We will favor server-side scoped queries (planned_exercise_id) already present in exercise_sets, use react-native-gifted-charts for line charts, and react-native-heatmap-calendar-sb for the heatmap. The approach emphasises minimal breaking changes: add new files and augment existing services with clearly-named functions, include unit tests for utilities, and keep UI components encapsulated so they can be re-used or replaced later.

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
