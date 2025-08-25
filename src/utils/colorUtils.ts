/**
 * Lightweight color utilities for contrast and alpha handling.
 * Intentionally dependency-free to avoid adding runtime packages.
 */

type RGB = { r: number; g: number; b: number };

/**
 * Parse a 3/6/8-digit hex string to RGB.
 * Accepts formats: #RGB, #RRGGBB, #RRGGBBAA
 */
function hexToRgb(hex: string): RGB | null {
  if (!hex) return null;
  const h = hex.replace("#", "").trim();
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  if (h.length === 6 || h.length === 8) {
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16),
    };
  }
  return null;
}

/**
 * Parse an rgba(...) or rgb(...) string into RGB.
 */
function rgbaStringToRgb(rgba: string): RGB | null {
  try {
    const m = rgba.match(/rgba?\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
    if (!m) return null;
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  } catch {
    return null;
  }
}

/**
 * Convert hex or rgba string into RGB
 */
function parseColorToRgb(color: string): RGB | null {
  if (!color) return null;
  if (color.startsWith("#")) return hexToRgb(color);
  if (color.startsWith("rgba") || color.startsWith("rgb")) return rgbaStringToRgb(color);
  return null;
}

/**
 * Convert RGB to relative luminance per WCAG
 */
function getRelativeLuminance(rgb: RGB): number {
  // sRGB to linear
  const srgb = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  // Rec. 709 luma coefficients
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/**
 * Compute contrast ratio between two colors (both hex or rgba/rgb strings)
 */
export function contrastRatio(colorA: string, colorB: string): number {
  const a = parseColorToRgb(colorA);
  const b = parseColorToRgb(colorB);
  if (!a || !b) return 1; // fallback
  const lumA = getRelativeLuminance(a);
  const lumB = getRelativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/**
 * Return an rgba(...) string from a hex and alpha decimal (0..1)
 */
export function adjustHexAlpha(hex: string, alpha: number): string {
  const rgb = parseColorToRgb(hex);
  if (!rgb) {
    // fallback: return semi-transparent black/white depending on alpha
    return `rgba(0,0,0,${alpha})`;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Decide an accessible text color for a given background using theme tokens as hints.
 * - background: color string (hex or rgba)
 * - colors: ThemeColors-like object with at least text and buttonText fields
 *
 * Behavior:
 * 1. If colors.buttonTextOnPrimary is provided, return it.
 * 2. Compute contrast against colors.functional.darkText and colors.functional.lightText (using provided colors.text/buttonText fallbacks).
 * 3. Prefer the color that meets 4.5:1 contrast; if both meet, prefer dark text for pale backgrounds.
 * 4. As a final fallback return colors.buttonText or colors.text or '#000'.
 */
export function getButtonTextColor(background: string, colors: any): string {
  try {
    // if override exists on the theme colors, use it
    if (colors?.buttonTextOnPrimary) return colors.buttonTextOnPrimary;

    const dark = colors?.functional?.darkText || colors?.text || "#000000";
    const light = colors?.functional?.lightText || "#FFFFFF";
    const preferred = colors?.buttonText || dark;

    const contrastWithDark = contrastRatio(background, dark);
    const contrastWithLight = contrastRatio(background, light);

    const threshold = 4.5;

    // If dark meets threshold and light doesn't, choose dark
    if (contrastWithDark >= threshold && contrastWithLight < threshold) return dark;

    // If light meets threshold and dark doesn't, choose light
    if (contrastWithLight >= threshold && contrastWithDark < threshold) return light;

    // If both meet, pick the one with higher contrast; prefer dark for pale backgrounds
    if (contrastWithDark >= threshold && contrastWithLight >= threshold) {
      // heuristic: if background is light-like, choose dark
      const bgRgb = parseColorToRgb(background);
      if (bgRgb && bgRgb.r + bgRgb.g + bgRgb.b > 382) {
        return dark;
      }
      return contrastWithDark >= contrastWithLight ? dark : light;
    }

    // If neither meets, fall back to the theme's suggested buttonText then dark
    return preferred || dark;
  } catch {
    return colors?.buttonText || colors?.text || "#000000";
  }
}

export default {
  hexToRgb,
  parseColorToRgb,
  contrastRatio,
  adjustHexAlpha,
  getButtonTextColor,
};
