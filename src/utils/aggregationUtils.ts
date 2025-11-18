import { ExerciseSet } from "../types";
import { startOfWeek, generateMonthsBetween } from "./dateUtils";

export interface WeeklyVolume {
  weekStart: string; // ISO date
  totalVolume: number;
  sessionCount: number;
  sets: number;
  averageRpe?: number | null;
}

/**
 * Aggregate weekly volume given a list of sets. Week starts on Sunday by default.
 */
export function aggregateWeeklyVolume(sets: ExerciseSet[], weeks: number = 8, weekStartsOn: 0 | 1 = 0): WeeklyVolume[] {
  if (!sets || sets.length === 0) return [];

  // normalize sets into a map keyed by weekStart ISO
  const map: Record<
    string,
    { totalVolume: number; sessionIds: Set<string>; sets: number; rpeSum: number; rpeCount: number }
  > = {};

  const now = new Date();
  const lastWeekStart = startOfWeek(now, weekStartsOn);

  for (const s of sets) {
    if (!s || s.isWarmup) continue; // skip warmups
    if (s.weightKg == null || s.reps == null) continue;

    const created = new Date(s.createdAt);
    const wkStart = startOfWeek(created, weekStartsOn).toISOString();
    if (!map[wkStart]) map[wkStart] = { totalVolume: 0, sessionIds: new Set(), sets: 0, rpeSum: 0, rpeCount: 0 };

    map[wkStart].totalVolume += (s.weightKg || 0) * s.reps;
    map[wkStart].sessionIds.add(s.sessionId);
    map[wkStart].sets += 1;
    if (typeof s.rpe === "number") {
      map[wkStart].rpeSum += s.rpe;
      map[wkStart].rpeCount += 1;
    }
  }

  // build last N weeks array
  const result: WeeklyVolume[] = [];
  let cursor = lastWeekStart;
  for (let i = 0; i < weeks; i++) {
    const key = cursor.toISOString();
    const entry = map[key] || { totalVolume: 0, sessionIds: new Set(), sets: 0, rpeSum: 0, rpeCount: 0 };
    result.unshift({
      weekStart: key,
      totalVolume: entry.totalVolume,
      sessionCount: entry.sessionIds.size,
      sets: entry.sets,
      averageRpe: entry.rpeCount > 0 ? entry.rpeSum / entry.rpeCount : null,
    });
    cursor = new Date(cursor.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  return result;
}

/**
 * Compute total volume for a given month (monthDate is any date within the month)
 */
export function computeMonthVolume(sets: ExerciseSet[], monthDate: Date | string) {
  const m = typeof monthDate === "string" ? new Date(monthDate) : monthDate;
  const start = new Date(m.getFullYear(), m.getMonth(), 1);
  const end = new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59, 59, 999);

  let total = 0;
  for (const s of sets) {
    if (!s || s.isWarmup) continue;
    if (s.weightKg == null || s.reps == null) continue;
    const created = new Date(s.createdAt);
    if (created >= start && created <= end) {
      total += (s.weightKg || 0) * s.reps;
    }
  }
  return { totalVolume: total };
}

/**
 * Compute personal records (weight/reps/volume) for the provided sets
 */
export function computePRs(sets: ExerciseSet[]) {
  const prs: { weight?: any; reps?: any; volume?: any } = {};
  let bestWeightSet = null;
  let bestRepsSet = null;
  let bestVolumeValue = 0;
  for (const s of sets) {
    if (!s || s.isWarmup) continue;
    if (s.weightKg != null && s.reps != null) {
      const vol = (s.weightKg || 0) * s.reps;
      if (!bestWeightSet || (s.weightKg || 0) > (bestWeightSet.weightKg || 0)) bestWeightSet = s;
      if (!bestRepsSet || s.reps > bestRepsSet.reps) bestRepsSet = s;
      if (vol > bestVolumeValue) bestVolumeValue = vol;
    }
  }

  const out = [] as any[];
  if (bestWeightSet) {
    out.push({
      type: "weight",
      value: bestWeightSet.weightKg,
      achievedAt: bestWeightSet.createdAt,
      sessionId: bestWeightSet.sessionId,
    });
  }
  if (bestRepsSet) {
    out.push({
      type: "reps",
      value: bestRepsSet.reps,
      achievedAt: bestRepsSet.createdAt,
      sessionId: bestRepsSet.sessionId,
    });
  }
  if (bestVolumeValue > 0) {
    out.push({
      type: "volume",
      value: bestVolumeValue,
      achievedAt: bestWeightSet ? bestWeightSet.createdAt : new Date().toISOString(),
      sessionId: bestWeightSet ? bestWeightSet.sessionId : "",
    });
  }
  return out;
}
