// ============================================================================
// REST TIMER COMPONENT
// ============================================================================
// Native timer integration with countdown display and completion detection

import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Platform, Linking, Alert, ViewStyle } from "react-native";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { Button } from "../ui/Button";
import { logger } from "../../utils/logger";

// ============================================================================
// TYPES
// ============================================================================

interface RestTimerProps {
  duration: number; // in seconds
  onComplete: () => void;
  onSkip: () => void;
  style?: ViewStyle;
  showNativeTimerButton?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary: "#B5CFF8",
  success: "#34C759",
  warning: "#FF9500",
  text: "#1C1C1E",
  textSecondary: "#8E8E93",
  background: "#FFFFFF",
  backgroundLight: "#F8FAFD",
} as const;

// ============================================================================
// COMPONENT
// ============================================================================

export const RestTimer: React.FC<RestTimerProps> = ({
  duration,
  onComplete,
  onSkip,
  style,
  showNativeTimerButton = true,
}) => {
  // ============================================================================
  // HOOKS
  // ============================================================================

  const { triggerRestTimerCompleteHaptic } = useHapticFeedback();

  // ============================================================================
  // STATE
  // ============================================================================

  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const [nativeTimerLaunched, setNativeTimerLaunched] = useState(false);

  // ============================================================================
  // TIMER LOGIC
  // ============================================================================

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Timer completed
            setIsRunning(false);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning, timeRemaining]);

  // Reset timer when duration changes
  useEffect(() => {
    setTimeRemaining(duration);
    setIsRunning(false);
    setNativeTimerLaunched(false);
  }, [duration]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleTimerComplete = useCallback(async () => {
    try {
      await triggerRestTimerCompleteHaptic();
      logger.info("Rest timer completed", { duration }, "timer");
      onComplete();
    } catch (error) {
      logger.error("Error handling timer completion", error, "timer");
      onComplete();
    }
  }, [duration, onComplete, triggerRestTimerCompleteHaptic]);

  const handleSkip = useCallback(() => {
    setIsRunning(false);
    logger.info("Rest timer skipped", { timeRemaining }, "timer");
    onSkip();
  }, [timeRemaining, onSkip]);

  const handleStartInAppTimer = useCallback(() => {
    setIsRunning(true);
    logger.info("In-app rest timer started", { duration }, "timer");
  }, [duration]);

  const handleLaunchNativeTimer = useCallback(async () => {
    try {
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;

      if (Platform.OS === "ios") {
        // iOS Clock app timer URL scheme
        const timerUrl = `clock-timer://timer?duration=${duration}`;
        const canOpen = await Linking.canOpenURL(timerUrl);

        if (canOpen) {
          await Linking.openURL(timerUrl);
          setNativeTimerLaunched(true);
          logger.info("iOS native timer launched", { duration }, "timer");
        } else {
          // Fallback to Clock app
          const clockUrl = "clock://";
          const canOpenClock = await Linking.canOpenURL(clockUrl);

          if (canOpenClock) {
            await Linking.openURL(clockUrl);
            Alert.alert(
              "Set Timer",
              `Please set a timer for ${minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`} in the Clock app.`,
              [{ text: "OK" }]
            );
            setNativeTimerLaunched(true);
          } else {
            throw new Error("Cannot open Clock app");
          }
        }
      } else if (Platform.OS === "android") {
        // Android timer intent
        const timerIntent = `intent://timer/${duration}#Intent;scheme=timer;package=com.android.deskclock;end`;
        const canOpen = await Linking.canOpenURL(timerIntent);

        if (canOpen) {
          await Linking.openURL(timerIntent);
          setNativeTimerLaunched(true);
          logger.info("Android native timer launched", { duration }, "timer");
        } else {
          // Fallback to generic timer intent
          const genericIntent = `intent://timer#Intent;scheme=timer;end`;
          const canOpenGeneric = await Linking.canOpenURL(genericIntent);

          if (canOpenGeneric) {
            await Linking.openURL(genericIntent);
            Alert.alert(
              "Set Timer",
              `Please set a timer for ${minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`}.`,
              [{ text: "OK" }]
            );
            setNativeTimerLaunched(true);
          } else {
            throw new Error("Cannot open timer app");
          }
        }
      }
    } catch (error) {
      logger.error("Failed to launch native timer", error, "timer");

      // Fallback to in-app timer
      Alert.alert(
        "Timer Not Available",
        "Unable to open native timer. Would you like to use the in-app timer instead?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Use In-App Timer", onPress: handleStartInAppTimer },
        ]
      );
    }
  }, [duration, handleStartInAppTimer]);

  const handleManualComplete = useCallback(() => {
    Alert.alert("Rest Complete?", "Mark your rest period as complete?", [
      { text: "Not Yet", style: "cancel" },
      { text: "Complete", onPress: handleTimerComplete },
    ]);
  }, [handleTimerComplete]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getTimerColor = (): string => {
    if (timeRemaining <= 10) return COLORS.warning;
    if (isRunning) return COLORS.primary;
    return COLORS.textSecondary;
  };

  const getRecommendedRestText = (): string => {
    if (duration <= 60) return "Short rest";
    if (duration <= 180) return "Medium rest";
    return "Long rest";
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Rest Timer</Text>
        <Text style={styles.subtitle}>{getRecommendedRestText()}</Text>
      </View>

      <View style={styles.timerDisplay}>
        <Text
          style={[styles.timerText, { color: getTimerColor() }]}
          accessibilityLabel={`${formatTime(timeRemaining)} remaining`}>
          {formatTime(timeRemaining)}
        </Text>

        {isRunning && <Text style={styles.runningIndicator}>Running...</Text>}

        {nativeTimerLaunched && !isRunning && <Text style={styles.nativeIndicator}>Native timer active</Text>}
      </View>

      <View style={styles.buttonContainer}>
        {!isRunning && !nativeTimerLaunched && showNativeTimerButton && (
          <Button
            variant='primary'
            onPress={handleLaunchNativeTimer}
            style={styles.primaryButton}
            accessibilityLabel={`Start ${formatTime(duration)} timer`}>
            <Text style={styles.primaryButtonText}>Start Timer</Text>
          </Button>
        )}

        {!isRunning && !nativeTimerLaunched && (
          <Button
            variant='secondary'
            onPress={handleStartInAppTimer}
            style={styles.secondaryButton}
            accessibilityLabel='Start in-app timer'>
            <Text style={styles.secondaryButtonText}>Use In-App Timer</Text>
          </Button>
        )}

        {isRunning && (
          <Button
            variant='secondary'
            onPress={() => setIsRunning(false)}
            style={styles.secondaryButton}
            accessibilityLabel='Pause timer'>
            <Text style={styles.secondaryButtonText}>Pause</Text>
          </Button>
        )}

        {nativeTimerLaunched && (
          <Button
            variant='primary'
            onPress={handleManualComplete}
            style={styles.primaryButton}
            accessibilityLabel='Mark rest as complete'>
            <Text style={styles.primaryButtonText}>Rest Complete</Text>
          </Button>
        )}

        <Button variant='text' onPress={handleSkip} style={styles.skipButton} accessibilityLabel='Skip rest timer'>
          <Text style={styles.skipButtonText}>Skip Rest</Text>
        </Button>
      </View>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  header: {
    alignItems: "center",
    marginBottom: 16,
  },

  title: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  timerDisplay: {
    alignItems: "center",
    marginBottom: 20,
  },

  timerText: {
    fontSize: 48,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    marginBottom: 8,
  },

  runningIndicator: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "500",
  },

  nativeIndicator: {
    fontSize: 14,
    color: COLORS.success,
    fontWeight: "500",
  },

  buttonContainer: {
    gap: 12,
  },

  primaryButton: {
    height: 50,
  },

  primaryButtonText: {
    fontSize: 17,
    fontWeight: "600",
  },

  secondaryButton: {
    height: 44,
  },

  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },

  skipButton: {
    height: 36,
    alignSelf: "center",
  },

  skipButtonText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
});

export default RestTimer;
