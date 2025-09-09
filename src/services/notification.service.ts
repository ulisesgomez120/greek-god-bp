// Notification service using expo-notifications with a web/service-worker-aware fallback.
// Provides simple API: init, requestPermission, schedule, cancel, presentImmediate.
// Designed to be best-effort on web (PWA) and use expo-notifications on native.

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { logger } from "../utils/logger";

type PermissionStatus = "granted" | "denied" | "default";

let swRegistration: ServiceWorkerRegistration | null = null;
let initialized = false;

export interface NotificationScheduleResult {
  id?: string;
  error?: any;
}

/**
 * Initialize notification service.
 * - Registers service worker (web)
 * - Optionally requests permission on init
 */
export async function initNotificationService(options: { requestPermissionOnInit?: boolean } = {}) {
  if (initialized) return;
  initialized = true;

  try {
    if (Platform.OS === "web") {
      if ("serviceWorker" in navigator) {
        try {
          // Attempt to register the project's service worker (best-effort)
          swRegistration = await navigator.serviceWorker.register("/service-worker.js");
          logger.info("Notification service: service worker registered", undefined, "notifications");
        } catch (err) {
          logger.warn("Notification service: service worker registration failed", err, "notifications");
          swRegistration = null;
        }
      }
      if (options.requestPermissionOnInit) {
        await requestPermission();
      }
    } else {
      // For native platforms, we can optionally request permissions via expo-notifications
      if (options.requestPermissionOnInit) {
        await requestPermission();
      }
    }
  } catch (err) {
    logger.error("Notification service init failed", err, "notifications");
  }
}

/**
 * Request notification permission.
 * Returns true if granted.
 */
export async function requestPermission(): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      if (!("Notification" in window)) {
        logger.info("Notifications unsupported in this browser", undefined, "notifications");
        return false;
      }
      const permission = await Notification.requestPermission();
      logger.info("Notification permission result", { permission }, "notifications");
      return permission === "granted";
    } else {
      const settings = await Notifications.getPermissionsAsync();
      if (settings.granted) return true;
      const requested = await Notifications.requestPermissionsAsync();
      return !!requested.granted;
    }
  } catch (err) {
    logger.error("requestPermission failed", err, "notifications");
    return false;
  }
}

/**
 * Present an immediate notification (foreground).
 * On web this uses the ServiceWorkerRegistration.showNotification if available,
 * otherwise falls back to the Notification constructor.
 */
export async function presentImmediateNotification(title: string, body?: string) {
  try {
    if (Platform.OS === "web") {
      const payload = { body };
      if (swRegistration && swRegistration.showNotification) {
        try {
          await swRegistration.showNotification(title, payload as NotificationOptions);
          return;
        } catch (err) {
          logger.warn("SW showNotification failed, falling back", err, "notifications");
        }
      }
      // Fallback
      new Notification(title, { body });
    } else {
      await Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: null,
      });
    }
  } catch (err) {
    logger.error("presentImmediateNotification error", err, "notifications");
  }
}

/**
 * Schedule a notification to fire after `seconds` seconds.
 * Returns the scheduled id (expo id on native) or a wrapper id on web.
 */
export async function scheduleNotificationAfterSeconds(
  seconds: number,
  title: string,
  body?: string
): Promise<NotificationScheduleResult> {
  try {
    if (Platform.OS === "web") {
      // Try expo-notifications web scheduling which uses service worker under the hood if configured.
      try {
        // expo-notifications exposes scheduleNotificationAsync on web; use it where available.
        // This call may internally register a background task/service worker presentation.
        const id = await Notifications.scheduleNotificationAsync({
          content: { title, body },
          trigger: { seconds },
        } as any);
        return { id };
      } catch (expoErr) {
        logger.warn(
          "expo-notifications schedule failed on web, falling back to setTimeout + SW/Notification",
          expoErr,
          "notifications"
        );
      }

      // Fallback: schedule in-page setTimeout to use SW or Notification API.
      const show = async () => {
        if (swRegistration && swRegistration.showNotification) {
          try {
            await swRegistration.showNotification(title, { body });
            return;
          } catch (err) {
            logger.warn("SW showNotification fallback failed", err, "notifications");
          }
        }
        try {
          new Notification(title, { body });
        } catch (err) {
          logger.error("Notification() constructor failed", err, "notifications");
        }
      };

      const timeoutId = window.setTimeout(show, seconds * 1000);
      // Return a cancel function encoded as id (string)
      return { id: `web-timeout-${timeoutId}` };
    } else {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: { seconds },
      } as any);
      return { id };
    }
  } catch (err) {
    logger.error("Failed to schedule notification", err, "notifications");
    return { error: err };
  }
}

/**
 * Cancel a scheduled notification.
 * Accepts ids returned by scheduleNotificationAfterSeconds.
 */
export async function cancelScheduledNotification(id?: string) {
  try {
    if (!id) return;
    if (Platform.OS === "web") {
      if (id.startsWith("web-timeout-")) {
        const parts = id.split("-");
        const timeoutId = Number(parts[2]);
        if (!Number.isNaN(timeoutId)) {
          window.clearTimeout(timeoutId);
        }
        return;
      }
      // If id is a numeric/uuid-like value created by expo-notifications web scheduling,
      // there is a cancel function in expo-notifications we can attempt to call.
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch (err) {
        logger.warn("Failed to cancel expo scheduled notification on web", err, "notifications");
      }
    } else {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
  } catch (err) {
    logger.error("cancelScheduledNotification failed", err, "notifications");
  }
}

export default {
  initNotificationService,
  requestPermission,
  scheduleNotificationAfterSeconds,
  cancelScheduledNotification,
  presentImmediateNotification,
};
