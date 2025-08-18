// ============================================================================
// SECURE STORAGE UTILITIES
// ============================================================================
// Secure storage utilities using Expo SecureStore for sensitive data
// and AsyncStorage for non-sensitive data

import StorageAdapter from "@/lib/storageAdapter";
import { STORAGE_KEYS } from "../config/constants";
import { logger } from "./logger";

// Create a storage-specific logger
const storageLogger = {
  debug: (message: string, data?: any) => logger.debug(message, data, "storage"),
  info: (message: string, data?: any) => logger.info(message, data, "storage"),
  warn: (message: string, data?: any) => logger.warn(message, data, "storage"),
  error: (message: string, data?: any) => logger.error(message, data, "storage"),
};

// ============================================================================
// SECURE STORAGE (ENCRYPTED)
// ============================================================================

/**
 * Store sensitive data securely (encrypted)
 */
export const setSecureItem = async (key: string, value: string): Promise<void> => {
  try {
    await StorageAdapter.secure.setItem(key, value);
    logger.debug(`Secure item stored: ${key}`);
  } catch (error) {
    logger.error(`Failed to store secure item ${key}:`, error);
    throw new Error(`Failed to store secure data: ${error}`);
  }
};

/**
 * Retrieve sensitive data securely
 */
export const getSecureItem = async (key: string): Promise<string | null> => {
  try {
    const value = await StorageAdapter.secure.getItem(key);
    logger.debug(`Secure item retrieved: ${key}`);
    return value;
  } catch (error) {
    logger.error(`Failed to retrieve secure item ${key}:`, error);
    return null;
  }
};

/**
 * Remove sensitive data securely
 */
export const removeSecureItem = async (key: string): Promise<void> => {
  try {
    await StorageAdapter.secure.removeItem(key);
    logger.debug(`Secure item removed: ${key}`);
  } catch (error) {
    logger.error(`Failed to remove secure item ${key}:`, error);
    throw new Error(`Failed to remove secure data: ${error}`);
  }
};

/**
 * Store non-sensitive data (now persisted in SecureStore under an "async:" prefix).
 * Note: AsyncStorage has been removed from the project; this keeps the same helpers
 * but uses SecureStore for development convenience.
 */
export const setAsyncItem = async (key: string, value: any): Promise<void> => {
  try {
    await StorageAdapter.async.setItem(key, value);
    logger.debug(`Async item stored: ${key}`);
  } catch (error) {
    logger.error(`Failed to store async item ${key}:`, error);
    throw new Error(`Failed to store data: ${error}`);
  }
};

/**
 * Retrieve non-sensitive data (stored under SecureStore with "async:" prefix)
 */
export const getAsyncItem = async <T = any>(key: string): Promise<T | null> => {
  try {
    const value = await StorageAdapter.async.getItem<T>(key);
    if (value === null || value === undefined) return null;
    logger.debug(`Async item retrieved: ${key}`);
    return value;
  } catch (error) {
    logger.error(`Failed to retrieve async item ${key}:`, error);
    return null;
  }
};

/**
 * Remove non-sensitive data
 */
export const removeAsyncItem = async (key: string): Promise<void> => {
  try {
    await StorageAdapter.async.removeItem(key);
    logger.debug(`Async item removed: ${key}`);
  } catch (error) {
    logger.error(`Failed to remove async item ${key}:`, error);
    throw new Error(`Failed to remove data: ${error}`);
  }
};

/**
 * Clear all non-sensitive data (SecureStore keys with "async:" prefix).
 * Note: SecureStore doesn't provide a listing API; this function clears known keys
 * defined in STORAGE_KEYS.async and related keys used by the app.
 */
export const clearAsyncStorage = async (): Promise<void> => {
  try {
    // Remove known keys from STORAGE_KEYS.async
    const keys = Object.values(STORAGE_KEYS.async) as string[];
    const removePromises = keys.map((k) => StorageAdapter.async.removeItem(k).catch(() => {}));

    // Also remove common runtime keys
    removePromises.push(StorageAdapter.async.removeItem("token_expires_at").catch(() => {}));
    removePromises.push(StorageAdapter.async.removeItem("workout_cache").catch(() => {}));

    // Additionally, attempt to list any remaining async: keys and remove them for thoroughness
    try {
      const listedKeys = await StorageAdapter.async.listKeys();
      for (const listedKey of listedKeys) {
        if (!keys.includes(listedKey)) {
          removePromises.push(StorageAdapter.async.removeItem(listedKey).catch(() => {}));
        }
      }
    } catch (listErr) {
      // Non-fatal - continue
      logger.warn("clearAsyncStorage: failed to list async keys for cleanup", listErr);
    }

    await Promise.all(removePromises);
    logger.info("Async storage cleared");
  } catch (error) {
    logger.error("Failed to clear async storage:", error);
    throw new Error(`Failed to clear storage: ${error}`);
  }
};

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

/**
 * Store authentication tokens securely
 */
export const storeTokens = async (tokens: TokenData): Promise<void> => {
  try {
    await Promise.all([
      setSecureItem(STORAGE_KEYS.secure.accessToken, tokens.accessToken),
      setSecureItem(STORAGE_KEYS.secure.refreshToken, tokens.refreshToken),
      setAsyncItem("token_expires_at", tokens.expiresAt),
    ]);
    logger.info("Authentication tokens stored securely");
  } catch (error) {
    logger.error("Failed to store tokens:", error);
    throw error;
  }
};

/**
 * Retrieve authentication tokens
 */
export const getTokens = async (): Promise<TokenData | null> => {
  try {
    const [accessToken, refreshToken, expiresAt] = await Promise.all([
      getSecureItem(STORAGE_KEYS.secure.accessToken),
      getSecureItem(STORAGE_KEYS.secure.refreshToken),
      getAsyncItem<string>("token_expires_at"),
    ]);

    if (!accessToken || !refreshToken) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      expiresAt: expiresAt || "",
    };
  } catch (error) {
    logger.error("Failed to retrieve tokens:", error);
    return null;
  }
};

/**
 * Clear authentication tokens
 */
export const clearTokens = async (): Promise<void> => {
  try {
    await Promise.all([
      removeSecureItem(STORAGE_KEYS.secure.accessToken),
      removeSecureItem(STORAGE_KEYS.secure.refreshToken),
      removeAsyncItem("token_expires_at"),
    ]);
    logger.info("Authentication tokens cleared");
  } catch (error) {
    logger.error("Failed to clear tokens:", error);
    throw error;
  }
};

/**
 * Check if tokens are expired
 */
export const areTokensExpired = async (): Promise<boolean> => {
  try {
    const expiresAt = await getAsyncItem<string>("token_expires_at");
    if (!expiresAt) {
      return true;
    }

    const expirationTime = new Date(expiresAt).getTime();
    const currentTime = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

    return currentTime >= expirationTime - bufferTime;
  } catch (error) {
    logger.error("Failed to check token expiration:", error);
    return true; // Assume expired on error
  }
};

// ============================================================================
// USER PREFERENCES
// ============================================================================

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  notifications: boolean;
  analytics: boolean;
  aiPersonality: "just_gentle" | "more_gentle" | "more_challenging" | "just_challenging";
  units: "metric" | "imperial";
  restTimerSound: boolean;
  hapticFeedback: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  notifications: true,
  analytics: true,
  aiPersonality: "more_gentle",
  units: "metric",
  restTimerSound: true,
  hapticFeedback: true,
};

/**
 * Store user preferences
 */
export const storeUserPreferences = async (preferences: Partial<UserPreferences>): Promise<void> => {
  try {
    const currentPreferences = await getUserPreferences();
    const updatedPreferences = { ...currentPreferences, ...preferences };
    await setAsyncItem(STORAGE_KEYS.async.userPreferences, updatedPreferences);
    logger.info("User preferences updated");
  } catch (error) {
    logger.error("Failed to store user preferences:", error);
    throw error;
  }
};

/**
 * Retrieve user preferences
 */
export const getUserPreferences = async (): Promise<UserPreferences> => {
  try {
    const preferences = await getAsyncItem<UserPreferences>(STORAGE_KEYS.async.userPreferences);
    return { ...DEFAULT_PREFERENCES, ...preferences };
  } catch (error) {
    logger.error("Failed to retrieve user preferences:", error);
    return DEFAULT_PREFERENCES;
  }
};

// ============================================================================
// OFFLINE WORKOUT QUEUE
// ============================================================================

export interface OfflineWorkout {
  id: string;
  data: any;
  timestamp: number;
  syncAttempts: number;
  lastSyncAttempt?: number;
  syncError?: string;
}

/**
 * Add workout to offline queue
 */
export const addToOfflineQueue = async (
  _workout: Omit<OfflineWorkout, "timestamp" | "syncAttempts">
): Promise<void> => {
  // Offline queueing has been removed in Phase 3. This function is now a no-op.
  logger.warn("addToOfflineQueue called but offline queueing has been removed (Phase 3).");
  return;
};

/**
 * Get offline workout queue
 */
export const getOfflineQueue = async (): Promise<OfflineWorkout[]> => {
  // Offline queueing removed — return empty queue as fallback.
  return [];
};

/**
 * Remove workout from offline queue
 */
export const removeFromOfflineQueue = async (_workoutId: string): Promise<void> => {
  // Offline queueing removed — no-op.
  logger.warn("removeFromOfflineQueue called but offline queueing has been removed (Phase 3).");
  return;
};

/**
 * Update workout sync attempt
 */
export const updateSyncAttempt = async (_workoutId: string, _error?: string): Promise<void> => {
  // Offline sync attempts tracking removed — no-op.
  logger.warn("updateSyncAttempt called but offline sync is removed (Phase 3).");
  return;
};

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Store workout cache data
 */
export const storeWorkoutCache = async (data: any): Promise<void> => {
  try {
    await setAsyncItem(STORAGE_KEYS.async.workoutCache, {
      data,
      timestamp: Date.now(),
    });
    logger.debug("Workout cache updated");
  } catch (error) {
    logger.error("Failed to store workout cache:", error);
    throw error;
  }
};

/**
 * Get workout cache data
 */
export const getWorkoutCache = async (maxAge: number = 24 * 60 * 60 * 1000): Promise<any | null> => {
  try {
    const cache = await getAsyncItem<{ data: any; timestamp: number }>(STORAGE_KEYS.async.workoutCache);

    if (!cache) {
      return null;
    }

    const isExpired = Date.now() - cache.timestamp > maxAge;
    if (isExpired) {
      await removeAsyncItem(STORAGE_KEYS.async.workoutCache);
      return null;
    }

    return cache.data;
  } catch (error) {
    logger.error("Failed to retrieve workout cache:", error);
    return null;
  }
};

// ============================================================================
// MIGRATION UTILITIES
// ============================================================================

/**
 * Migrate storage data between app versions
 */
export const migrateStorageData = async (fromVersion: string, toVersion: string): Promise<void> => {
  try {
    logger.info(`Migrating storage data from ${fromVersion} to ${toVersion}`);

    // Add migration logic here as needed
    // Example: migrate old preference keys to new ones

    await setAsyncItem(STORAGE_KEYS.async.appVersion, toVersion);
    logger.info("Storage migration completed");
  } catch (error) {
    logger.error("Failed to migrate storage data:", error);
    throw error;
  }
};

/**
 * Check if storage migration is needed
 */
export const needsStorageMigration = async (currentVersion: string): Promise<boolean> => {
  try {
    const storedVersion = await getAsyncItem<string>(STORAGE_KEYS.async.appVersion);
    return storedVersion !== currentVersion;
  } catch (error) {
    logger.error("Failed to check migration status:", error);
    return false;
  }
};

// ============================================================================
// STORAGE HEALTH CHECK
// ============================================================================

/**
 * Perform storage health check
 */
export const performStorageHealthCheck = async (): Promise<{
  secure: boolean;
  async: boolean;
  errors: string[];
}> => {
  const errors: string[] = [];
  let secureStorageHealthy = true;
  let asyncStorageHealthy = true;

  try {
    // Test secure storage
    const testKey = "health_check_secure";
    const testValue = "test_value";
    await setSecureItem(testKey, testValue);
    const retrievedValue = await getSecureItem(testKey);
    await removeSecureItem(testKey);

    if (retrievedValue !== testValue) {
      secureStorageHealthy = false;
      errors.push("Secure storage read/write test failed");
    }
  } catch (error) {
    secureStorageHealthy = false;
    errors.push(`Secure storage error: ${error}`);
  }

  try {
    // Test async (now stored in SecureStore) storage
    const testKey = "health_check_async";
    const testValue = { test: "value" };
    await setAsyncItem(testKey, testValue);
    const retrievedValue = await getAsyncItem(testKey);
    await removeAsyncItem(testKey);

    if (JSON.stringify(retrievedValue) !== JSON.stringify(testValue)) {
      asyncStorageHealthy = false;
      errors.push("Async storage (secure) read/write test failed");
    }
  } catch (error) {
    asyncStorageHealthy = false;
    errors.push(`Async storage (secure) error: ${error}`);
  }

  return {
    secure: secureStorageHealthy,
    async: asyncStorageHealthy,
    errors,
  };
};
