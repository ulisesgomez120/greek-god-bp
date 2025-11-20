# Implementation Plan

[Overview]
Update the VolumeChart component so the chart's line, data points, axis text, and grid/rules colors respond to the app theme via the existing useTheme hook.

This change will make the chart visually consistent with the app's light/dark themes by pulling semantic colors from the app theme (via useTheme) instead of hard-coded or default chart colors. The implementation will be constrained to the chart component and its small public props surface so it is low-risk and easy to review. The plan documents the exact file edits, any small type additions, and a safe rollout/testing sequence to validate visual results on both light and dark themes.

[Types]  
No breaking type-system changes required; add a small optional prop interface for color overrides to the VolumeChart component.

Detailed type definitions:

- New type: VolumeChartColorOverrides (added to the component file)
  - line?: string — color for the main line (CSS color string)
  - point?: string — color for the data points / dots
  - axisText?: string — color for x/y axis text labels
  - rules?: string — color for grid/rules lines
- VolumeChart props (update existing component signature):
  - data: VolumeDataPoint[] (existing)
  - timeframe: TimeframeOption (existing)
  - colorOverrides?: VolumeChartColorOverrides (optional; validation: if provided, values should be CSS color strings; prefer theme colors when not provided)

No global or exported theme type changes are required — the hook already exposes a typed Theme with Theme.colors.

[Files]
Single sentence describing file modifications.
Modify the VolumeChart component and add the implementation_plan.md (this document) to the repo.

Detailed breakdown:

- New files to be created
  - implementation_plan.md (project root) — this file; contains the plan and will be used by implementation agents.
- Existing files to be modified
  - src/components/progress/VolumeChart.tsx
    - Add a typed prop interface to accept optional color overrides.
    - Use the existing useTheme hook to read theme colors and compute final chart colors (prefer overrides > theme colors > sensible defaults).
    - Pass theme-aware color props to LineChart to style:
      - line color
      - dot/point color
      - xAxis / yAxis text style (color)
      - rules/grid color
      - area fill gradient (use a translucent version of the primary color)
    - Remove or adjust any hard-coded color props so the theme controls the appearance.
    - Keep existing behavior for data formatting and spacing unchanged.
- Files to be deleted or moved
  - None.
- Configuration file updates
  - None required.

[Functions]
Single sentence describing function modifications.
Modify the VolumeChart component function to compute theme-aware chart props and optionally accept color overrides.

Detailed breakdown:

- New functions (within the same file)
  - getChartColors(themeColors, overrides?): { lineColor, pointColor, axisTextColor, rulesColor, areaStart, areaEnd }
    - Signature: (colors: ThemeColors, overrides?: VolumeChartColorOverrides) => { ... }
    - Purpose: Centralize the color selection logic and fallback rules (overrides take precedence; otherwise use theme.colors).
    - Validation: Ensure values exist and fall back to sensible defaults (e.g., colors.primary, colors.subtext, colors.border).
- Modified functions
  - transformToGifted (existing)
    - File: src/components/progress/VolumeChart.tsx
    - Changes: No behavior changes required, but ensure labels use locale-aware short format if desired (optional).
  - default export function VolumeChart
    - File: src/components/progress/VolumeChart.tsx
    - Changes:
      - Add the new prop type to the function signature.
      - Use getChartColors to compute final props.
      - Pass style props to LineChart: color, dotColor, xAxisTextStyle, yAxisTextStyle, rulesColor, startFillColor/endFillColor (area gradient colors).
      - If existing prop hideRules is present in current code, set it to false (or leave as-is if you prefer no grid); plan uses theme color for rules when rules are visible.
- Removed functions
  - None.

[Classes]
Single sentence describing class modifications.
No new classes or class modifications are required.

Detailed breakdown:

- New classes
  - None.
- Modified classes
  - None.
- Removed classes
  - None.

[Dependencies]
Single sentence describing dependency modifications.
No new dependencies required; the change uses existing theme hook and react-native-gifted-charts props.

Details:

- No new npm packages.
- No version changes.
- Integration requirements: none beyond updating the component props and ensuring the component imports useTheme (already present).

[Testing]
Single sentence describing testing approach.
Validate with manual visual tests in both light and dark themes and add a minimal snapshot/style test if desired.

Test file requirements, existing test modifications, and validation strategies:

- Manual visual checks
  - Launch app in development mode on a device or emulator and confirm:
    - With light theme: line and dots are colors.primary, axis text is colors.subtext, rules/grid use colors.border.
    - With dark theme: same mapping but colors change according to the dark theme definitions.
    - When colorOverrides prop is provided to VolumeChart, those override the theme colors.
  - Confirm that the chart still renders correctly with empty data (existing fallback text remains themed via colors.subtext).
- Automated tests (optional)
  - Add a Jest snapshot test for the VolumeChart component with a small data set to assert that the rendered tree contains the expected props (this can be implemented by shallow rendering and inspecting component props or a snapshot of the output).
  - Example: tests/components/progress/VolumeChart.test.tsx
    - Mount VolumeChart with a light theme context and assert that LineChart receives expected color props.
- Accessibility and edge cases
  - Confirm that axis text color has sufficient contrast against background in both themes (use theme designers or color contrast checks if available).
  - Confirm the component does not crash if color fields are missing (fall back to sensible defaults).

[Implementation Order]
Single sentence describing the implementation sequence.
Make small, focused changes in one commit: update component types and logic, wire theme colors into LineChart props, run manual visual checks, and optionally add tests.

Numbered steps:

1. Create implementation_plan.md at project root (this file).
2. Update src/components/progress/VolumeChart.tsx:
   - Add the VolumeChartColorOverrides type.
   - Add getChartColors helper function.
   - Update the component signature to accept colorOverrides?: VolumeChartColorOverrides.
   - Compute final colors and pass them into LineChart props: color (line), dotColor (points), xAxisTextStyle/yAxisTextStyle (axis text color), rulesColor (grid), startFillColor/endFillColor (area fill).
   - Ensure existing empty-data UI still uses colors.subtext.
3. Run TypeScript type-check: npm run type-check (or yarn type-check).
4. Run the app locally (expo start) and test visually in both light and dark themes:
   - Switch theme via app settings or simulate system theme.
   - Verify the line, points, axis text, and rules reflect theme colors.
5. If visual changes are correct, create a small Jest test that mounts VolumeChart and asserts LineChart received the color props (optional).
6. Commit the changes with a clear commit message and open a pull request for review.

Notes and rationale:

- The change is intentionally localized to a single component file; this reduces risk and review surface.
- Adding a colorOverrides prop allows future callers to customize chart colors without changing themes.
- Using theme.colors ensures the app's charts will automatically update when users switch themes or when the system theme changes.
