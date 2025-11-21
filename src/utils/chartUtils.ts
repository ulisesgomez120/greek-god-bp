/* Local clamp helper to avoid importing from other utils */
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export type ChartConfig = {
  containerWidth: number;
  spacing: number;
  initialSpacing?: number;
  endSpacing?: number;
};

/**
 * Compute an integer spacing (px) to use for gifted-charts spacing prop.
 * - containerWidth: measured width in pixels
 * - pointsCount: number of data points
 * - opts:
 *   - minSpacing defaults to 10
 *   - sidePadding defaults to 16 (left + right)
 */
export function computeChartSpacing(
  containerWidth: number,
  pointsCount: number,
  opts?: { minSpacing?: number; sidePadding?: number }
): number {
  const minSpacing = opts?.minSpacing ?? 10;
  const sidePadding = opts?.sidePadding ?? 16;

  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return minSpacing;
  }

  const usableWidth = Math.max(0, containerWidth - sidePadding);
  const rawSpacing = Math.floor(usableWidth / Math.max(pointsCount, 1));
  // clamp to [8, 80] but respect provided minSpacing lower bound
  const spacing = Math.max(8, minSpacing);
  return clamp(rawSpacing, spacing, 80);
}

/**
 * Return a ChartConfig with spacing and small initial/end spacing values.
 */
export function getChartConfig(containerWidth: number, pointsCount: number): ChartConfig {
  const spacing = computeChartSpacing(containerWidth, pointsCount);
  const side = Math.min(12, Math.floor(spacing / 2));
  return {
    containerWidth,
    spacing,
    initialSpacing: side,
    endSpacing: side,
  };
}
