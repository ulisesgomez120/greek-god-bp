import { useCallback, useEffect, useState } from "react";
import { Platform, Linking } from "react-native";
import * as Notifications from "expo-notifications";
import { requestPermission as requestPermissionService } from "../services/notification.service";
import { logger } from "../utils/logger";

type PermissionStatus = "granted" | "denied" | "default";

export interface UseNotificationPermissionsResult {
  permission: PermissionStatus;
  asking: boolean;
  error?: Error | null;
  askForPermission: () => Promise<boolean>;
  openSettings: () => Promise<boolean>;
}

/**
 * Hook to expose notification permission state and helpers for requesting/opening settings.
 *
 * - Reads current permission on mount.
 * - Exposes askForPermission() which delegates to the centralized notification service.
 * - Exposes openSettings() to open native app settings where possible (Linking.openSettings()).
 *
 * Note: On web the only reliable source of truth is `Notification.permission`.
 */
export default function useNotificationPermissions(): UseNotificationPermissionsResult {
  const [permission, setPermission] = useState<PermissionStatus>("default");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const readCurrentPermission = useCallback(async () => {
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && "Notification" in window) {
          const p = Notification.permission as PermissionStatus;
          setPermission(p);
        } else {
          setPermission("denied");
        }
      } else {
        // Native platforms: use expo-notifications to query permission state
        const status = await Notifications.getPermissionsAsync();
        // status object shape can vary; prefer boolean granted when present
        if ((status as any).granted) {
          setPermission("granted");
        } else if ((status as any).status) {
          // map common expo statuses to our PermissionStatus
          const s = (status as any).status as string;
          if (s === "undetermined" || s === "prompt") {
            setPermission("default");
          } else {
            setPermission("denied");
          }
        } else {
          setPermission("denied");
        }
      }
    } catch (err: any) {
      logger.error("useNotificationPermissions: failed to read permission", err, "notifications");
      setError(err);
      setPermission("denied");
    }
  }, []);

  useEffect(() => {
    void readCurrentPermission();
  }, [readCurrentPermission]);

  const askForPermission = useCallback(async (): Promise<boolean> => {
    setAsking(true);
    setError(null);
    try {
      const granted = await requestPermissionService();
      // requestPermissionService already normalizes for web/native (returns boolean)
      if (granted) {
        setPermission("granted");
      } else {
        // On web, reflect the actual Notification.permission value if available
        if (Platform.OS === "web" && typeof window !== "undefined" && "Notification" in window) {
          setPermission(Notification.permission as PermissionStatus);
        } else {
          setPermission("denied");
        }
      }
      return granted;
    } catch (err: any) {
      logger.error("useNotificationPermissions: askForPermission failed", err, "notifications");
      setError(err);
      setPermission("denied");
      return false;
    } finally {
      setAsking(false);
    }
  }, []);

  /**
   * Attempts to open OS/app notification settings.
   * - On native: uses Linking.openSettings()
   * - On web: not reliably possible; returns false. Consumers should surface instructions to users.
   */
  const openSettings = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS === "web") {
        // Opening browser notification settings is not reliably supported programmatically.
        // Some browsers have internal chrome:// URLs but they are not cross-browser and often blocked.
        logger.info(
          "openSettings: not supported on web — instruct user to open browser settings",
          undefined,
          "notifications"
        );
        return false;
      } else {
        const opened = await Linking.openSettings();
        return Boolean(opened);
      }
    } catch (err: any) {
      logger.error("useNotificationPermissions: openSettings failed", err, "notifications");
      setError(err);
      return false;
    }
  }, []);

  return {
    permission,
    asking,
    error,
    askForPermission,
    openSettings,
  };
}
