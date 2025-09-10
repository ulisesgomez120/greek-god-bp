import React, { useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import useNotificationPermissions from "../../hooks/useNotificationPermissions";
import { logger } from "../../utils/logger";
import useTheme from "@/hooks/useTheme";

export default function NotificationPermissionCTA() {
  const { permission, askForPermission, openSettings, asking } = useNotificationPermissions();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const handleRequest = useCallback(async () => {
    try {
      await askForPermission();
    } catch (err) {
      logger.error("NotificationPermissionCTA: askForPermission failed", err, "notifications");
    }
  }, [askForPermission]);

  const handleOpenSettings = useCallback(async () => {
    try {
      await openSettings();
    } catch (err) {
      logger.error("NotificationPermissionCTA: openSettings failed", err, "notifications");
    }
  }, [openSettings]);

  // Only render when not granted
  if (permission === "granted") return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enable notifications to receive timer alerts</Text>
      <View style={styles.actions}>
        {permission === "default" ? (
          <TouchableOpacity style={styles.button} onPress={handleRequest} disabled={asking}>
            <Text style={styles.buttonText}>{asking ? "Requesting..." : "Allow Notifications"}</Text>
          </TouchableOpacity>
        ) : (
          // denied
          <TouchableOpacity style={styles.button} onPress={handleOpenSettings}>
            <Text style={styles.buttonText}>Open Settings</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      marginTop: 8,
      padding: 10,
      borderRadius: 8,
      backgroundColor: colors.surfaceVariant || "#222",
    },
    title: {
      color: colors.text,
      fontSize: 13,
      marginBottom: 8,
    },
    actions: {
      flexDirection: "row",
      gap: 8,
    },
    button: {
      backgroundColor: colors.primary,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
    },
    buttonText: {
      color: colors.buttonTextOnPrimary || colors.surface,
      fontWeight: "600",
      fontSize: 13,
    },
  });
