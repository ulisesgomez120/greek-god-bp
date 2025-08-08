// ============================================================================
// EXERCISE DETAIL SCREEN
// ============================================================================
// Modal screen showing detailed exercise information

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

type ExerciseDetailScreenNavigationProp = StackNavigationProp<WorkoutStackParamList, "ExerciseDetail">;
type ExerciseDetailScreenRouteProp = RouteProp<WorkoutStackParamList, "ExerciseDetail">;

interface ExerciseDetailScreenProps {
  navigation: ExerciseDetailScreenNavigationProp;
  route: ExerciseDetailScreenRouteProp;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ExerciseDetailScreen: React.FC<ExerciseDetailScreenProps> = ({ navigation, route }) => {
  const { exerciseId } = route.params;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text variant='h1' color='primary' style={styles.title}>
          Exercise Details
        </Text>
        <Text variant='body' color='secondary'>
          Exercise ID: {exerciseId}
        </Text>
        <Text variant='body' color='secondary' style={styles.placeholder}>
          Detailed exercise information will be displayed here.
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

export default ExerciseDetailScreen;
