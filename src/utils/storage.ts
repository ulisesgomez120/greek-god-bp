// ============================================================================
// SECURE STORAGE UTILITIES
// ============================================================================
// Secure storage utilities using Expo SecureStore for sensitive data
// and AsyncStorage for non-sensitive data

import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
    await SecureStore.setItemAsync(key, value, {
      keychainService: "trainsmart-keychain",
      requireAuthentication: false, // Set to true for biometric protection
    });
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
    const value = await SecureStore.getItemAsync(key, {
      keychainService: "trainsmart-keychain",
      requireAuthentication: false,
    });
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
    await SecureStore.deleteItemAsync(key, {
      keychainService: "trainsmart-keychain",
    });
    logger.debug(`Secure item removed: ${key}`);
  } catch (error) {
    logger.error(`Failed to remove secure item ${key}:`, error);
    throw new Error(`Failed to remove secure data: ${error}`);
  }
};

// ============================================================================
// ASYNC STORAGE (UNENCRYPTED)
// ============================================================================

/**
 * Store non-sensitive data
 */
export const setAsyncItem = async (key: string, value: any): Promise<void> => {
  try {
    const serializedValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, serializedValue);
    logger.debug(`Async item stored: ${key}`);
  } catch (error) {
    logger.error(`Failed to store async item ${key}:`, error);
    throw new Error(`Failed to store data: ${error}`);
  }
};

/**
 * Retrieve non-sensitive data
 */
export const getAsyncItem = async <T = any>(key: string): Promise<T | null> => {
  try {
    const serializedValue = await AsyncStorage.getItem(key);
    if (serializedValue === null) {
      return null;
    }

    // Try parsing as JSON first. If parsing fails, fall back to returning the raw string.
    try {
      const value = JSON.parse(serializedValue);
      logger.debug(`Async item retrieved (parsed JSON): ${key}`);
      return value;
    } catch (parseError) {
      // Non-JSON value stored (legacy/malformed). Return raw string as a safe fallback.
      logger.warn(`Async item for key ${key} is not valid JSON — returning raw string fallback`, {
        parseError,
        key,
        rawValuePreview: String(serializedValue).slice(0, 200),
      });
      return serializedValue as unknown as T;
    }
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
    await AsyncStorage.removeItem(key);
    logger.debug(`Async item removed: ${key}`);
  } catch (error) {
    logger.error(`Failed to remove async item ${key}:`, error);
    throw new Error(`Failed to remove data: ${error}`);
  }
};

/**
 * Clear all non-sensitive data
 */
export const clearAsyncStorage = async (): Promise<void> => {
  try {
    await AsyncStorage.clear();
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
export const addToOfflineQueue = async (workout: Omit<OfflineWorkout, "timestamp" | "syncAttempts">): Promise<void> => {
  try {
    const queue = await getOfflineQueue();
    const newWorkout: OfflineWorkout = {
      ...workout,
      timestamp: Date.now(),
      syncAttempts: 0,
    };

    queue.push(newWorkout);
    await setAsyncItem(STORAGE_KEYS.async.offlineWorkouts, queue);
    logger.info(`Added workout to offline queue: ${workout.id}`);
  } catch (error) {
    logger.error("Failed to add workout to offline queue:", error);
    throw error;
  }
};

/**
 * Get offline workout queue
 */
export const getOfflineQueue = async (): Promise<OfflineWorkout[]> => {
  try {
    const queue = await getAsyncItem<OfflineWorkout[]>(STORAGE_KEYS.async.offlineWorkouts);
    return queue || [];
  } catch (error) {
    logger.error("Failed to retrieve offline queue:", error);
    return [];
  }
};

/**
 * Remove workout from offline queue
 */
export const removeFromOfflineQueue = async (workoutId: string): Promise<void> => {
  try {
    const queue = await getOfflineQueue();
    const updatedQueue = queue.filter((workout) => workout.id !== workoutId);
    await setAsyncItem(STORAGE_KEYS.async.offlineWorkouts, updatedQueue);
    logger.info(`Removed workout from offline queue: ${workoutId}`);
  } catch (error) {
    logger.error("Failed to remove workout from offline queue:", error);
    throw error;
  }
};

/**
 * Update workout sync attempt
 */
export const updateSyncAttempt = async (workoutId: string, error?: string): Promise<void> => {
  try {
    const queue = await getOfflineQueue();
    const workoutIndex = queue.findIndex((workout) => workout.id === workoutId);

    if (workoutIndex !== -1) {
      queue[workoutIndex].syncAttempts += 1;
      queue[workoutIndex].lastSyncAttempt = Date.now();
      if (error) {
        queue[workoutIndex].syncError = error;
      }

      await setAsyncItem(STORAGE_KEYS.async.offlineWorkouts, queue);
      logger.debug(`Updated sync attempt for workout: ${workoutId}`);
    }
  } catch (error) {
    logger.error("Failed to update sync attempt:", error);
    throw error;
  }
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
    // Test async storage
    const testKey = "health_check_async";
    const testValue = { test: "value" };
    await setAsyncItem(testKey, testValue);
    const retrievedValue = await getAsyncItem(testKey);
    await removeAsyncItem(testKey);

    if (JSON.stringify(retrievedValue) !== JSON.stringify(testValue)) {
      asyncStorageHealthy = false;
      errors.push("Async storage read/write test failed");
    }
  } catch (error) {
    asyncStorageHealthy = false;
    errors.push(`Async storage error: ${error}`);
  }

  return {
    secure: secureStorageHealthy,
    async: asyncStorageHealthy,
    errors,
  };
};
