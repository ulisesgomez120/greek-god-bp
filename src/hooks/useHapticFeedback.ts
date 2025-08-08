// ============================================================================
// HAPTIC FEEDBACK HOOK
// ============================================================================
// Tactile feedback for interactions with cross-platform support

import { useCallback } from "react";
import { Platform, Vibration } from "react-native";
import * as Haptics from "expo-haptics";
import { logger } from "../utils/logger";

// ============================================================================
// TYPES
// ============================================================================

export type HapticFeedbackType = "light" | "medium" | "heavy" | "success" | "warning" | "error";

export interface HapticFeedbackOptions {
  enabled?: boolean;
  fallbackToVibration?: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

export const useHapticFeedback = (options: HapticFeedbackOptions = {}) => {
  const { enabled = true, fallbackToVibration = true } = options;

  const triggerHaptic = useCallback(
    async (type: HapticFeedbackType): Promise<void> => {
      if (!enabled) return;

      try {
        if (Platform.OS === "ios") {
          // iOS haptic feedback using Expo Haptics
          switch (type) {
            case "light":
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              break;
            case "medium":
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              break;
            case "heavy":
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              break;
            case "success":
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              break;
            case "warning":
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              break;
            case "error":
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              break;
            default:
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        } else if (Platform.OS === "android") {
          // Android haptic feedback
          if (fallbackToVibration) {
            const vibrationPatterns = {
              light: 10,
              medium: 50,
              heavy: 100,
              success: [0, 50, 50, 50],
              warning: [0, 100, 50, 100],
              error: [0, 100, 100, 100, 100, 100],
            };

            const pattern = vibrationPatterns[type];
            if (Array.isArray(pattern)) {
              Vibration.vibrate(pattern);
            } else {
              Vibration.vibrate(pattern);
            }
          }
        }

        logger.debug("Haptic feedback triggered", { type }, "haptics");
      } catch (error) {
        logger.error("Failed to trigger haptic feedback", error, "haptics");

        // Fallback to basic vibration if haptics fail
        if (fallbackToVibration && Platform.OS === "android") {
          try {
            Vibration.vibrate(50);
          } catch (vibrationError) {
            logger.error("Fallback vibration also failed", vibrationError, "haptics");
          }
        }
      }
    },
    [enabled, fallbackToVibration]
  );

  const triggerSelectionHaptic = useCallback(async (): Promise<void> => {
    if (!enabled) return;

    try {
      if (Platform.OS === "ios") {
        await Haptics.selectionAsync();
      } else if (Platform.OS === "android" && fallbackToVibration) {
        Vibration.vibrate(25);
      }
    } catch (error) {
      logger.error("Failed to trigger selection haptic", error, "haptics");
    }
  }, [enabled, fallbackToVibration]);

  const triggerSetCompleteHaptic = useCallback(async (): Promise<void> => {
    await triggerHaptic("success");
  }, [triggerHaptic]);

  const triggerProgressionHaptic = useCallback(async (): Promise<void> => {
    // Special haptic pattern for progressive overload achievements
    if (Platform.OS === "ios") {
      await triggerHaptic("success");
      setTimeout(() => triggerHaptic("light"), 100);
    } else {
      await triggerHaptic("success");
    }
  }, [triggerHaptic]);

  const triggerRestTimerCompleteHaptic = useCallback(async (): Promise<void> => {
    // Distinctive pattern for rest timer completion
    if (Platform.OS === "ios") {
      await triggerHaptic("heavy");
      setTimeout(() => triggerHaptic("medium"), 150);
      setTimeout(() => triggerHaptic("light"), 300);
    } else {
      Vibration.vibrate([0, 100, 100, 100, 100, 50]);
    }
  }, [triggerHaptic]);

  return {
    triggerHaptic,
    triggerSelectionHaptic,
    triggerSetCompleteHaptic,
    triggerProgressionHaptic,
    triggerRestTimerCompleteHaptic,
  };
};

export default useHapticFeedback;
