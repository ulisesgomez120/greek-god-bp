// ============================================================================
// EXERCISE LIST SCREEN
// ============================================================================
// Screen for previewing exercises before starting a workout
// Now loads planned_exercises for the selected session via workoutPlanService.
// Falls back to legacy hard-coded lists if no session/exercises are available.

import React, { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";

// Components
import Text from "../../components/ui/Text";
import useTheme from "@/hooks/useTheme";

// Services
import workoutPlanService from "../../services/workoutPlan.service";
import WorkoutControlsSection from "../../components/workout/WorkoutControlsSection";

// Utils
import { formatProgramPhase } from "../../utils/formatters";

// Types
import { WorkoutStackParamList } from "../../types/navigation";

type ExerciseListScreenNavigationProp = StackNavigationProp<WorkoutStackParamList, "ExerciseList">;
type ExerciseListScreenRouteProp = RouteProp<WorkoutStackParamList, "ExerciseList">;

interface ExerciseListScreenProps {
  navigation: ExerciseListScreenNavigationProp;
  route: ExerciseListScreenRouteProp;
}

interface ExerciseInfo {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rpe: string;
  restTime: string;
  muscleGroups: string[];
  notes?: string;
}

// Helper to detect UUID-like strings
const looksLikeUuid = (s?: string) => {
  if (!s) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f4]-[0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
};

const ExerciseListScreen: React.FC<ExerciseListScreenProps> = ({ navigation, route }) => {
  const { programId, phaseId, dayId, workoutName } = route.params;

  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseInfo[]>([]);
  const [sessionName, setSessionName] = useState<string | null>(workoutName ?? null);
  // Keep the fetched session available so we can expose plannedExerciseId when navigating to details
  const [session, setSession] = useState<any | null>(null);
  useEffect(() => {
    let mounted = true;

    async function loadSessionExercises() {
      try {
        setLoading(true);
        setError(null);

        // If caller provided a workoutSessionId (resume), try to recover it into workoutService
        // so the in-memory session is set and subsequent set logging will resume instead of creating.
        const maybeWorkoutSessionId = (route.params as any)?.workoutSessionId;
        if (maybeWorkoutSessionId) {
          try {
            await import("../../services/workout.service").then((m) =>
              m.workoutService.recoverWorkoutSession(maybeWorkoutSessionId).catch(() => {
                /* non-fatal */
              })
            );
          } catch (recoverErr) {
            // non-fatal; continue to load planned session
            console.warn("ExerciseList: failed to recover workoutSessionId before loading session", recoverErr);
          }
        }

        // Try to fetch the specific session (this leverages workoutPlanService cache when available)
        const fetchedSession = await workoutPlanService.getWorkoutSession(programId, phaseId, dayId);

        if (!mounted) return;

        if (fetchedSession && fetchedSession.exercises && fetchedSession.exercises.length > 0) {
          // Map ExerciseSummary -> ExerciseInfo for UI
          const mapped: ExerciseInfo[] = fetchedSession.exercises.map((ex) => {
            const reps =
              ex.targetRepsMin && ex.targetRepsMax
                ? ex.targetRepsMin === ex.targetRepsMax
                  ? `${ex.targetRepsMin}`
                  : `${ex.targetRepsMin}-${ex.targetRepsMax}`
                : `${ex.targetRepsMin ?? ex.targetRepsMax ?? ""}`.trim();

            return {
              id: ex.id,
              name: ex.name || "Exercise",
              sets: ex.targetSets ?? 0,
              reps: reps || "—",
              rpe: ex.targetRpe ? String(ex.targetRpe) : "—",
              restTime: ex.restSeconds ? `${ex.restSeconds} sec` : "—",
              muscleGroups: [], // not present in session mapping; empty fallback
              notes: ex.notes,
            } as ExerciseInfo;
          });

          setExercises(mapped);
          // Persist the fetched session in local state so callers can reference plannedExerciseId
          setSession(fetchedSession);
          setSessionName(fetchedSession.name ?? workoutName ?? null);
          return;
        }
      } catch (err: any) {
        console.error("ExerciseList: failed to load session exercises", err);
        // On error, fall back to legacy mapping but surface a non-blocking error message
        setError(err?.message || "Failed to load exercises");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSessionExercises();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, phaseId, dayId, route.params]);

  useEffect(() => {
    navigation.setOptions({ title: sessionName || workoutName || "Today's Workout" });
  }, [navigation, sessionName, workoutName]);

  if (loading) {
    return (
      <View style={styles.containerCentered}>
        <ActivityIndicator size='large' color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.workoutInfo}>
            <View style={styles.infoItem}>
              <Text variant='bodySmall' color='secondary'>
                EXERCISES
              </Text>
              <Text variant='h3' color='primary'>
                {exercises.length}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text variant='bodySmall' color='secondary'>
                EST. TIME
              </Text>
              <Text variant='h3' color='primary'>
                {Math.max(5, exercises.length * 6)}min
              </Text>
            </View>
          </View>
          {error ? (
            <Text variant='bodySmall' color='tertiary' style={{ marginTop: 8 }}>
              {`Note: ${error}`}
            </Text>
          ) : null}
        </View>

        <WorkoutControlsSection
          programId={programId}
          phaseId={phaseId}
          dayId={dayId}
          workoutName={sessionName || workoutName}
          session={session}
          navigation={navigation}
        />

        <View style={styles.exerciseList}>
          <Text variant='h3' color='primary' style={styles.sectionTitle}>
            Exercises
          </Text>

          {exercises.map((exercise, index) => (
            <TouchableOpacity
              key={exercise.id + "-" + index}
              style={styles.exerciseCard}
              onPress={() =>
                navigation.navigate("ExerciseDetail", {
                  exerciseId: exercise.id,
                  exerciseIndex: index,
                  workoutContext: {
                    programId,
                    phaseId,
                    dayId,
                    workoutName: sessionName || workoutName || "Workout",
                  },
                  // Pass plannedExerciseId when available from the session's planned_exercises mapping.
                  plannedExerciseId: session?.exercises?.[index]?.plannedExerciseId,
                  // Include workoutSessionId when present so downstream screens know this is a resume of an existing session.
                  workoutSessionId: (route.params as any)?.workoutSessionId,
                  exerciseData: {
                    name: exercise.name,
                    targetSets: exercise.sets,
                    targetReps: exercise.reps,
                    targetRpe: exercise.rpe,
                    restSeconds: parseInt(exercise.restTime.replace(/[^0-9]/g, "")) || 180,
                    notes: exercise.notes || "",
                  },
                })
              }
              activeOpacity={0.7}>
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseInfo}>
                  <Text variant='h3' color='primary' style={styles.exerciseName}>
                    {exercise.name}
                  </Text>
                  <Text variant='bodySmall' color='secondary'>
                    {exercise.muscleGroups.length > 0 ? exercise.muscleGroups.join(", ") : exercise.notes || ""}
                  </Text>
                </View>
              </View>

              <View style={styles.exerciseDetails}>
                <View style={styles.detailItem}>
                  <Text variant='bodySmall' color='secondary'>
                    Sets
                  </Text>
                  <Text variant='body' color='primary'>
                    {exercise.sets}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text variant='bodySmall' color='secondary'>
                    Reps
                  </Text>
                  <Text variant='body' color='primary'>
                    {exercise.reps}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text variant='bodySmall' color='secondary'>
                    RPE
                  </Text>
                  <Text variant='body' color='primary'>
                    {exercise.rpe}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text variant='bodySmall' color='secondary'>
                    Rest
                  </Text>
                  <Text variant='body' color='primary'>
                    {exercise.restTime}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
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
    containerCentered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 20,
    },
    header: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      marginBottom: 4,
    },
    subtitle: {
      marginBottom: 20,
    },
    workoutInfo: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    infoItem: {
      alignItems: "center",
    },
    exerciseList: {
      padding: 20,
    },
    sectionTitle: {
      marginBottom: 16,
    },
    exerciseCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },
    exerciseHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    exerciseInfo: {
      flex: 1,
    },
    exerciseName: {
      marginBottom: 2,
    },
    exerciseDetails: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    detailItem: {
      alignItems: "center",
      flex: 1,
    },
  });

export default ExerciseListScreen;
