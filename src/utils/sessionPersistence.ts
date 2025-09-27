/**
 * sessionPersistence.ts
 *
 * Lightweight helpers to decide whether to attempt a refresh on app focus
 * and to record simple session/refresh metrics for diagnostics and tests.
 *
 * - Metrics are stored in StorageAdapter.async under key "session_metrics" (not sensitive).
 * - Functions are small and easily mocked in unit tests.
 */

import { SESSION_PERSISTENCE_CONFIG, STORAGE_KEYS } from "@/config/constants";
import StorageAdapter from "@/lib/storageAdapter";

export type SessionMetricEvent =
  | "refresh_attempt"
  | "refresh_success"
  | "refresh_failed_temporary"
  | "refresh_failed_permanent"
  | "session_rehydrated"
  | "session_cleared"
  | "queued_attempt_enqueued"
  | "queued_attempt_processed";

export type SessionMetric = {
  event: SessionMetricEvent;
  timestamp: number;
  details?: Record<string, any>;
};

export type SessionMetrics = {
  events: SessionMetric[];
  lastRefreshAt?: number | null;
  sessionStartTime?: number | null;
};

const METRICS_STORAGE_KEY = "session_metrics";

/**
 * shouldAttemptRefreshOnFocus
 *
 * Decide whether to attempt a refresh when the app comes to the foreground.
 *
 * Heuristics:
 *  - If there is no lastRefreshAt, return true (we haven't refreshed yet).
 *  - If the time until access-token expiry is unknown, rely on sessionStartTime + buffer.
 *  - If (now - lastRefreshAt) >= bufferTime then true.
 *
 * The function is intentionally conservative to avoid unnecessary refresh spam while
 * ensuring we refresh well before access token expiry (SESSION_PERSISTENCE_CONFIG.bufferTimeMs).
 */
export async function shouldAttemptRefreshOnFocus(
  lastRefreshAt: number | null | undefined,
  sessionStartTime?: number | null,
  config = SESSION_PERSISTENCE_CONFIG
): Promise<boolean> {
  const now = Date.now();

  if (!config.enableRefreshOnForeground) return false;

  // If we've never refreshed since rehydration, try.
  if (!lastRefreshAt) {
    return true;
  }

  // If sessionStartTime exists and it's older than periodicRefreshInterval, attempt refresh.
  if (sessionStartTime && now - sessionStartTime > (config.periodicRefreshIntervalMs ?? 0)) {
    return true;
  }

  // If lastRefreshAt is older than bufferTime, attempt.
  if (now - lastRefreshAt >= (config.bufferTimeMs ?? 0)) {
    return true;
  }

  return false;
}

/**
 * recordSessionMetrics
 *
 * Append a metric event to persisted metrics. Keeps a bounded list to avoid unbounded growth.
 */
export async function recordSessionMetrics(event: SessionMetricEvent, details?: Record<string, any>) {
  try {
    const now = Date.now();
    const stored = (await StorageAdapter.async.getItem<SessionMetrics>(METRICS_STORAGE_KEY)) || {
      events: [],
      lastRefreshAt: null,
      sessionStartTime: null,
    };

    const newEvent: SessionMetric = {
      event,
      timestamp: now,
      details,
    };

    // Update lastRefreshAt for refresh success events.
    if (event === "refresh_success") {
      stored.lastRefreshAt = now;
    }

    if (event === "session_rehydrated") {
      stored.sessionStartTime = now;
    }

    // Keep recent 200 events max.
    stored.events.push(newEvent);
    if (stored.events.length > 200) {
      stored.events = stored.events.slice(stored.events.length - 200);
    }

    await StorageAdapter.async.setItem(METRICS_STORAGE_KEY, stored);
  } catch (err) {
    // Don't throw; metrics recording should be best-effort only.
    // eslint-disable-next-line no-console
    console.warn("recordSessionMetrics failed:", err);
  }
}

/**
 * getSessionMetrics
 *
 * Return stored metrics or a sane default.
 */
export async function getSessionMetrics(): Promise<SessionMetrics> {
  try {
    const stored = (await StorageAdapter.async.getItem<SessionMetrics>(METRICS_STORAGE_KEY)) || {
      events: [],
      lastRefreshAt: null,
      sessionStartTime: null,
    };
    return stored;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("getSessionMetrics failed:", err);
    return { events: [], lastRefreshAt: null, sessionStartTime: null };
  }
}

/**
 * clearSessionMetrics
 *
 * Remove persisted metrics (useful in tests or when user logs out).
 */
export async function clearSessionMetrics(): Promise<void> {
  try {
    await StorageAdapter.async.removeItem(METRICS_STORAGE_KEY);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("clearSessionMetrics failed:", err);
  }
}

export default {
  shouldAttemptRefreshOnFocus,
  recordSessionMetrics,
  getSessionMetrics,
  clearSessionMetrics,
};
