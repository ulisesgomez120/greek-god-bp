// ============================================================================
// PROGRESS INDICATOR COMPONENT
// ============================================================================
// Workout progress visualization with real-time animated transitions

import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, ViewStyle } from "react-native";

// ============================================================================
// TYPES
// ============================================================================

interface ProgressIndicatorProps {
  progress: number; // 0 to 1
  currentExercise: number;
  totalExercises: number;
  style?: ViewStyle;
  showText?: boolean;
  animated?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary: "#B5CFF8",
  success: "#34C759",
  background: "#F2F2F7",
  text: "#1C1C1E",
  textSecondary: "#8E8E93",
} as const;

const ANIMATION_DURATION = 300;

// ============================================================================
// COMPONENT
// ============================================================================

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  currentExercise,
  totalExercises,
  style,
  showText = true,
  animated = true,
}) => {
  // ============================================================================
  // ANIMATION
  // ============================================================================

  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (animated) {
      // Animate progress bar
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: ANIMATION_DURATION,
        useNativeDriver: false, // Cannot use native driver for width animations
      }).start();

      // Subtle scale animation when progress changes
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.02,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      progressAnim.setValue(progress);
    }
  }, [progress, animated, progressAnim, scaleAnim]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const progressPercentage = Math.round(progress * 100);
  const isComplete = progress >= 1;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Animated.View style={[styles.container, style, { transform: [{ scale: scaleAnim }] }]}>
      {showText && (
        <View style={styles.textContainer}>
          <Text style={styles.exerciseText} accessibilityLabel={`Exercise ${currentExercise} of ${totalExercises}`}>
            Exercise {currentExercise} of {totalExercises}
          </Text>
          <Text
            style={[styles.percentageText, isComplete && styles.percentageTextComplete]}
            accessibilityLabel={`${progressPercentage} percent complete`}>
            {progressPercentage}%
          </Text>
        </View>
      )}

      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground} />
        <Animated.View
          style={[
            styles.progressBarFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
                extrapolate: "clamp",
              }),
            },
            isComplete && styles.progressBarFillComplete,
          ]}
          accessibilityRole='progressbar'
          accessibilityValue={{
            min: 0,
            max: 100,
            now: progressPercentage,
          }}
        />

        {/* Progress dots for each exercise */}
        <View style={styles.dotsContainer}>
          {Array.from({ length: totalExercises }, (_, index) => {
            const exerciseProgress = (index + 1) / totalExercises;
            const isCurrentExercise = index + 1 === currentExercise;
            const isCompleted = progress >= exerciseProgress;

            return (
              <View
                key={index}
                style={[styles.dot, isCurrentExercise && styles.dotCurrent, isCompleted && styles.dotCompleted]}
                accessibilityLabel={`Exercise ${index + 1} ${
                  isCompleted ? "completed" : isCurrentExercise ? "current" : "upcoming"
                }`}
              />
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },

  textContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  exerciseText: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.text,
  },

  percentageText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primary,
    fontVariant: ["tabular-nums"],
  },

  percentageTextComplete: {
    color: COLORS.success,
  },

  progressBarContainer: {
    position: "relative",
    height: 8,
    borderRadius: 4,
  },

  progressBarBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
    borderRadius: 4,
  },

  progressBarFill: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    minWidth: 4, // Ensure some width is always visible when started
  },

  progressBarFillComplete: {
    backgroundColor: COLORS.success,
  },

  dotsContainer: {
    position: "absolute",
    top: -2,
    left: 0,
    right: 0,
    bottom: -2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
  },

  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.background,
    borderWidth: 2,
    borderColor: COLORS.textSecondary,
  },

  dotCurrent: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
    transform: [{ scale: 1.2 }],
  },

  dotCompleted: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success,
  },
});

export default ProgressIndicator;
