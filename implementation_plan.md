# Implementation Plan

[Overview]
Transform the Expo React Native / Web app into a proper Progressive Web App (PWA) with a web-safe secure storage fallback for sensitive data, service worker-based offline support, proper manifest & icons, and web-compatible animation/navigation behavior to provide an app-like installable experience and fix the current auth and install problems observed on Netlify.

This work will add the missing PWA assets (manifest, icons, service worker), register the service worker and implement robust caching strategies, implement an encrypted web storage adapter that uses the Web Crypto API for storing sensitive tokens on web, refactor Supabase initialization to use a platform-aware storage adapter, and add small runtime and build config changes to ensure the web build exposes the PWA assets correctly. The changes will preserve existing native behavior (SecureStore / AsyncStorage) and only apply secure web crypto storage on web platforms. This approach avoids weakening security on mobile, fixes the SecureStore errors in the console when running on web, restores navigation to the Register screen, and ensures add-to-home-screen results in an app-like standalone display with proper icons and splash.

[Types]  
Introduce a small set of PWA + secure-web-storage types and storage interfaces.

Detailed type definitions:

- src/types/pwa.d.ts (new)

  - export interface PWAManifest {
    name: string;
    short_name: string;
    description?: string;
    start_url: string;
    scope?: string;
    display: "standalone" | "fullscreen" | "minimal-ui" | "browser";
    background_color: string;
    theme_color: string;
    lang?: string;
    icons: PWAIcon[];
    }
  - export interface PWAIcon {
    src: string;
    sizes: string; // e.g., "192x192"
    type: string; // "image/png"
    purpose?: string; // "any maskable"
    }

- src/types/storage.d.ts (new or appended)
  - export interface SecureWebStorage {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    }
  - export interface StorageAdapterShape {
    secure: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    };
    async: {
    getItem<T = any>(key: string): Promise<T | null>;
    setItem(key: string, value: any): Promise<void>;
    removeItem(key: string): Promise<void>;
    listKeys(): Promise<string[]>;
    };
    }

Validation rules and relationships:

- SecureWebStorage implementations must return string or null for getItem.
- The web SecureWebStorage must encrypt values before storing in localStorage/sessionStorage and decrypt on get.
- Keys used by web encryption must be rotated after sign-out and must not be persisted unencrypted.

[Files]  
Create PWA files and modify storage / supabase initialization files to use platform-aware secure storage.

New files to be created (full paths and purpose):

- public/manifest.json
  - Purpose: PWA manifest used by browsers for A2HS metadata. Contains app name, start_url, display: standalone, theme/background colors and a set of icons.
- public/service-worker.js
  - Purpose: Lightweight service worker that precaches application shell (index.html, JS bundles, manifest, icons), implements runtime caching for API requests, and provides update/skipWaiting/clients.claim flow.
- public/icons/icon-48.png
- public/icons/icon-72.png
- public/icons/icon-96.png
- public/icons/icon-144.png
- public/icons/icon-192.png
- public/icons/icon-256.png
- public/icons/icon-384.png
- public/icons/icon-512.png
- public/icons/maskable-icon-192.png
- public/icons/maskable-icon-512.png
  - Purpose: PWA icon variants used by manifest. If you prefer we can provide a small script to generate PNGs from assets/icon.svg, but creating them manually or via an image tool is acceptable.
- src/lib/webCrypto.ts
  - Purpose: Web Crypto API helper that exposes createSecureWebStorage() producing an object implementing SecureWebStorage. Handles encryption/decryption (AES-GCM) and key derivation using a per-session derived key.
- src/lib/pwaUtils.ts
  - Purpose: Service worker registration utilities and helper to prompt for installation and detect updates (registerServiceWorker, listenForSWUpdate).
- src/hooks/usePWA.ts
  - Purpose: Hook that exposes installability, listens for beforeinstallprompt, and reports update availability to UI.
- scripts/generate-pwa-icons.sh (optional)
  - Purpose: A small helper script describing how to generate required icons from SVG using an external tool (imagemagick or your preferred image tool); included as reference only (no new npm deps).
- src/types/pwa.d.ts (new) — types as above.
- **tests**/pwa/manifest.test.ts (new)
- **tests**/storage/webCrypto.test.ts (new)
- **tests**/pwa/serviceWorker.test.ts (new) (high-level, can be limited to unit tests for utils and mocks)

Existing files to be modified (with specific changes):

- src/lib/storageAdapter.ts

  - Add import for createSecureWebStorage from src/lib/webCrypto.
  - Modify StorageAdapter.secure.\* to:
    - When isWeb() is true, prefer using the WebCrypto-based SecureWebStorage; fallback to sessionStorage only if Web Crypto or the secure storage instance cannot be initialized.
    - Keep behavior on native unchanged (expo-secure-store).
  - Add a note and exported helper to explicitly clear web crypto keys on signOut.

- src/lib/supabase.ts

  - Replace the direct SecureStoreAdapter object with a platform-aware adapter:
    - On native: use SecureStoreAdapter (unchanged).
    - On web: use the StorageAdapter.secure variant (web crypto wrapper) or, if using Supabase web JS 2.x, consider using the default local persistence but ensure encryption before passing tokens into persistence.
  - Ensure createClient() receives storage adapter compatible with supabase-js (an object with getItem/setItem/removeItem). Use ENV_CONFIG detection if necessary.

- index.web.js (or src/index.web.tsx / index.ts if web entry exists)

  - Register service worker by importing src/lib/pwaUtils.registerServiceWorker() at top-level when typeof window !== 'undefined' and process.env.NODE_ENV === 'production'.

- app.config.ts

  - No major changes required, but add a "web" manifest path if necessary and ensure "web.lang" and "web.favicon" are correct. (We'll add manifest.json to public so no programmatic change required, but include the step to verify EAS/Expo outputs manifest into the build, and ensure bundler=metro remains.)

- public/\_redirects
  - Confirm it already contains "/\* /index.html 200" (it does). Add a header to ensure manifest and service-worker served with no-cache (netlify.toml already has headers for service-worker.js and manifest.json). Confirm Netlify publish folder includes these files (dist/public?). Instruct updating netlify.toml if build publishes elsewhere.

Files to be deleted or moved:

- None required. Keep existing assets (assets/icon.svg and assets/adaptive-icon.png) as source images for icon generation.

Configuration file updates:

- netlify.toml (verify publish dir contains the created public/manifest.json and public/service-worker.js). No automatic changes are necessary if build outputs public/ to dist/ as-is; if not, add post-build script to copy public files into dist/ before Netlify publishes.
- package.json
  - Optional: Add a script "pwa:icons" that lists required icon generation steps (not required to add external dependencies).
- app.config.ts
  - Ensure web bundler is metro (already set) and that runtime output: "single" is correct for single-page deployment.

[Functions]  
Add Web Crypto & PWA registration functions and modify the storage functions used by supabase.

Single sentence describing function modifications: Add createSecureWebStorage, registerServiceWorker, and hooks to detect/install PWA; modify StorageAdapter.secure functions and Supabase SecureStoreAdapter to use web-secure storage on web.

Detailed breakdown:

New functions:

- src/lib/webCrypto.ts

  - export async function initializeWebCryptoKey(sessionSalt?: string): Promise<CryptoKey>
    - Purpose: Derive or import an AES-GCM key from a session-specific salt (use subtle.importKey / subtle.deriveKey with PBKDF2 or HKDF).
  - export async function encryptString(key: CryptoKey, plaintext: string): Promise<string>
    - Purpose: AES-GCM encrypt and return base64/URL-safe string including IV.
  - export async function decryptString(key: CryptoKey, cipher: string): Promise<string>
    - Purpose: Decrypt AES-GCM ciphertext produced by encryptString.
  - export function createSecureWebStorage(): Promise<SecureWebStorage>
    - Purpose: Returns an object with getItem/setItem/removeItem that encrypts values with a per-session key, stores ciphertext in localStorage under a prefixed key, and removes/cleans keys on signOut.

- src/lib/pwaUtils.ts

  - export function registerServiceWorker(): Promise<void>
    - Purpose: Registers public/service-worker.js in production, listens for updatefound and posts messages to window for update handling.
  - export function listenForBeforeInstallPrompt(callback: (evt: Event) => void): () => void
    - Purpose: Hook into beforeinstallprompt to allow custom install prompt flow.

- src/hooks/usePWA.ts
  - export default function usePWA(): { isInstallable: boolean; promptInstall: () => void; updateAvailable: boolean; reloadForUpdate: () => void; }
    - Purpose: React hook that manages installability state and exposes prompt and update actions.

Modified functions:

- StorageAdapter.secure.getItem/setItem/removeItem (src/lib/storageAdapter.ts)

  - When isWeb() is true, call createSecureWebStorage() once and then use its getItem/setItem/removeItem to perform encrypted storage. If createSecureWebStorage() fails, fall back to sessionStorage with a console.warn.

- Supabase SecureStoreAdapter (src/lib/supabase.ts)
  - Replace direct usage of expo-secure-store on web with a call to StorageAdapter.secure.\* so Supabase always sees a compliant storage object. Example:
    - const storage = isWeb() ? { getItem: StorageAdapter.secure.getItem, setItem: StorageAdapter.secure.setItem, removeItem: StorageAdapter.secure.removeItem } : SecureStoreAdapter;
  - Keep Supabase auth options otherwise unchanged (autoRefreshToken, persistSession: true).

Removed functions:

- None removed, existing APIs remain but are adapted for web compatibility.

[Classes]  
Single sentence: No major class additions; provide a small ServiceWorkerManager utility object and ensure StorageAdapter remains a plain object.

Detailed breakdown:

New classes/objects:

- src/lib/ServiceWorkerManager (object in pwaUtils.ts)
  - Key methods:
    - init(): registers SW and listens for update
    - onUpdate(callback): subscribes to update events
    - skipWaitingAndReload(): posts skipWaiting to SW then reloads clients
  - Inheritance: none — plain module-level manager.

Modified classes:

- StorageAdapter (src/lib/storageAdapter.ts)
  - Add an initialization state for web secure storage and a method to clear crypto keys when user signs out.

Removed classes:

- None.

[Dependencies]  
Single sentence: No new runtime dependencies required; the implementation uses standard browser APIs (Web Crypto, Service Workers, Cache API) and existing project packages.

Details:

- No new npm packages required. Implementation uses:
  - Web Crypto API (window.crypto.subtle) for encryption (supported by modern browsers).
  - Cache API + Service Workers (supported by modern browsers).
- Optional: If you want automated icon generation, you can install an external tool (ImageMagick or sharp). Recommended command-line approach instead of adding sharp to project dependencies to avoid native build issues:
  - Example: Use Inkscape/Imagemagick or an online generator to produce PNG sizes, or run a local script using Node + sharp if dev environment supports it.

[Testing]  
Single sentence: Add unit tests for web crypto storage, manifest validity, and service worker registration flows; test manual install and navigation flows in browser.

Test file requirements and validation strategies:

- **tests**/storage/webCrypto.test.ts
  - Tests: encrypt/decrypt roundtrip, set/get/remove using createSecureWebStorage, fallback behavior when Web Crypto not available (mock window.crypto.subtle).
- **tests**/pwa/manifest.test.ts
  - Tests: ensure public/manifest.json exists, contains required fields (name, short_name, display: standalone, start_url, icons array with required sizes).
- **tests**/pwa/serviceWorker.test.ts
  - Tests: registerServiceWorker registers SW in production environment (mock navigator.serviceWorker) and emits update events.
- Manual E2E checklist:
  - Build a production web bundle (npm run build:web), deploy to Netlify (or local static server).
  - Confirm visiting site on Chrome/Edge/Firefox on desktop & mobile: Install prompt appears or use "Add to Home screen".
  - Confirm installed app launches in standalone mode with no address bar and that icons show up.
  - Sign in/out flows: ensure no console errors about SecureStore when on web, and tokens exist encrypted in localStorage.
  - Navigation: verify Login -> Register navigation works (clicking secondary action in LoginScreen should navigate to Register).
  - Offline behavior: load app offline after initial load and verify cached shell loads and critical pages render.

[Implementation Order]  
Single sentence: Implement secure web storage first, refactor storage adapters and supabase to use it, then add PWA manifest/icons and service worker, register SW in web entry, add install/update utilities and tests, and finally fix animations/navigation details and run full validation.

Numbered steps:

1. Implement src/lib/webCrypto.ts (createSecureWebStorage) and unit tests for encryption roundtrip.
2. Add types file src/types/pwa.d.ts and src/types/storage.d.ts and update tsconfig includes if required.
3. Update src/lib/storageAdapter.ts:
   - Import createSecureWebStorage.
   - Wire StorageAdapter.secure to use web crypto on web, fallback to sessionStorage.
   - Export a clearWebCryptoKeys helper.
4. Update src/lib/supabase.ts:
   - Detect isWeb() (small helper or reuse StorageAdapter.isWeb detection).
   - Use StorageAdapter.secure for the Supabase auth storage option on web.
5. Create public/manifest.json and required public/icons/\* files (create or generate).
   - Required manifest fields: name, short_name, start_url: "/", display: "standalone", background_color, theme_color, icons array including maskable icons.
6. Add public/service-worker.js:
   - Precaching of index.html, main JS bundle(s), manifest.json, icons.
   - Runtime caching strategy for API requests (stale-while-revalidate) and navigation fallback.
   - PostMessage handling for skipWaiting and broadcasting update.
7. Modify index.web.js (or web entry) to import and call registerServiceWorker() in production.
8. Create src/lib/pwaUtils.ts and src/hooks/usePWA.ts to surface install/update prompts to UI.
9. Generate icons from assets/icon.svg / adaptive-icon.png (manual or scripted) and place under public/icons/.
10. Adjust netlify.toml/publish settings if necessary and ensure public/manifest.json & service-worker.js are copied into the build output directory (dist) before publish (add post-build copy step if needed).
11. Address useNativeDriver warnings:
    - Add Platform.OS === "web" conditional to animation calls that use useNativeDriver: true and provide JS fallback options (or set useNativeDriver: false on web).
    - Update components spotted earlier (src/components/ui/SplashScreen.tsx, src/components/ui/SkeletonLoader.tsx).
12. Add tests and run unit tests, then perform manual E2E validation on desktop + mobile browsers and Netlify preview.
13. Clean up: add docs in context/pwa/README.md explaining how web secure storage works, how to regenerate icons, and how to update the service worker cache list.

Notes and rationale:

- Using Web Crypto API with AES-GCM and storing ciphertext in localStorage provides stronger protection than plaintext storage while avoiding new heavy runtime dependencies.
- Supabase expects a storage shape (getItem/setItem/removeItem). By providing that shape backed by encrypted localStorage, we avoid changing supabase-js behavior and remove the runtime SecureStore errors on web.
- The service worker and manifest must live in the published static root so ensure Netlify publish includes the files (dist/public or dist root depending on your build). If the expo export output doesn't include public by default, add a post-build step to copy public/manifest.json and service-worker.js to the dist folder used by Netlify.
- For icon generation, provide a short list of sizes and filenames so you (or a script) can create them: 48,72,96,144,192,256,384,512. Include maskable 192 & 512 for modern Android.

End of implementation plan.
