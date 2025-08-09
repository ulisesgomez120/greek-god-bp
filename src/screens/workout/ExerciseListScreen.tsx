// ============================================================================
// EXERCISE LIST SCREEN
// ============================================================================
// Screen for previewing exercises before starting a workout

import React from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";

// Components
import Text from "../../components/ui/Text";
import { Button } from "../../components/ui/Button";

// Utils
import { formatProgramPhase } from "../../utils/formatters";

// Types
import { WorkoutStackParamList } from "../../types/navigation";

// ============================================================================
// TYPES
// ============================================================================

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
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ExerciseListScreen: React.FC<ExerciseListScreenProps> = ({ navigation, route }) => {
  const { programId, phaseId, dayId, workoutName } = route.params;

  const handleStartWorkout = () => {
    navigation.navigate("ActiveWorkout", {
      workoutId: `${programId}-${phaseId}-${dayId}`,
      programId,
      phaseId,
      dayId,
      workoutName,
    });
  };

  // Get exercises based on program and day
  const getExercises = (): ExerciseInfo[] => {
    // This would normally come from the database, but for now using hardcoded data
    const baseExercises: Record<string, ExerciseInfo[]> = {
      full_body: [
        {
          id: "1",
          name: "Back Squat",
          sets: 3,
          reps: "6-8",
          rpe: "7-8",
          restTime: "3 min",
          muscleGroups: ["Quadriceps", "Glutes", "Core"],
        },
        {
          id: "2",
          name: "Barbell Bench Press",
          sets: 3,
          reps: "8-10",
          rpe: "7-8",
          restTime: "3 min",
          muscleGroups: ["Chest", "Shoulders", "Triceps"],
        },
        {
          id: "3",
          name: "Lat Pulldown",
          sets: 3,
          reps: "10-12",
          rpe: "8",
          restTime: "2 min",
          muscleGroups: ["Back", "Biceps"],
        },
        {
          id: "4",
          name: "Romanian Deadlift",
          sets: 3,
          reps: "10-12",
          rpe: "7",
          restTime: "2 min",
          muscleGroups: ["Hamstrings", "Glutes"],
        },
        {
          id: "5",
          name: "Assisted Dip",
          sets: 3,
          reps: "8-10",
          rpe: "7",
          restTime: "90 sec",
          muscleGroups: ["Triceps", "Chest"],
        },
        {
          id: "6",
          name: "Standing Calf Raise",
          sets: 3,
          reps: "12-15",
          rpe: "8",
          restTime: "60 sec",
          muscleGroups: ["Calves"],
        },
        {
          id: "7",
          name: "Dumbbell Supinated Curl",
          sets: 3,
          reps: "10-12",
          rpe: "8",
          restTime: "60 sec",
          muscleGroups: ["Biceps"],
        },
      ],
      upper_lower:
        dayId === "day1" || dayId === "day3"
          ? [
              // Upper body exercises
              {
                id: "1",
                name: "Barbell Bench Press",
                sets: 4,
                reps: "6-8",
                rpe: "7-8",
                restTime: "3 min",
                muscleGroups: ["Chest", "Shoulders", "Triceps"],
              },
              {
                id: "2",
                name: "Lat Pulldown",
                sets: 4,
                reps: "8-10",
                rpe: "8",
                restTime: "2-3 min",
                muscleGroups: ["Back", "Biceps"],
              },
              {
                id: "3",
                name: "Overhead Press",
                sets: 3,
                reps: "8-10",
                rpe: "7-8",
                restTime: "2-3 min",
                muscleGroups: ["Shoulders", "Triceps"],
              },
              {
                id: "4",
                name: "Chest-Supported T-Bar Row",
                sets: 3,
                reps: "10-12",
                rpe: "8",
                restTime: "2 min",
                muscleGroups: ["Back", "Biceps"],
              },
            ]
          : [
              // Lower body exercises
              {
                id: "1",
                name: "Back Squat",
                sets: 4,
                reps: "6-8",
                rpe: "7-8",
                restTime: "3-4 min",
                muscleGroups: ["Quadriceps", "Glutes"],
              },
              {
                id: "2",
                name: "Romanian Deadlift",
                sets: 3,
                reps: "8-10",
                rpe: "7-8",
                restTime: "3 min",
                muscleGroups: ["Hamstrings", "Glutes"],
              },
              {
                id: "3",
                name: "Leg Press",
                sets: 3,
                reps: "12-15",
                rpe: "8",
                restTime: "2 min",
                muscleGroups: ["Quadriceps", "Glutes"],
              },
              {
                id: "4",
                name: "Lying Leg Curl",
                sets: 3,
                reps: "10-12",
                rpe: "8",
                restTime: "90 sec",
                muscleGroups: ["Hamstrings"],
              },
            ],
      body_part_split: (() => {
        switch (dayId) {
          case "day1": // Chest & Triceps
            return [
              {
                id: "1",
                name: "Barbell Bench Press",
                sets: 4,
                reps: "6-8",
                rpe: "8",
                restTime: "3 min",
                muscleGroups: ["Chest", "Triceps"],
              },
              {
                id: "2",
                name: "Dumbbell Incline Press",
                sets: 3,
                reps: "8-10",
                rpe: "7-8",
                restTime: "2-3 min",
                muscleGroups: ["Chest", "Shoulders"],
              },
            ];
          case "day2": // Back & Biceps
            return [
              {
                id: "1",
                name: "Lat Pulldown",
                sets: 4,
                reps: "8-10",
                rpe: "8",
                restTime: "2-3 min",
                muscleGroups: ["Back", "Biceps"],
              },
              {
                id: "2",
                name: "Chest-Supported T-Bar Row",
                sets: 3,
                reps: "10-12",
                rpe: "8",
                restTime: "2 min",
                muscleGroups: ["Back", "Biceps"],
              },
            ];
          default:
            return [];
        }
      })(),
    };

    return baseExercises[programId] || baseExercises.full_body;
  };

  const exercises = getExercises();
  const totalDuration = exercises.length * 6; // Rough estimate

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text variant='h1' color='primary' style={styles.title}>
            {workoutName || "Today's Workout"}
          </Text>
          <Text variant='body' color='secondary' style={styles.subtitle}>
            {formatProgramPhase(programId, phaseId)}
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
                {totalDuration}min
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.exerciseList}>
          <Text variant='h3' color='primary' style={styles.sectionTitle}>
            Exercises
          </Text>

          {exercises.map((exercise, index) => (
            <TouchableOpacity
              key={exercise.id}
              style={styles.exerciseCard}
              onPress={() => navigation.navigate("ExerciseDetail", { exerciseId: exercise.id })}
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
                    {exercise.muscleGroups.join(", ")}
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

      <View style={styles.footer}>
        <Button onPress={handleStartWorkout} style={styles.startButton}>
          <Text variant='button' style={styles.startButtonText}>
            Start Workout
          </Text>
        </Button>
      </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Space for footer button
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
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  startButton: {
    backgroundColor: "#B5CFF8",
    borderRadius: 12,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  startButtonText: {
    color: "#1C1C1E",
    fontWeight: "600",
  },
});

export default ExerciseListScreen;
