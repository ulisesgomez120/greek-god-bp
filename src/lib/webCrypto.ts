/**
 * src/lib/webCrypto.ts
 *
 * Secure web storage using the Web Crypto API (AES-GCM).
 *
 * Exports:
 *   - createSecureWebStorage(storage?: Storage): SecureStorage
 *
 * Usage:
 *   const secureStorage = createSecureWebStorage(localStorage);
 *   await secureStorage.setItem('supabase.auth.token', token);
 *   const token = await secureStorage.getItem('supabase.auth.token');
 *
 * Behavior:
 *   - Uses window.crypto.subtle to generate/import an AES-GCM key.
 *   - Exports the generated key as JWK and keeps it in localStorage under a well-known key.
 *     (Storing the key JWK in localStorage is a pragmatic trade-off for PWAs
 *      where a native secure store is unavailable. It still protects tokens at-rest
 *      because encrypted ciphertext cannot be read without the key.)
 *   - Each ciphertext is stored as a small JSON object: { iv: "...", data: "..." } (base64).
 *   - If Web Crypto is not available or an error occurs, falls back to plain storage (sessionStorage by default).
 *
 * Notes:
 *   - This is intended for web/PWA usage as a replacement for native secure stores.
 *   - For stronger security, consider additional platform-specific protections (e.g., IndexedDB key wrapping, user passphrase).
 */

type SecureStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  clear?: () => Promise<void>;
};

const KEY_STORAGE_KEY = "ggbp_secure_key_v1"; // JWK stored in localStorage for this app
const KEY_ALGORITHM: AesKeyGenParams = { name: "AES-GCM", length: 256 };
const IV_BYTE_LENGTH = 12; // recommended length for AES-GCM

function isWebCryptoAvailable(): boolean {
  return typeof window !== "undefined" && !!(window.crypto && window.crypto.subtle);
}

function bufToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function importKeyFromJWK(jwk: JsonWebKey): Promise<CryptoKey> {
  return await window.crypto.subtle.importKey("jwk", jwk, KEY_ALGORITHM, true, ["encrypt", "decrypt"]);
}

async function getOrCreateKey(): Promise<CryptoKey | null> {
  try {
    if (!isWebCryptoAvailable()) return null;
    const existing = localStorage.getItem(KEY_STORAGE_KEY);
    if (existing) {
      try {
        const jwk = JSON.parse(existing) as JsonWebKey;
        return await importKeyFromJWK(jwk);
      } catch (err) {
        // if import fails, remove and generate new
        console.warn("webCrypto: failed to import stored key, generating new one", err);
        localStorage.removeItem(KEY_STORAGE_KEY);
      }
    }
    // generate new key
    const key = await window.crypto.subtle.generateKey(KEY_ALGORITHM, true, ["encrypt", "decrypt"]);
    const jwk = await window.crypto.subtle.exportKey("jwk", key);
    localStorage.setItem(KEY_STORAGE_KEY, JSON.stringify(jwk));
    return key;
  } catch (err) {
    console.warn("webCrypto: error generating/importing key", err);
    return null;
  }
}

/**
 * Factory that returns an object compatible with supabase-js storage adapter shape:
 *  - getItem(key): Promise<string | null>
 *  - setItem(key, value): Promise<void>
 *  - removeItem(key): Promise<void>
 *
 * Uses AES-GCM encryption when available, with IV per-encryption.
 */
export function createSecureWebStorage(storage: Storage = sessionStorage): SecureStorage {
  async function setItem(key: string, value: string): Promise<void> {
    if (!isWebCryptoAvailable()) {
      try {
        storage.setItem(key, value);
        return;
      } catch (err) {
        console.warn("webCrypto: fallback storage.setItem failed", err);
        return;
      }
    }

    const cryptoKey = await getOrCreateKey();
    if (!cryptoKey) {
      // fallback
      try {
        storage.setItem(key, value);
      } catch (err) {
        console.warn("webCrypto: fallback storage.setItem failed", err);
      }
      return;
    }

    try {
      const iv = window.crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
      const encoded = new TextEncoder().encode(value);
      const cipher = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encoded);
      const payload = {
        iv: bufToBase64(iv.buffer),
        data: bufToBase64(cipher),
      };
      storage.setItem(key, JSON.stringify(payload));
    } catch (err) {
      console.warn("webCrypto: encryption failed, falling back to plain storage", err);
      try {
        storage.setItem(key, value);
      } catch (err2) {
        console.warn("webCrypto: fallback storage.setItem failed", err2);
      }
    }
  }

  async function getItem(key: string): Promise<string | null> {
    const raw = storage.getItem(key);
    if (raw === null) return null;

    if (!isWebCryptoAvailable()) {
      return raw;
    }

    // attempt to parse as our encrypted payload
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.iv === "string" && typeof parsed.data === "string") {
        const cryptoKey = await getOrCreateKey();
        if (!cryptoKey) {
          // can't decrypt without key
          return null;
        }
        const ivBuf = base64ToArrayBuffer(parsed.iv);
        const dataBuf = base64ToArrayBuffer(parsed.data);
        const plainBuf = await window.crypto.subtle.decrypt(
          { name: "AES-GCM", iv: new Uint8Array(ivBuf) },
          cryptoKey,
          dataBuf
        );
        return new TextDecoder().decode(plainBuf);
      } else {
        // not our format: return raw
        return raw;
      }
    } catch (err) {
      // Not JSON or decryption failed; return raw as fallback
      // but if decryption fails, it likely means key mismatch/corruption; in that case, return raw or null
      console.warn("webCrypto: failed to parse/decrypt stored value", err);
      return raw;
    }
  }

  async function removeItem(key: string): Promise<void> {
    try {
      storage.removeItem(key);
    } catch (err) {
      console.warn("webCrypto: removeItem failed", err);
    }
  }

  async function clear(): Promise<void> {
    try {
      storage.clear();
    } catch (err) {
      console.warn("webCrypto: clear failed", err);
    }
  }

  return {
    getItem,
    setItem,
    removeItem,
    clear,
  };
}

export default createSecureWebStorage;
