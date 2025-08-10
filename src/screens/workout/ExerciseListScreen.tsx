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

// Services
import workoutPlanService from "../../services/workoutPlan.service";

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

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseInfo[]>([]);
  const [sessionName, setSessionName] = useState<string | null>(workoutName ?? null);

  useEffect(() => {
    let mounted = true;

    async function loadSessionExercises() {
      try {
        setLoading(true);
        setError(null);

        // Try to fetch the specific session (this leverages workoutPlanService cache when available)
        const session = await workoutPlanService.getWorkoutSession(programId, phaseId, dayId);

        if (!mounted) return;

        if (session && session.exercises && session.exercises.length > 0) {
          // Map ExerciseSummary -> ExerciseInfo for UI
          const mapped: ExerciseInfo[] = session.exercises.map((ex) => {
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
          setSessionName(session.name ?? workoutName ?? null);
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
  }, [programId, phaseId, dayId]);

  if (loading) {
    return (
      <View style={styles.containerCentered}>
        <ActivityIndicator size='large' color='#B5CFF8' />
      </View>
    );
  }

  // Compose subtitle safely — avoid showing raw UUIDs
  const safeSubtitle =
    sessionName && sessionName.length > 0
      ? sessionName
      : looksLikeUuid(phaseId)
      ? `${workoutPlanService.formatProgramName(programId)} • Workout`
      : formatProgramPhase(programId, phaseId);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text variant='h1' color='primary' style={styles.title}>
            {sessionName || workoutName || "Today's Workout"}
          </Text>
          <Text variant='body' color='secondary' style={styles.subtitle}>
            {safeSubtitle}
          </Text>

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
                <View style={styles.exerciseNumber}>
                  <Text variant='bodySmall' color='primary'>
                    {index + 1}
                  </Text>
                </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  containerCentered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
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
    borderBottomColor: "#F2F2F7",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F2F2F7",
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
  exerciseNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F8FAFD",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
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
