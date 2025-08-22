# TrainSmart Metric → Imperial Conversion Implementation Plan

## Goal

Allow users to view and enter workout data using imperial units (lbs, ft/in, miles) while continuing to store all data in metric units (kg, cm, km) in the database. Prioritize the working workout logging flow (program → exercise logging) and implement a conversion layer + preferences so the rest of the app can switch later with minimal changes.

## High-level approach

- Keep database schema unchanged (store metric).
- Add a conversion layer: metric ↔ imperial.
- Add a unit preference manager (hook + persisted storage) using existing `ProfilePreferences` where possible.
- Convert input from imperial → metric before persisting.
- Format and display stored metric values into imperial for UI when user preference = imperial.
- Prefer small, targeted changes to components used in workout logging: `SetLogger`, `ExerciseCard`, `ExerciseDetailScreen`, `WorkoutSummaryScreen`.
- Update validation rules to accept imperial input (and convert to metric for validation/ storage), while not changing server-side validation (server still expects metric).

## Files to add / modify

Primary files to add:

- src/utils/unitConversions.ts (new) — conversion functions and formatting helpers
- src/hooks/useUnitPreferences.ts (new) — react hook to read & write unit prefs from storage & profile service
- src/utils/formatters.ts (update) — reuse or add formatting for height/weight display
- src/constants/progressionRules.ts (update) — expose kg-based rules and helpers to get imperial display values
- implementation_plan.md (this file)

Primary files to update (minimal, localized edits):

- src/components/workout/SetLogger.tsx
- src/components/workout/ExerciseCard.tsx
- src/screens/workout/ExerciseDetailScreen.tsx
- src/screens/workout/WorkoutSummaryScreen.tsx
- src/utils/validation.ts
- src/config/constants.ts (validation ranges / storage keys adjustments optional)
- src/types/profile.ts (already contains ProfilePreferences; ensure saved/persisted usage)

## Design & Decisions

- Data storage: metric only (no DB migration).
- Display & input: follow user's preference — by default DEFAULT_PROFILE_PREFERENCES already chooses imperial but app may not persist it; hook will read persisted preferences and fall back to defaults.
- Height: use feet & inches format (e.g., 5'10"); provide input helpers to capture feet and inches separately or accept single string and parse.
- Weight rounding for display: Round to nearest 0.5 lb (per requirements). For progression increments, map kg increments to practical lb increments (e.g., 2.5kg → 5.5 lbs → round to 5 lbs).
- Progression rules: Store progression increments in kg (source of truth). Provide helper to compute approximate lb increment for display; do NOT use imperial values as truth.
- Validation: Keep server-side validation in kg. Client-side will accept imperial values and convert to kg before validating with existing numeric ranges.

## Conversion rules / rounding

- 1 kg = 2.20462 lbs
- Display weight in lbs rounded to nearest 0.5 lb: roundToNearest(valueInLbs, 0.5)
- On input in lbs, convert to kg with: kg = lbs / 2.20462 (store float with reasonable precision)
- Display height: convert cm → ft/in. Example: 178 cm → 5'10" (floor inches, round remaining to nearest 0.5" if needed)
- On height input in ft/in, convert to cm for storage: cm = (ft _ 12 + in) _ 2.54
- Volume: totalVolumeKg from server → convert to lbs for display (multiply by 2.20462), round to integer or 0.5 lb per UX choice (recommend integer for aggregates)
- Progression conversion: map kg increments → lbs, then map to nearest practical plate increment:
  - barbell: 2.5 kg → 5.5 lb → show 5 lb (or `~5.5 lbs`) — recommendation: show rounded to 5 lb and include note in tooltip if precise needed.

## API / Persistence considerations

- When persisting sets via workoutService.addExerciseSet, SetLogger must convert user-entered weight (lbs if imperial user) into kg and call the service with weightKg.
- When reading sets (history, summary), components receive kg from service and must format for display using unit preference hook.
- When updating profile preferences, use existing profile.service functions to save preferences (if present) and also persist locally (STORAGE_KEYS.async.userPreferences).
- No backend changes required for storage, syncing, or server validation.

## Implementation breakdown (ordered tasks)

Phase A — Foundation

1. Create `src/utils/unitConversions.ts`

   - Exported functions:
     - kgToLbs(kg: number): number
     - lbsToKg(lbs: number): number
     - roundToNearest(value: number, step: number): number
     - cmToFeetInches(cm: number): { ft: number; in: number }
     - feetInchesToCm(ft: number, inches: number): number
     - formatLbsForDisplay(kgOrLbs: number, inputIsKg?: boolean): string // returns "180 lbs" (rounded)
     - formatCmToFtIn(cm: number): string // returns `5'10"`
     - parseWeightInput(input: string): number | null // parse "180", "180.5", "180 lb"
     - parseHeightInput(input: string): { ft?: number; in?: number } | null
   - Add unit tests locally (describe math and rounding behavior).
   - Keep functions pure and documented.

2. Create `src/hooks/useUnitPreferences.ts`
   - Reads preferences from Redux `selectUser` or from async storage fallback `STORAGE_KEYS.async.userPreferences`.
   - Provides:
     - current preferences
     - setter: setUnitPreferences()
     - helpers: isImperialWeight(), isImperialHeight()
   - Persist changes to async storage and call `profile.service.updatePreferences` if logged in.

Phase B — Conversion + Formatting 3. Add formatting glue in `src/utils/formatters.ts` (or extend if existing):

- weightDisplay(kg: number | undefined, prefs): string
- heightDisplay(cm: number | undefined, prefs): string

Phase C — Component updates (workout-first) 4. Update `src/components/workout/SetLogger.tsx`

- Replace static "Weight (kg)" label with computed label based on prefs: `Weight (kg)` or `Weight (lbs)`
- Accept imperial input:
  - If user uses lbs: allow decimal numbers, round only for display. On change, keep raw lbs string in state.
  - When constructing `ExerciseSetFormData`, convert to weightKg using `lbsToKg` before passing to onSetComplete.
- Validation:
  - Instead of checking kg ranges directly, convert input to kg then validate using the existing validateForm logic or constants.
  - Update error messages to show units appropriate to user's preference.
  - For fast change, in SetLogger adjust validateForm to convert state.weight (string) to metric before comparing against VALIDATION.workout.maxWeight etc.
- Suggested weight prop remains as kg from parent; convert to display units for filling input (use kgToLbs if prefs === lbs).

5. Update `src/components/workout/ExerciseCard.tsx`

   - Wherever `{set.weightKg ? `${set.weightKg}kg` ...}` appears, replace with `weightDisplay(set.weightKg, prefs)`
   - ProgressionRecommendation.suggestedWeight: currently computed in kg (`lastWeight + 2.5`). When showing suggestion to users with imperial preference, convert suggestedWeight to lbs and format using roundToNearest step 0.5 or practical rules. Also update suggestion label `Try ${value}kg` → use formatter.

6. Update `src/screens/workout/ExerciseDetailScreen.tsx`

   - Completed sets listing: convert `set.weightKg` to display via `weightDisplay`.
   - Exercise history: convert session.sets weight fields accordingly.
   - Suggested values passed into SetLogger: convert `suggestedWeight` (kg) → display units if SetLogger expects display units. Decision: keep SetLogger suggestedWeight prop as kg (current API) and let SetLogger convert to display units when rendering; less surface change.
   - Ensure SetLogger `suggestedWeight` behavior preserved: if SetLogger input empty, fill with suggestedWeight converted to display units.

7. Update `src/screens/workout/WorkoutSummaryScreen.tsx`
   - Replace raw `session.totalVolumeKg` display with conversion to lbs when prefs = imperial. Format as `X lbs` (round to integer recommended for totals).
   - Each set display: use `weightDisplay`.

Phase D — Validation & Progression constants 8. Update `src/utils/validation.ts`

- Do not change server-side validation. Client-side change:
  - Expose helper `validateWeightInput(value: string, prefs)` that converts display input into kg and validates value against current VALIDATION.profile.weight range.
  - For height, add `validateHeightInput` that parses ft/in into cm then uses existing range.
- Use these helpers in `ProfileSetupScreen` and `ProfileEditScreen` where appropriate.

9. Update `src/constants/progressionRules.ts` (or the place constants come from)
   - Keep progression increments in kg as source of truth.
   - Provide `getProgressionDisplayValue(incrementKg, prefs)` helper that returns formatted string for UI (e.g., `+5 lbs`).
   - For mapping to practical plates, create `mapKgIncrementToPracticalLb(incrementKg)` simple function:
     - Convert to lbs and round to nearest 2.5lb or 5lb depending on whether using small dumbbell increments. Document behavior.

Phase E — Preferences UI & persistence 10. Preference persistence - Ensure `ProfilePreferences` is saved and read during app startup. - If there's an existing `useProfile` or profile service hook, integrate hook to read and write preferences through `profile.service.updatePreferences`. - Fallback to `STORAGE_KEYS.async.userPreferences` for unauthenticated users.

11. Optional: Add toggle UI (Settings screen)
    - Add a simple row in `src/screens/profile/SettingsScreen.tsx` to toggle weight/height units using `useUnitPreferences`.
    - Keep implementation minimal (a few lines) because user asked primarily to focus on workout logging.

Phase F — Testing 12. Unit tests (recommended) - Add tests for conversion math (kg<->lbs, cm->ft/in) and rounding behavior. - Test parsing of weight and height input strings.

13. Manual testing flow (imperial user)
    - Confirm default pref = imperial or set preferences manually.
    - Open program → exercise logging.
    - Verify SetLogger:
      - Label shows "Weight (lbs)".
      - Enter weight as lbs (e.g., 180) and reps; on submit, check that workoutService.addExerciseSet is called with weightKg ≈ 81.65.
      - Suggested weight passed from previous sets (kg) is shown in lbs in the input when empty.
    - Verify ExerciseCard:
      - Previous workout sets display "180 lbs × 8" etc.
      - Progression tip shows suggested increment in lbs (rounded to practical increment).
    - Verify ExerciseDetailScreen completed sets and history display imperial units.
    - Verify WorkoutSummaryScreen total volume displays in lbs (and exam plain conversion).
    - Edge cases: bodyweight (BW) remains unaffected, zero/empty values handled gracefully.
    - Test height input and profile update flows: entering 5'10" converts to 178 cm in stored profile.

## Implementation details & code snippets

1. Example utility (src/utils/unitConversions.ts) — core functions:

- kgToLbs(kg) => kg \* 2.20462
- lbsToKg(lbs) => lbs / 2.20462
- roundToNearest(value, step) => Math.round(value / step) \* step
- cmToFeetInches(cm) => totalInches = cm / 2.54; ft = Math.floor(totalInches / 12); in = Math.round(totalInches - ft\*12)
- feetInchesToCm(ft, inches) => (ft*12 + inches) * 2.54

2. SetLogger changes (high level)

- Replace static label:
  - const { prefs } = useUnitPreferences();
  - const weightLabel = prefs.units.weight === "lbs" ? "Weight (lbs)" : "Weight (kg)";
- When rendering input value:
  - if (prefs.units.weight === "lbs") display kgToLbs(suggestedWeight) rounded to nearest 0.5
- When submitting:
  - if (prefs.units.weight === "lbs") convert parseFloat(state.weight) -> kg via lbsToKg before building ExerciseSetFormData.weightKg

3. Formatting helpers

- weightDisplay(kg, prefs) returns:
  - if (!kg) return "BW"
  - if prefs weight === "lbs" -> `${roundToNearest(kgToLbs(kg), 0.5)} lbs` else `${kg} kg`

## Acceptance criteria

- Workout logging flow (program → exercise → log set) works identical to prior behavior for metric users.
- Imperial users see labels, inputs, suggestions, and history in imperial units but underlying storage remains metric.
- Validation of inputs still performed against metric ranges (client converts inputs to metric before validation).
- No DB migration necessary.
- Changes are limited to files listed above to reduce surface area and avoid touching known-bug screens.

## Rollout plan & risk mitigation

- Implement changes behind a feature flag (if possible) to enable quick rollback.
- Deploy incrementally: modify UI and utils (client-side) first; do not change server behavior.
- Test synchronisation flows: ensure stored kg values are identical to pre-change behavior when converting back and forth.
- Document conversion rules in README/developer docs.

## Next steps for Act Mode

I will implement these changes in the following order (small commits, one area at a time):

- [x] Create this implementation plan file
- [ ] Add `src/utils/unitConversions.ts` and tests
- [ ] Add `src/hooks/useUnitPreferences.ts`
- [ ] Update `src/components/workout/SetLogger.tsx`
- [ ] Update `src/components/workout/ExerciseCard.tsx`
- [ ] Update `src/screens/workout/ExerciseDetailScreen.tsx`
- [ ] Update `src/screens/workout/WorkoutSummaryScreen.tsx`
- [ ] Update `src/utils/validation.ts` client helpers
- [ ] Update progression display helpers
- [ ] Manual testing & QA pass
- [ ] Optional: Settings toggle UI and persistence tweaks

If you want me to start implementing the code, toggle to Act mode (switch the Plan/Act toggle to Act mode). After you switch, I'll begin by adding `src/utils/unitConversions.ts` and the unit preference hook, then update SetLogger to support imperial input.
