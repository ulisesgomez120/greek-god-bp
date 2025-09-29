// ============================================================================
// COMPACT REST TIMER COMPONENT (background-only notification timers)
// ============================================================================
// Replaces prior URL-scheme/native-launch approach with in-app scheduling using
// expo-notifications through src/services/notification.service.ts
//
// Features:
// - Seconds-based input (0-600) with minutes/seconds display (e.g. "3m 30s")
// - Toggleable inline input when tapping the rest display
// - Schedule background notifications (multiple concurrent timers supported)
// - Track scheduled notification IDs for cancellation ("Cancel All Timers")
// - Per-exercise duration persistence (resets when `duration` prop changes)
// - Success toast "Xm Xs timer started" (auto-dismiss 2s) using redux UI notifications
// - Notification body/title: "Xm Xs rest complete"
// ============================================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, Platform, TouchableOpacity, ViewStyle, TextInput, Keyboard, AppState } from "react-native";
import * as ExpoNotifications from "expo-notifications";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import TextUI from "../ui/Text";
import useTheme from "@/hooks/useTheme";
import Icon from "@/components/ui/Icon";
import notificationService from "@/services/notification.service";
import useNotificationPermissions from "@/hooks/useNotificationPermissions";
import { useDispatch } from "react-redux";
import { showSuccessNotification, showErrorNotification, showInfoNotification } from "@/store/ui/uiSlice";

interface CompactRestTimerProps {
  duration: number; // seconds (initial / exercise-provided)
  onComplete?: () => void;
  onSkip?: () => void;
  style?: ViewStyle;
}

const MAX_SECONDS = 600;
const MIN_SECONDS = 0;

export const CompactRestTimer: React.FC<CompactRestTimerProps> = ({ duration, onComplete, onSkip, style }) => {
  const { triggerRestTimerCompleteHaptic } = useHapticFeedback();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const dispatch = useDispatch();
  const { permission, askForPermission, openSettings } = useNotificationPermissions();

  // Persisted per-exercise duration (resets when `duration` prop changes)
  const initialDurationRef = useRef<number>(duration);
  const [customDuration, setCustomDuration] = useState<number>(duration);

  // Input visibility / editing state
  const [isInputVisible, setIsInputVisible] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>(String(duration));

  // Scheduling state
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [activeTimerIds, setActiveTimerIds] = useState<string[]>([]);

  // Keep input in sync when exercise changes
  useEffect(() => {
    if (duration !== initialDurationRef.current) {
      // New exercise loaded -> reset persisted per-exercise duration
      initialDurationRef.current = duration;
      setCustomDuration(duration);
      setInputValue(String(duration));
      setIsInputVisible(false);
    }

    // When the exercise changes (effect cleanup), cancel any active timers scheduled for the previous exercise.
    return () => {
      try {
        activeTimerIds.forEach((id) => {
          try {
            notificationService.cancelScheduledNotification(id);
          } catch (_) {
            // ignore per-id errors
          }
        });
      } catch (_) {
        // ignore
      } finally {
        setActiveTimerIds([]);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const formatDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }, []);

  const clampDuration = useCallback((value: number) => {
    if (Number.isNaN(value)) return MIN_SECONDS;
    return Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, Math.floor(value)));
  }, []);

  const validateAndSetFromInput = useCallback(
    (val: string) => {
      // allow only digits
      const digits = val.replace(/[^0-9]/g, "");
      setInputValue(digits);
      if (digits === "") return;
      const num = clampDuration(Number(digits));
      setCustomDuration(num);
    },
    [clampDuration]
  );

  const ensurePermissionOrAsk = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      // Web permission handled in hook; askForPermission will prompt
      if (permission === "granted") return true;
      const granted = await askForPermission();
      return granted;
    } else {
      if (permission === "granted") return true;
      const granted = await askForPermission();
      return granted;
    }
  }, [askForPermission, permission]);

  // Notification listeners & reconcile logic:
  useEffect(() => {
    // When the user interacts with a notification (taps it), remove the scheduled id from local state.
    const responseListener = ExpoNotifications.addNotificationResponseReceivedListener((response) => {
      try {
        const id =
          (response &&
            (response as any).notification &&
            (response as any).notification.request &&
            (response as any).notification.request.identifier) ||
          undefined;
        if (id) {
          setActiveTimerIds((prev) => prev.filter((x) => x !== id));
        }
      } catch (_) {
        // ignore parsing errors
      }
    });

    // Reconcile activeTimerIds with scheduled notifications when app becomes active.
    const reconcileScheduled = async () => {
      try {
        const scheduled = await ExpoNotifications.getAllScheduledNotificationsAsync();
        // scheduled items may use `identifier` or `id` depending on platform/version
        const scheduledIds = scheduled
          .map((s: any) => s.identifier ?? s.id ?? (s.request && s.request.identifier))
          .filter(Boolean) as string[];

        setActiveTimerIds((prev) => prev.filter((id) => scheduledIds.includes(id)));
      } catch (_) {
        // best-effort
      }
    };

    const appStateListener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void reconcileScheduled();
      }
    });

    // Initial reconcile on mount
    void reconcileScheduled();

    return () => {
      responseListener.remove();
      appStateListener.remove();
    };
  }, []);

  const handleStartTimer = useCallback(async () => {
    // Parse and validate duration
    const seconds = clampDuration(customDuration);

    if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
      dispatch(
        showErrorNotification({
          title: "Invalid duration",
          message: `Please enter a value between ${MIN_SECONDS} and ${MAX_SECONDS} seconds.`,
          duration: 3000,
        })
      );
      return;
    }

    setIsStarting(true);

    try {
      const hasPermission = await ensurePermissionOrAsk();
      if (!hasPermission) {
        dispatch(
          showErrorNotification({
            title: "Notifications Disabled",
            message: "Please enable notifications to receive rest timers.",
            duration: 4000,
          })
        );
        // Optionally surface a button/instruction to open settings; keep simple for now
        return;
      }

      // Schedule notification for background timer
      const title = `${formatDuration(seconds)} rest complete`;
      const body = `${formatDuration(seconds)} rest complete`;
      const result = await notificationService.scheduleNotificationAfterSeconds(seconds, title, body);

      if (result.error || !result.id) {
        dispatch(
          showErrorNotification({
            title: "Failed to schedule timer",
            message: "Unable to schedule notification. Please try again.",
            duration: 4000,
          })
        );
        return;
      }

      // Track scheduled id for cancellation
      setActiveTimerIds((prev) => [...prev, result.id as string]);

      // Haptic feedback when scheduling (instant)
      try {
        await triggerRestTimerCompleteHaptic();
      } catch (_) {
        // ignore haptic errors
      }

      // Success toast (auto-dismiss after 2s)
      dispatch(
        showSuccessNotification({
          title: "Timer Started",
          message: `${formatDuration(seconds)} timer started`,
          duration: 2000,
        })
      );
    } catch (err: any) {
      dispatch(
        showErrorNotification({
          title: "Timer Error",
          message: err?.message ?? "Failed to start timer",
          duration: 4000,
        })
      );
    } finally {
      setIsStarting(false);
      setIsInputVisible(false);
      Keyboard.dismiss();
    }
  }, [clampDuration, customDuration, dispatch, ensurePermissionOrAsk, formatDuration, triggerRestTimerCompleteHaptic]);

  const handleCancelAllTimers = useCallback(async () => {
    const count = activeTimerIds.length;
    if (count === 0) return;

    try {
      // Cancel each scheduled notification
      await Promise.all(activeTimerIds.map((id) => notificationService.cancelScheduledNotification(id)));
    } catch (err) {
      // best-effort; still clear local state
    } finally {
      setActiveTimerIds([]);
      dispatch(
        showInfoNotification({
          title: "Timers Cancelled",
          message: `Cancelled ${count} timer${count === 1 ? "" : "s"}.`,
          duration: 2000,
        })
      );
    }
  }, [activeTimerIds, dispatch]);

  const handleDisplayPress = useCallback(() => {
    setIsInputVisible((s) => !s);
    setInputValue(String(customDuration));
  }, [customDuration]);

  const handleInputSubmit = useCallback(() => {
    // commit input value to customDuration
    const digits = inputValue.replace(/[^0-9]/g, "");
    const num = digits === "" ? MIN_SECONDS : clampDuration(Number(digits));
    setCustomDuration(num);
    setInputValue(String(num));
    setIsInputVisible(false);
  }, [clampDuration, inputValue]);

  const activeCount = activeTimerIds.length;

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        accessibilityRole='button'
        accessibilityLabel='Rest duration'
        onPress={handleDisplayPress}
        style={styles.restTextContainer}
        activeOpacity={0.85}>
        {isInputVisible ? (
          <TextInput
            keyboardType='number-pad'
            value={inputValue}
            onChangeText={validateAndSetFromInput}
            onSubmitEditing={handleInputSubmit}
            onBlur={handleInputSubmit}
            style={[styles.input]}
            maxLength={4}
            placeholder='Seconds (0-600)'
            returnKeyType='done'
          />
        ) : (
          <TextUI variant='bodySmall' color='secondary' style={styles.restText}>
            Rest: {formatDuration(customDuration)}
          </TextUI>
        )}

        {activeCount > 0 && (
          <View style={styles.counterBadge}>
            <TextUI variant='caption' weight='medium' style={styles.counterText}>
              {activeCount}
            </TextUI>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole='button'
        accessibilityLabel={`Start ${formatDuration(customDuration)} timer`}
        onPress={handleStartTimer}
        style={[styles.button, isStarting ? styles.buttonStarting : styles.buttonIdle]}
        activeOpacity={0.8}>
        <Icon
          name={isStarting ? "hourglass-outline" : "play-outline"}
          size={20}
          color={colors.surface}
          style={styles.iconText}
        />
      </TouchableOpacity>

      {activeCount > 0 && (
        <TouchableOpacity
          accessibilityRole='button'
          accessibilityLabel={`Cancel all ${activeCount} timers`}
          onPress={handleCancelAllTimers}
          style={[styles.cancelButton]}>
          <TextUI variant='caption' weight='medium' style={styles.cancelText}>
            Cancel All
          </TextUI>
        </TouchableOpacity>
      )}
    </View>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      width: "100%",
      marginTop: 12,
      marginBottom: 12,
      gap: 8,
    },
    restTextContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginRight: 12,
      flex: 1,
    },
    restText: {
      fontWeight: "600",
      color: colors.subtext,
    },
    input: {
      minWidth: 120,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: colors.card,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 14,
    },
    counterBadge: {
      marginLeft: 8,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingHorizontal: 6,
    },
    counterText: {
      color: colors.surface,
      fontSize: 12,
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
      marginLeft: 8,
    },
    buttonIdle: {
      backgroundColor: colors.primary,
    },
    buttonStarting: {
      backgroundColor: colors.primaryVariant || colors.primary,
    },
    iconText: {
      fontSize: 18,
    },
    cancelButton: {
      marginLeft: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: {
      color: colors.subtext,
    },
  });

export default CompactRestTimer;
