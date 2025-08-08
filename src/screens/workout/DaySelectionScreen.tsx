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

  const handleDaySelect = (dayId: string) => {
    navigation.navigate("ActiveWorkout", { workoutId: `${programId}-${phaseId}-${dayId}` });
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text variant='h1' color='primary' style={styles.title}>
          Choose Workout
        </Text>
        <Text variant='body' color='secondary' style={styles.subtitle}>
          {programId} - {phaseId}
        </Text>

        <TouchableOpacity style={styles.dayCard} onPress={() => handleDaySelect("day1")} activeOpacity={0.7}>
          <Text variant='h3' color='primary'>
            Day 1 - Full Body #1
          </Text>
          <Text variant='body' color='secondary'>
            7 exercises • 45 minutes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dayCard} onPress={() => handleDaySelect("day2")} activeOpacity={0.7}>
          <Text variant='h3' color='primary'>
            Day 2 - Full Body #2
          </Text>
          <Text variant='body' color='secondary'>
            7 exercises • 50 minutes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dayCard} onPress={() => handleDaySelect("day3")} activeOpacity={0.7}>
          <Text variant='h3' color='primary'>
            Day 3 - Full Body #3
          </Text>
          <Text variant='body' color='secondary'>
            7 exercises • 45 minutes
          </Text>
        </TouchableOpacity>
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
