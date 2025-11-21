import { useEffect, useState } from "react";
import ProgressService from "@/services/progress.service";
import { exerciseLookupService } from "@/services/exerciseLookup.service";
import type { VolumeDataPoint, ExerciseSessionSummary, PersonalRecord, TimeframeOption } from "@/types";

export function useExerciseProgress(
  userId: string,
  exerciseId: string,
  plannedExerciseId: string | undefined,
  timeframe: TimeframeOption = "8w"
) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState<VolumeDataPoint[] | null>(null);
  const [sessions, setSessions] = useState<ExerciseSessionSummary[] | null>(null);
  const [prs, setPrs] = useState<PersonalRecord[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      setError(null);

      try {
        // Preload exercise names for header
        await exerciseLookupService.preloadCache();

        if (!plannedExerciseId) {
          setError("planned_exercise_id required");
          setLoading(false);
          return;
        }

        const tf = timeframe === "8w" ? "quarter" : timeframe === "4w" ? "month" : "year";

        const [volData, rawSessions, personalRecords] = await Promise.all([
          ProgressService.getVolumeProgression(userId, exerciseId, plannedExerciseId, tf),
          ProgressService.getExerciseHistory(userId, exerciseId, plannedExerciseId, 5, 60),
          ProgressService.getPersonalRecords(userId, plannedExerciseId, exerciseId, 10),
        ]);

        if (cancelled) return;

        setVolume(volData);
        setSessions(rawSessions);
        setPrs(personalRecords);
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || "Failed to load exercise progress");
        setLoading(false);
      }
    }

    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [userId, exerciseId, plannedExerciseId, timeframe]);

  return { loading, error, volume, sessions, prs };
}
