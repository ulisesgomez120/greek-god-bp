// Unit conversion utilities for TrainSmart
// Keep metric as source-of-truth; provide helpers to convert & format for imperial display.

const KG_TO_LBS = 2.20462;
const CM_TO_INCH = 1 / 2.54;

/**
 * Convert kilograms to pounds.
 * @param kg
 */
export function kgToLbs(kg: number): number {
  return kg * KG_TO_LBS;
}

/**
 * Convert pounds to kilograms.
 * @param lbs
 */
export function lbsToKg(lbs: number): number {
  return lbs / KG_TO_LBS;
}

/**
 * Round a number to the nearest step (e.g. 0.5, 1, 2.5).
 * @param value
 * @param step
 */
export function roundToNearest(value: number, step: number): number {
  if (!isFinite(value) || step <= 0) return value;
  return Math.round(value / step) * step;
}

/**
 * Convert centimeters to feet and inches.
 * Rounds inches to the nearest whole number by default.
 * @param cm
 * @param roundToHalfInch - if true, rounds inches to nearest 0.5
 */
export function cmToFeetInches(cm: number, roundToHalfInch = false): { ft: number; in: number } {
  const totalInches = cm * CM_TO_INCH;
  const ft = Math.floor(totalInches / 12);
  let inches = totalInches - ft * 12;

  if (roundToHalfInch) {
    inches = roundToNearest(inches, 0.5);
  } else {
    inches = Math.round(inches);
  }

  // Normalize e.g., 11.5 -> ft remains same, but if rounding pushes to 12, roll over.
  if (inches >= 12) {
    return { ft: ft + 1, in: 0 };
  }

  return { ft, in: inches };
}

/**
 * Convert feet + inches to centimeters.
 * @param ft
 * @param inches
 */
export function feetInchesToCm(ft: number, inches: number): number {
  const totalInches = ft * 12 + inches;
  return totalInches / CM_TO_INCH;
}

/**
 * Format kilograms into a display string in pounds.
 * Rounds to the nearest step (default 0.5 lb).
 * Returns something like "180 lbs".
 * @param kg
 * @param step
 */
export function formatKgToLbsDisplay(kg: number | undefined | null, step = 0.5): string {
  if (kg == null || !isFinite(kg)) return "BW";
  const lbs = kgToLbs(kg);
  const rounded = roundToNearest(lbs, step);
  // If the rounded value is integer, show without decimal; otherwise show up to 1 decimal place.
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${str} lbs`;
}

/**
 * Format centimeters into feet/inches display string like 5'10"
 * @param cm
 */
export function formatCmToFtIn(cm: number | undefined | null): string {
  if (cm == null || !isFinite(cm)) return "";
  const { ft, in: inches } = cmToFeetInches(cm);
  return `${ft}'${inches}"`;
}

/**
 * Parse a weight input string and return numeric value (assumed pounds if input includes "lb" or user uses lbs).
 * This function extracts the first numeric value found. Returns null when parsing fails.
 *
 * Examples:
 *  - "180" => 180
 *  - "180.5" => 180.5
 *  - "180 lb" => 180
 *  - "180lbs" => 180
 */
export function parseWeightInput(input: string): number | null {
  if (!input || typeof input !== "string") return null;
  // strip commas and trim
  const cleaned = input.replace(/,/g, "").trim();
  // find first number (integer or decimal)
  const match = cleaned.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  if (!isFinite(num)) return null;
  return num;
}

/**
 * Parse various height input formats into feet and inches.
 * Returns null if parsing fails.
 *
 * Supported examples:
 *  - 5'10"
 *  - 5'10
 *  - 5 ft 10 in
 *  - 5 10
 *  - 5-10
 *  - 70in (returns 5ft 10in)
 *  - 70 in
 */
export function parseHeightInput(input: string): { ft: number; in: number } | null {
  if (!input || typeof input !== "string") return null;
  const txt = input.trim().toLowerCase();

  // 1) ft'in" or ft'in or ft' in"
  const ftInMatch = txt.match(/^\s*(\d{1,2})\s*'\s*(\d{1,2}(\.\d+)?)\s*"?\s*$/);
  if (ftInMatch) {
    const ft = parseInt(ftInMatch[1], 10);
    const inches = Math.round(Number(ftInMatch[2]));
    return { ft, in: inches >= 12 ? 11 : inches };
  }

  // 2) formats like "5 ft 10 in" or "5ft10in"
  const verboseMatch = txt.match(/^\s*(\d{1,2})\s*(ft|feet)\s*(\d{1,2}(\.\d+)?)\s*(in|inches)?\s*$/);
  if (verboseMatch) {
    const ft = parseInt(verboseMatch[1], 10);
    const inches = Math.round(Number(verboseMatch[3]));
    return { ft, in: inches >= 12 ? 11 : inches };
  }

  // 3) hyphen or space separated "5-10" or "5 10"
  const sepMatch = txt.match(/^\s*(\d{1,2})\s*[-\s]\s*(\d{1,2}(\.\d+)?)\s*$/);
  if (sepMatch) {
    const ft = parseInt(sepMatch[1], 10);
    const inches = Math.round(Number(sepMatch[2]));
    return { ft, in: inches >= 12 ? 11 : inches };
  }

  // 4) inches-only input "70in" or "70 in" or "70"
  const inchesOnlyMatch = txt.match(/^\s*(\d{2,3}(\.\d+)?)\s*(in|inches)?\s*$/);
  if (inchesOnlyMatch) {
    const totalInches = Math.round(Number(inchesOnlyMatch[1]));
    const ft = Math.floor(totalInches / 12);
    const inches = totalInches - ft * 12;
    return { ft, in: inches };
  }

  return null;
}

/**
 * Helper to convert a display weight (string) to kg.
 * If input is already numeric string representing lbs, parse it and convert.
 * Returns null if parsing fails.
 *
 * Example: "180" => 81.6466...
 */
export function parseDisplayWeightToKg(input: string): number | null {
  const parsed = parseWeightInput(input);
  if (parsed == null) return null;
  return lbsToKg(parsed);
}

/**
 * Helper to convert feet/inches input (string) to cm.
 * Uses parseHeightInput and returns cm or null on failure.
 */
export function parseDisplayHeightToCm(input: string): number | null {
  const parsed = parseHeightInput(input);
  if (!parsed) return null;
  return feetInchesToCm(parsed.ft, parsed.in);
}

export default {
  KG_TO_LBS,
  kgToLbs,
  lbsToKg,
  roundToNearest,
  cmToFeetInches,
  feetInchesToCm,
  formatKgToLbsDisplay,
  formatCmToFtIn,
  parseWeightInput,
  parseHeightInput,
  parseDisplayWeightToKg,
  parseDisplayHeightToCm,
};
