// ============================================================================
// EXERCISE DETAIL SCREEN - COMPLETE EXERCISE LOGGER
// ============================================================================
// Full exercise logging interface with set tracking, rest timer, history, and navigation

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import useUnitPreferences from "../../hooks/useUnitPreferences";
import { formatKgToLbsDisplay } from "../../utils/unitConversions";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";

// Components

import Text from "../../components/ui/Text";
import Icon from "../../components/ui/Icon";
import useTheme from "@/hooks/useTheme";
import { Button } from "../../components/ui/Button";
import SetLogger from "../../components/workout/SetLogger";
import CompactRestTimer from "../../components/workout/CompactRestTimer";

// Services
import workoutService from "../../services/workout.service";
import workoutPlanService from "../../services/workoutPlan.service";
import databaseService from "../../services/database.service";

// Types
import { WorkoutStackParamList } from "../../types/navigation";
import type { ExerciseSet, ExerciseSetFormData, TutorialVideo } from "../../types";

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
  keyboardVisible: boolean;
  tutorialVideos?: TutorialVideo[];
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
// MAIN COMPONENT
// ============================================================================

export const ExerciseDetailScreen: React.FC<ExerciseDetailScreenProps> = ({ navigation, route }) => {
  const { exerciseId, exerciseIndex, workoutContext, exerciseData, plannedExerciseId } = route.params;

  // Enforce plannedExerciseId presence — this screen's history/progression views must be scoped.
  if (!plannedExerciseId || typeof plannedExerciseId !== "string") {
    throw new Error("ExerciseDetail: plannedExerciseId is required");
  }

  const { colors } = useTheme();
  const styles = createStyles(colors);

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
    keyboardVisible: false,
    tutorialVideos: [],
  });

  // Local submitting state for set submissions
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showFormCuesExpanded, setShowFormCuesExpanded] = useState<boolean>(false);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    loadExerciseData();
    calculateNextExercise();
  }, [exerciseId, plannedExerciseId]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================
  // Fetch recent exercise history (last `limit` sessions)
  const loadExerciseData = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      // plannedExerciseId validated above; call service which requires it
      const history = await workoutService.getExerciseHistory(exerciseId, plannedExerciseId, 6);
      // Fetch tutorial videos (read-only)
      let tutorials: TutorialVideo[] = [];
      try {
        tutorials = await databaseService.getTutorialsForExercise(exerciseId);
      } catch (tErr) {
        console.warn("Failed to load tutorial videos for exercise", exerciseId, tErr);
        tutorials = [];
      }

      setState((prev) => ({
        ...prev,
        exerciseHistory: history,
        tutorialVideos: tutorials,
        isLoading: false,
      }));
    } catch (error) {
      console.error("Failed to load exercise data:", error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [exerciseId, plannedExerciseId]);

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

  // Keyboard visibility is driven by SetLogger's focus (onFocusChange prop).
  // We intentionally avoid global Keyboard listeners (expensive / unreliable on web).

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
        const result = await workoutService.addExerciseSet({ ...setData, plannedExerciseId });

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
      // Try to pass plannedExerciseId for the next exercise when available from cached session
      plannedExerciseId:
        cachedSession && cachedSession.exercises && cachedSession.exercises[nextIndex]
          ? (cachedSession.exercises[nextIndex] as any).plannedExerciseId
          : undefined,
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
  const extractYouTubeId = useCallback((url: string): string | null => {
    if (!url) return null;
    // Match typical YouTube URL forms (watch?v=ID, youtu.be/ID, embed/ID)
    const m = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})(?:[&?]|$)/);
    return m ? m[1] : null;
  }, []);

  const openTutorialUrl = useCallback(
    async (url: string) => {
      if (!url) {
        Alert.alert("No URL available");
        return;
      }

      try {
        // On web, open in a new browser tab.
        // Normalize app-scheme or non-http URLs to an https YouTube link when possible
        if (Platform.OS === "web") {
          let normalized = url;
          // If the URL is a youtube app scheme or youtu.be short link, convert to https watch URL
          const ytId = extractYouTubeId(url);
          if (!/^https?:\/\//i.test(url) && ytId) {
            normalized = `https://www.youtube.com/watch?v=${ytId}`;
          }
          // If URL is missing scheme but not a youtube id, try to add https://
          if (!/^https?:\/\//i.test(normalized) && !ytId) {
            normalized = `https://${normalized}`;
          }

          try {
            window.open(normalized, "_blank", "noopener,noreferrer");
          } catch (e) {
            await Linking.openURL(normalized);
          }
          return;
        }

        const ytId = extractYouTubeId(url);
        if (ytId) {
          const appUrl = `vnd.youtube://watch?v=${ytId}`;
          if (await Linking.canOpenURL(appUrl)) {
            await Linking.openURL(appUrl);
            return;
          }
          const altApp = `youtube://www.youtube.com/watch?v=${ytId}`;
          if (await Linking.canOpenURL(altApp)) {
            await Linking.openURL(altApp);
            return;
          }
        }

        await Linking.openURL(url);
      } catch (err) {
        Alert.alert("Unable to open link", url);
      }
    },
    [extractYouTubeId]
  );

  const handleToggleFormCues = useCallback(() => {
    setShowFormCuesExpanded((s) => !s);
  }, []);

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

      <TouchableOpacity
        onPress={handleToggleFormCues}
        accessibilityRole='button'
        accessibilityLabel='Toggle Form Cues and Tutorials'
        style={styles.formCuesHeader}
        activeOpacity={0.85}>
        <Text variant='bodySmall' color='secondary' style={styles.formCuesHeaderText}>
          Form Cues & Tutorials
        </Text>
        <View style={styles.formCuesHeaderRight}>
          <Icon
            name={showFormCuesExpanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.subtext}
            style={styles.formCuesChevron}
          />
        </View>
      </TouchableOpacity>

      {showFormCuesExpanded && (
        <View style={styles.formCues}>
          {exerciseData.notes ? (
            <Text variant='body' color='primary' style={styles.formCuesText}>
              {exerciseData.notes}
            </Text>
          ) : null}

          {state.tutorialVideos && state.tutorialVideos.length > 0 ? (
            <View style={{ marginTop: 12 }}>
              <Text variant='bodySmall' color='secondary' style={styles.formCuesTitle}>
                TUTORIAL VIDEOS{" "}
                <Icon name='logo-youtube' size={20} color={colors.primary} style={styles.formCuesIcon} />
              </Text>
              {state.tutorialVideos.map((t) => (
                <View key={t.id} style={styles.tutorialItem}>
                  <TouchableOpacity
                    onPress={() => openTutorialUrl(t.url)}
                    accessibilityLabel={`Open tutorial ${t.title}`}>
                    <Text variant='body' color='primary'>
                      {t.title}
                    </Text>
                  </TouchableOpacity>
                  {/* <Text variant='bodySmall' color='secondary' style={styles.tutorialUrlText}>
                    {t.url}
                  </Text> */}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );

  const { isImperial } = useUnitPreferences();

  const weightDisplay = (kg?: number | null) => {
    if (!kg) return "Bodyweight";
    if (isImperial()) return formatKgToLbsDisplay(kg);
    return `${kg}kg`;
  };

  const renderTutorials = () => null;

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
              Set {set.setNumber}: {set.weightKg ? `${weightDisplay(set.weightKg)}` : "Bodyweight"} × {set.reps}
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
                    • Set {setIndex + 1}: {set.weight ? `${weightDisplay(set.weight)}` : "BW"} × {set.reps}
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

  const renderNavigationFooter = () => {
    if (state.keyboardVisible) return null;

    return (
      <View style={styles.navigationFooter}>
        {state.nextExercise ? (
          <Button
            variant='primary'
            onPress={handleNextExercise}
            style={styles.nextButton}
            accessibilityLabel='Next exercise'>
            {`Next: ${state.nextExercise.name} →`}
          </Button>
        ) : (
          <Button
            variant='primary'
            onPress={handleCompleteWorkout}
            style={{ ...styles.completeButton, backgroundColor: colors.success }}
            accessibilityLabel='Complete workout'>
            Complete Workout
          </Button>
        )}
      </View>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (state.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size='large' color={colors.primary} />
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
            onFocusChange={(hasFocus: boolean) => setState((prev) => ({ ...prev, keyboardVisible: hasFocus }))}
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

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: 16,
      color: colors.subtext,
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
      borderBottomColor: colors.border,
    },
    exerciseName: {
      marginBottom: 20,
      textAlign: "center",
      color: colors.text,
    },
    targetInfo: {
      marginBottom: 20,
    },
    targetText: {
      textAlign: "center",
      lineHeight: 20,
      color: colors.subtext,
    },
    formCues: {
      backgroundColor: colors.surface || colors.surfaceElevated || colors.lightBackground,
      borderRadius: 12,
      padding: 16,
      marginTop: 8,
    },
    formCuesHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 12,
      paddingBottom: 8,
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated || colors.surface || "transparent",
    },
    formCuesHeaderText: {
      fontWeight: "700",
      color: colors.subtext,
    },
    formCuesHeaderRight: {
      marginLeft: 8,
      flexDirection: "row",
      alignItems: "center",
    },
    formCuesChevron: {
      marginLeft: 8,
    },
    formCuesIcon: {
      marginLeft: 8,
    },
    formCuesTitle: {
      marginBottom: 8,
      fontWeight: "600",
      color: colors.subtext,
    },
    tutorialItem: {
      marginBottom: 16,
    },
    tutorialUrlText: {
      marginTop: 2,
      color: colors.subtext,
    },
    formCuesText: {
      lineHeight: 20,
      color: colors.text,
    },
    restTimerSection: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    setLoggerSection: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface || colors.surfaceElevated,
    },
    completedSetsSection: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      marginBottom: 20,
      color: colors.text,
    },
    completedSetItem: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.surface || colors.surfaceElevated || colors.lightBackground,
      borderRadius: 8,
      marginBottom: 8,
    },
    historySection: {
      padding: 20,
    },
    historyItem: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    historyDate: {
      marginBottom: 4,
      fontWeight: "500",
      color: colors.subtext,
    },
    historySets: {
      marginTop: 4,
    },
    historySetItem: {
      marginBottom: 2,
      lineHeight: 18,
      color: colors.text,
    },
    navigationFooter: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      padding: 20,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 12,
    },
    backButton: {
      flex: 1,
      height: 50,
      backgroundColor: "transparent",
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    backButtonText: {
      color: colors.primary,
      fontWeight: "600",
    },
    nextButton: {
      flex: 2,
      height: 50,
      backgroundColor: colors.primary,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    nextButtonText: {
      color: colors.buttonTextOnPrimary || colors.buttonText || colors.text,
      fontWeight: "600",
    },
    completeButton: {
      flex: 2,
      height: 50,
      backgroundColor: colors.success,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    completeButtonText: {
      color: colors.buttonTextOnPrimary || colors.buttonText || colors.background,
      fontWeight: "600",
    },
  });

export default ExerciseDetailScreen;
