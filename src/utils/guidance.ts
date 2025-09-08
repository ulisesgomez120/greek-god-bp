/**
 * Utilities for mapping experience levels and stages to guidance content.
 *
 * Uses canonical copy from src/constants/progressionRules.ts and provides
 * helper functions used by UI components and navigation logic.
 */

import { PROGRESSION_EDUCATION, EXPERIENCE_MESSAGES, PROGRESSION_RULES } from "../constants/progressionRules";
import type { ExperienceLevel, GuidanceStage, GuidanceContent } from "../types/guidance";

/**
 * Truncate or format guidance bullets to a maximum number of items.
 * Returns a new array (does not mutate input).
 */
export function formatGuidanceBullets(bullets: string[] = [], maxBullets = 5): string[] {
  if (!Array.isArray(bullets)) return [];
  return bullets.slice(0, maxBullets).map((b) => b.trim());
}

/**
 * Build a GuidanceContent payload for a given experience level and display stage.
 * This composes short, authoritative bullets derived from PROGRESSION_EDUCATION and EXPERIENCE_MESSAGES.
 */
export function getGuidanceForLevel(level: ExperienceLevel, stage: GuidanceStage): GuidanceContent {
  const id = `${level}-${stage}`;
  const levelMessage = (EXPERIENCE_MESSAGES as any)[level] || {};
  const rulesForLevel = (PROGRESSION_RULES as any)[level] || {};

  // Default bullets that are short and actionable
  let bullets: string[] = [];

  if (stage === "postOnboarding") {
    // For post-onboarding, show a concise 3-5 item primer combining focus + top tips
    const focus = rulesForLevel.focusMessage || levelMessage.focus || "";
    const rpeTips = PROGRESSION_EDUCATION.rpe_scale?.tips || [];
    const overloadTips = PROGRESSION_EDUCATION.progressive_overload?.tips || [];
    // Compose prioritized bullets: explicit focus, then a couple practical tips
    bullets = [focus, ...(rpeTips.slice(0, 2) as string[]), ...(overloadTips.slice(0, 2) as string[])].filter(Boolean);
  } else if (stage === "firstWorkout") {
    // Short checklist for the first workout
    bullets = [
      "Warm up thoroughly and prioritize safe movement patterns.",
      "Start lighter than you think — aim for controlled reps with good form.",
      "Track your sets and rate RPE for the last working set.",
    ];
    // Tailor a small encouragement or caveat for untrained users
    if (level === "untrained") {
      bullets.unshift("Focus on learning the movement — progression comes after consistency.");
    }
  } else {
    // inline tips: single-line, contextually useful hints
    if (level === "untrained") {
      bullets = ["Prioritize perfect form; if unsure, reduce weight and practice the movement."];
    } else if (level === "beginner") {
      bullets = ["If you completed all reps with room, consider the small weekly increase."];
    } else if (level === "intermediate" || level === "advanced") {
      bullets = ["Use RPE trends to decide when to add weight — small, consistent bumps win over time."];
    } else {
      bullets = ["Keep consistent and listen to RPE — that's how progression is earned."];
    }
  }

  bullets = formatGuidanceBullets(bullets, 5);

  const title =
    stage === "postOnboarding"
      ? levelMessage.focus || (rulesForLevel.focusMessage as string) || "Progression basics"
      : stage === "firstWorkout"
      ? "First workout tips"
      : "Quick tip";

  const source = "PROGRESSION_EDUCATION";

  return {
    id,
    level,
    stage,
    title,
    bullets,
    source,
  } as GuidanceContent;
}

/**
 * Determine whether the app should show the FirstWorkoutPrep screen.
 * The function is defensive and accepts a profile object with several possible property shapes.
 *
 * Heuristics used:
 * - User has completed onboarding (onboardingComplete / completedOnboarding / hasCompletedOnboarding)
 * - User has zero recorded workouts (workoutsCount / workoutCount / completedWorkouts / workouts.length)
 * - User has not yet seen the first-workout prep (seenFirstWorkoutPrep / firstWorkoutPrepSeen)
 *
 * Returns true when it looks like the user finished onboarding but has not started any workouts and hasn't
 * already seen the prep screen.
 */
export function shouldShowFirstWorkoutPrep(profile: Record<string, any> | null | undefined): boolean {
  if (!profile) return false;

  const onboardingComplete =
    profile.onboardingComplete ?? profile.completedOnboarding ?? profile.hasCompletedOnboarding ?? false;

  const workoutsCount =
    profile.workoutsCount ??
    profile.workoutCount ??
    profile.completedWorkouts ??
    (Array.isArray(profile.workouts) ? profile.workouts.length : undefined) ??
    0;

  const seenFirstPrep = profile.seenFirstWorkoutPrep ?? profile.firstWorkoutPrepSeen ?? false;

  return Boolean(onboardingComplete) && Number(workoutsCount) === 0 && !Boolean(seenFirstPrep);
}

export default {
  getGuidanceForLevel,
  shouldShowFirstWorkoutPrep,
  formatGuidanceBullets,
};
