// Platform-aware StorageAdapter
// - secure.* uses Expo SecureStore on native, sessionStorage fallback on web (documented tradeoffs).
// - async.* uses AsyncStorage on native, localStorage on web (keys are stored with "async:" prefix to remain
//   compatible with previous SecureStore-backed "async:" entries).
//
// This adapter keeps a small, well-documented surface so src/utils/storage.ts can delegate to it and remain
// backwards-compatible with existing call sites.

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import createSecureWebStorage from "./webCrypto";

const ASYNC_PREFIX = "async:";

function isWeb(): boolean {
  try {
    // Platform.OS exists in RN; additionally double-check for browser globals
    return Platform.OS === "web" || (typeof window !== "undefined" && typeof window.document !== "undefined");
  } catch {
    return false;
  }
}

export const StorageAdapter = {
  secure: {
    async getItem(key: string): Promise<string | null> {
      if (isWeb()) {
        // Use encrypted web storage via Web Crypto API when available. Falls back to plain sessionStorage/localStorage.
        try {
          const storageRoot = typeof localStorage !== "undefined" ? localStorage : sessionStorage;
          const webSecure = createSecureWebStorage(storageRoot);
          return await webSecure.getItem(key);
        } catch (err) {
          console.warn("StorageAdapter.secure.getItem (web) failed:", err);
          return null;
        }
      }

      try {
        const value = await SecureStore.getItemAsync(key, { keychainService: "trainsmart-keychain" });
        return value;
      } catch (err) {
        console.warn("StorageAdapter.secure.getItem failed:", err);
        return null;
      }
    },

    async setItem(key: string, value: string): Promise<void> {
      if (isWeb()) {
        try {
          const storageRoot = typeof localStorage !== "undefined" ? localStorage : sessionStorage;
          const webSecure = createSecureWebStorage(storageRoot);
          await webSecure.setItem(key, value);
          return;
        } catch (err) {
          console.warn("StorageAdapter.secure.setItem (web) failed:", err);
          throw err;
        }
      }

      try {
        await SecureStore.setItemAsync(key, value, { keychainService: "trainsmart-keychain" });
      } catch (err) {
        console.warn("StorageAdapter.secure.setItem failed:", err);
        throw err;
      }
    },

    async removeItem(key: string): Promise<void> {
      if (isWeb()) {
        try {
          const storageRoot = typeof localStorage !== "undefined" ? localStorage : sessionStorage;
          const webSecure = createSecureWebStorage(storageRoot);
          await webSecure.removeItem(key);
          return;
        } catch (err) {
          console.warn("StorageAdapter.secure.removeItem (web) failed:", err);
          throw err;
        }
      }

      try {
        await SecureStore.deleteItemAsync(key, { keychainService: "trainsmart-keychain" });
      } catch (err) {
        console.warn("StorageAdapter.secure.removeItem failed:", err);
        throw err;
      }
    },
  },

  async: {
    // Async storage keys are persisted with "async:" prefix to keep compatibility with existing data.
    async getItem<T = any>(key: string): Promise<T | null> {
      const storageKey = ASYNC_PREFIX + key;

      if (isWeb()) {
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw === null) return null;
          try {
            return JSON.parse(raw) as T;
          } catch {
            // Not JSON - return raw string
            return raw as unknown as T;
          }
        } catch (err) {
          console.warn("StorageAdapter.async.getItem (web) failed:", err);
          return null;
        }
      }

      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw === null) return null;
        try {
          return JSON.parse(raw) as T;
        } catch {
          return raw as unknown as T;
        }
      } catch (err) {
        console.warn("StorageAdapter.async.getItem failed:", err);
        return null;
      }
    },

    async setItem(key: string, value: any): Promise<void> {
      const storageKey = ASYNC_PREFIX + key;
      const serialized = typeof value === "string" ? value : JSON.stringify(value);

      if (isWeb()) {
        try {
          localStorage.setItem(storageKey, serialized);
          return;
        } catch (err) {
          console.warn("StorageAdapter.async.setItem (web) failed:", err);
          throw err;
        }
      }

      try {
        await AsyncStorage.setItem(storageKey, serialized);
      } catch (err) {
        console.warn("StorageAdapter.async.setItem failed:", err);
        throw err;
      }
    },

    async removeItem(key: string): Promise<void> {
      const storageKey = ASYNC_PREFIX + key;

      if (isWeb()) {
        try {
          localStorage.removeItem(storageKey);
          return;
        } catch (err) {
          console.warn("StorageAdapter.async.removeItem (web) failed:", err);
          throw err;
        }
      }

      try {
        await AsyncStorage.removeItem(storageKey);
      } catch (err) {
        console.warn("StorageAdapter.async.removeItem failed:", err);
        throw err;
      }
    },

    // List async keys stored with the async: prefix (returns keys without the prefix)
    async listKeys(): Promise<string[]> {
      if (isWeb()) {
        try {
          const keys = Object.keys(localStorage)
            .filter((k) => k.startsWith(ASYNC_PREFIX))
            .map((k) => k.slice(ASYNC_PREFIX.length));
          return keys;
        } catch (err) {
          console.warn("StorageAdapter.async.listKeys (web) failed:", err);
          return [];
        }
      }

      try {
        const keys = await AsyncStorage.getAllKeys();
        return keys.filter((k) => k.startsWith(ASYNC_PREFIX)).map((k) => k.slice(ASYNC_PREFIX.length));
      } catch (err) {
        console.warn("StorageAdapter.async.listKeys failed:", err);
        return [];
      }
    },
  },
};

export default StorageAdapter;
