// ============================================================================
// CONNECTION STATUS INDICATOR COMPONENT
// ============================================================================
// Top-level connection status indicator with color-coded visual feedback

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import Text from "./Text";

// ============================================================================
// TYPES
// ============================================================================

export interface ConnectionStatusIndicatorProps {
  position?: "top" | "bottom";
  showText?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  position = "top",
  showText = false,
}) => {
  const { isConnected, connectionType, isSlowConnection } = useNetworkStatus();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;

  // Determine status color and message
  const getStatusInfo = () => {
    if (!isConnected) {
      return {
        color: "#FF3B30", // Error Red
        message: "Offline",
        description: "Working offline - changes will sync when connected",
      };
    }

    if (isSlowConnection) {
      return {
        color: "#FF9500", // Warning Amber
        message: "Slow Connection",
        description: "Connection is slow - some features may be limited",
      };
    }

    return {
      color: "#34C759", // Success Green
      message: "Online",
      description: "Connected and syncing",
    };
  };

  const statusInfo = getStatusInfo();

  // Animation effects
  useEffect(() => {
    if (!isConnected || isSlowConnection) {
      // Show indicator for offline or slow connection
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Hide indicator when online with good connection
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: position === "top" ? -50 : 50,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isConnected, isSlowConnection, fadeAnim, slideAnim, position]);

  // Don't render if online with good connection
  if (isConnected && !isSlowConnection) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        position === "bottom" ? styles.bottom : styles.top,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}>
      <View style={styles.content}>
        {/* Status Dot */}
        <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />

        {/* Status Text */}
        <View style={styles.textContainer}>
          <Text variant='bodySmall' color='primary' weight='medium' style={styles.statusText}>
            {statusInfo.message}
          </Text>
          {showText && (
            <Text variant='caption' color='secondary' style={styles.descriptionText}>
              {statusInfo.description}
            </Text>
          )}
        </View>

        {/* Connection Type Indicator */}
        {connectionType && (
          <Text variant='caption' color='secondary' style={styles.connectionType}>
            {connectionType.toUpperCase()}
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  top: {
    top: 0,
    paddingTop: 44, // Account for status bar
  },
  bottom: {
    bottom: 0,
    paddingBottom: 34, // Account for home indicator
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 32,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 12,
    lineHeight: 16,
  },
  descriptionText: {
    fontSize: 10,
    lineHeight: 12,
    marginTop: 2,
  },
  connectionType: {
    fontSize: 10,
    lineHeight: 12,
    opacity: 0.6,
    marginLeft: 8,
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default ConnectionStatusIndicator;
