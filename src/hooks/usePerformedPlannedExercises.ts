import { useEffect, useRef, useState } from "react";
import progressService from "../services/progress.service";

export type PlannedExerciseSearchResult = {
  plannedExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  planName?: string | null;
  sessionName?: string | null;
  targetSets?: number | null;
  targetRepsMin?: number | null;
  targetRepsMax?: number | null;
  timesPerformed: number;
  lastPerformed?: string | null;
};

type Options = {
  userId?: string;
  debounceMs?: number;
  pageSize?: number;
};

export default function usePerformedPlannedExercises(initialQuery = "", options: Options = {}) {
  const { userId, debounceMs = 300, pageSize = 20 } = options;
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [results, setResults] = useState<PlannedExerciseSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const debounceRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // reset paging when query changes
    setPage(0);
    setResults([]);
    setHasMore(false);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      fetchResults(0, true);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, userId]);

  async function fetchResults(fetchPage = 0, replace = false) {
    // cancel previous
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setLoading(true);
    setError(null);

    try {
      const offset = fetchPage * pageSize;
      // progressService.getPerformedPlannedExercises should accept (userId, searchQuery, { limit, offset })
      // fallback behavior: if progressService not available or throws, bubble error
      const res = await progressService.getPerformedPlannedExercises(userId ?? "", searchQuery.trim() || null, {
        limit: pageSize,
        offset,
        signal: ac.signal,
      });

      if (!Array.isArray(res)) {
        throw new Error("Unexpected response from getPerformedPlannedExercises");
      }

      setResults((prev) => (replace ? res : [...prev, ...res]));
      setHasMore(res.length === pageSize);
      setPage(fetchPage);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        // request was cancelled — ignore
        return;
      }
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  const fetchMore = async () => {
    if (loading || !hasMore) return;
    await fetchResults(page + 1, false);
  };

  const refresh = async () => {
    setResults([]);
    await fetchResults(0, true);
  };

  return {
    searchQuery,
    setSearchQuery,
    results,
    loading,
    error,
    fetchMore,
    refresh,
    hasMore,
  };
}
