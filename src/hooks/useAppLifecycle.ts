import { useEffect, useRef } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import tokenManager from "@/utils/tokenManager";
import { logger } from "@/utils/logger";

/**
 * Centralized app lifecycle hook.
 *
 * - Notifies TokenManager of app foreground/background transitions via tokenManager.handleAppStateChange.
 * - Debounces repeated identical state changes within DEBOUNCE_MS to avoid redundant refresh attempts.
 * - Idempotent-global: if the hook is mounted multiple times it will only register listeners once.
 *
 * Usage: import and call useAppLifecycle() once during app bootstrap (e.g., in App.tsx).
 */

const DEBOUNCE_MS = 1000;

let isRegisteredGlobally = false;

export default function useAppLifecycle(): void {
  const lastStateRef = useRef<{ state: "active" | "background" | "inactive" | null; at: number }>({
    state: null,
    at: 0,
  });

  useEffect(() => {
    if (isRegisteredGlobally) {
      logger.debug(
        "useAppLifecycle: already registered globally, skipping duplicate registration",
        undefined,
        "lifecycle"
      );
      return;
    }
    isRegisteredGlobally = true;

    const handleState = async (newState: "active" | "background" | "inactive") => {
      try {
        const now = Date.now();
        const last = lastStateRef.current;
        if (last.state === newState && now - last.at < DEBOUNCE_MS) {
          logger.debug("useAppLifecycle: Ignoring duplicate state change", { state: newState }, "lifecycle");
          return;
        }
        lastStateRef.current = { state: newState, at: now };

        logger.debug("useAppLifecycle: Reporting app state change to TokenManager", { state: newState }, "lifecycle");
        // Fire-and-forget; TokenManager handles its own errors and logging.
        void tokenManager.handleAppStateChange(newState);

        // When app becomes active, also process any queued refresh attempts so
        // offline/temporary failures are retried promptly on foreground.
        if (newState === "active" && typeof tokenManager.processQueuedRefreshs === "function") {
          // Fire-and-forget; tokenManager will handle errors internally but log them.
          void tokenManager.processQueuedRefreshs();
        }
      } catch (err) {
        logger.warn("useAppLifecycle: Failed to handle app state change", err, "lifecycle");
      }
    };

    // -------- React Native (native & web builds that still support AppState) --------
    let removeAppStateListener: (() => void) | null = null;
    try {
      // AppState.addEventListener returns different shapes depending on RN version.
      // Use the supported API and guard for older RN where it's still available.
      const sub = AppState.addEventListener?.("change", (status: AppStateStatus) => {
        const mapped = status === "active" ? "active" : status === "background" ? "background" : "inactive";
        void handleState(mapped);
      });

      if (sub && typeof sub.remove === "function") {
        removeAppStateListener = () => {
          try {
            sub.remove();
          } catch {}
        };
      } else if (typeof sub === "function") {
        // older RN: addEventListener returns unsubscribe fn
        removeAppStateListener = sub as () => void;
      } else {
        // Fallback: use AppState.addEventListener legacy (older RN versions)
        // (No-op if not supported)
        removeAppStateListener = null;
      }
    } catch (err) {
      logger.warn("useAppLifecycle: Failed to register AppState listener", err, "lifecycle");
    }

    // -------- Web document.visibilitychange fallback --------
    let removeVisibilityListener: (() => void) | null = null;
    try {
      const isWeb = Platform.OS === "web" || typeof document !== "undefined";
      if (isWeb && typeof document !== "undefined" && typeof document.addEventListener === "function") {
        const onVisibility = () => {
          try {
            const vis = document.visibilityState;
            const mapped = vis === "visible" ? "active" : "background";
            void handleState(mapped);
          } catch (err) {
            logger.warn("useAppLifecycle: visibilitychange handler failed", err, "lifecycle");
          }
        };

        document.addEventListener("visibilitychange", onVisibility, false);
        removeVisibilityListener = () => {
          try {
            document.removeEventListener("visibilitychange", onVisibility, false);
          } catch {}
        };

        // Trigger initial visibility state so TokenManager can react on first mount if needed.
        try {
          const initial = document.visibilityState;
          const mapped = initial === "visible" ? "active" : "background";
          void handleState(mapped);
        } catch {}
      }
    } catch (err) {
      logger.warn("useAppLifecycle: Failed to register visibilitychange listener", err, "lifecycle");
    }

    logger.debug("useAppLifecycle: lifecycle listeners registered", undefined, "lifecycle");

    return () => {
      // Cleanup: remove listeners and allow re-registration if the hook unmounts app-wide.
      try {
        if (removeAppStateListener) removeAppStateListener();
      } catch {}

      try {
        if (removeVisibilityListener) removeVisibilityListener();
      } catch {}

      isRegisteredGlobally = false;
      logger.debug("useAppLifecycle: lifecycle listeners unregistered", undefined, "lifecycle");
    };
    // Intentionally run only once on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
