/**
 * src/lib/pwaUtils.ts
 *
 * Small helpers for PWA behaviors:
 *  - listenForBeforeInstallPrompt: captures the beforeinstallprompt event so the app can show a custom A2HS UI
 *  - onServiceWorkerMessage: attach a handler for messages from the service worker
 *  - skipWaiting: request the waiting SW to skipWaiting (activate immediately)
 *
 * These functions are guarded so they are safe to call in SSR/build-time contexts.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function listenForBeforeInstallPrompt(cb: (e: BeforeInstallPromptEvent) => void) {
  if (typeof window === "undefined") return () => {};
  function handler(e: Event) {
    // Cast to BeforeInstallPromptEvent; some browsers may not implement prompt() but event still fires
    try {
      const evt = e as BeforeInstallPromptEvent;
      e.preventDefault(); // Prevent automatic prompting
      cb(evt);
    } catch (err) {
      // ignore
      console.warn("listenForBeforeInstallPrompt: unexpected event", err);
    }
  }
  window.addEventListener("beforeinstallprompt", handler as EventListener);
  return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
}

export function onServiceWorkerMessage(cb: (data: any, event: MessageEvent) => void) {
  if (typeof navigator === "undefined" || typeof navigator.serviceWorker === "undefined") return () => {};
  function handler(event: MessageEvent) {
    try {
      cb(event.data, event);
    } catch (err) {
      console.warn("onServiceWorkerMessage handler error", err);
    }
  }
  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}

/**
 * Tell the waiting service worker to skipWaiting (activate immediately).
 * If registration is not provided, attempt to find any registration with a waiting worker.
 */
export async function skipWaiting(registration?: ServiceWorkerRegistration | null) {
  if (typeof navigator === "undefined" || typeof navigator.serviceWorker === "undefined") return false;
  try {
    const reg = registration || (await navigator.serviceWorker.getRegistration());
    if (!reg) return false;
    const waiting = reg.waiting;
    if (!waiting) {
      // if there's no waiting worker, nothing to do
      return false;
    }
    waiting.postMessage("SKIP_WAITING");
    return true;
  } catch (err) {
    console.warn("skipWaiting failed:", err);
    return false;
  }
}

/**
 * Helper to get the active service worker registration (if any).
 */
export async function getSWRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || typeof navigator.serviceWorker === "undefined") return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg || null;
  } catch (err) {
    console.warn("getSWRegistration failed:", err);
    return null;
  }
}
