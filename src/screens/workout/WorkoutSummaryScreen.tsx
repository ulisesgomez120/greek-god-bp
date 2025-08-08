// ============================================================================
// WORKOUT SUMMARY SCREEN
// ============================================================================
// Screen showing workout completion summary and progress

import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";

// Components
import Text from "../../components/ui/Text";

// Types
import { WorkoutStackParamList } from "../../types/navigation";

// ============================================================================
// TYPES
// ============================================================================

type WorkoutSummaryScreenNavigationProp = StackNavigationProp<WorkoutStackParamList, "WorkoutSummary">;
type WorkoutSummaryScreenRouteProp = RouteProp<WorkoutStackParamList, "WorkoutSummary">;

interface WorkoutSummaryScreenProps {
  navigation: WorkoutSummaryScreenNavigationProp;
  route: WorkoutSummaryScreenRouteProp;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const WorkoutSummaryScreen: React.FC<WorkoutSummaryScreenProps> = ({ navigation, route }) => {
  const { sessionId } = route.params;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text variant='h1' color='primary' style={styles.title}>
          Workout Complete! 🎉
        </Text>
        <Text variant='body' color='secondary'>
          Session ID: {sessionId}
        </Text>
        <Text variant='body' color='secondary' style={styles.placeholder}>
          Workout summary and progress will be displayed here.
        </Text>
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
    marginBottom: 16,
  },
  placeholder: {
    marginTop: 32,
    fontStyle: "italic",
  },
});

export default WorkoutSummaryScreen;
