// ============================================================================
// COMPACT REST TIMER COMPONENT
// ============================================================================
// Small, always-visible start/stop widget that launches native timers on iOS/Android
// and schedules a web notification for PWA (best-effort). Relies on native timer
// for countdown and notifications where available.
// ============================================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Platform, Linking, Alert, TouchableOpacity, ViewStyle } from "react-native";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { logger } from "../../utils/logger";
import { scheduleNotificationAfterSeconds, cancelScheduledNotification } from "../../services/notification.service";
import TextUI from "../ui/Text";
import useTheme from "@/hooks/useTheme";
import useNotificationPermissions from "@/hooks/useNotificationPermissions";
import NotificationPermissionCTA from "../ui/NotificationPermissionCTA";
import Icon from "@/components/ui/Icon";

interface CompactRestTimerProps {
  duration: number; // seconds
  onComplete?: () => void;
  onSkip?: () => void;
  style?: ViewStyle;
}

export const CompactRestTimer: React.FC<CompactRestTimerProps> = ({ duration, onComplete, onSkip, style }) => {
  const { triggerRestTimerCompleteHaptic } = useHapticFeedback();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { permission, askForPermission, openSettings } = useNotificationPermissions();

  const [nativeTimerLaunched, setNativeTimerLaunched] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const webCancelRef = useRef<null | (() => void)>(null);
  const initialDurationRef = useRef<number>(duration);

  useEffect(() => {
    // Update the displayed duration only when a native timer has NOT been launched.
    // Once the user launches a native timer we preserve the displayed duration (native-first).
    if (!nativeTimerLaunched) {
      initialDurationRef.current = duration;
      setIsStarting(false);
    }

    // clear any scheduled web notification from previous runs
    if (webCancelRef.current) {
      webCancelRef.current();
      webCancelRef.current = null;
    }
  }, [duration, nativeTimerLaunched]);

  useEffect(() => {
    return () => {
      // cleanup scheduled web notification on unmount
      if (webCancelRef.current) {
        webCancelRef.current();
        webCancelRef.current = null;
      }
    };
  }, []);

  const handleNativeLaunch = useCallback(async () => {
    setIsStarting(true);
    try {
      // iOS clock-timer scheme
      if (Platform.OS === "ios") {
        const timerUrl = `clock-timer://timer?duration=${duration}`;
        const canOpen = await Linking.canOpenURL(timerUrl);
        if (canOpen) {
          await Linking.openURL(timerUrl);
          setNativeTimerLaunched(true);
          logger.info("iOS native timer launched", { duration }, "timer");
          return;
        } else {
          const clockUrl = "clock://";
          const canOpenClock = await Linking.canOpenURL(clockUrl);
          if (canOpenClock) {
            await Linking.openURL(clockUrl);
            Alert.alert(
              "Set Timer",
              `Please set a timer for ${Math.floor(duration / 60)}m ${duration % 60}s in the Clock app.`,
              [{ text: "OK" }]
            );
            setNativeTimerLaunched(true);
            return;
          } else {
            logger.warn("Cannot open Clock app");
            Alert.alert("Timer Not Available", "Unable to open Clock app on this device or simulator.", [
              { text: "OK" },
            ]);
            return;
          }
        }
      }

      // Android timer intent
      if (Platform.OS === "android") {
        // try a direct intent for the clock timer (best-effort)
        const timerIntent = `intent://timer/${duration}#Intent;scheme=timer;package=com.android.deskclock;end`;
        const canOpen = await Linking.canOpenURL(timerIntent);
        if (canOpen) {
          await Linking.openURL(timerIntent);
          setNativeTimerLaunched(true);
          logger.info("Android native timer launched via intent", { duration }, "timer");
          return;
        } else {
          // fallback to generic timer intent or open Clock app
          const genericIntent = `intent://timer#Intent;scheme=timer;end`;
          const canOpenGeneric = await Linking.canOpenURL(genericIntent);
          if (canOpenGeneric) {
            await Linking.openURL(genericIntent);
            Alert.alert("Set Timer", `Please set a timer for ${Math.floor(duration / 60)}m ${duration % 60}s.`, [
              { text: "OK" },
            ]);
            setNativeTimerLaunched(true);
            return;
          } else {
            logger.warn("Cannot open timer app on Android");
            Alert.alert("Timer Not Available", "Unable to open timer app on this device.", [{ text: "OK" }]);
            return;
          }
        }
      }

      // Web / PWA: schedule a web notification (best-effort) using expo-notifications/service-worker-aware scheduling
      if (Platform.OS === "web") {
        try {
          // Ensure we have permission before attempting to schedule.
          if (permission !== "granted") {
            if (permission === "default") {
              // Ask for permission interactively
              const granted = await askForPermission();
              if (!granted) {
                Alert.alert(
                  "Notifications Disabled",
                  "Notifications are disabled for this app. Enable them in your browser settings to receive rest timer alerts.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Open Settings", onPress: async () => await openSettings() },
                  ]
                );
                return;
              }
            } else {
              // permission === "denied"
              Alert.alert(
                "Notifications Blocked",
                "Notifications are blocked for this app. Open your browser or device settings to enable notifications.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Open Settings", onPress: async () => await openSettings() },
                ]
              );
              return;
            }
          }

          const result = await scheduleNotificationAfterSeconds(duration, "Rest Complete", undefined);
          if (result && result.id) {
            // store cancel function in ref so it can be cleared later
            const scheduledId = result.id;
            webCancelRef.current = () => {
              // cancelScheduledNotification can be async; call it but don't await in cleanup paths
              (async () => {
                try {
                  await cancelScheduledNotification(scheduledId);
                } catch (e) {
                  // ignore
                }
              })();
              webCancelRef.current = null;
            };
            setNativeTimerLaunched(true);
            logger.info("Web notification scheduled for rest timer", { duration }, "timer");
          } else {
            // scheduling failed or returned no id — surface a warning to the user
            logger.warn("Web notification scheduling returned no id", undefined, "timer");
            Alert.alert("Notification Error", "Unable to schedule a notification for the rest timer on this device.", [
              { text: "OK" },
            ]);
          }
        } catch (err) {
          logger.error("Failed to schedule web notification via notification service", err, "timer");
          Alert.alert("Notification Error", "An error occurred while scheduling the rest timer notification.", [
            { text: "OK" },
          ]);
        }
        return;
      }

      // Unknown platform
      throw new Error("Unsupported platform for native timer");
    } catch (error) {
      logger.error("Failed to launch native timer", error, "timer");
      Alert.alert(
        "Timer Not Available",
        "Unable to open native timer. If you are on the web, make sure notifications are enabled for this site.",
        [{ text: "OK" }]
      );
    } finally {
      setIsStarting(false);
      // trigger haptic regardless (best-effort)
      try {
        triggerRestTimerCompleteHaptic();
      } catch (_) {
        // ignore
      }
    }
  }, [duration, triggerRestTimerCompleteHaptic]);

  const handleStart = useCallback(() => {
    handleNativeLaunch();
  }, [handleNativeLaunch]);

  const formatMinutes = (seconds: number) => {
    const mins = Math.round(seconds / 60);
    return `${mins}m`;
  };

  const handleManualComplete = useCallback(async () => {
    try {
      await triggerRestTimerCompleteHaptic();
    } catch (_) {}
    setNativeTimerLaunched(false);
    if (onComplete) onComplete();
  }, [onComplete, triggerRestTimerCompleteHaptic]);

  return (
    <View style={[styles.container, style]}>
      <TextUI variant='bodySmall' color='secondary' style={styles.restText}>
        Rest: {formatMinutes(initialDurationRef.current)}
      </TextUI>

      <NotificationPermissionCTA />

      <TouchableOpacity
        accessibilityRole='button'
        accessibilityLabel={nativeTimerLaunched ? "Timer active" : `Start ${formatMinutes(duration)} timer`}
        onPress={nativeTimerLaunched ? handleManualComplete : handleStart}
        style={[styles.button, nativeTimerLaunched ? styles.buttonActive : styles.buttonIdle]}
        activeOpacity={0.8}>
        <Icon
          name={nativeTimerLaunched ? "timer-outline" : isStarting ? "hourglass-outline" : "play-outline"}
          size={20}
          color={
            nativeTimerLaunched ? colors.surface : colors.buttonTextOnPrimary || colors.buttonText || colors.surface
          }
          style={styles.iconText}
        />
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      marginTop: 12,
      marginBottom: 12,
    },
    restText: {
      marginRight: 12,
      fontWeight: "600",
      color: colors.subtext,
    },
    button: {
      width: 42,
      height: 42,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    buttonIdle: {
      backgroundColor: colors.primary,
    },
    buttonActive: {
      backgroundColor: colors.success,
    },
    iconText: {
      fontSize: 18,
    },
  });

export default CompactRestTimer;
