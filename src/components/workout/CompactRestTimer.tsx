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
import TextUI from "../ui/Text";
import useTheme from "@/hooks/useTheme";
import Icon from "react-native-vector-icons/MaterialIcons";

interface CompactRestTimerProps {
  duration: number; // seconds
  onComplete?: () => void;
  onSkip?: () => void;
  style?: ViewStyle;
}

/**
 * Schedule a web notification when running in web/PWA.
 * Best-effort: will attempt to use a Service Worker registration to showNotification,
 * otherwise falls back to the Notification constructor.
 */
const scheduleWebNotification = async (durationSeconds: number, title = "Rest Complete", body?: string) => {
  try {
    if (!("Notification" in window)) {
      logger.info("Web Notifications not supported");
      return null;
    }

    // Request permission if needed
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      logger.info("Notification permission not granted");
      return null;
    }

    const show = async () => {
      const minutes = Math.floor(durationSeconds / 60);
      const seconds = durationSeconds % 60;
      const message = body || `Rest for ${minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`} is complete`;

      // Prefer service worker registration if available (works better when PWA is backgrounded)
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg && reg.showNotification) {
            reg.showNotification(title, {
              body: message,
              tag: `rest-timer-${Date.now()}`,
            });
            logger.info("Scheduled notification via service worker", { durationSeconds }, "timer");
            return;
          }
        } catch (err) {
          logger.warn("Service worker notification failed, falling back to Notification()", err);
        }
      }

      // Fallback to basic Notification (may not fire if tab is fully closed)
      new Notification(title, {
        body: message,
        tag: `rest-timer-${Date.now()}`,
      });
      logger.info("Scheduled notification via Notification API", { durationSeconds }, "timer");
    };

    // Schedule with setTimeout
    const timeoutId = window.setTimeout(show, durationSeconds * 1000);
    return () => {
      window.clearTimeout(timeoutId);
    };
  } catch (error) {
    logger.error("Failed to schedule web notification", error, "timer");
    return null;
  }
};

export const CompactRestTimer: React.FC<CompactRestTimerProps> = ({ duration, onComplete, onSkip, style }) => {
  const { triggerRestTimerCompleteHaptic } = useHapticFeedback();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [nativeTimerLaunched, setNativeTimerLaunched] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const webCancelRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    // Reset when duration changes
    setNativeTimerLaunched(false);
    setIsStarting(false);
    // clear any scheduled web notification from previous runs
    if (webCancelRef.current) {
      webCancelRef.current();
      webCancelRef.current = null;
    }
  }, [duration]);

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

      // Web / PWA: schedule a web notification (best-effort)
      if (Platform.OS === "web") {
        const cancel = await scheduleWebNotification(duration, "Rest Complete");
        if (cancel) webCancelRef.current = cancel;
        setNativeTimerLaunched(true);
        logger.info("Web notification scheduled for rest timer", { duration }, "timer");
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
        Rest: {formatMinutes(duration)}
      </TextUI>

      <TouchableOpacity
        accessibilityRole='button'
        accessibilityLabel={nativeTimerLaunched ? "Timer active" : `Start ${formatMinutes(duration)} timer`}
        onPress={nativeTimerLaunched ? handleManualComplete : handleStart}
        style={[styles.button, nativeTimerLaunched ? styles.buttonActive : styles.buttonIdle]}
        activeOpacity={0.8}>
        <Icon
          name={nativeTimerLaunched ? "timer" : isStarting ? "hourglass_empty" : "play-arrow"}
          size={20}
          color={nativeTimerLaunched ? colors.success : colors.buttonTextOnPrimary || colors.buttonText || colors.text}
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
      color: colors.text,
    },
  });

export default CompactRestTimer;
