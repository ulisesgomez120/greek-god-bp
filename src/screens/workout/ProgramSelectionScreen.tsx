// ============================================================================
// PROGRAM SELECTION SCREEN (DB-DRIVEN)
// ============================================================================
// Fetches workout programs from workoutPlanService and displays selectable cards

import React, { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, AccessibilityRole } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";

// Components
import Text from "../../components/ui/Text";

// Services
import workoutPlanService, { WorkoutPlanSummary } from "../../services/workoutPlan.service";

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

// ============================================================================
// PROGRAM CARD COMPONENT
// ============================================================================

interface ProgramCardProps {
  program: WorkoutPlanSummary;
  onPress: () => void;
}

const ProgramCard: React.FC<ProgramCardProps> = ({ program, onPress }) => {
  const difficultyLabel = `Level ${program.difficulty}`;

  return (
    <TouchableOpacity
      style={styles.programCard}
      onPress={onPress}
      activeOpacity={0.8}
      accessible
      accessibilityRole={"button" as AccessibilityRole}
      accessibilityLabel={`${program.name}. ${program.description}. ${program.frequencyPerWeek} times per week. ${difficultyLabel}.`}
      testID={`program-card-${program.id}`}>
      <View style={styles.cardHeader}>
        <Text variant='h3' color='primary' style={styles.programName}>
          {program.name}
        </Text>
        <View style={styles.difficultyBadge}>
          <Text variant='caption' color='secondary' style={styles.difficultyText}>
            {difficultyLabel}
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
            {program.frequencyPerWeek}x per week
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text variant='bodySmall' color='tertiary' style={styles.detailLabel}>
            Duration
          </Text>
          <Text variant='bodySmall' color='primary' style={styles.detailValue}>
            {program.durationWeeks} weeks
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ProgramSelectionScreen: React.FC<ProgramSelectionScreenProps> = ({ navigation }) => {
  const [plans, setPlans] = useState<WorkoutPlanSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadPlans() {
      try {
        setLoading(true);
        const data = await workoutPlanService.getWorkoutPlans();
        if (!mounted) return;
        setPlans(data || []);
      } catch (err: any) {
        console.error("ProgramSelection: failed to load plans", err);
        if (!mounted) return;
        setError(err?.message || "Failed to load programs");
        console.warn("Unable to load programs. Showing cached data if available.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPlans();

    return () => {
      mounted = false;
    };
  }, []);

  const handleProgramSelect = (programId: string) => {
    navigation.navigate("PhaseSelection", { programId });
  };

  if (loading) {
    return (
      <View style={styles.containerCentered}>
        <ActivityIndicator size='large' color='#B5CFF8' />
      </View>
    );
  }

  if (error && plans.length === 0) {
    return (
      <View style={styles.containerCentered}>
        <Text variant='h2' color='primary'>
          Unable to load programs
        </Text>
        <Text variant='body' color='secondary' style={{ marginTop: 12 }}>
          {error}
        </Text>
      </View>
    );
  }

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
          {plans.length > 0 ? (
            plans.map((program) => (
              <ProgramCard key={program.id} program={program} onPress={() => handleProgramSelect(program.id)} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text variant='h3' color='primary'>
                No programs available
              </Text>
              <Text variant='body' color='secondary' style={{ marginTop: 8 }}>
                Try again later or check your network connection.
              </Text>
            </View>
          )}
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
  emptyState: {
    padding: 24,
    alignItems: "center",
  },
});

export default ProgramSelectionScreen;
