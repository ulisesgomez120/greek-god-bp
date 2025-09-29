// Small storage helpers that provide robust operations used by TokenManager.
// Specifically, readSecureItemWithRetry implements a short retry/backoff loop
// around StorageAdapter.secure.getItem to mitigate transient SecureStore errors
// during cold starts on iOS.
//
// Usage:
//   import { readSecureItemWithRetry } from "@/lib/storageHelpers";
//   const val = await readSecureItemWithRetry("access_token", 3, 250);

import StorageAdapter from "@/lib/storageAdapter";
import { logger } from "@/utils/logger";

/**
 * Read a secure item with retries and exponential backoff.
 * - key: storage key
 * - attempts: number of attempts (default 3)
 * - initialDelayMs: base delay in ms between attempts (default 250)
 *
 * Returns the stored string or null if not available.
 */
export async function readSecureItemWithRetry(key: string, attempts = 3, initialDelayMs = 250): Promise<string | null> {
  let lastErr: any = null;

  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt++) {
    try {
      const val = await StorageAdapter.secure.getItem(key);
      return val ?? null;
    } catch (err) {
      lastErr = err;
      logger.warn(
        `storageHelpers: readSecureItemWithRetry attempt ${attempt} failed for key=${key}`,
        { error: (err as any)?.message ?? String(err) },
        "auth"
      );

      if (attempt < attempts) {
        const delay = initialDelayMs * Math.pow(2, attempt - 1);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }

  logger.error("storageHelpers: readSecureItemWithRetry exhausted attempts", {
    key,
    error: (lastErr as any)?.message ?? String(lastErr),
  });

  return null;
}
