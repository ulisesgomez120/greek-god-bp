# Implementation Plan

[Overview]
Single sentence describing the overall goal.

Fix ProfileEditScreen state/units handling and inputs so height/weight are edited as local display strings (no conversion while typing), birthday is a date picker, height is a select/picker, conversions only happen when saving (same pattern used by SetLogger), and verify profile updates persist correctly with the database changes (use_metric boolean, removed preferences/privacy_settings JSONB).

Multiple paragraphs outlining the scope, context, and high-level approach. Explain why this implementation is needed and how it fits into the existing system.

This change targets the profile edit UX regressions you reported: weight not passed, height cleared after focus change, and inconsistent handling of birthDate input formats. The current ProfileEditScreen converts on blur and mixes local display state with canonical form data causing race conditions and clearing. The SetLogger component demonstrates a robust pattern: store display strings locally while editing, convert to canonical types only at submission, and keep the UI in user's preferred units. We'll apply the same pattern across ProfileEditScreen.

Scope:

- ProfileEditScreen.tsx: main UX and state changes (height, weight, birthDate, units).
- Add a simple HeightPicker component (inline or new file) to pick standard heights in cm or ft/in.
- Replace birthDate text input with a date picker UI (platform-aware).
- Modify save flow to convert display values into canonical cm/kg/date before calling updateProfile.
- Verify profile.service handling of use_metric and normalized privacy columns; ensure no DB migrations required beyond existing migration that added use_metric and dropped preferences.
- Add unit tests for conversion-on-save logic (where practical) and an interactive test plan.

High-level approach:

- Use local display-only state (strings or Date) for problematic fields to avoid re-render/formatting interference.
- Do NOT convert or write canonical numeric values to formData while user is typing; only when saving.
- Use existing unit conversion utilities (parseDisplayWeightToKg, parseDisplayHeightToCm, format helpers) when converting on save.
- Use a date picker component (platform-native via @react-native-community/datetimepicker or RN built-in if available) for birthDate input to avoid format variability.
- Provide a height selector/dropdown that covers typical user heights for fast selection. Keep a "custom" option that allows numeric entry if needed.

[Types]  
Single sentence describing the type system changes.

No core type shape changes required; introduce local input types and ensure conversions produce fields matching ProfileEditData (heightCm:number, weightKg:number, birthDate:string).

Detailed type definitions, interfaces, enums, or data structures with complete specifications. Include field names, types, validation rules, and relationships.

- New UI-local types (internal to ProfileEditScreen, not exported):
  - HeightDisplay: { display: string } (string for shown value, e.g., "170" or "5'10\"")
  - WeightDisplay: string (e.g., "180" for lbs or "80" for kg; kept as string while editing)
  - BirthDateDisplay: Date | null (selected JS Date)
- Existing ProfileEditData (from src/types/profile.ts) remains canonical:
  - displayName?: string
  - heightCm?: number (integer, optional, validated 100-250)
  - weightKg?: number (float, optional, validated 30-300)
  - birthDate?: string (ISO date "YYYY-MM-DD")
  - gender?: Gender
  - fitnessGoals?: string[]
  - privacySettings?: Partial<PrivacySettings>
  - experienceLevel?: ExperienceLevel
  - preferences?: ProfilePreferences (NOTE: preferences JSONB dropped in DB — profile.service maps use_metric to preferences.useMetric)
  - Normalized privacy booleans as used by the frontend (privacyDataSharing, etc.)

Validation rules:

- Height canonical (heightCm): integer between 100 and 250 inclusive.
- Weight canonical (weightKg): float between 30 and 300 inclusive.
- BirthDate canonical: string in ISO format; computed age must be >=13 and reasonable (<100).
- When validating on save, parse display values using existing utilities and apply the above rules.

[Files]
Single sentence describing file modifications.

Modify ProfileEditScreen, add height picker component file, update imports, and update tests; no DB migration files required.

Detailed breakdown:

- New files to be created (with full paths and purpose)

  - src/screens/profile/components/HeightPicker.tsx
    - Purpose: small reusable height selection component. Exposes props:
      - valueCm?: number | undefined
      - onChange: (valueCm?: number) => void
      - unitIsMetric: boolean
      - style?: any
    - Behavior: shows a Picker/select with common heights (100cm–220cm in 1cm increments via sections, or imperial display 4'0"–7'3" by mapping). Include a "Custom" option that when selected emits undefined so the parent can show a numeric input.
  - (Optional) src/components/ui/DateInput.tsx
    - Purpose: wrapper around platform date picker providing a consistent button/display. Exposes:
      - value?: Date | null
      - onChange: (d: Date | null) => void
      - maximumDate?: Date
      - minimumDate?: Date
    - If project already uses or prefers a datepicker lib, reuse it instead of creating.

- Existing files to be modified (with specific changes)

  - src/screens/profile/ProfileEditScreen.tsx
    - Replace edit flow for height and weight:
      - Remove conversion logic in onBlur for heightInput/weightInput.
      - Add local state:
        - heightDisplay: string (for showing current display value or "")
        - weightDisplay: string
        - birthDateLocal: Date | null
      - Initialize local states from profile in useEffect.
      - On input change, update local display states only (no conversions).
      - Replace Birth Date TextInput with DateInput/date picker component and manage birthDateLocal as Date.
      - Replace Height TextInput with HeightPicker component. If HeightPicker returns undefined (Custom), show a numeric TextInput for custom entry bound to heightDisplay. If HeightPicker returns a value, set heightDisplay to formatted string for display only.
      - Modify handleSave so that before calling updateProfile it:
        - Parses weightDisplay into weightKg using parseDisplayWeightToKg if imperial or parseFloat if metric.
        - Parses heightDisplay into cm using parseDisplayHeightToCm if imperial or parseInt if metric; if using HeightPicker value (already cm), use it directly.
        - Converts birthDateLocal to ISO string ("YYYY-MM-DD") and set to formData.birthDate.
        - Construct the ProfileEditData object with canonical fields and call updateProfile(formEditData, { optimistic:true }).
      - Keep other fields behavior unchanged.
    - Update imports to include new HeightPicker and DateInput and adjust getInputProps usage.
    - Keep preferences toggle behavior: updateFormData should still set preferences.useMetric so profileService.updateProfile persists use_metric (profile.service handles updates.preferences -> use_metric mapping).

- Files to be deleted or moved

  - None.

- Configuration file updates
  - If choosing an external datepicker package, add to package.json:
    - @react-native-community/datetimepicker (recommended) — or a single dependency for date picker preferred by the project.
  - Add any TypeScript types if necessary.
  - No DB migrations required: existing migration supabase/migrations/20250822000001_add_use_metric_and_drop_preferences.sql already applied. We must verify backend respects normalized privacy columns (profile.service already handles them).

[Functions]
Single sentence describing function modifications.

Add conversion-on-save logic in the save handler and create helper utilities/components for height/date UI; no changes to profile.service logic besides ensuring mapping of preferences.useMetric to use_metric remains.

Detailed breakdown:

- New functions (name, signature, file path, purpose)

  - formatCmToPickerDisplay(cm: number, unitIsMetric: boolean): string
    - Location: src/screens/profile/components/HeightPicker.tsx (helper)
    - Purpose: convert cm into display string for picker (e.g., "170 cm" or "5'7\"").
  - parseHeightDisplayToCm(display: string, unitIsMetric: boolean): number | null
    - Location: src/screens/profile/ProfileEditScreen.tsx (local helper or import from utils if generic)
    - Purpose: parse custom height string entered by user into integer cm using existing parseDisplayHeightToCm utility or small wrapper.
  - formatDateToISO(d: Date): string
    - Location: src/components/ui/DateInput.tsx or src/screens/profile/ProfileEditScreen.tsx helper
    - Purpose: output "YYYY-MM-DD" for storage.

- Modified functions (exact name, current file path, required changes)

  - handleSave -> src/screens/profile/ProfileEditScreen.tsx

    - Current behavior: uses formData as-is (fields already numeric or strings), conversions happen earlier on blur. Required changes:
      - Before validating and calling updateProfile, coerce display-only fields into canonical form:
        - heightCm: from heightDisplay/HeightPicker selection (cm)
        - weightKg: from weightDisplay using parseDisplayWeightToKg/parseFloat
        - birthDate: from birthDateLocal -> ISO string
      - Validate converted values with existing validateForm (may need to adjust validateForm to accept canonical form instead of parsing inside).
      - Call updateProfile with the canonical ProfileEditData.

  - validateForm -> src/screens/profile/ProfileEditScreen.tsx
    - Current behavior: validates formData which previously may have had converted values on blur. Required changes:
      - Ensure validateForm checks the canonical values produced on-save. If validateForm continues to read formData, make sure handleSave sets canonical values into formData or pass a canonical copy to validateForm to avoid validation mismatches.

- Removed functions (name, file path, reason, migration strategy)
  - Remove ad-hoc onBlur parse handlers for heightInput/weightInput in ProfileEditScreen.tsx:
    - These will be deleted and replaced with conversion-on-save.

[Classes]
Single sentence describing class modifications.

No class-level changes required.

Detailed breakdown:

- New classes (name, file path, key methods, inheritance)

  - None (components and helpers via functions).

- Modified classes (exact name, file path, specific modifications)

  - None.

- Removed classes (name, file path, replacement strategy)
  - None.

[Dependencies]
Single sentence describing dependency modifications.

Add a lightweight datepicker dependency if the project has none; otherwise reuse existing datepicker; no database dependency changes required.

Details of new packages, version changes, and integration requirements.

- Recommended (choose one based on project conventions):
  - @react-native-community/datetimepicker — cross-platform native date picker
    - Add to package.json and run yarn/npm install.
    - Reason: native look & feel and fewer UI surprises.
  - Alternative: react-native-modal-datetime-picker if modal UX is preferred (requires @react-native-community/datetimepicker as peer).
- If you prefer to avoid adding dependencies, implement a simple text-to-date parse helper and use a modal for date selection, but this is lower UX quality than native picker.
- No DB migrations required. ProfileService already supports use_metric boolean and normalized privacy columns.

[Testing]
Single sentence describing testing approach.

Add unit tests and manual verification steps for conversion-on-save behavior, and run end-to-end-like checks by editing profile and ensuring DB row values are correct.

Test file requirements, existing test modifications, and validation strategies.

- Unit tests:
  - src/screens/profile/**tests**/ProfileEditScreen.unit.tsx
    - Tests:
      - When editing weight (imperial), entering "180" and saving results in updateProfile called with weightKg ~= 81.65 (use parseDisplayWeightToKg).
      - When editing height via HeightPicker selecting "170 cm", saving results in heightCm=170.
      - Birth date selection with DateInput converts to ISO string stored in updateProfile payload.
      - Toggle units (Use Metric Units) updates preferences.useMetric and Save persists use_metric via updates.preferences mapping.
  - Use jest + react-test-renderer / @testing-library/react-native for component tests.
- Manual tests:
  - Start app, open Profile > Edit
  - Switch to Preferences -> toggle units and Save, confirm DB user_profiles.use_metric updated (via API or database viewer).
  - Edit weight in imperial (lbs), Save, verify weightKg in DB.
  - Edit height using HeightPicker (imperial mode), Save, verify heightCm in DB.
  - Edit birth date using date picker, Save, verify birth_date in DB is ISO string and validate age rules.
- Validation strategies:
  - Keep existing validateForm rules but ensure they run against canonical values produced on Save.
  - Include tests for edge values (age < 13, weight too low/high, height too low/high).

[Implementation Order]
Single sentence describing the implementation sequence.

Implement UI-local changes and helpers first, wire conversion-on-save logic next, add tests, then run manual verification and dependency installs if needed.

Numbered steps showing the logical order of changes to minimize conflicts and ensure successful integration.

1. Add HeightPicker component (src/screens/profile/components/HeightPicker.tsx) and DateInput wrapper (optional). Keep these changes isolated and unit-testable.
2. Modify ProfileEditScreen.tsx:
   - Add local display states (heightDisplay, weightDisplay, birthDateLocal).
   - Replace height/weight/birth fields with new UI components/inputs bound to local state.
   - Remove onBlur conversion logic; do not mutate formData during typing.
   - Update the Save handler to convert local display values into canonical ProfileEditData (heightCm, weightKg, birthDate ISO) and call validateForm against this canonical copy; then call updateProfile with canonical data (optimistic:true).
   - Ensure preferences.useMetric mapping remains working (updateFormData for preferences can still be used to update UI).
3. Update validateForm to accept a canonical ProfileEditData argument or ensure handleSave writes canonical values into formData prior to calling validateForm.
4. Add/adjust unit tests for conversion-on-save.
5. If adding a new dependency (date picker), run npm/yarn install and update project configuration; commit package.json changes.
6. Run manual QA:
   - Edit display name, weight, height, birthDate, gender, goals, privacy toggles, units toggle; save and confirm DB values are correct.
   - Confirm no clearing/typing issues for height/weight/birthDate when switching inputs.
7. Address any minor style/import issues and run the app on iOS/Android simulators to confirm native datepicker behavior.
8. Merge and ship.

Notes / Edge Cases / Rationale:

- We deliberately avoid converting during typing. This prevents UI flicker, formatting that interferes with editing, and clearing due to conflicting conversions.
- Height selection: using a picker with common values covers the majority of users. Provide a "Custom" fallback so edge-case heights can still be entered.
- The profileService already maps updates.preferences.useMetric => use_metric column, and reads use_metric to synthesize preferences on fetch. No DB migration is necessary beyond what you've already applied.
- If you want the "units" toggle to immediately persist server-side, call updateProfile({ preferences: { useMetric: val } }, { optimistic: true }) on toggle. The existing useUnitPreferences.setUseMetric writes to local storage and redux only; depending on product preference you might persist to server immediately or defer until Save. I'll keep current behavior (local + setUseMetric) but the profile save will persist the use_metric value if present in preferences in the update payload.

Implementation artifacts:

- implementation_plan.md (this document) saved at project root.
- New task created referencing this document with step-by-step task_progress and shell commands for reading sections.

Proceeding to create the implementation task now.
