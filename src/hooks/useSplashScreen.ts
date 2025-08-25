import { useCallback, useEffect, useRef, useState } from "react";
import type { SplashScreenConfig, SplashScreenState } from "@/types/theme";

/**
 * useSplashScreen
 * Ensures the splash screen is shown for at least `minimumDisplayTimeMs`.
 *
 * Usage:
 * const { state, show, hide } = useSplashScreen({ minimumDisplayTimeMs: 2000 });
 * show()         // mark splash as visible / starting
 * hide()         // hide, but will wait until minimum time elapsed
 *
 * The hook purposefully provides a small API so callers (App, PersistGate, etc.)
 * can coordinate app initialization with a deterministic splash display time.
 */

const DEFAULT_CONFIG: SplashScreenConfig = {
  minimumDisplayTimeMs: 2000,
  showProgressIndicator: true,
};

export function useSplashScreen(config?: Partial<SplashScreenConfig>) {
  const cfg = { ...DEFAULT_CONFIG, ...(config || {}) };
  const [state, setState] = useState<SplashScreenState>("hidden");
  const startedAtRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const manualShownRef = useRef(false);

  useEffect(() => {
    return () => {
      // cleanup pending timeouts on unmount
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        // @ts-ignore - browsers vs Node, clearTimeout accepts number
        hideTimeoutRef.current = null;
      }
    };
  }, []);

  const show = useCallback(() => {
    // If already visible, no-op
    if (state === "loading" || state === "ready") return;
    manualShownRef.current = true;
    startedAtRef.current = Date.now();
    setState("loading");
  }, [state]);

  const hide = useCallback(() => {
    // If we were never shown, just set ready/hidden immediately
    if (!manualShownRef.current && state === "hidden") {
      setState("hidden");
      return;
    }

    const started = startedAtRef.current || 0;
    const elapsed = Date.now() - started;
    const remaining = Math.max(0, cfg.minimumDisplayTimeMs - elapsed);

    // If already exceeded minimum, hide immediately (set to ready then hidden)
    if (remaining <= 0) {
      setState("ready");
      // small timeout to allow any transition; callers can interpret 'ready' as ready-to-hide
      hideTimeoutRef.current = setTimeout(() => {
        setState("hidden");
        // @ts-ignore
        hideTimeoutRef.current = null;
      }, 50) as unknown as number;
      return;
    }

    // otherwise schedule hide after remaining time
    setState("ready");
    hideTimeoutRef.current = setTimeout(() => {
      setState("hidden");
      // @ts-ignore
      hideTimeoutRef.current = null;
    }, remaining) as unknown as number;
  }, [cfg.minimumDisplayTimeMs, state]);

  const reset = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      // @ts-ignore
      hideTimeoutRef.current = null;
    }
    startedAtRef.current = null;
    manualShownRef.current = false;
    setState("hidden");
  }, []);

  return {
    state,
    config: cfg,
    show,
    hide,
    reset,
  };
}

export default useSplashScreen;
