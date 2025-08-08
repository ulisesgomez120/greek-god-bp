// ============================================================================
// EXERCISE CARD COMPONENT
// ============================================================================
// Individual exercise logging component with set history, instructions,
// and progressive overload recommendations

import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  ViewStyle,
} from "react-native";
import { useSelector } from "react-redux";
import { logger } from "../../utils/logger";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { SetLogger } from "./SetLogger";
import { Button } from "../ui/Button";
import { selectUser } from "../../store/auth/authSlice";
import type { Exercise, ExerciseSet, ExerciseSetFormData } from "../../types";

// ============================================================================
// TYPES
// ============================================================================

interface ExerciseCardProps {
  exercise: Exercise;
  currentSets: ExerciseSet[];
  previousWorkoutSets: ExerciseSet[];
  onSetComplete: (setData: ExerciseSetFormData) => void;
  isActive: boolean;
  style?: ViewStyle;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary: "#B5CFF8",
  success: "#34C759",
  warning: "#FF9500",
  text: "#1C1C1E",
  textSecondary: "#8E8E93",
  background: "#FFFFFF",
  backgroundLight: "#F8FAFD",
  border: "#E5E5EA",
} as const;

// ============================================================================
// COMPONENT
// ============================================================================

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  currentSets,
  previousWorkoutSets,
  onSetComplete,
  isActive,
  style,
}) => {
  // ============================================================================
  // HOOKS & STATE
  // ============================================================================

  const { triggerSelectionHaptic } = useHapticFeedback();
  const user = useSelector(selectUser);

  const [showInstructions, setShowInstructions] = useState(false);
  const [showPreviousData, setShowPreviousData] = useState(false);
  const [showProgressionTip, setShowProgressionTip] = useState(false);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const workingSets = useMemo(() => currentSets.filter((set) => !set.isWarmup), [currentSets]);
  const warmupSets = useMemo(() => currentSets.filter((set) => set.isWarmup), [currentSets]);

  const previousWorkingSets = useMemo(() => previousWorkoutSets.filter((set) => !set.isWarmup), [previousWorkoutSets]);

  const nextSetNumber = currentSets.length + 1;
  const isFirstSet = currentSets.length === 0;

  // Calculate suggested weight based on previous workout
  const suggestedWeight = useMemo(() => {
    if (previousWorkingSets.length === 0) return undefined;

    const lastWorkingSet = previousWorkingSets[previousWorkingSets.length - 1];
    return lastWorkingSet?.weightKg;
  }, [previousWorkingSets]);

  // Calculate progression recommendation
  const progressionRecommendation = useMemo(() => {
    if (previousWorkingSets.length === 0) return null;

    const avgRpe = previousWorkingSets.reduce((sum, set) => sum + (set.rpe || 0), 0) / previousWorkingSets.length;
    const lastWeight = previousWorkingSets[previousWorkingSets.length - 1]?.weightKg || 0;

    if (avgRpe <= 7 && avgRpe > 0) {
      return {
        shouldIncrease: true,
        suggestedWeight: lastWeight + 2.5,
        reason: `Previous RPE was ${avgRpe.toFixed(1)} - ready to increase weight`,
      };
    } else if (avgRpe >= 9) {
      return {
        shouldIncrease: false,
        suggestedWeight: lastWeight,
        reason: `Previous RPE was ${avgRpe.toFixed(1)} - maintain current weight`,
      };
    }

    return {
      shouldIncrease: false,
      suggestedWeight: lastWeight,
      reason: "Continue with same weight and focus on form",
    };
  }, [previousWorkingSets]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleToggleInstructions = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowInstructions((prev) => !prev);
    triggerSelectionHaptic();

    logger.debug(
      "Exercise instructions toggled",
      {
        exerciseId: exercise.id,
        showing: !showInstructions,
      },
      "workout",
      user?.id
    );
  }, [exercise.id, showInstructions, triggerSelectionHaptic, user?.id]);

  const handleTogglePreviousData = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowPreviousData((prev) => !prev);
    triggerSelectionHaptic();

    logger.debug(
      "Previous data toggled",
      {
        exerciseId: exercise.id,
        showing: !showPreviousData,
      },
      "workout",
      user?.id
    );
  }, [exercise.id, showPreviousData, triggerSelectionHaptic, user?.id]);

  const handleToggleProgressionTip = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowProgressionTip((prev) => !prev);
    triggerSelectionHaptic();
  }, [triggerSelectionHaptic]);

  const handleSetComplete = useCallback(
    (setData: ExerciseSetFormData) => {
      onSetComplete({
        ...setData,
        exerciseId: exercise.id,
      });

      logger.info(
        "Set logged",
        {
          exerciseId: exercise.id,
          setNumber: nextSetNumber,
          weight: setData.weightKg,
          reps: setData.reps,
          rpe: setData.rpe,
        },
        "workout",
        user?.id
      );
    },
    [exercise.id, nextSetNumber, onSetComplete, user?.id]
  );

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderExerciseHeader = () => (
    <View style={styles.header}>
      <View style={styles.titleContainer}>
        <Text style={styles.exerciseName} accessibilityRole='header'>
          {exercise.name}
        </Text>
        <View style={styles.muscleGroups}>
          {exercise.muscleGroups.slice(0, 2).map((muscle, index) => (
            <Text key={muscle} style={styles.muscleGroup}>
              {muscle}
              {index < Math.min(exercise.muscleGroups.length, 2) - 1 && " • "}
            </Text>
          ))}
          {exercise.muscleGroups.length > 2 && (
            <Text style={styles.muscleGroup}>+{exercise.muscleGroups.length - 2}</Text>
          )}
        </View>
      </View>

      <View style={styles.headerButtons}>
        <TouchableOpacity
          style={styles.infoButton}
          onPress={handleToggleInstructions}
          accessibilityLabel='Toggle exercise instructions'
          accessibilityRole='button'>
          <Text style={styles.infoButtonText}>ℹ️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderInstructions = () => {
    if (!showInstructions) return null;

    return (
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Instructions</Text>
        {exercise.instructions.map((instruction, index) => (
          <Text key={index} style={styles.instructionText}>
            {index + 1}. {instruction}
          </Text>
        ))}

        {exercise.tips && exercise.tips.length > 0 && (
          <>
            <Text style={styles.tipsTitle}>Tips</Text>
            {exercise.tips.map((tip, index) => (
              <Text key={index} style={styles.tipText}>
                • {tip}
              </Text>
            ))}
          </>
        )}
      </View>
    );
  };

  const renderProgressionTip = () => {
    if (!progressionRecommendation || !showProgressionTip) return null;

    return (
      <View
        style={[
          styles.progressionTip,
          progressionRecommendation.shouldIncrease ? styles.progressionTipPositive : styles.progressionTipNeutral,
        ]}>
        <Text style={styles.progressionTipTitle}>
          {progressionRecommendation.shouldIncrease ? "🚀 Ready to Progress!" : "💪 Keep Building"}
        </Text>
        <Text style={styles.progressionTipText}>{progressionRecommendation.reason}</Text>
        {progressionRecommendation.shouldIncrease && (
          <Text style={styles.progressionTipSuggestion}>Try {progressionRecommendation.suggestedWeight}kg</Text>
        )}
      </View>
    );
  };

  const renderPreviousData = () => {
    if (!showPreviousData || previousWorkingSets.length === 0) return null;

    return (
      <View style={styles.previousDataContainer}>
        <Text style={styles.previousDataTitle}>Previous Workout</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previousSetsScroll}>
          {previousWorkingSets.map((set, index) => (
            <View key={index} style={styles.previousSetCard}>
              <Text style={styles.previousSetNumber}>Set {set.setNumber}</Text>
              <Text style={styles.previousSetData}>
                {set.weightKg ? `${set.weightKg}kg` : "BW"} × {set.reps}
              </Text>
              {set.rpe && <Text style={styles.previousSetRpe}>RPE {set.rpe}</Text>}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderCurrentSets = () => {
    if (currentSets.length === 0) return null;

    return (
      <View style={styles.currentSetsContainer}>
        <Text style={styles.currentSetsTitle}>Today's Sets</Text>

        {warmupSets.length > 0 && (
          <View style={styles.warmupSetsContainer}>
            <Text style={styles.warmupSetsTitle}>Warmup</Text>
            {warmupSets.map((set, index) => (
              <View key={set.id} style={styles.completedSetRow}>
                <Text style={styles.completedSetNumber}>W{index + 1}</Text>
                <Text style={styles.completedSetData}>
                  {set.weightKg ? `${set.weightKg}kg` : "BW"} × {set.reps}
                </Text>
                {set.rpe && <Text style={styles.completedSetRpe}>RPE {set.rpe}</Text>}
              </View>
            ))}
          </View>
        )}

        {workingSets.length > 0 && (
          <View style={styles.workingSetsContainer}>
            <Text style={styles.workingSetsTitle}>Working Sets</Text>
            {workingSets.map((set, index) => (
              <View key={set.id} style={styles.completedSetRow}>
                <Text style={styles.completedSetNumber}>{index + 1}</Text>
                <Text style={styles.completedSetData}>
                  {set.weightKg ? `${set.weightKg}kg` : "BW"} × {set.reps}
                </Text>
                {set.rpe && <Text style={styles.completedSetRpe}>RPE {set.rpe}</Text>}
                <Text style={styles.completedSetCheck}>✓</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderActionButtons = () => (
    <View style={styles.actionButtons}>
      {previousWorkingSets.length > 0 && (
        <Button
          variant='text'
          onPress={handleTogglePreviousData}
          style={styles.actionButton}
          accessibilityLabel='Toggle previous workout data'>
          <Text style={styles.actionButtonText}>{showPreviousData ? "Hide" : "Show"} Previous</Text>
        </Button>
      )}

      {progressionRecommendation && (
        <Button
          variant='text'
          onPress={handleToggleProgressionTip}
          style={styles.actionButton}
          accessibilityLabel='Toggle progression tip'>
          <Text
            style={[
              styles.actionButtonText,
              progressionRecommendation.shouldIncrease && styles.actionButtonTextPositive,
            ]}>
            {showProgressionTip ? "Hide" : "Show"} Tip
          </Text>
        </Button>
      )}
    </View>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isActive) {
    return (
      <View style={[styles.container, styles.containerInactive, style]}>
        <Text style={styles.inactiveText}>Swipe to view this exercise</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, style]} showsVerticalScrollIndicator={false}>
      {renderExerciseHeader()}
      {renderInstructions()}
      {renderProgressionTip()}
      {renderPreviousData()}
      {renderCurrentSets()}
      {renderActionButtons()}

      <View style={styles.setLoggerContainer}>
        <SetLogger
          exerciseId={exercise.id}
          setNumber={nextSetNumber}
          suggestedWeight={suggestedWeight}
          onSetComplete={handleSetComplete}
          isFirstSet={isFirstSet}
        />
      </View>
    </ScrollView>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  containerInactive: {
    justifyContent: "center",
    alignItems: "center",
  },

  inactiveText: {
    fontSize: 17,
    color: COLORS.textSecondary,
    textAlign: "center",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingHorizontal: 4,
  },

  titleContainer: {
    flex: 1,
  },

  exerciseName: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 4,
  },

  muscleGroups: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  muscleGroup: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textTransform: "capitalize",
  },

  headerButtons: {
    flexDirection: "row",
    gap: 8,
  },

  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: "center",
    alignItems: "center",
  },

  infoButtonText: {
    fontSize: 16,
  },

  instructionsContainer: {
    backgroundColor: COLORS.backgroundLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },

  instructionsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 12,
  },

  instructionText: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: 8,
  },

  tipsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 8,
  },

  tipText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },

  progressionTip: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },

  progressionTipPositive: {
    backgroundColor: "rgba(52, 199, 89, 0.1)",
    borderWidth: 1,
    borderColor: COLORS.success,
  },

  progressionTipNeutral: {
    backgroundColor: "rgba(181, 207, 248, 0.1)",
    borderWidth: 1,
    borderColor: COLORS.primary,
  },

  progressionTipTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },

  progressionTipText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },

  progressionTipSuggestion: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.success,
  },

  previousDataContainer: {
    marginBottom: 16,
  },

  previousDataTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 12,
  },

  previousSetsScroll: {
    flexDirection: "row",
  },

  previousSetCard: {
    backgroundColor: COLORS.backgroundLight,
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    minWidth: 80,
    alignItems: "center",
  },

  previousSetNumber: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },

  previousSetData: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },

  previousSetRpe: {
    fontSize: 12,
    color: COLORS.primary,
  },

  currentSetsContainer: {
    marginBottom: 16,
  },

  currentSetsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 12,
  },

  warmupSetsContainer: {
    marginBottom: 12,
  },

  warmupSetsTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textSecondary,
    marginBottom: 8,
  },

  workingSetsContainer: {
    marginBottom: 12,
  },

  workingSetsTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
    marginBottom: 8,
  },

  completedSetRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.backgroundLight,
    borderRadius: 8,
    marginBottom: 4,
  },

  completedSetNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    width: 32,
  },

  completedSetData: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.text,
  },

  completedSetRpe: {
    fontSize: 13,
    color: COLORS.primary,
    marginRight: 8,
  },

  completedSetCheck: {
    fontSize: 16,
    color: COLORS.success,
  },

  actionButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginBottom: 20,
  },

  actionButton: {
    paddingHorizontal: 0,
  },

  actionButtonText: {
    fontSize: 15,
    color: COLORS.primary,
  },

  actionButtonTextPositive: {
    color: COLORS.success,
    fontWeight: "600",
  },

  setLoggerContainer: {
    marginTop: 8,
    paddingBottom: 20,
  },
});

export default ExerciseCard;
