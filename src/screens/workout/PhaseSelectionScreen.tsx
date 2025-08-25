// ============================================================================
// PHASE SELECTION SCREEN (DB-DRIVEN)
// ============================================================================
// Screen for selecting workout phases within a program (loads phases from DB)

import React, { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, AccessibilityRole } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";

// Components
import Text from "../../components/ui/Text";
import useTheme from "@/hooks/useTheme";

// Services
import workoutPlanService, { WorkoutPhase } from "../../services/workoutPlan.service";

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

const PhaseSelectionScreen: React.FC<PhaseSelectionScreenProps> = ({ navigation, route }) => {
  const { programId } = route.params;
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [plan, setPlan] = useState<any | null>(null);
  const [phases, setPhases] = useState<WorkoutPhase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (mountedRef = { current: true }) => {
    try {
      setLoading(true);
      setError(null);

      // Load the plan (to get friendly name) and phases
      const [planRes, phasesRes] = await Promise.all([
        workoutPlanService.getWorkoutPlanWithSessions(programId),
        workoutPlanService.getWorkoutPhases(programId),
      ]);

      if (!mountedRef.current) return;

      setPlan(planRes);
      setPhases(phasesRes || []);
    } catch (err: any) {
      console.error("PhaseSelection: failed to load plan/phases", err);
      setError(err?.message || "Failed to load program phases");
      setPhases([]);
      setPlan(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    const mountedRef = { current: true };
    loadData(mountedRef);

    return () => {
      mountedRef.current = false;
    };
  }, [programId]);

  const handlePhaseSelect = (phaseId: string) => {
    navigation.navigate("DaySelection", { programId, phaseId });
  };

  const handleRetry = () => {
    loadData({ current: true });
  };

  if (loading) {
    return (
      <View style={styles.containerCentered}>
        <ActivityIndicator size='large' color={colors.primary} />
      </View>
    );
  }

  // If plan loaded but there are no phases, show helpful message
  if (!loading && plan && phases.length === 0) {
    return (
      <View style={styles.containerCentered}>
        <Text variant='h2' color='primary'>
          No workouts in this program
        </Text>
        <Text variant='body' color='secondary' style={{ marginTop: 12, textAlign: "center", maxWidth: 300 }}>
          This program appears to have no scheduled workouts/phases on the server. Try reloading or pick a different
          program.
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRetry}
          accessibilityRole={"button" as AccessibilityRole}>
          <Text variant='body' color='primary'>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error && phases.length === 0) {
    return (
      <View style={styles.containerCentered}>
        <Text variant='h2' color='primary'>
          Unable to load phases
        </Text>
        <Text variant='body' color='secondary' style={{ marginTop: 12 }}>
          {error}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRetry}
          accessibilityRole={"button" as AccessibilityRole}>
          <Text variant='body' color='primary'>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text variant='h1' color='primary' style={styles.title}>
          Choose Phase
        </Text>
        <Text variant='body' color='secondary' style={styles.subtitle}>
          Program: {plan?.name ?? workoutPlanService.formatProgramName(programId)}
        </Text>

        {phases.length > 0 ? (
          phases.map((phase) => (
            <TouchableOpacity
              key={phase.id}
              style={styles.phaseCard}
              onPress={() => handlePhaseSelect(phase.id)}
              activeOpacity={0.75}
              accessible
              accessibilityRole={"button" as AccessibilityRole}
              accessibilityLabel={`${phase.name}. ${phase.description}. Weeks ${phase.weekStart} to ${phase.weekEnd}.`}
              testID={`phase-card-${phase.id}`}>
              <Text variant='h3' color='primary'>
                {phase.name}
              </Text>
              {phase.description ? (
                <Text variant='body' color='secondary' style={{ marginTop: 6 }}>
                  {phase.description}
                </Text>
              ) : null}
              <View style={{ marginTop: 10 }}>
                <Text variant='bodySmall' color='tertiary'>
                  Weeks {phase.weekStart} - {phase.weekEnd}
                </Text>
                <Text variant='bodySmall' color='tertiary'>
                  {phase.sessions.length} workout{phase.sessions.length !== 1 ? "s" : ""}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text variant='h3' color='primary'>
              No phases found
            </Text>
            <Text variant='body' color='secondary' style={{ marginTop: 8 }}>
              This program doesn't contain any phases yet.
            </Text>
          </View>
        )}
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
      padding: 20,
    },
    title: {
      marginBottom: 8,
    },
    subtitle: {
      marginBottom: 32,
    },
    phaseCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.surfaceElevated,
    },
    emptyState: {
      padding: 24,
      alignItems: "center",
    },
    retryButton: {
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
  });

export default PhaseSelectionScreen;
