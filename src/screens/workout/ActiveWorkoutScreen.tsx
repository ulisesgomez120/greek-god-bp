// ============================================================================
// ACTIVE WORKOUT SCREEN
// ============================================================================
// Main workout logging interface with real-time exercise logging, rest timers,
// RPE tracking, weight/rep entry, progress indicators, and workout completion flow

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  BackHandler,
  AppState,
  AppStateStatus,
  Dimensions,
  SafeAreaView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { logger } from "../../utils/logger";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useWorkoutTimer } from "../../hooks/useWorkoutTimer";
import { Button } from "../../components/ui/Button";
import { ExerciseCard } from "../../components/workout/ExerciseCard";
import { ProgressIndicator } from "../../components/workout/ProgressIndicator";
import { RestTimer } from "../../components/workout/RestTimer";
import {
  selectCurrentWorkout,
  selectIsWorkoutActive,
  selectCurrentExercise,
  selectCurrentSet,
  selectExercises,
  setCurrentExercise,
  setCurrentSet,
  completeWorkout,
  cancelWorkout,
  addExerciseSet,
} from "../../store/workout/workoutSlice";
import { selectUser } from "../../store/auth/authSlice";
import type { RootState } from "../../types";
import type { ExerciseSetFormData } from "../../types";

// ============================================================================
// TYPES
// ============================================================================

interface ActiveWorkoutScreenProps {
  navigation: any;
  route: {
    params?: {
      workoutId?: string;
      resumeSession?: boolean;
    };
  };
}

interface WorkoutSummaryData {
  totalVolume: number;
  totalSets: number;
  duration: number;
  averageRpe: number;
  exercisesCompleted: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary: "#B5CFF8",
  success: "#34C759",
  warning: "#FF9500",
  error: "#FF3B30",
  text: "#1C1C1E",
  textSecondary: "#8E8E93",
  background: "#FFFFFF",
  backgroundLight: "#F8FAFD",
} as const;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ActiveWorkoutScreen: React.FC<ActiveWorkoutScreenProps> = ({ navigation, route }) => {
  // ============================================================================
  // HOOKS & STATE
  // ============================================================================

  const dispatch = useDispatch();
  const { triggerHaptic } = useHapticFeedback();
  const { workoutDuration, startTimer, stopTimer, resetTimer } = useWorkoutTimer();

  // Redux selectors
  const currentWorkout = useSelector(selectCurrentWorkout);
  const isWorkoutActive = useSelector(selectIsWorkoutActive);
  const currentExerciseIndex = useSelector(selectCurrentExercise);
  const currentSetIndex = useSelector(selectCurrentSet);
  const exercises = useSelector(selectExercises);
  const user = useSelector(selectUser);

  // Local state
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restDuration, setRestDuration] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [workoutNotes, setWorkoutNotes] = useState("");
  const [showCompletionSummary, setShowCompletionSummary] = useState(false);

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const appState = useRef(AppState.currentState);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const workoutExercises =
    currentWorkout?.exercises?.map((exerciseId) => exercises.find((ex) => ex.id === exerciseId)).filter(Boolean) || [];

  const currentExercise = workoutExercises[currentExerciseIndex];
  const totalExercises = workoutExercises.length;
  const workoutProgress = totalExercises > 0 ? (currentExerciseIndex + 1) / totalExercises : 0;

  const currentWorkoutSets = currentWorkout?.sets || [];
  const currentExerciseSets = currentWorkoutSets.filter((set) => set.exerciseId === currentExercise?.id);

  // Calculate workout summary data
  const workoutSummary: WorkoutSummaryData = {
    totalVolume: currentWorkoutSets
      .filter((set) => !set.isWarmup)
      .reduce((sum, set) => sum + (set.weightKg || 0) * set.reps, 0),
    totalSets: currentWorkoutSets.length,
    duration: workoutDuration,
    averageRpe: currentWorkoutSets
      .filter((set) => set.rpe && !set.isWarmup)
      .reduce((sum, set, _, arr) => sum + (set.rpe || 0) / arr.length, 0),
    exercisesCompleted: new Set(currentWorkoutSets.map((set) => set.exerciseId)).size,
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initialize workout timer
  useEffect(() => {
    if (isWorkoutActive && currentWorkout) {
      startTimer();
      logger.info("Workout timer started", { workoutId: currentWorkout.id }, "workout", user?.id);
    }

    return () => {
      if (!isWorkoutActive) {
        stopTimer();
      }
    };
  }, [isWorkoutActive, currentWorkout, startTimer, stopTimer, user?.id]);

  // Handle app state changes for timer persistence
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === "active") {
        // App came to foreground - check if rest timer completed
        logger.info("App returned to foreground during workout", undefined, "workout", user?.id);
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription?.remove();
  }, [user?.id]);

  // Handle hardware back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleExitWorkout();
        return true; // Prevent default back action
      };

      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [])
  );

  // Auto-scroll to current exercise
  useEffect(() => {
    if (scrollViewRef.current && currentExerciseIndex >= 0) {
      const scrollPosition = currentExerciseIndex * SCREEN_WIDTH;
      scrollViewRef.current.scrollTo({ x: scrollPosition, animated: true });
    }
  }, [currentExerciseIndex]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSetComplete = useCallback(
    async (setData: ExerciseSetFormData) => {
      if (!currentExercise || !currentWorkout) return;

      try {
        await triggerHaptic("medium");

        // Add set to workout
        dispatch(
          addExerciseSet({
            exerciseId: currentExercise.id,
            weightKg: setData.weightKg,
            reps: setData.reps,
            rpe: setData.rpe,
            isWarmup: setData.isWarmup,
            restSeconds: setData.restSeconds,
            notes: setData.notes,
          })
        );

        // Start rest timer if not a warmup set
        if (!setData.isWarmup && setData.restSeconds && setData.restSeconds > 0) {
          setRestDuration(setData.restSeconds);
          setShowRestTimer(true);
        }

        // Move to next set
        dispatch(setCurrentSet(currentSetIndex + 1));

        logger.info(
          "Set completed",
          {
            exerciseId: currentExercise.id,
            weight: setData.weightKg,
            reps: setData.reps,
            rpe: setData.rpe,
          },
          "workout",
          user?.id
        );
      } catch (error) {
        logger.error("Failed to complete set", error, "workout", user?.id);
        Alert.alert("Error", "Failed to save set. Please try again.");
      }
    },
    [currentExercise, currentWorkout, currentSetIndex, dispatch, triggerHaptic, user?.id]
  );

  const handleNextExercise = useCallback(() => {
    if (currentExerciseIndex < totalExercises - 1) {
      dispatch(setCurrentExercise(currentExerciseIndex + 1));
      dispatch(setCurrentSet(0));
      triggerHaptic("light");

      logger.info(
        "Moved to next exercise",
        {
          fromIndex: currentExerciseIndex,
          toIndex: currentExerciseIndex + 1,
        },
        "workout",
        user?.id
      );
    }
  }, [currentExerciseIndex, totalExercises, dispatch, triggerHaptic, user?.id]);

  const handlePreviousExercise = useCallback(() => {
    if (currentExerciseIndex > 0) {
      dispatch(setCurrentExercise(currentExerciseIndex - 1));
      dispatch(setCurrentSet(0));
      triggerHaptic("light");

      logger.info(
        "Moved to previous exercise",
        {
          fromIndex: currentExerciseIndex,
          toIndex: currentExerciseIndex - 1,
        },
        "workout",
        user?.id
      );
    }
  }, [currentExerciseIndex, dispatch, triggerHaptic, user?.id]);

  const handleRestTimerComplete = useCallback(() => {
    setShowRestTimer(false);
    triggerHaptic("heavy");
    logger.info("Rest timer completed", { duration: restDuration }, "workout", user?.id);
  }, [restDuration, triggerHaptic, user?.id]);

  const handleCompleteWorkout = useCallback(async () => {
    if (!currentWorkout || isCompleting) return;

    try {
      setIsCompleting(true);
      await triggerHaptic("heavy");

      // Show completion summary first
      setShowCompletionSummary(true);

      // Complete workout after a brief delay for UX
      setTimeout(async () => {
        dispatch(
          completeWorkout({
            notes: workoutNotes,
            totalVolumeKg: workoutSummary.totalVolume,
            averageRpe: workoutSummary.averageRpe,
          })
        );

        stopTimer();

        logger.info(
          "Workout completed",
          {
            workoutId: currentWorkout.id,
            duration: workoutDuration,
            totalVolume: workoutSummary.totalVolume,
            totalSets: workoutSummary.totalSets,
          },
          "workout",
          user?.id
        );

        // Navigate to summary screen
        navigation.replace("WorkoutSummary", {
          workoutId: currentWorkout.id,
          summary: workoutSummary,
        });
      }, 2000); // 2 second delay for celebration animation
    } catch (error) {
      logger.error("Failed to complete workout", error, "workout", user?.id);
      Alert.alert("Error", "Failed to complete workout. Please try again.");
      setIsCompleting(false);
      setShowCompletionSummary(false);
    }
  }, [
    currentWorkout,
    isCompleting,
    workoutNotes,
    workoutSummary,
    workoutDuration,
    dispatch,
    stopTimer,
    triggerHaptic,
    navigation,
    user?.id,
  ]);

  const handleExitWorkout = useCallback(() => {
    Alert.alert("Exit Workout", "Are you sure you want to exit? Your progress will be saved.", [
      {
        text: "Continue Workout",
        style: "cancel",
      },
      {
        text: "Save & Exit",
        onPress: () => {
          stopTimer();
          navigation.goBack();
          logger.info("Workout saved and exited", { workoutId: currentWorkout?.id }, "workout", user?.id);
        },
      },
      {
        text: "Discard Workout",
        style: "destructive",
        onPress: () => {
          dispatch(cancelWorkout());
          stopTimer();
          resetTimer();
          navigation.goBack();
          logger.info("Workout discarded", { workoutId: currentWorkout?.id }, "workout", user?.id);
        },
      },
    ]);
  }, [currentWorkout?.id, dispatch, navigation, resetTimer, stopTimer, user?.id]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderWorkoutHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Button variant='text' onPress={handleExitWorkout} style={styles.exitButton} accessibilityLabel='Exit workout'>
          <Text style={styles.exitButtonText}>Exit</Text>
        </Button>

        <View style={styles.timerContainer}>
          <Text
            style={styles.timerText}
            accessibilityLabel={`Workout duration: ${Math.floor(workoutDuration / 60)} minutes`}>
            {Math.floor(workoutDuration / 60)}:{(workoutDuration % 60).toString().padStart(2, "0")}
          </Text>
        </View>

        <Button
          variant='text'
          onPress={handleCompleteWorkout}
          disabled={currentWorkoutSets.length === 0 || isCompleting}
          style={styles.completeButton}
          accessibilityLabel='Complete workout'>
          <Text style={[styles.completeButtonText, isCompleting && styles.completeButtonTextDisabled]}>
            {isCompleting ? "Finishing..." : "Finish"}
          </Text>
        </Button>
      </View>

      <ProgressIndicator
        progress={workoutProgress}
        currentExercise={currentExerciseIndex + 1}
        totalExercises={totalExercises}
        style={styles.progressIndicator}
      />
    </View>
  );

  const renderExerciseNavigation = () => (
    <View style={styles.navigationContainer}>
      <Button
        variant='secondary'
        onPress={handlePreviousExercise}
        disabled={currentExerciseIndex === 0}
        style={styles.navButton}
        accessibilityLabel='Previous exercise'>
        <Text style={styles.navButtonText}>← Previous</Text>
      </Button>

      <Text
        style={styles.exerciseCounter}
        accessibilityLabel={`Exercise ${currentExerciseIndex + 1} of ${totalExercises}`}>
        {currentExerciseIndex + 1} / {totalExercises}
      </Text>

      <Button
        variant='secondary'
        onPress={handleNextExercise}
        disabled={currentExerciseIndex === totalExercises - 1}
        style={styles.navButton}
        accessibilityLabel='Next exercise'>
        <Text style={styles.navButtonText}>Next →</Text>
      </Button>
    </View>
  );

  const renderCompletionCelebration = () => (
    <View style={styles.celebrationOverlay}>
      <View style={styles.celebrationContent}>
        <Text style={styles.celebrationTitle}>🎉 Workout Complete! 🎉</Text>
        <Text style={styles.celebrationSubtitle}>Great job crushing your workout!</Text>

        <View style={styles.quickStats}>
          <Text style={styles.quickStat}>{workoutSummary.totalSets} sets</Text>
          <Text style={styles.quickStat}>{Math.round(workoutSummary.totalVolume)}kg volume</Text>
          <Text style={styles.quickStat}>{Math.floor(workoutDuration / 60)}min</Text>
        </View>
      </View>
    </View>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!currentWorkout || !isWorkoutActive) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No active workout found</Text>
          <Button onPress={() => navigation.goBack()}>
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentExercise) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No exercises found for this workout</Text>
          <Button onPress={() => navigation.goBack()}>
            <Text>Go Back</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {renderWorkoutHeader()}

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false} // Disable manual scrolling, use navigation buttons
        style={styles.exerciseScrollView}
        contentContainerStyle={styles.exerciseScrollContent}>
        {workoutExercises.map((exercise, index) => (
          <View key={exercise.id} style={styles.exercisePage}>
            <ExerciseCard
              exercise={exercise}
              currentSets={currentWorkoutSets.filter((set) => set.exerciseId === exercise.id)}
              onSetComplete={handleSetComplete}
              isActive={index === currentExerciseIndex}
              previousWorkoutSets={[]} // TODO: Load from previous workouts
              style={styles.exerciseCard}
            />
          </View>
        ))}
      </ScrollView>

      {renderExerciseNavigation()}

      {showRestTimer && (
        <RestTimer
          duration={restDuration}
          onComplete={handleRestTimerComplete}
          onSkip={() => setShowRestTimer(false)}
          style={styles.restTimer}
        />
      )}

      {showCompletionSummary && renderCompletionCelebration()}
    </SafeAreaView>
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

  header: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.backgroundLight,
  },

  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  exitButton: {
    paddingHorizontal: 0,
  },

  exitButtonText: {
    fontSize: 17,
    color: COLORS.textSecondary,
    fontWeight: "400",
  },

  timerContainer: {
    alignItems: "center",
  },

  timerText: {
    fontSize: 24,
    fontWeight: "600",
    color: COLORS.text,
    fontVariant: ["tabular-nums"],
  },

  completeButton: {
    paddingHorizontal: 0,
  },

  completeButtonText: {
    fontSize: 17,
    color: COLORS.primary,
    fontWeight: "500",
  },

  completeButtonTextDisabled: {
    color: COLORS.textSecondary,
  },

  progressIndicator: {
    marginTop: 8,
  },

  exerciseScrollView: {
    flex: 1,
  },

  exerciseScrollContent: {
    // Content will be sized by individual pages
  },

  exercisePage: {
    width: SCREEN_WIDTH,
    flex: 1,
  },

  exerciseCard: {
    flex: 1,
    margin: 16,
  },

  navigationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.backgroundLight,
    borderTopWidth: 1,
    borderTopColor: COLORS.backgroundLight,
  },

  navButton: {
    minWidth: 80,
  },

  navButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },

  exerciseCounter: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },

  restTimer: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 16,
  },

  celebrationOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },

  celebrationContent: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    marginHorizontal: 32,
  },

  celebrationTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 8,
  },

  celebrationSubtitle: {
    fontSize: 17,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 24,
  },

  quickStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },

  quickStat: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primary,
    textAlign: "center",
  },

  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },

  errorText: {
    fontSize: 17,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 24,
  },
});

export default ActiveWorkoutScreen;
