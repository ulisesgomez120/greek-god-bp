/**
 * Guidance types for progression strategy
 *
 * This file defines the canonical shapes used by guidance content and utilities.
 * Keep this focused on types and simple type-guards only; business logic lives in utils/guidance.ts.
 */

export type ExperienceLevel = "untrained" | "beginner" | "early_intermediate" | "intermediate" | "advanced";

export type GuidanceStage = "postOnboarding" | "firstWorkout" | "inline";

/**
 * A short, focused guidance content payload shown to the user.
 * - id: stable identifier for analytics / tests
 * - level: experience level this guidance is targeted at
 * - stage: where this guidance should be shown
 * - title: optional short heading
 * - bullets: concise copy (recommend 3-5 items)
 * - source: optional origin key (e.g. PROGRESSION_EDUCATION)
 */
export interface GuidanceContent {
  id: string;
  level: ExperienceLevel;
  stage: GuidanceStage;
  title?: string;
  bullets: string[];
  source?: string;
}

/**
 * A nested map keyed by experience level and stage for quick lookup.
 * Example shape:
 * {
 *   beginner: {
 *     postOnboarding: GuidanceContent,
 *     inline: GuidanceContent
 *   },
 *   intermediate: { ... }
 * }
 */
export type GuidanceMap = {
  [L in ExperienceLevel]?: Partial<Record<GuidanceStage, GuidanceContent>>;
};

/** Simple runtime type guard for ExperienceLevel */
export function isExperienceLevel(value: string): value is ExperienceLevel {
  return (
    value === "untrained" ||
    value === "beginner" ||
    value === "early_intermediate" ||
    value === "intermediate" ||
    value === "advanced"
  );
}
