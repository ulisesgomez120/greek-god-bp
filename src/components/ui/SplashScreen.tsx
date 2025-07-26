// ============================================================================
// SPLASH SCREEN COMPONENT
// ============================================================================
// Branded splash screen with loading animation for app initialization

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Dimensions } from "react-native";
import Text from "./Text";

// ============================================================================
// TYPES
// ============================================================================

export interface SplashScreenProps {
  message?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

const SplashScreen: React.FC<SplashScreenProps> = ({ message = "Loading TrainSmart..." }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Initial fade in and scale animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous pulse animation for loading indicator
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();

    return () => {
      pulseAnimation.stop();
    };
  }, [fadeAnim, scaleAnim, pulseAnim]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}>
        {/* App Logo/Icon */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}>
          <View style={styles.logo}>
            <Text variant='h1' style={styles.logoText}>
              💪
            </Text>
          </View>
        </Animated.View>

        {/* App Name */}
        <Text variant='h1' color='primary' align='center' style={styles.appName}>
          TrainSmart
        </Text>

        {/* Tagline */}
        <Text variant='body' color='coach' align='center' style={styles.tagline}>
          AI-Powered Fitness Coaching
        </Text>

        {/* Loading Message */}
        <Text variant='bodySmall' color='secondary' align='center' style={styles.loadingMessage}>
          {message}
        </Text>

        {/* Loading Indicator */}
        <View style={styles.loadingIndicator}>
          <View style={styles.loadingDots}>
            {[0, 1, 2].map((index) => (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    opacity: pulseAnim.interpolate({
                      inputRange: [1, 1.1],
                      outputRange: [0.3, 1],
                      extrapolate: "clamp",
                    }),
                    transform: [
                      {
                        scale: pulseAnim.interpolate({
                          inputRange: [1, 1.1],
                          outputRange: [0.8, 1.2],
                          extrapolate: "clamp",
                        }),
                      },
                    ],
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const { width, height } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F8FAFD",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#B5CFF8",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  logoText: {
    fontSize: 40,
  },
  appName: {
    marginBottom: 8,
    fontSize: 32,
    fontWeight: "700",
  },
  tagline: {
    marginBottom: 40,
    fontSize: 16,
    fontWeight: "500",
  },
  loadingMessage: {
    marginBottom: 32,
    opacity: 0.8,
  },
  loadingIndicator: {
    alignItems: "center",
  },
  loadingDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#B5CFF8",
    marginHorizontal: 4,
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default SplashScreen;
