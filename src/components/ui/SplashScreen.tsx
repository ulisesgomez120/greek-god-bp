// ============================================================================
// SPLASH SCREEN COMPONENT
// ============================================================================
// Branded splash screen with loading animation for app initialization

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Dimensions, Image } from "react-native";
import Text from "./Text";
import useTheme from "@/hooks/useTheme";
import store, { waitForRehydration } from "@/store";
import { syncAuthState } from "@/utils/authValidation";

// ============================================================================
// TYPES
// ============================================================================

export interface SplashScreenProps {
  message?: string;
  minimumDisplayTimeMs?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

const SplashScreen: React.FC<SplashScreenProps> = ({
  message = "Loading TrainSmart...",
  minimumDisplayTimeMs = 2000,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Consume theme (works when component is rendered inside ThemeProvider)
  const { colors } = useTheme();

  // Manage minimum display timing using internal ref
  const displayedAtRef = useRef<number | null>(null);

  useEffect(() => {
    displayedAtRef.current = Date.now();

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

  // When the splash screen mounts, perform a conservative auth validation so the
  // app doesn't transition away from the splash until auth state consistency is
  // checked. This is best-effort and will not block for long — failures are
  // handled gracefully by the auth layer.
  useEffect(() => {
    let isMounted = true;

    const validate = async () => {
      try {
        // Wait for store rehydration so Redux is available for sync actions.
        await waitForRehydration();

        // Attempt to sync client + Redux auth state. This may trigger a refresh
        // or a forceLogout if the tokens are invalid.
        await syncAuthState(store);
      } catch (err) {
        // Non-fatal: log and continue. syncAuthState will have forced logout
        // if it detected unrecoverable issues.
        if (isMounted) {
          // eslint-disable-next-line no-console
          console.warn("SplashScreen: auth validation failed", err);
        }
      }
    };

    validate();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Background image (contained & centered) */}
      <Image source={require("../../../assets/splash-icon.png")} style={styles.bgImage} resizeMode='cover' />
      {/* Dark overlay so text pops on top of the background image */}
      <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.65)" }]}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}>
          {/* App Name */}
          <Text
            variant='h1'
            color='primary'
            align='center'
            style={[styles.appName, { color: colors?.text || "#FFFFFF" }]}>
            TrainSmart
          </Text>

          {/* Tagline */}
          <Text
            variant='body'
            color='coach'
            align='center'
            style={[styles.tagline, { color: colors?.subtext || "rgba(255,255,255,0.9)" }]}>
            AI-Powered Fitness Coaching
          </Text>

          {/* Loading Message */}
          <Text
            variant='bodySmall'
            color='secondary'
            align='center'
            style={[styles.loadingMessage, { color: colors?.subtext || "rgba(255,255,255,0.85)" }]}>
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
                      backgroundColor: colors?.primary || "#B5CFF8",
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
    backgroundColor: "#B5CFF8",
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
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
  logoImage: {
    width: 48,
    height: 48,
  },
  bgImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    alignSelf: "center",
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
