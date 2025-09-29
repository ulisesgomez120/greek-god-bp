// Persisted refresh queue for offline / temporary-failure refresh attempts.
// - Uses StorageAdapter.async to persist a list of QueuedRefreshAttempt objects.
// - Provides enqueue, list, dequeueAndProcess, and clear operations.
//
// This module is intentionally small and dependency-free; callers implement the
// actual refresh processor and decide how to handle TokenRefreshResult outcomes.

import { v4 as uuidv4 } from "uuid";
import StorageAdapter from "@/lib/storageAdapter";
import type { QueuedRefreshAttempt } from "@/types/auth";
import { SESSION_PERSISTENCE_CONFIG } from "@/config/constants";
import { logger } from "@/utils/logger";

const QUEUE_KEY = "refresh_queue";

/**
 * Read the persisted queue (returns an array, never null).
 */
async function readQueue(): Promise<QueuedRefreshAttempt[]> {
  try {
    const q = (await StorageAdapter.async.getItem<QueuedRefreshAttempt[]>(QUEUE_KEY)) ?? [];
    // Defensive: ensure it's an array
    if (!Array.isArray(q)) return [];
    return q;
  } catch (err) {
    logger.warn("refreshQueue: readQueue failed, returning empty queue", err, "auth");
    return [];
  }
}

/**
 * Persist the queue.
 */
async function writeQueue(queue: QueuedRefreshAttempt[]): Promise<void> {
  try {
    await StorageAdapter.async.setItem(QUEUE_KEY, queue);
  } catch (err) {
    logger.warn("refreshQueue: writeQueue failed", err, "auth");
  }
}

/**
 * Enqueue a refresh attempt with given reason.
 */
export async function enqueueRefresh(reason: QueuedRefreshAttempt["reason"]): Promise<QueuedRefreshAttempt> {
  const attempt: QueuedRefreshAttempt = {
    id: uuidv4(),
    queuedAt: Date.now(),
    reason,
    attempts: 0,
    lastError: null,
  };

  const queue = await readQueue();
  queue.push(attempt);

  // Optionally cap queue size using SESSION_PERSISTENCE_CONFIG.maxQueuedAttempts
  const maxQueued = SESSION_PERSISTENCE_CONFIG.maxQueuedAttempts ?? 10;
  if (queue.length > maxQueued) {
    // Drop oldest items (FIFO) to keep queue bounded
    queue.splice(0, queue.length - maxQueued);
  }

  await writeQueue(queue);
  try {
    await StorageAdapter.async.setItem("last_queued_refresh_at", new Date().toISOString());
  } catch {}

  logger.debug("refreshQueue: enqueued refresh attempt", { id: attempt.id, reason }, "auth");
  return attempt;
}

/**
 * List queued attempts (shallow copy).
 */
export async function listQueuedAttempts(): Promise<QueuedRefreshAttempt[]> {
  const queue = await readQueue();
  // Return a copy to prevent external mutation
  return queue.slice();
}

/**
 * Clear the persisted queue.
 */
export async function clearQueue(): Promise<void> {
  try {
    await StorageAdapter.async.removeItem(QUEUE_KEY);
    logger.debug("refreshQueue: cleared queue", undefined, "auth");
  } catch (err) {
    logger.warn("refreshQueue: failed to clear queue", err, "auth");
  }
}

/**
 * Dequeue and process items sequentially.
 *
 * The processor callback should throw on failure (temporary or permanent).
 * It's the caller's responsibility to interpret the error and decide what to do
 * (e.g., re-enqueue with updated attempts or drop on permanent failure).
 *
 * This helper:
 *  - Loads the current queue
 *  - Iterates over items in FIFO order
 *  - Calls processor for each item
 *  - On success removes the item from the queue
 *  - On failure increments attempts and updates lastError then persists the queue
 *
 * For safety this function limits the number of processed items in a single run
 * to avoid long-running foreground processing. The limit is configurable via
 * SESSION_PERSISTENCE_CONFIG.processQueueBatchSize (defaults to 5).
 */
export async function dequeueAndProcess(processor: (attempt: QueuedRefreshAttempt) => Promise<void>): Promise<void> {
  const queue = await readQueue();
  if (queue.length === 0) return;

  const batchSize = SESSION_PERSISTENCE_CONFIG.processQueueBatchSize ?? 5;
  const itemsToProcess = queue.slice(0, batchSize);

  let mutated = false;

  for (const item of itemsToProcess) {
    try {
      await processor(item);
      // On success, remove the item from the persisted queue
      const idx = queue.findIndex((q) => q.id === item.id);
      if (idx >= 0) {
        queue.splice(idx, 1);
        mutated = true;
        logger.debug("refreshQueue: processed and removed item", { id: item.id }, "auth");
      }
    } catch (err: any) {
      // On failure, increment attempts and update lastError
      const idx = queue.findIndex((q) => q.id === item.id);
      if (idx >= 0) {
        queue[idx].attempts = (queue[idx].attempts ?? 0) + 1;
        queue[idx].lastError = { code: err?.code ?? "UNKNOWN", message: err?.message ?? String(err) };
        mutated = true;
        logger.warn(
          "refreshQueue: processor failed for item, updated attempts",
          { id: item.id, attempts: queue[idx].attempts },
          "auth"
        );

        // If attempts exceed configured max, drop the item (treat as permanent failure)
        const maxAttempts = SESSION_PERSISTENCE_CONFIG.maxRetryAttempts ?? 5;
        if (queue[idx].attempts >= maxAttempts) {
          queue.splice(idx, 1);
          logger.warn("refreshQueue: item removed after exceeding max attempts", { id: item.id }, "auth");
        }
      }
    }
  }

  if (mutated) {
    await writeQueue(queue);
  }
}
