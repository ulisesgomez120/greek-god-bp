// ============================================================================
// DAY SELECTION SCREEN (DATA-DRIVEN)
// ============================================================================
// Screen for selecting specific workout days within a phase
// Uses workoutPlanService to load actual sessions for the selected program + phase

import React, { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, AccessibilityRole } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";

// Components
import Text from "../../components/ui/Text";

// Services
import workoutPlanService, { WorkoutSessionSummary } from "../../services/workoutPlan.service";

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

const DaySelectionScreen: React.FC<DaySelectionScreenProps> = ({ navigation, route }) => {
  const { programId, phaseId } = route.params;

  const [sessions, setSessions] = useState<WorkoutSessionSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);

  const loadData = async (mountedRef = { current: true }) => {
    try {
      setLoading(true);
      setError(null);

      // Load sessions for the selected plan + phase
      const [sessionsRes, planRes] = await Promise.all([
        workoutPlanService.getWorkoutSessions(programId, phaseId).catch((e) => {
          // Surface error but allow plan name to still attempt to load
          console.warn("getWorkoutSessions failed", e);
          return [] as WorkoutSessionSummary[];
        }),
        workoutPlanService.getWorkoutPlanWithSessions(programId).catch(() => null),
      ]);

      if (!mountedRef.current) return;

      setSessions(sessionsRes || []);
      setPlanName(planRes?.name ?? workoutPlanService.formatProgramName(programId));
    } catch (err: any) {
      console.error("DaySelection: failed to load sessions", err);
      if (!mountedRef.current) return;
      setError(err?.message || "Failed to load workout days");
      setSessions([]);
      setPlanName(workoutPlanService.formatProgramName(programId));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, phaseId]);

  const handleDaySelect = (dayId: string, workoutName: string) => {
    navigation.navigate("ExerciseList", { programId, phaseId, dayId, workoutName });
  };

  const handleRetry = () => {
    loadData({ current: true });
  };

  // Fallback: if sessions empty (for any reason), optionally show a default set matching legacy behavior
  const fallbackWorkouts = () => {
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

  if (loading) {
    return (
      <View style={styles.containerCentered}>
        <ActivityIndicator size='large' color='#B5CFF8' />
      </View>
    );
  }

  if (error && sessions.length === 0) {
    return (
      <View style={styles.containerCentered}>
        <Text variant='h2' color='primary'>
          Unable to load workouts
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

  // Determine which list to render: fetched sessions (preferred) or fallback
  const renderSessions =
    sessions.length > 0
      ? sessions.map((s) => ({
          id: s.id,
          name: s.name,
          exercises: s.exerciseCount,
          duration: s.estimatedDurationMinutes,
        }))
      : fallbackWorkouts();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text variant='h1' color='primary' style={styles.title}>
          Choose Workout
        </Text>
        <Text variant='body' color='secondary' style={styles.subtitle}>
          {planName
            ? `${planName} • ${workoutPlanService.formatPhaseName(phaseId)}`
            : workoutPlanService.formatPhaseName(phaseId)}
        </Text>

        {renderSessions.length > 0 ? (
          renderSessions.map((workout: any) => (
            <TouchableOpacity
              key={workout.id}
              style={styles.dayCard}
              onPress={() => handleDaySelect(workout.id, workout.name)}
              activeOpacity={0.7}
              accessible
              accessibilityRole={"button" as AccessibilityRole}
              accessibilityLabel={`${workout.name}. ${workout.exercises} exercises. ${workout.duration} minutes.`}
              testID={`day-card-${workout.id}`}>
              <Text variant='h3' color='primary'>
                {workout.name}
              </Text>
              <Text variant='body' color='secondary'>
                {workout.exercises} exercises • {workout.duration} minutes
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text variant='h3' color='primary'>
              No workouts found
            </Text>
            <Text variant='body' color='secondary' style={{ marginTop: 8 }}>
              This phase doesn't contain any scheduled workouts.
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
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#B5CFF8",
    backgroundColor: "#FFFFFF",
  },
  emptyState: {
    padding: 24,
    alignItems: "center",
  },
});

export default DaySelectionScreen;
