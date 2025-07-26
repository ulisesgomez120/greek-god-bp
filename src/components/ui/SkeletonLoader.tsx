// ============================================================================
// SKELETON LOADER COMPONENT
// ============================================================================
// Animated skeleton placeholders for loading states with shimmer effect

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, ViewStyle } from "react-native";

// ============================================================================
// TYPES
// ============================================================================

export interface SkeletonLoaderProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
  animated?: boolean;
}

export interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  lastLineWidth?: number | string;
  style?: ViewStyle;
}

export interface SkeletonFormProps {
  fields?: number;
  showButton?: boolean;
  style?: ViewStyle;
}

// ============================================================================
// BASE SKELETON COMPONENT
// ============================================================================

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = "100%",
  height = 20,
  borderRadius = 4,
  style,
  animated = true,
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      const shimmerAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );

      shimmerAnimation.start();

      return () => {
        shimmerAnimation.stop();
      };
    }
  }, [animated, shimmerAnim]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
    extrapolate: "clamp",
  });

  return (
    <View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height: height as any,
          borderRadius,
        },
        style,
      ]}>
      {animated && (
        <Animated.View
          style={[
            styles.shimmer,
            {
              opacity: shimmerOpacity,
              borderRadius,
            },
          ]}
        />
      )}
    </View>
  );
};

// ============================================================================
// SKELETON TEXT COMPONENT
// ============================================================================

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  lineHeight = 16,
  lastLineWidth = "60%",
  style,
}) => {
  return (
    <View style={[styles.textContainer, style]}>
      {Array.from({ length: lines }, (_, index) => {
        const marginStyle: ViewStyle = index === lines - 1 ? {} : { marginBottom: 8 };
        return (
          <SkeletonLoader
            key={index}
            width={index === lines - 1 ? lastLineWidth : "100%"}
            height={lineHeight}
            borderRadius={lineHeight / 4}
            style={marginStyle.marginBottom ? [styles.textLine, marginStyle] : styles.textLine}
          />
        );
      })}
    </View>
  );
};

// ============================================================================
// SKELETON FORM COMPONENT
// ============================================================================

export const SkeletonForm: React.FC<SkeletonFormProps> = ({ fields = 3, showButton = true, style }) => {
  return (
    <View style={[styles.formContainer, style]}>
      {/* Form Fields */}
      {Array.from({ length: fields }, (_, index) => (
        <View key={index} style={styles.fieldContainer}>
          {/* Field Label */}
          <SkeletonLoader width='40%' height={14} borderRadius={2} style={styles.fieldLabel} />

          {/* Field Input */}
          <SkeletonLoader width='100%' height={52} borderRadius={12} style={styles.fieldInput} />
        </View>
      ))}

      {/* Submit Button */}
      {showButton && <SkeletonLoader width='100%' height={50} borderRadius={12} style={styles.submitButton} />}
    </View>
  );
};

// ============================================================================
// SKELETON CARD COMPONENT
// ============================================================================

export interface SkeletonCardProps {
  showImage?: boolean;
  imageHeight?: number;
  showTitle?: boolean;
  showSubtitle?: boolean;
  showContent?: boolean;
  contentLines?: number;
  style?: ViewStyle;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  showImage = true,
  imageHeight = 120,
  showTitle = true,
  showSubtitle = true,
  showContent = true,
  contentLines = 2,
  style,
}) => {
  return (
    <View style={[styles.card, style]}>
      {/* Card Image */}
      {showImage && <SkeletonLoader width='100%' height={imageHeight} borderRadius={12} style={styles.cardImage} />}

      <View style={styles.cardContent}>
        {/* Card Title */}
        {showTitle && <SkeletonLoader width='80%' height={20} borderRadius={4} style={styles.cardTitle} />}

        {/* Card Subtitle */}
        {showSubtitle && <SkeletonLoader width='60%' height={16} borderRadius={3} style={styles.cardSubtitle} />}

        {/* Card Content */}
        {showContent && (
          <SkeletonText lines={contentLines} lineHeight={14} lastLineWidth='70%' style={styles.cardText} />
        )}
      </View>
    </View>
  );
};

// ============================================================================
// SKELETON LIST COMPONENT
// ============================================================================

export interface SkeletonListProps {
  items?: number;
  itemHeight?: number;
  showAvatar?: boolean;
  avatarSize?: number;
  style?: ViewStyle;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
  items = 5,
  itemHeight = 60,
  showAvatar = true,
  avatarSize = 40,
  style,
}) => {
  return (
    <View style={[styles.listContainer, style]}>
      {Array.from({ length: items }, (_, index) => (
        <View key={index} style={[styles.listItem, { minHeight: itemHeight }]}>
          {/* Avatar */}
          {showAvatar && (
            <SkeletonLoader
              width={avatarSize}
              height={avatarSize}
              borderRadius={avatarSize / 2}
              style={styles.listAvatar}
            />
          )}

          {/* Content */}
          <View style={styles.listContent}>
            <SkeletonLoader width='70%' height={16} borderRadius={3} style={styles.listTitle} />
            <SkeletonLoader width='50%' height={12} borderRadius={2} style={styles.listSubtitle} />
          </View>

          {/* Action */}
          <SkeletonLoader width={24} height={24} borderRadius={12} style={styles.listAction} />
        </View>
      ))}
    </View>
  );
};

// ============================================================================
// SKELETON WORKOUT COMPONENT
// ============================================================================

export interface SkeletonWorkoutProps {
  exercises?: number;
  style?: ViewStyle;
}

export const SkeletonWorkout: React.FC<SkeletonWorkoutProps> = ({ exercises = 4, style }) => {
  return (
    <View style={[styles.workoutContainer, style]}>
      {/* Workout Header */}
      <View style={styles.workoutHeader}>
        <SkeletonLoader width='60%' height={24} borderRadius={4} style={styles.workoutTitle} />
        <SkeletonLoader width='40%' height={16} borderRadius={3} style={styles.workoutSubtitle} />
      </View>

      {/* Exercise List */}
      {Array.from({ length: exercises }, (_, index) => (
        <View key={index} style={styles.exerciseItem}>
          {/* Exercise Name */}
          <SkeletonLoader width='70%' height={18} borderRadius={3} style={styles.exerciseName} />

          {/* Sets Info */}
          <View style={styles.setsContainer}>
            {Array.from({ length: 3 }, (_, setIndex) => (
              <SkeletonLoader key={setIndex} width={60} height={32} borderRadius={8} style={styles.setItem} />
            ))}
          </View>
        </View>
      ))}

      {/* Action Button */}
      <SkeletonLoader width='100%' height={50} borderRadius={12} style={styles.workoutButton} />
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "#F2F2F7",
    overflow: "hidden",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
  },
  textContainer: {
    width: "100%",
  },
  textLine: {
    // marginBottom handled in component
  },
  formContainer: {
    width: "100%",
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    marginBottom: 8,
  },
  fieldInput: {
    // No additional styles needed
  },
  submitButton: {
    marginTop: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardImage: {
    marginBottom: 16,
  },
  cardContent: {
    // No additional styles needed
  },
  cardTitle: {
    marginBottom: 8,
  },
  cardSubtitle: {
    marginBottom: 12,
  },
  cardText: {
    // No additional styles needed
  },
  listContainer: {
    width: "100%",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  listAvatar: {
    marginRight: 12,
  },
  listContent: {
    flex: 1,
  },
  listTitle: {
    marginBottom: 4,
  },
  listSubtitle: {
    // No additional styles needed
  },
  listAction: {
    marginLeft: 12,
  },
  workoutContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  workoutHeader: {
    marginBottom: 20,
  },
  workoutTitle: {
    marginBottom: 8,
  },
  workoutSubtitle: {
    // No additional styles needed
  },
  exerciseItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  exerciseName: {
    marginBottom: 12,
  },
  setsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  setItem: {
    // No additional styles needed
  },
  workoutButton: {
    marginTop: 20,
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default SkeletonLoader;
