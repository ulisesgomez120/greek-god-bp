// ============================================================================
// PROGRAM SELECTION SCREEN
// ============================================================================
// Screen for selecting workout programs (Full Body, Upper/Lower, Body Part Split)

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

type ProgramSelectionScreenNavigationProp = StackNavigationProp<WorkoutStackParamList, "ProgramSelection">;
type ProgramSelectionScreenRouteProp = RouteProp<WorkoutStackParamList, "ProgramSelection">;

interface ProgramSelectionScreenProps {
  navigation: ProgramSelectionScreenNavigationProp;
  route: ProgramSelectionScreenRouteProp;
}

interface Program {
  id: string;
  name: string;
  description: string;
  frequency: string;
  difficulty: string;
  duration: string;
}

// ============================================================================
// PROGRAM DATA
// ============================================================================

const PROGRAMS: Program[] = [
  {
    id: "full_body",
    name: "Full Body Program",
    description: "Train your entire body in each session. Perfect for beginners and those with limited time.",
    frequency: "3x per week",
    difficulty: "Beginner",
    duration: "8 weeks",
  },
  {
    id: "upper_lower",
    name: "Upper/Lower Program",
    description: "Split your training between upper and lower body days for balanced development.",
    frequency: "4x per week",
    difficulty: "Intermediate",
    duration: "8 weeks",
  },
  {
    id: "body_part_split",
    name: "Body Part Split Program",
    description: "Focus on specific muscle groups each day for maximum muscle development.",
    frequency: "5x per week",
    difficulty: "Advanced",
    duration: "8 weeks",
  },
];

// ============================================================================
// PROGRAM CARD COMPONENT
// ============================================================================

interface ProgramCardProps {
  program: Program;
  onPress: () => void;
}

const ProgramCard: React.FC<ProgramCardProps> = ({ program, onPress }) => {
  return (
    <TouchableOpacity style={styles.programCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text variant='h3' color='primary' style={styles.programName}>
          {program.name}
        </Text>
        <View style={styles.difficultyBadge}>
          <Text variant='caption' color='secondary' style={styles.difficultyText}>
            {program.difficulty}
          </Text>
        </View>
      </View>

      <Text variant='body' color='secondary' style={styles.programDescription}>
        {program.description}
      </Text>

      <View style={styles.programDetails}>
        <View style={styles.detailItem}>
          <Text variant='bodySmall' color='tertiary' style={styles.detailLabel}>
            Frequency
          </Text>
          <Text variant='bodySmall' color='primary' style={styles.detailValue}>
            {program.frequency}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text variant='bodySmall' color='tertiary' style={styles.detailLabel}>
            Duration
          </Text>
          <Text variant='bodySmall' color='primary' style={styles.detailValue}>
            {program.duration}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ProgramSelectionScreen: React.FC<ProgramSelectionScreenProps> = ({ navigation }) => {
  const handleProgramSelect = (programId: string) => {
    navigation.navigate("PhaseSelection", { programId });
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text variant='h1' color='primary' style={styles.title}>
            Choose Your Program
          </Text>
          <Text variant='body' color='secondary' style={styles.subtitle}>
            Select a workout program that matches your experience level and schedule.
          </Text>
        </View>

        <View style={styles.programList}>
          {PROGRAMS.map((program) => (
            <ProgramCard key={program.id} program={program} onPress={() => handleProgramSelect(program.id)} />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    lineHeight: 22,
  },
  programList: {
    gap: 16,
  },
  programCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F2F2F7",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  programName: {
    flex: 1,
    marginRight: 12,
  },
  difficultyBadge: {
    backgroundColor: "#F8FAFD",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#B5CFF8",
  },
  difficultyText: {
    color: "#B5CFF8",
    fontWeight: "600",
  },
  programDescription: {
    marginBottom: 16,
    lineHeight: 20,
  },
  programDetails: {
    flexDirection: "row",
    gap: 24,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    fontWeight: "600",
  },
});

export default ProgramSelectionScreen;
