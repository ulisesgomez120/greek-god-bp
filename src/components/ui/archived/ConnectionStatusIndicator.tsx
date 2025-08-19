// ARCHIVED: ConnectionStatusIndicator (removed - Phase 4)
// The original component was archived here for reference. To avoid build-time
// TypeScript resolution errors (the archived copy referenced live modules that
// may be removed), the original source has been preserved below as a commented
// block. This file intentionally does not import any runtime modules.
//
// Original source (archived for reference):
/*
import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import Text from "./Text";

export interface ConnectionStatusIndicatorProps {
  position?: "top" | "bottom";
  showText?: boolean;
}

const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  position = "top",
  showText = false,
}) => {
  const { isConnected, connectionType, isSlowConnection } = useNetworkStatus();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;

  const getStatusInfo = () => {
    if (!isConnected) {
      return {
        color: "#FF3B30",
        message: "Offline",
        description: "Working offline - changes will sync when connected",
      };
    }

    if (isSlowConnection) {
      return {
        color: "#FF9500",
        message: "Slow Connection",
        description: "Connection is slow - some features may be limited",
      };
    }

    return {
      color: "#34C759",
      message: "Online",
      description: "Connected and syncing",
    };
  };

  const statusInfo = getStatusInfo();

  useEffect(() => {
    if (!isConnected || isSlowConnection) {
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
        <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
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
        {connectionType && (
          <Text variant='caption' color='secondary' style={styles.connectionType}>
            {connectionType.toUpperCase()}
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { /* ... */
//   top: { /* ... */ },
//   bottom: { /* ... */ },
//   content: { /* ... */ },
//   statusDot: { /* ... */ },
//   textContainer: { /* ... */ },
//   statusText: { /* ... */ },
//   descriptionText: { /* ... */ },
//   connectionType: { /* ... */ },
// });

// export default ConnectionStatusIndicator;
// */

//
// This archived file intentionally exports nothing to avoid runtime/type errors.
// If you need to restore the component, copy the archived source above into
// `src/components/ui/ConnectionStatusIndicator.tsx` and re-add any necessary imports.
//
export {};
