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
import useTheme from "@/hooks/useTheme";
import NextWorkoutCard from "../../components/workout/NextWorkoutCard";
import { useAuth } from "@/hooks/useAuth";
import type { NextWorkoutInfo } from "@/types/workoutProgress";

// Services
import workoutPlanService, { WorkoutPlanSummary } from "../../services/workoutPlan.service";
import { workoutService } from "../../services/workout.service";

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
  styles?: any;
}

const ProgramCard: React.FC<ProgramCardProps> = ({ program, onPress, styles }) => {
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
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [plans, setPlans] = useState<WorkoutPlanSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Next workout state (minimal)
  const { user } = useAuth();
  const [nextInfo, setNextInfo] = useState<NextWorkoutInfo | null>(null);
  const [creatingSession, setCreatingSession] = useState<boolean>(false);

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

  // Auto-fetch next workout for authenticated user
  useEffect(() => {
    let mounted = true;

    async function loadNextWorkoutForUser() {
      if (!user?.id) {
        return;
      }

      try {
        // Delegate plan selection and progression logic to workoutPlanService
        const next = await workoutPlanService.getNextWorkoutForUser(user.id);
        if (!mounted) return;
        setNextInfo(next || null);
      } catch (err: any) {
        console.warn("ProgramSelection: failed to load next workout", err);
        if (!mounted) return;
      }
    }

    loadNextWorkoutForUser();

    return () => {
      mounted = false;
    };
  }, [user?.id, plans.length]);

  const handleProgramSelect = (programId: string) => {
    navigation.navigate("PhaseSelection", { programId });
  };

  // Next workout handlers (simple navigation to ExerciseList)
  const handleResumeWorkout = async (resumeInfo?: NextWorkoutInfo["resumeSession"]) => {
    if (!resumeInfo) return;

    // Try to recover the referenced workout_sessions row into workoutService so the in-memory
    // current session reflects the user's actual session (resume) rather than creating a new one.
    // Do not modify user_workout_progress here — resuming should not change stored progress.
    try {
      if (resumeInfo.workoutSessionId) {
        try {
          await workoutService.recoverWorkoutSession(resumeInfo.workoutSessionId);
        } catch (recoverErr) {
          // Non-fatal: log and continue to navigation so user can still view the session/day.
          console.warn("ProgramSelection: failed to recover session for resume", recoverErr);
        }
      }
    } catch (err) {
      console.warn("ProgramSelection: unexpected error while attempting to recover resume session", err);
    }

    navigation.navigate("ExerciseList", {
      programId: resumeInfo.planId,
      phaseId: resumeInfo.phaseId,
      dayId: resumeInfo.sessionId,
      workoutName: resumeInfo.workoutName,
      // Include workoutSessionId so downstream screens know this is a resume of an existing session.
      workoutSessionId: resumeInfo.workoutSessionId,
    } as any);
  };

  const handleStartNext = async (nextSession?: NextWorkoutInfo["nextSession"]) => {
    if (!nextSession || !user?.id) return;

    try {
      setCreatingSession(true);

      // Create the next workout session and persist progress
      const result = await workoutPlanService.advanceToNextWorkout(user.id, nextSession.planId);
      const created = result?.createdSession;

      // Ensure workoutService has the created session loaded in-memory for immediate use
      if (created && created.id) {
        try {
          await workoutService.recoverWorkoutSession(created.id);
        } catch (recoverErr) {
          // Non-fatal: log and continue to navigation so user sees the exercises
          console.warn("Failed to recover created session into workoutService", recoverErr);
        }
      }

      // Navigate to ExerciseList and include workoutSessionId so downstream screens can reference it.
      navigation.navigate("ExerciseList", {
        programId: nextSession.planId,
        phaseId: nextSession.phaseId,
        dayId: nextSession.sessionId,
        workoutName: nextSession.workoutName,
        workoutSessionId: created?.id,
      } as any);
    } catch (err: any) {
      console.warn("ProgramSelection: failed to start next workout", err);
    } finally {
      setCreatingSession(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.containerCentered}>
        <ActivityIndicator size='large' color={colors.primary} />
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

        {/* Next workout card */}
        <View style={{ paddingHorizontal: 20 }}>
          <NextWorkoutCard
            info={nextInfo}
            onResume={() => handleResumeWorkout(nextInfo?.resumeSession)}
            onStartNext={() => handleStartNext(nextInfo?.nextSession)}
          />
        </View>

        <View style={styles.programList}>
          {plans.length > 0 ? (
            plans.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                onPress={() => handleProgramSelect(program.id)}
                styles={styles}
              />
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
    header: {
      marginBottom: 32,
    },
    title: {
      marginBottom: 8,
    },
    subtitle: {
      lineHeight: 22,
      color: colors.subtext,
    },
    programList: {
      gap: 16,
    },
    programCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.surfaceElevated,
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
      backgroundColor: colors.lightBackground,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    difficultyText: {
      color: colors.primary,
      fontWeight: "600",
    },
    programDescription: {
      marginBottom: 16,
      lineHeight: 20,
      color: colors.subtext,
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
      color: colors.subtext,
    },
    detailValue: {
      fontWeight: "600",
      color: colors.text,
    },
    emptyState: {
      padding: 24,
      alignItems: "center",
    },
  });

export default ProgramSelectionScreen;
