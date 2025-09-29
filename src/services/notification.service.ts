// Notification service using expo-notifications with a web/service-worker-aware fallback.
// Provides simple API: init, requestPermission, schedule, cancel, presentImmediate.
// Designed to be best-effort on web (PWA) and use expo-notifications on native.

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { logger } from "../utils/logger";

type PermissionStatus = "granted" | "denied" | "default";

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
    // Ensure notifications are shown when app is foregrounded and play sound where supported.
    if (Platform.OS !== "web") {
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
      } catch (err) {
        // Non-fatal: log and continue
        logger.warn("Failed to set notification handler", err, "notifications");
      }
    }

    // Only request permissions automatically on native platforms.
    if (options.requestPermissionOnInit && Platform.OS !== "web") {
      await requestPermission();
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
      try {
        // Use the simple Notification constructor on web (no service worker shortcut).
        new Notification(title, { body });
      } catch (err) {
        logger.error("presentImmediateNotification error (web)", err, "notifications");
      }
    } else {
      try {
        // Ensure we include a sound for native platforms where applicable
        const safeBody = typeof body === "string" && body.length > 0 ? body : title;
        await Notifications.scheduleNotificationAsync({
          content: { title, body: safeBody, sound: "default" },
          trigger: null,
        });
      } catch (err) {
        logger.error("presentImmediateNotification error (native)", err, "notifications");
      }
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
  logger.info("scheduleNotificationAfterSeconds called", { seconds, title, body }, "notifications");
  try {
    if (Platform.OS === "web") {
      // Simple in-page scheduling for web PWAs: use setTimeout + Notification constructor.
      const show = () => {
        try {
          new Notification(title, { body });
        } catch (err) {
          logger.error("Notification() constructor failed (web)", err, "notifications");
        }
      };

      const timeoutId = window.setTimeout(show, seconds * 1000);
      logger.info("Scheduled web timeout notification", { timeoutId }, "notifications");
      return { id: `web-timeout-${timeoutId}` };
    } else {
      try {
        // Ensure body is a string (iOS native may reject null/undefined)
        const safeBody = typeof body === "string" && body.length > 0 ? body : title;
        const id = await Notifications.scheduleNotificationAsync({
          content: { title, body: safeBody, sound: "default" },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
        } as any);
        logger.info("Scheduled native notification", { id, seconds, title, body: safeBody }, "notifications");
        return { id };
      } catch (err) {
        logger.error("scheduleNotificationAfterSeconds: native schedule failed", err, "notifications");
        return { error: err };
      }
    }
  } catch (err) {
    logger.error("Failed to schedule notification (unexpected)", err, "notifications");
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
      // For other ids on web, attempt to cancel via expo API if available
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
