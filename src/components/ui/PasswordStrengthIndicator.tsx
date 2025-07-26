// ============================================================================
// PASSWORD STRENGTH INDICATOR COMPONENT
// ============================================================================
// Visual password strength meter with animated progress bar and requirement checklist

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import Text from "./Text";
import { validatePassword, getPasswordStrengthColor, getPasswordStrengthText } from "../../utils/validation";

// ============================================================================
// TYPES
// ============================================================================

export interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
  showStrengthText?: boolean;
  style?: any;
}

// ============================================================================
// COMPONENT
// ============================================================================

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  showRequirements = true,
  showStrengthText = true,
  style,
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const colorAnim = useRef(new Animated.Value(0)).current;

  // Validate password and get strength info
  const validation = validatePassword(password);
  const { strength, requirements, isValid } = validation;

  // Calculate progress percentage
  const getProgressPercentage = () => {
    const metRequirements = Object.values(requirements).filter(Boolean).length;
    const totalRequirements = Object.keys(requirements).length;
    return (metRequirements / totalRequirements) * 100;
  };

  const progressPercentage = getProgressPercentage();

  // Get strength color
  const strengthColor = getPasswordStrengthColor(strength);
  const strengthText = getPasswordStrengthText(strength);

  // Animate progress bar
  useEffect(() => {
    Animated.parallel([
      Animated.timing(progressAnim, {
        toValue: progressPercentage,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(colorAnim, {
        toValue: progressPercentage,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  }, [progressPercentage, progressAnim, colorAnim]);

  // Interpolate color based on progress
  const animatedColor = colorAnim.interpolate({
    inputRange: [0, 25, 50, 75, 100],
    outputRange: ["#FF3B30", "#FF9500", "#FF9500", "#64D2FF", "#34C759"],
    extrapolate: "clamp",
  });

  // Don't show anything if password is empty
  if (!password) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ["0%", "100%"],
                  extrapolate: "clamp",
                }),
                backgroundColor: animatedColor,
              },
            ]}
          />
        </View>

        {/* Strength Text */}
        {showStrengthText && (
          <Text variant='bodySmall' style={[styles.strengthText, { color: strengthColor }]}>
            {strengthText}
          </Text>
        )}
      </View>

      {/* Requirements Checklist */}
      {showRequirements && (
        <View style={styles.requirementsContainer}>
          <RequirementItem label='At least 12 characters' met={requirements.minLength} animated={password.length > 0} />
          <RequirementItem
            label='One uppercase letter'
            met={requirements.hasUppercase}
            animated={password.length > 0}
          />
          <RequirementItem
            label='One lowercase letter'
            met={requirements.hasLowercase}
            animated={password.length > 0}
          />
          <RequirementItem label='One number' met={requirements.hasNumbers} animated={password.length > 0} />
          <RequirementItem
            label='One special character'
            met={requirements.hasSpecialChars}
            animated={password.length > 0}
          />
        </View>
      )}
    </View>
  );
};

// ============================================================================
// REQUIREMENT ITEM COMPONENT
// ============================================================================

interface RequirementItemProps {
  label: string;
  met: boolean;
  animated?: boolean;
}

const RequirementItem: React.FC<RequirementItemProps> = ({ label, met, animated = true }) => {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (animated) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: met ? 1.1 : 0.8,
          tension: 300,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: met ? 1 : 0.5,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (met) {
          // Bounce back to normal size
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 300,
            friction: 10,
            useNativeDriver: true,
          }).start();
        }
      });
    }
  }, [met, animated, scaleAnim, opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.requirementItem,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}>
      <View style={[styles.checkmark, met ? styles.checkmarkMet : styles.checkmarkUnmet]}>
        <Text variant='caption' style={[styles.checkmarkText, { color: met ? "#FFFFFF" : "#8E8E93" }]}>
          {met ? "✓" : "○"}
        </Text>
      </View>
      <Text variant='bodySmall' style={[styles.requirementText, { color: met ? "#34C759" : "#8E8E93" }]}>
        {label}
      </Text>
    </Animated.View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "#F2F2F7",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "right",
  },
  requirementsContainer: {
    gap: 6,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
  },
  checkmark: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  checkmarkMet: {
    backgroundColor: "#34C759",
  },
  checkmarkUnmet: {
    backgroundColor: "#F2F2F7",
    borderWidth: 1,
    borderColor: "#8E8E93",
  },
  checkmarkText: {
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 12,
  },
  requirementText: {
    fontSize: 12,
    lineHeight: 16,
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default PasswordStrengthIndicator;
