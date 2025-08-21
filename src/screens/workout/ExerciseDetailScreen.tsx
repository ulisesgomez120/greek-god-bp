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
import CompactRestTimer from "../../components/workout/CompactRestTimer";

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
    notes?: string;
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

  // Local submitting state for set submissions
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
  // Fetch recent exercise history (last `limit` sessions)
  const loadExerciseData = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      const history = await workoutService.getExerciseHistory(exerciseId, 6);

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

  // Hide bottom tab bar while this screen is focused, restore on blur
  useEffect(() => {
    const parent = (navigation as any).getParent?.();
    if (!parent || !parent.setOptions) {
      return;
    }

    const hideTabBar = () => {
      try {
        parent.setOptions({ tabBarStyle: { display: "none" } });
      } catch (err) {
        // ignore
      }
    };

    const showTabBar = () => {
      try {
        parent.setOptions({ tabBarStyle: undefined });
      } catch (err) {
        // ignore
      }
    };

    const unsubFocus = navigation.addListener("focus", hideTabBar);
    const unsubBlur = navigation.addListener("blur", showTabBar);

    // If already focused, hide immediately
    if ((navigation as any).isFocused && (navigation as any).isFocused()) {
      hideTabBar();
    }

    return () => {
      unsubFocus();
      unsubBlur();
      // restore on cleanup
      showTabBar();
    };
  }, [navigation]);

  // end DATA LOADING

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
      setIsSubmitting(true);
      try {
        // Ensure there's an active workout session; if not, start one using workoutContext
        if (!workoutService.hasActiveWorkout()) {
          const sessionName = workoutContext?.workoutName || "Workout";
          const startResult = await workoutService.startWorkout(sessionName, [setData.exerciseId], {
            planId: workoutContext?.programId,
            sessionId: workoutContext?.dayId,
          });

          if (!startResult.success) {
            Alert.alert("Failed to start workout", startResult.error || "Unable to start workout");
            return startResult;
          }
        }

        // Persist the set via workoutService (direct online). Service returns the created set.
        const result = await workoutService.addExerciseSet(setData);

        if (!result.success) {
          Alert.alert("Error", result.error || "Failed to log set");
          return result;
        }

        const createdSet = result.data as ExerciseSet;

        // Update local state using returned set (do not fabricate ids here)
        setState((prev) => ({
          ...prev,
          completedSets: [...prev.completedSets, createdSet],
          currentSetNumber: prev.currentSetNumber + 1,
          showRestTimer: !setData.isWarmup,
          restDuration: setData.restSeconds || exerciseData.restSeconds,
        }));

        // Removed immediate background sync: persistence is attempted inline by the service.
        console.log("Set logged successfully:", createdSet);
        return result;
      } catch (error) {
        console.error("Failed to log set:", error);
        Alert.alert("Error", "Failed to log set. Please try again.");
        return { success: false, error: error instanceof Error ? error.message : "Failed to log set" };
      } finally {
        setIsSubmitting(false);
      }
    },
    [exerciseData.restSeconds, workoutContext]
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

  const handleNextExercise = useCallback(() => {
    if (!state.nextExercise) return;

    const nextIndex = state.nextExercise.index;

    // Prefer the cached session payload to avoid additional network/db calls.
    const cachedSession = workoutPlanService.getCachedWorkoutSession(
      workoutContext.programId,
      workoutContext.phaseId,
      workoutContext.dayId
    );

    const nextExercisePayload =
      cachedSession && cachedSession.exercises && cachedSession.exercises[nextIndex]
        ? {
            name: cachedSession.exercises[nextIndex].name,
            targetSets: (cachedSession.exercises[nextIndex] as any).targetSets ?? exerciseData.targetSets,
            targetReps: (() => {
              const ex = cachedSession.exercises[nextIndex] as any;
              if (ex && ex.targetRepsMin !== undefined && ex.targetRepsMax !== undefined) {
                return ex.targetRepsMin === ex.targetRepsMax
                  ? String(ex.targetRepsMin)
                  : `${ex.targetRepsMin}-${ex.targetRepsMax}`;
              }
              if (ex && ex.targetRepsMin !== undefined) {
                return String(ex.targetRepsMin);
              }
              return exerciseData.targetReps;
            })(),
            targetRpe: (cachedSession.exercises[nextIndex] as any).targetRpe ?? exerciseData.targetRpe,
            restSeconds: (cachedSession.exercises[nextIndex] as any).restSeconds ?? exerciseData.restSeconds,
            notes: (cachedSession.exercises[nextIndex] as any).notes ?? "",
          }
        : {
            // Fallback: use minimal info we already have in state/params without making a network call
            name: state.nextExercise.name,
            targetSets: exerciseData.targetSets,
            targetReps: exerciseData.targetReps,
            targetRpe: exerciseData.targetRpe,
            restSeconds: exerciseData.restSeconds,
            notes: "",
          };

    navigation.replace("ExerciseDetail", {
      exerciseId: state.nextExercise.id,
      exerciseIndex: state.nextExercise.index,
      workoutContext,
      exerciseData: nextExercisePayload,
    });
  }, [state.nextExercise, navigation, workoutContext, exerciseData]);

  const handleCompleteWorkout = useCallback(() => {
    Alert.alert("Complete Workout?", "Are you finished with this workout?", [
      { text: "Continue", style: "cancel" },
      {
        text: "Complete",
        onPress: async () => {
          try {
            // Finalize the workout via the service so stats are computed and stored
            const result = await workoutService.completeWorkout();

            if (!result.success) {
              Alert.alert("Error", result.error || "Failed to complete workout");
              return;
            }

            const completed = result.data;
            const sessionId = completed?.id ?? "current_session";

            navigation.navigate("WorkoutSummary", { sessionId });
          } catch (error) {
            console.error("Failed to complete workout", error);
            Alert.alert("Error", "Failed to complete workout");
          }
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
    if (state.exerciseHistory.length === 0) {
      return (
        <View style={styles.historySection}>
          <Text variant='h3' color='primary' style={styles.sectionTitle}>
            Exercise History
          </Text>
          <Text variant='body' color='secondary'>
            No history found
          </Text>
        </View>
      );
    }
    console.log("state.exerciseHistory", state.exerciseHistory[0]);
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
            <View style={styles.historySets}>
              {session.sets.map((set, setIndex) => (
                <View key={setIndex} style={{ marginBottom: 6 }}>
                  <Text variant='body' color='primary' style={styles.historySetItem}>
                    • Set {setIndex + 1}: {set.weight ? `${set.weight}kg` : "BW"} × {set.reps}
                    {set.rpe ? ` @ RPE ${set.rpe}` : ""}
                    {set.isWarmup && (
                      <Text variant='bodySmall' color='secondary'>
                        {" "}
                        - Warmup
                      </Text>
                    )}
                  </Text>
                  {set.notes ? (
                    <Text variant='bodySmall' color='secondary' style={{ marginLeft: 12 }}>
                      Notes: {set.notes}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderNavigationFooter = () => (
    <View style={styles.navigationFooter}>
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
        <View style={styles.restTimerSection}>
          <CompactRestTimer duration={state.restDuration} onComplete={handleRestComplete} onSkip={handleSkipRest} />
        </View>

        {/* Set Logging Section */}
        <View style={styles.setLoggerSection}>
          <SetLogger
            exerciseId={exerciseId}
            setNumber={state.currentSetNumber}
            suggestedWeight={
              state.completedSets.length > 0 ? state.completedSets[state.completedSets.length - 1].weightKg : undefined
            }
            suggestedReps={
              state.completedSets.length > 0 ? state.completedSets[state.completedSets.length - 1].reps : undefined
            }
            onSetComplete={handleSetComplete}
            isFirstSet={state.completedSets.length === 0}
            isSubmitting={isSubmitting}
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
  historySets: {
    marginTop: 4,
  },
  historySetItem: {
    marginBottom: 2,
    lineHeight: 18,
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
