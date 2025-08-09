// ============================================================================
// DAY SELECTION SCREEN
// ============================================================================
// Screen for selecting specific workout days within a phase

import React from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";

// Components
import Text from "../../components/ui/Text";

// Utils
import { formatProgramPhase } from "../../utils/formatters";

// Types
import { WorkoutStackParamList } from "../../types/navigation";

// ============================================================================
// TYPES
// ============================================================================

type DaySelectionScreenNavigationProp = StackNavigationProp<WorkoutStackParamList, "DaySelection">;
type DaySelectionScreenRouteProp = RouteProp<WorkoutStackParamList, "DaySelection">;

interface DaySelectionScreenProps {
  navigation: DaySelectionScreenNavigationProp;
  route: DaySelectionScreenRouteProp;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const DaySelectionScreen: React.FC<DaySelectionScreenProps> = ({ navigation, route }) => {
  const { programId, phaseId } = route.params;

  const handleDaySelect = (dayId: string, workoutName: string) => {
    navigation.navigate("ExerciseList", { programId, phaseId, dayId, workoutName });
  };

  // Get workout names based on program type
  const getWorkoutNames = () => {
    switch (programId) {
      case "full_body":
        return [
          { id: "day1", name: "Full Body #1", exercises: 7, duration: 45 },
          { id: "day2", name: "Full Body #2", exercises: 7, duration: 50 },
          { id: "day3", name: "Full Body #3", exercises: 7, duration: 45 },
        ];
      case "upper_lower":
        return [
          { id: "day1", name: "Upper Body", exercises: 8, duration: 50 },
          { id: "day2", name: "Lower Body", exercises: 6, duration: 45 },
          { id: "day3", name: "Upper Body", exercises: 8, duration: 50 },
          { id: "day4", name: "Lower Body", exercises: 6, duration: 45 },
        ];
      case "body_part_split":
        return [
          { id: "day1", name: "Chest & Triceps", exercises: 6, duration: 45 },
          { id: "day2", name: "Back & Biceps", exercises: 6, duration: 45 },
          { id: "day3", name: "Shoulders", exercises: 5, duration: 40 },
          { id: "day4", name: "Legs", exercises: 7, duration: 55 },
          { id: "day5", name: "Arms", exercises: 6, duration: 40 },
        ];
      default:
        return [
          { id: "day1", name: "Workout #1", exercises: 7, duration: 45 },
          { id: "day2", name: "Workout #2", exercises: 7, duration: 50 },
          { id: "day3", name: "Workout #3", exercises: 7, duration: 45 },
        ];
    }
  };

  const workouts = getWorkoutNames();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text variant='h1' color='primary' style={styles.title}>
          Choose Workout
        </Text>
        <Text variant='body' color='secondary' style={styles.subtitle}>
          {formatProgramPhase(programId, phaseId)}
        </Text>

        {workouts.map((workout) => (
          <TouchableOpacity
            key={workout.id}
            style={styles.dayCard}
            onPress={() => handleDaySelect(workout.id, workout.name)}
            activeOpacity={0.7}>
            <Text variant='h3' color='primary'>
              {workout.name}
            </Text>
            <Text variant='body' color='secondary'>
              {workout.exercises} exercises • {workout.duration} minutes
            </Text>
          </TouchableOpacity>
        ))}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 32,
  },
  dayCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F2F2F7",
  },
});

export default DaySelectionScreen;
