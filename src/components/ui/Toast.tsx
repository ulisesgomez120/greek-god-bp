// ============================================================================
// TOAST NOTIFICATION COMPONENT
// ============================================================================
// Non-intrusive toast notifications with animations and auto-dismiss functionality

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Dimensions, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Text from "./Text";
import type { Notification } from "../../types";

// ============================================================================
// TYPES
// ============================================================================

export interface ToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  position?: "top" | "bottom";
  index?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

const Toast: React.FC<ToastProps> = ({ notification, onDismiss, position = "top", index = 0 }) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(position === "top" ? -100 : 100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  const { id, type, title, message, duration = 4000, actions } = notification;

  // Get toast styling based on type
  const getToastStyle = () => {
    switch (type) {
      case "success":
        return {
          backgroundColor: "#34C759",
          borderColor: "#30D158",
          iconColor: "#FFFFFF",
          textColor: "#FFFFFF",
          icon: "✓",
        };
      case "error":
        return {
          backgroundColor: "#FF3B30",
          borderColor: "#FF453A",
          iconColor: "#FFFFFF",
          textColor: "#FFFFFF",
          icon: "✕",
        };
      case "warning":
        return {
          backgroundColor: "#FF9500",
          borderColor: "#FF9F0A",
          iconColor: "#FFFFFF",
          textColor: "#FFFFFF",
          icon: "⚠",
        };
      case "info":
      default:
        return {
          backgroundColor: "#B5CFF8",
          borderColor: "#87B1F3",
          iconColor: "#1C1C1E",
          textColor: "#1C1C1E",
          icon: "ℹ",
        };
    }
  };

  const toastStyle = getToastStyle();

  // Animation effects
  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss timer
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }

    // Return empty cleanup function when no timer
    return () => {};
  }, [duration, translateY, opacity, scale]);

  const handleDismiss = () => {
    // Exit animation
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: position === "top" ? -100 : 100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.9,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(id);
    });
  };

  const handleActionPress = (action: any) => {
    if (action.action) {
      action.action();
    }
    handleDismiss();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: position === "top" ? insets.top + 16 + index * 80 : undefined,
          bottom: position === "bottom" ? insets.bottom + 16 + index * 80 : undefined,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}>
      <TouchableOpacity
        style={[
          styles.toast,
          {
            backgroundColor: toastStyle.backgroundColor,
            borderColor: toastStyle.borderColor,
          },
        ]}
        onPress={handleDismiss}
        activeOpacity={0.9}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Text variant='body' style={[styles.icon, { color: toastStyle.iconColor }]}>
            {toastStyle.icon}
          </Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text variant='bodySmall' weight='medium' style={[styles.title, { color: toastStyle.textColor }]}>
            {title}
          </Text>
          {message && (
            <Text variant='caption' style={[styles.message, { color: toastStyle.textColor, opacity: 0.9 }]}>
              {message}
            </Text>
          )}

          {/* Actions */}
          {actions && actions.length > 0 && (
            <View style={styles.actionsContainer}>
              {actions.map((action, actionIndex) => (
                <TouchableOpacity
                  key={actionIndex}
                  style={[
                    styles.actionButton,
                    {
                      borderColor: toastStyle.textColor,
                    },
                  ]}
                  onPress={() => handleActionPress(action)}>
                  <Text variant='caption' weight='medium' style={[styles.actionText, { color: toastStyle.textColor }]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Dismiss Button */}
        <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
          <Text variant='caption' style={[styles.dismissText, { color: toastStyle.textColor, opacity: 0.8 }]}>
            ✕
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Progress Bar (for timed toasts) */}
      {duration > 0 && <ProgressBar duration={duration} color={toastStyle.borderColor} />}
    </Animated.View>
  );
};

// ============================================================================
// PROGRESS BAR COMPONENT
// ============================================================================

interface ProgressBarProps {
  duration: number;
  color: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ duration, color }) => {
  const progressAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: 0,
      duration,
      useNativeDriver: false,
    }).start();
  }, [duration, progressAnim]);

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressBar,
          {
            backgroundColor: color,
            width: progressAnim.interpolate({
              inputRange: [0, 100],
              outputRange: ["0%", "100%"],
              extrapolate: "clamp",
            }),
          },
        ]}
      />
    </View>
  );
};

// ============================================================================
// TOAST CONTAINER COMPONENT
// ============================================================================

export interface ToastContainerProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  position?: "top" | "bottom";
  maxVisible?: number;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  notifications,
  onDismiss,
  position = "top",
  maxVisible = 3,
}) => {
  // Show only the most recent notifications
  const visibleNotifications = notifications.slice(0, maxVisible);

  return (
    <View style={styles.toastContainer} pointerEvents='box-none'>
      {visibleNotifications.map((notification, index) => (
        <Toast
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
          position={position}
          index={index}
        />
      ))}
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  toastContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  toast: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    minHeight: 64,
  },
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },
  icon: {
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 2,
  },
  message: {
    fontSize: 12,
    lineHeight: 16,
  },
  actionsContainer: {
    flexDirection: "row",
    marginTop: 8,
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 11,
    lineHeight: 14,
  },
  dismissButton: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  dismissText: {
    fontSize: 12,
    fontWeight: "600",
  },
  progressTrack: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default Toast;
