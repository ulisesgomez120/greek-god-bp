// ============================================================================
// EXPERIENCE LEVEL SELECTOR COMPONENT
// ============================================================================
// Interactive experience level selection component with visual indicators,
// accessibility features, and smooth animations

import React, { useState, useCallback } from "react";
import { View, StyleSheet, Animated, Pressable } from "react-native";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import useTheme from "@/hooks/useTheme";
import type { ExperienceLevelInfo } from "@/types/profile";
import type { ExperienceLevel } from "@/types/database";
import { EXPERIENCE_LEVELS, getExperienceLevelInfo } from "@/types/profile";

// ============================================================================
// TYPES
// ============================================================================

export interface ExperienceLevelSelectorProps {
  selectedLevel?: ExperienceLevel;
  onLevelSelect: (level: ExperienceLevel) => void;
  showDetails?: boolean;
  compact?: boolean;
  disabled?: boolean;
  excludeAdvanced?: boolean; // Option to exclude advanced level for most users
}

interface LevelCardProps {
  levelInfo: ExperienceLevelInfo;
  isSelected: boolean;
  onSelect: () => void;
  showDetails: boolean;
  compact: boolean;
  disabled: boolean;
  index: number;
}

// ============================================================================
// LEVEL CARD COMPONENT
// ============================================================================

const LevelCard: React.FC<LevelCardProps> = ({
  levelInfo,
  isSelected,
  onSelect,
  showDetails,
  compact,
  disabled,
  index,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [scaleAnim] = useState(new Animated.Value(1));
  const [pressAnim] = useState(new Animated.Value(0));

  const handlePressIn = useCallback(() => {
    if (disabled) return;

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.98,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(pressAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  }, [disabled, scaleAnim, pressAnim]);

  const handlePressOut = useCallback(() => {
    if (disabled) return;

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.timing(pressAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  }, [disabled, scaleAnim, pressAnim]);

  const handlePress = useCallback(() => {
    if (disabled) return;

    // Celebration animation when selected
    if (!isSelected) {
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.05,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }),
      ]).start();
    }

    onSelect();
  }, [disabled, isSelected, onSelect, scaleAnim]);

  // Calculate difficulty level (0-4 based on experience level)
  const difficultyLevel = Math.min(index, 4);
  const difficultyPercentage = ((difficultyLevel + 1) / 5) * 100;

  // Get level color based on difficulty - use theme tokens with safe fallbacks
  const getLevelColor = (level: number): string => {
    const palette = [
      colors.success || "#34C759",
      colors.primary || "#64D2FF",
      colors.warning || "#FF9500",
      colors.primaryOnDark || "#FF6B35",
      colors.error || "#FF3B30",
    ];
    return palette[level] || palette[0];
  };

  const levelColor = getLevelColor(difficultyLevel);

  const animatedBackgroundColor = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      isSelected ? colors.surfaceElevated || colors.surface || colors.background : colors.background,
      colors.surfaceElevated || colors.surface,
    ],
  });

  return (
    <Animated.View
      style={[
        styles.levelCard,
        compact && styles.levelCardCompact,
        isSelected && styles.levelCardSelected,
        disabled && styles.levelCardDisabled,
        { transform: [{ scale: scaleAnim }] },
      ]}>
      <Animated.View style={[styles.levelCardBackground, { backgroundColor: animatedBackgroundColor }]}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          style={styles.levelCardPressable}
          accessibilityRole='button'
          accessibilityLabel={`Select ${levelInfo.name} experience level`}
          accessibilityHint={`${levelInfo.description}. Duration: ${levelInfo.duration}`}
          accessibilityState={{ selected: isSelected, disabled }}>
          {/* Header with name and difficulty indicator */}
          <View style={styles.levelCardHeader}>
            <View style={styles.levelNameContainer}>
              <Text
                style={[
                  styles.levelName,
                  compact && styles.levelNameCompact,
                  isSelected && styles.levelNameSelected,
                  disabled && styles.levelNameDisabled,
                ]}>
                {levelInfo.name}
              </Text>

              {/* Difficulty indicator */}
              <View style={styles.difficultyContainer}>
                <View style={styles.difficultyTrack}>
                  <Animated.View
                    style={[
                      styles.difficultyFill,
                      {
                        width: `${difficultyPercentage}%`,
                        backgroundColor: levelColor,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.difficultyText}>{difficultyLevel + 1}/5</Text>
              </View>
            </View>

            <Text
              style={[
                styles.levelDuration,
                isSelected && styles.levelDurationSelected,
                disabled && styles.levelDurationDisabled,
              ]}>
              {levelInfo.duration}
            </Text>
          </View>

          {/* Description */}
          <Text
            style={[
              styles.levelDescription,
              compact && styles.levelDescriptionCompact,
              isSelected && styles.levelDescriptionSelected,
              disabled && styles.levelDescriptionDisabled,
            ]}>
            {levelInfo.description}
          </Text>

          {/* Detailed information (when showDetails is true) */}
          {showDetails && !compact && (
            <View style={styles.levelDetails}>
              {/* Progression strategy */}
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Strategy:</Text>
                <Text style={[styles.detailText, isSelected && styles.detailTextSelected]}>
                  {levelInfo.progressionStrategy}
                </Text>
              </View>

              {/* Key characteristics */}
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Key traits:</Text>
                <View style={styles.characteristicsList}>
                  {levelInfo.characteristics.slice(0, 2).map((characteristic, idx) => (
                    <Text
                      key={idx}
                      style={[styles.characteristicItem, isSelected && styles.characteristicItemSelected]}>
                      • {characteristic}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Selection indicator */}
          {isSelected && (
            <View style={styles.selectionIndicator}>
              <View style={[styles.selectionDot, { backgroundColor: levelColor }]} />
            </View>
          )}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ExperienceLevelSelector: React.FC<ExperienceLevelSelectorProps> = ({
  selectedLevel,
  onLevelSelect,
  showDetails = true,
  compact = false,
  disabled = false,
  excludeAdvanced = true,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  // Filter experience levels (exclude advanced for most users)
  const availableLevels = EXPERIENCE_LEVELS.filter((level) => {
    if (excludeAdvanced && level.level === "advanced") {
      return false;
    }
    return true;
  });

  const handleLevelSelect = useCallback(
    (level: ExperienceLevel) => {
      if (disabled) return;
      onLevelSelect(level);
    },
    [disabled, onLevelSelect]
  );

  return (
    <View
      style={[styles.container, compact && styles.containerCompact, disabled && styles.containerDisabled]}
      accessibilityRole='radiogroup'
      accessibilityLabel='Experience level selection'>
      {/* Header */}
      {!compact && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Choose Your Experience Level</Text>
          <Text style={styles.headerDescription}>
            This determines your progression strategy and workout recommendations
          </Text>
        </View>
      )}

      {/* Level cards */}
      <View style={[styles.levelsContainer, compact && styles.levelsContainerCompact]}>
        {availableLevels.map((levelInfo, index) => (
          <LevelCard
            key={levelInfo.level}
            levelInfo={levelInfo}
            isSelected={selectedLevel === levelInfo.level}
            onSelect={() => handleLevelSelect(levelInfo.level)}
            showDetails={showDetails}
            compact={compact}
            disabled={disabled}
            index={index}
          />
        ))}
      </View>

      {/* Help text */}
      {!compact && (
        <View style={styles.helpContainer}>
          <Text style={styles.helpText}>
            💡 Not sure? Start with a lower level - you can always progress up as you improve!
          </Text>
        </View>
      )}
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    containerCompact: {
      flex: 0,
    },
    containerDisabled: {
      opacity: 0.6,
    },
    header: {
      marginBottom: 24,
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
      marginBottom: 8,
    },
    headerDescription: {
      fontSize: 16,
      color: colors.subtext,
      textAlign: "center",
      lineHeight: 22,
      paddingHorizontal: 20,
    },
    levelsContainer: {
      gap: 16,
    },
    levelsContainerCompact: {
      gap: 12,
    },
    levelCard: {
      borderRadius: 16,
      overflow: "hidden",
      elevation: 2,
      shadowColor: colors.shadow || "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    levelCardCompact: {
      borderRadius: 12,
    },
    levelCardSelected: {
      elevation: 4,
      shadowOpacity: 0.15,
      shadowRadius: 12,
    },
    levelCardDisabled: {
      opacity: 0.5,
    },
    levelCardBackground: {
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 16,
      backgroundColor: colors.surface,
    },
    levelCardPressable: {
      padding: 20,
      position: "relative",
    },
    levelCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    levelNameContainer: {
      flex: 1,
      marginRight: 16,
    },
    levelName: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 8,
    },
    levelNameCompact: {
      fontSize: 18,
      marginBottom: 6,
    },
    levelNameSelected: {
      color: colors.primary,
    },
    levelNameDisabled: {
      color: colors.subtext,
    },
    difficultyContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    difficultyTrack: {
      width: 60,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      overflow: "hidden",
    },
    difficultyFill: {
      height: "100%",
      borderRadius: 2,
    },
    difficultyText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.subtext,
    },
    levelDuration: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.subtext,
      textAlign: "right",
    },
    levelDurationSelected: {
      color: colors.primary,
    },
    levelDurationDisabled: {
      color: colors.muted || colors.subtext,
    },
    levelDescription: {
      fontSize: 16,
      color: colors.subtext,
      lineHeight: 22,
      marginBottom: 16,
    },
    levelDescriptionCompact: {
      fontSize: 14,
      marginBottom: 0,
    },
    levelDescriptionSelected: {
      color: colors.text,
    },
    levelDescriptionDisabled: {
      color: colors.muted || colors.subtext,
    },
    levelDetails: {
      gap: 12,
    },
    detailSection: {
      gap: 4,
    },
    detailLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    detailText: {
      fontSize: 14,
      color: colors.subtext,
      lineHeight: 20,
    },
    detailTextSelected: {
      color: colors.primary,
      fontWeight: "500",
    },
    characteristicsList: {
      gap: 2,
    },
    characteristicItem: {
      fontSize: 14,
      color: colors.subtext,
      lineHeight: 20,
    },
    characteristicItemSelected: {
      color: colors.text,
    },
    selectionIndicator: {
      position: "absolute",
      top: 16,
      right: 16,
    },
    selectionDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    helpContainer: {
      marginTop: 24,
      paddingHorizontal: 20,
    },
    helpText: {
      fontSize: 15,
      color: colors.subtext,
      textAlign: "center",
      lineHeight: 20,
      fontStyle: "italic",
    },
  });

export default ExperienceLevelSelector;
