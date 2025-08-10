// ============================================================================
// EXERCISE DETAIL SCREEN - COMPLETE EXERCISE LOGGER
// ============================================================================
// Full exercise logging interface with set tracking, rest timer, history, and navigation

import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";

// Components
import Text from "../../components/ui/Text";
import { Button } from "../../components/ui/Button";
import SetLogger from "../../components/workout/SetLogger";
import RestTimer from "../../components/workout/RestTimer";

// Services
import workoutService from "../../services/workout.service";
import workoutPlanService from "../../services/workoutPlan.service";

// Types
import { WorkoutStackParamList } from "../../types/navigation";
import type { ExerciseSet, ExerciseSetFormData } from "../../types";

// ============================================================================
// TYPES
// ============================================================================

type ExerciseDetailScreenNavigationProp = StackNavigationProp<WorkoutStackParamList, "ExerciseDetail">;
type ExerciseDetailScreenRouteProp = RouteProp<WorkoutStackParamList, "ExerciseDetail">;

interface ExerciseDetailScreenProps {
  navigation: ExerciseDetailScreenNavigationProp;
  route: ExerciseDetailScreenRouteProp;
}

interface ExerciseLoggerState {
  completedSets: ExerciseSet[];
  exerciseHistory: ExerciseHistorySession[];
  isLoading: boolean;
  showRestTimer: boolean;
  restDuration: number;
  currentSetNumber: number;
  nextExercise: NextExerciseInfo | null;
}

interface ExerciseHistorySession {
  date: string;
  sets: {
    weight?: number;
    reps: number;
    rpe?: number;
    isWarmup: boolean;
  }[];
}

interface NextExerciseInfo {
  id: string;
  name: string;
  index: number;
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ExerciseDetailScreen: React.FC<ExerciseDetailScreenProps> = ({ navigation, route }) => {
  const { exerciseId, exerciseIndex, workoutContext, exerciseData } = route.params;

  // ============================================================================
  // STATE
  // ============================================================================

  const [state, setState] = useState<ExerciseLoggerState>({
    completedSets: [],
    exerciseHistory: [],
    isLoading: true,
    showRestTimer: false,
    restDuration: exerciseData.restSeconds,
    currentSetNumber: 1,
    nextExercise: null,
  });

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    loadExerciseData();
    calculateNextExercise();
  }, [exerciseId]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadExerciseData = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      // Load exercise history (last 6 sessions)
      // This would typically come from workoutService or a dedicated history service
      const history = await loadExerciseHistory(exerciseId);

      setState((prev) => ({
        ...prev,
        exerciseHistory: history,
        isLoading: false,
      }));
    } catch (error) {
      console.error("Failed to load exercise data:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [exerciseId]);

  const loadExerciseHistory = async (exerciseId: string): Promise<ExerciseHistorySession[]> => {
    // Mock implementation - in real app, this would query the database
    // for the last 6 workout sessions containing this exercise
    return [
      {
        date: "2024-01-08",
        sets: [
          { weight: 100, reps: 8, rpe: 7, isWarmup: false },
          { weight: 100, reps: 8, rpe: 8, isWarmup: false },
          { weight: 100, reps: 7, rpe: 9, isWarmup: false },
        ],
      },
      {
        date: "2024-01-05",
        sets: [
          { weight: 95, reps: 8, rpe: 7, isWarmup: false },
          { weight: 95, reps: 8, rpe: 8, isWarmup: false },
          { weight: 95, reps: 8, rpe: 8, isWarmup: false },
        ],
      },
      {
        date: "2024-01-03",
        sets: [
          { weight: 90, reps: 8, rpe: 7, isWarmup: false },
          { weight: 90, reps: 8, rpe: 7, isWarmup: false },
          { weight: 90, reps: 8, rpe: 8, isWarmup: false },
        ],
      },
    ];
  };

  const calculateNextExercise = useCallback(async () => {
    try {
      // Get the workout session to find the next exercise
      const session = await workoutPlanService.getWorkoutSession(
        workoutContext.programId,
        workoutContext.phaseId,
        workoutContext.dayId
      );

      if (session && session.exercises) {
        const nextIndex = exerciseIndex + 1;
        if (nextIndex < session.exercises.length) {
          const nextEx = session.exercises[nextIndex];
          setState((prev) => ({
            ...prev,
            nextExercise: {
              id: nextEx.id,
              name: nextEx.name || "Next Exercise",
              index: nextIndex,
            },
          }));
        }
      }
    } catch (error) {
      console.error("Failed to calculate next exercise:", error);
    }
  }, [workoutContext, exerciseIndex]);

  // ============================================================================
  // SET LOGGING HANDLERS
  // ============================================================================

  const handleSetComplete = useCallback(
    async (setData: ExerciseSetFormData) => {
      try {
        // Create the exercise set
        const newSet: ExerciseSet = {
          id: `set_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          sessionId: "current_session", // Would come from active workout session
          exerciseId: setData.exerciseId,
          setNumber: state.currentSetNumber,
          weightKg: setData.weightKg,
          reps: setData.reps,
          rpe: setData.rpe,
          isWarmup: setData.isWarmup || false,
          isFailure: false,
          restSeconds: setData.restSeconds,
          notes: setData.notes,
          createdAt: new Date().toISOString(),
        };

        // Add to workout service
        const result = await workoutService.addExerciseSet(setData);

        if (result.success) {
          // Update local state
          setState((prev) => ({
            ...prev,
            completedSets: [...prev.completedSets, newSet],
            currentSetNumber: prev.currentSetNumber + 1,
            showRestTimer: !setData.isWarmup, // Show rest timer for working sets
            restDuration: setData.restSeconds || exerciseData.restSeconds,
          }));

          console.log("Set logged successfully:", newSet);
        } else {
          Alert.alert("Error", result.error || "Failed to log set");
        }
      } catch (error) {
        console.error("Failed to log set:", error);
        Alert.alert("Error", "Failed to log set. Please try again.");
      }
    },
    [state.currentSetNumber, exerciseData.restSeconds]
  );

  // ============================================================================
  // REST TIMER HANDLERS
  // ============================================================================

  const handleRestComplete = useCallback(() => {
    setState((prev) => ({ ...prev, showRestTimer: false }));
  }, []);

  const handleSkipRest = useCallback(() => {
    setState((prev) => ({ ...prev, showRestTimer: false }));
  }, []);

  // ============================================================================
  // NAVIGATION HANDLERS
  // ============================================================================

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleNextExercise = useCallback(() => {
    if (state.nextExercise) {
      navigation.replace("ExerciseDetail", {
        exerciseId: state.nextExercise.id,
        exerciseIndex: state.nextExercise.index,
        workoutContext,
        exerciseData: {
          // Would need to get this from the session data
          name: state.nextExercise.name,
          targetSets: exerciseData.targetSets,
          targetReps: exerciseData.targetReps,
          targetRpe: exerciseData.targetRpe,
          restSeconds: exerciseData.restSeconds,
          notes: "",
        },
      });
    }
  }, [state.nextExercise, navigation, workoutContext, exerciseData]);

  const handleCompleteWorkout = useCallback(() => {
    Alert.alert("Complete Workout?", "Are you finished with this workout?", [
      { text: "Continue", style: "cancel" },
      {
        text: "Complete",
        onPress: () => {
          // Navigate to workout summary or completion flow
          navigation.navigate("WorkoutSummary", { sessionId: "current_session" });
        },
      },
    ]);
  }, [navigation]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderHeader = () => (
    <View style={styles.header}>
      <Text variant='h1' color='primary' style={styles.exerciseName}>
        {exerciseData.name}
      </Text>

      <View style={styles.targetInfo}>
        <Text variant='body' color='secondary' style={styles.targetText}>
          Target: {exerciseData.targetSets} sets • {exerciseData.targetReps} reps • RPE {exerciseData.targetRpe} • Rest:{" "}
          {Math.round(exerciseData.restSeconds / 60)}min
        </Text>
      </View>

      {exerciseData.notes && (
        <View style={styles.formCues}>
          <Text variant='bodySmall' color='secondary' style={styles.formCuesTitle}>
            FORM CUES
          </Text>
          <Text variant='body' color='primary' style={styles.formCuesText}>
            {exerciseData.notes}
          </Text>
        </View>
      )}
    </View>
  );

  const renderCompletedSets = () => {
    if (state.completedSets.length === 0) return null;

    return (
      <View style={styles.completedSetsSection}>
        <Text variant='h3' color='primary' style={styles.sectionTitle}>
          Completed Sets
        </Text>

        {state.completedSets.map((set, index) => (
          <View key={set.id} style={styles.completedSetItem}>
            <Text variant='body' color='primary'>
              Set {set.setNumber}: {set.weightKg ? `${set.weightKg}kg` : "Bodyweight"} × {set.reps}
              {set.rpe && ` @ RPE ${set.rpe}`}
              {set.isWarmup && (
                <Text variant='bodySmall' color='secondary'>
                  {" "}
                  - Warmup
                </Text>
              )}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderExerciseHistory = () => {
    if (state.exerciseHistory.length === 0) return null;

    return (
      <View style={styles.historySection}>
        <Text variant='h3' color='primary' style={styles.sectionTitle}>
          Exercise History
        </Text>

        {state.exerciseHistory.map((session, index) => (
          <View key={session.date} style={styles.historyItem}>
            <Text variant='bodySmall' color='secondary' style={styles.historyDate}>
              {new Date(session.date).toLocaleDateString()}
            </Text>
            <Text variant='body' color='primary'>
              {session.sets
                .map(
                  (set, setIndex) =>
                    `${set.weight ? `${set.weight}kg` : "BW"} × ${set.reps}${set.rpe ? ` @ ${set.rpe}` : ""}`
                )
                .join(", ")}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderNavigationFooter = () => (
    <View style={styles.navigationFooter}>
      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Text variant='button' style={styles.backButtonText}>
          ← Back
        </Text>
      </TouchableOpacity>

      {state.nextExercise ? (
        <TouchableOpacity style={styles.nextButton} onPress={handleNextExercise}>
          <Text variant='button' style={styles.nextButtonText}>
            Next: {state.nextExercise.name} →
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.completeButton} onPress={handleCompleteWorkout}>
          <Text variant='button' style={styles.completeButtonText}>
            Complete Workout
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  if (state.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size='large' color={COLORS.primary} />
        <Text variant='body' color='secondary' style={styles.loadingText}>
          Loading exercise data...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderHeader()}

        {/* Rest Timer Section */}
        {state.showRestTimer && (
          <View style={styles.restTimerSection}>
            <RestTimer duration={state.restDuration} onComplete={handleRestComplete} onSkip={handleSkipRest} />
          </View>
        )}

        {/* Set Logging Section */}
        <View style={styles.setLoggerSection}>
          <SetLogger
            exerciseId={exerciseId}
            setNumber={state.currentSetNumber}
            onSetComplete={handleSetComplete}
            isFirstSet={state.completedSets.length === 0}
          />
        </View>

        {renderCompletedSets()}
        {renderExerciseHistory()}
      </ScrollView>

      {renderNavigationFooter()}
    </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Space for navigation footer
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  exerciseName: {
    marginBottom: 12,
    textAlign: "center",
  },
  targetInfo: {
    marginBottom: 16,
  },
  targetText: {
    textAlign: "center",
    lineHeight: 20,
  },
  formCues: {
    backgroundColor: COLORS.backgroundLight,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  formCuesTitle: {
    marginBottom: 8,
    fontWeight: "600",
  },
  formCuesText: {
    lineHeight: 20,
  },
  restTimerSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  setLoggerSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  completedSetsSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  sectionTitle: {
    marginBottom: 16,
  },
  completedSetItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.backgroundLight,
    borderRadius: 8,
    marginBottom: 8,
  },
  historySection: {
    padding: 20,
  },
  historyItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  historyDate: {
    marginBottom: 4,
    fontWeight: "500",
  },
  navigationFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    padding: 20,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
    gap: 12,
  },
  backButton: {
    flex: 1,
    height: 50,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  nextButton: {
    flex: 2,
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  nextButtonText: {
    color: COLORS.text,
    fontWeight: "600",
  },
  completeButton: {
    flex: 2,
    height: 50,
    backgroundColor: COLORS.success,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  completeButtonText: {
    color: COLORS.background,
    fontWeight: "600",
  },
});

export default ExerciseDetailScreen;
