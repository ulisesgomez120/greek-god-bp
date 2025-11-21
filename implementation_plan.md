# Implementation Plan

[Overview]
Fix the VolumeChart so the chart fills the available horizontal space and x-axis date labels are readable (not truncated).

This change updates the VolumeChart rendering logic to compute responsive spacing based on the container width, apply compact/consistent date formatting for x-axis labels, and configure react-native-gifted-charts props to avoid label truncation and ensure the chart uses the full width of its container. The approach is minimally invasive: introduce two small utility helpers (chart spacing and short date formatting), update VolumeChart to measure its container and compute optimal spacing/spacing-related props, and add unit tests and a visual verification checklist. This fits into the existing progress screens and does not change backend services or data shapes.

[Types]  
Add a small internal type for chart configuration.

- ChartConfig
  - file: src/utils/chartUtils.ts (export)
  - definition:
    - containerWidth: number
      - description: measured width in pixels of the chart container
      - validation: positive integer > 0
    - spacing: number
      - description: horizontal spacing (px) between data points passed to gifted-charts `spacing` prop
      - validation: integer >= 8; recommended minimum 10 for legibility
    - initialSpacing?: number
      - description: spacing from Y-axis to first data point (px)
      - validation: >= 0
    - endSpacing?: number
      - description: right-side padding at the end of the line (px)
      - validation: >= 0

No other global type changes required. Existing VolumeDataPoint and TimeframeOption types are sufficient.

[Files]
Single sentence describing file modifications: Modify VolumeChart to calculate layout-driven spacing and labels; add chart helpers and tests.

Detailed breakdown:

- New files to be created
  - src/utils/chartUtils.ts
    - Purpose: helpers to compute spacing and a ChartConfig from container width and number of points.
    - Exports:
      - type ChartConfig
      - function computeChartSpacing(containerWidth: number, pointsCount: number, opts?: {minSpacing?: number, sidePadding?: number}): number
      - function getChartConfig(containerWidth: number, pointsCount: number): ChartConfig
    - Notes:
      - sidePadding defaults to 16 (8px left/right) to account for container padding and axis labels.
      - Spacing is clamped within [8, 80].
  - src/components/progress/**tests**/VolumeChart.test.tsx
    - Purpose: unit tests to assert formatShortDate usage and that LineChart receives spacing props.
    - Use react-test-renderer or @testing-library/react-native to shallow render and assert props passed to LineChart (mock LineChart if necessary).
  - src/utils/**tests**/dateUtils.test.ts
    - Purpose: tests for formatShortDate behavior across timeframes.
- Existing files to be modified
  - src/components/progress/VolumeChart.tsx
    - Add:
      - onLayout handler to measure container width (store in state).
      - Calculation of spacing via computeChartSpacing/getChartConfig.
      - Use of a new formatShortDate function (exported from src/utils/dateUtils.ts) to generate compact x-axis labels.
      - Pass additional react-native-gifted-charts props:
        - spacing (calculated)
        - initialSpacing (small computed or constant; e.g., 10)
        - endSpacing (computed small padding)
        - xAxisLabelsHeight (30-40 depending on fontSize)
        - xAxisLabelsVerticalShift (if needed)
        - xAxisLabelTextStyle (smaller fontSize to reduce truncation)
        - optionally, labelTexts (if we want to provide exact labels array)
      - Ensure wrapper View uses style={{ width: '100%' }} and the onLayout measurement.
    - Keep:
      - kg/lbs conversion logic unchanged.
      - color, areaChart, startFillColor, endFillColor behavior unchanged.
  - src/utils/dateUtils.ts
    - Add:
      - export function formatShortDate(date: Date | string, timeframe: TimeframeOption): string
        - Behavior:
          - For timeframe "4w" and "8w": return "MMM d" (e.g., "Sep 8") using date-fns format. This is compact and unambiguous.
          - For timeframe "3m" and "6m": return "MMM" for monthly buckets or "MMM d" if the point represents a specific date; prefer "MMM" when there are many points.
          - For timeframe "all": return "MMM yyyy" (e.g., "Sep 2024") or "yyyy" for very long ranges.
          - If incoming date is invalid, return empty string to avoid long garbage labels.
        - Validation:
          - Accept string or Date, convert to Date and guard with isValid if needed.
- Files to be deleted or moved
  - None.
- Configuration file updates
  - None.

[Functions]
Single sentence describing function modifications: Add computeChartSpacing and formatShortDate helpers and update transformToGifted to use the new helpers and to respect computed spacing.

Detailed breakdown:

- New functions
  - computeChartSpacing(containerWidth: number, pointsCount: number, opts?: {minSpacing?: number, sidePadding?: number}): number
    - File: src/utils/chartUtils.ts
    - Purpose: Compute and return an integer spacing value to use for gifted-charts `spacing` based on available width and number of points.
    - Algorithm:
      - usableWidth = Math.max(0, containerWidth - (opts.sidePadding ?? 16))
      - rawSpacing = Math.floor(usableWidth / Math.max(pointsCount, 1))
      - spacing = clamp(rawSpacing, opts.minSpacing ?? 10, 80)
      - Return spacing
  - getChartConfig(containerWidth: number, pointsCount: number): ChartConfig
    - File: src/utils/chartUtils.ts
    - Purpose: Convenience wrapper returning ChartConfig with spacing, initialSpacing, and endSpacing.
    - initialSpacing suggestion: Math.min(12, Math.floor(spacing / 2))
    - endSpacing suggestion: Math.min(12, Math.floor(spacing / 2))
  - formatShortDate(date: Date | string, timeframe: TimeframeOption): string
    - File: src/utils/dateUtils.ts
    - Purpose: Return a compact label string tailored for the timeframe.
    - Implementation notes: use date-fns `format` with patterns "MMM d", "MMM", "MMM yyyy".
- Modified functions
  - transformToGifted (currently inside VolumeChart.tsx)
    - File: src/components/progress/VolumeChart.tsx
    - Changes:
      - Replace new Date(d.date).toLocaleDateString() with formatShortDate(d.date, timeframe)
      - Ensure numeric rounding logic remains (isMetric vs kgToLbs)
      - Optionally return additional metadata such as originalDate or index if needed for label thinning logic.
- Removed functions
  - None.

[Classes]
Single sentence describing class modifications: No classes will be added or removed; changes are functional.

Detailed breakdown:

- New classes
  - None
- Modified classes
  - None
- Removed classes
  - None

[Dependencies]
Single sentence describing dependency modifications: No new npm packages required; use existing date-fns already in project and gifted-charts props.

Details:

- No new packages required.
- Existing packages used:
  - date-fns (already in the repo)
  - react-native-gifted-charts (already a dependency in package.json)
- Integration notes:
  - The react-native-gifted-charts props used are: spacing, initialSpacing, endSpacing, xAxisLabelsHeight, xAxisLabelsVerticalShift, xAxisLabelTextStyle. Confirmed available based on library docs.
  - No native install steps required.

[Testing]
Single sentence describing testing approach: Unit tests for date formatting and component prop logic plus manual visual verification on device/simulator.

Detailed testing breakdown:

- Unit tests
  - src/utils/**tests**/dateUtils.test.ts
    - Cases:
      - formatShortDate("2025-09-08", "8w") -> "Sep 8"
      - formatShortDate("2025-09-08", "6m") -> "Sep"
      - formatShortDate invalid date -> ""
  - src/components/progress/**tests**/VolumeChart.test.tsx
    - Render VolumeChart with a mock dataset (e.g., 5 points) and a mocked container width (via onLayout simulation) and assert:
      - LineChart receives a `spacing` prop within expected range
      - chart data labels are the formatted short labels
      - xAxisLabelTextStyle contains expected fontSize and color derived from theme mock
- Visual/manual tests
  - Launch app and navigate to ExerciseDetailProgress
  - Test each timeframe: 4w, 8w, 3m, 6m, all
  - Verify:
    - Chart occupies full horizontal width (no large unused right margin)
    - X-axis labels are legible (no "9...9..." truncation). If points densely packed, verify library behavior to show subset of labels rather than many truncated labels.
    - Y-axis and areaChart appearance unchanged.
  - Edge cases:
    - Single data point: chart still renders centered and label shows full short date.
    - Very dense data (20+ points): spacing clamps to min value and labels reduce; confirm acceptable behavior.
- Test failure handling
  - No data: existing fallback message remains unchanged.
  - Date parsing failure: labels fallback to empty string.

[Implementation Order]
Single sentence describing the implementation sequence: Implement helpers, update VolumeChart to measure width and pass computed props, add tests, run tests, and visually verify across timeframes.

Numbered steps:

1. Create src/utils/chartUtils.ts with computeChartSpacing, getChartConfig, and ChartConfig type.
2. Add formatShortDate(date, timeframe) to src/utils/dateUtils.ts and export it.
3. Modify src/components/progress/VolumeChart.tsx:
   - Add state for containerWidth and onLayout measurement
   - Call getChartConfig to compute spacing, initialSpacing, endSpacing
   - Update transformToGifted to call formatShortDate for labels
   - Pass props to LineChart: spacing, initialSpacing, endSpacing, xAxisLabelsHeight, xAxisLabelsVerticalShift, xAxisLabelTextStyle
   - Ensure wrapper View style allows onLayout measurement (width: '100%') and preserves height
4. Add unit tests:
   - src/utils/**tests**/dateUtils.test.ts
   - src/components/progress/**tests**/VolumeChart.test.tsx
5. Run unit tests and fix any typing or lint issues.
6. Run the app on device/simulator and visually verify charts for 4w, 8w, 3m, 6m, all.
