// ============================================================================
// PHASE SELECTION SCREEN
// ============================================================================
// Screen for selecting workout phases within a program

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

type PhaseSelectionScreenNavigationProp = StackNavigationProp<WorkoutStackParamList, "PhaseSelection">;
type PhaseSelectionScreenRouteProp = RouteProp<WorkoutStackParamList, "PhaseSelection">;

interface PhaseSelectionScreenProps {
  navigation: PhaseSelectionScreenNavigationProp;
  route: PhaseSelectionScreenRouteProp;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const PhaseSelectionScreen: React.FC<PhaseSelectionScreenProps> = ({ navigation, route }) => {
  const { programId } = route.params;

  const handlePhaseSelect = (phaseId: string) => {
    navigation.navigate("DaySelection", { programId, phaseId });
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text variant='h1' color='primary' style={styles.title}>
          Choose Phase
        </Text>
        <Text variant='body' color='secondary' style={styles.subtitle}>
          Program: {programId}
        </Text>

        <TouchableOpacity style={styles.phaseCard} onPress={() => handlePhaseSelect("phase1")} activeOpacity={0.7}>
          <Text variant='h3' color='primary'>
            4 Week Strength Base
          </Text>
          <Text variant='body' color='secondary'>
            Build your foundation with progressive overload
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.phaseCard} onPress={() => handlePhaseSelect("phase2")} activeOpacity={0.7}>
          <Text variant='h3' color='primary'>
            4 Week Modified Strength Base
          </Text>
          <Text variant='body' color='secondary'>
            Advanced progression with increased intensity
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
  phaseCard: {
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

export default PhaseSelectionScreen;
