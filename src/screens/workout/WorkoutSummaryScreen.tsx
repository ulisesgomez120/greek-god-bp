import React, { useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, ActivityIndicator, Alert } from "react-native";
import useUnitPreferences from "../../hooks/useUnitPreferences";
import { formatKgToLbsDisplay } from "../../utils/unitConversions";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";

import Text from "../../components/ui/Text";
import workoutService from "../../services/workout.service";
import { WorkoutStackParamList } from "../../types/navigation";
import type { WorkoutSession } from "../../types";

type WorkoutSummaryScreenNavigationProp = StackNavigationProp<WorkoutStackParamList, "WorkoutSummary">;
type WorkoutSummaryScreenRouteProp = RouteProp<WorkoutStackParamList, "WorkoutSummary">;

interface WorkoutSummaryScreenProps {
  navigation: WorkoutSummaryScreenNavigationProp;
  route: WorkoutSummaryScreenRouteProp;
}

export const WorkoutSummaryScreen: React.FC<WorkoutSummaryScreenProps> = ({ route }) => {
  const { sessionId } = route.params;

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<WorkoutSession | null>(null);

  // Ensure hooks are called unconditionally at the top-level to avoid Hooks order violations.
  const { isImperial } = useUnitPreferences();

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        setLoading(true);
        setError(null);

        // Try to recover session from the service (server)
        const result = await workoutService.recoverWorkoutSession(sessionId);
        if (!mounted) return;

        if (!result.success || !result.data) {
          setError(result.error || "Failed to load workout summary");
          setSession(null);
        } else {
          setSession(result.data);
        }
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message || "Failed to load workout summary");
        setSession(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSession();

    return () => {
      mounted = false;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <View style={styles.containerCentered}>
        <ActivityIndicator size='large' color='#B5CFF8' />
        <Text variant='body' color='secondary' style={{ marginTop: 12 }}>
          Loading workout summary...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.containerCentered}>
        <Text variant='h1' color='primary' style={{ marginBottom: 8 }}>
          Workout Summary
        </Text>
        <Text variant='body' color='tertiary' style={{ marginBottom: 16 }}>
          {`Error: ${error}`}
        </Text>
        <Text
          variant='bodySmall'
          color='secondary'
          onPress={() => {
            // simple retry UX: reload by remounting effect
            setLoading(true);
            setError(null);
            workoutService
              .recoverWorkoutSession(sessionId)
              .then((res) => {
                if (res.success && res.data) {
                  setSession(res.data);
                } else {
                  setError(res.error || "Failed to load workout summary");
                }
              })
              .catch((e) => {
                setError(e?.message || "Failed to load workout summary");
              })
              .finally(() => setLoading(false));
          }}>
          Tap to retry
        </Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.containerCentered}>
        <Text variant='h1' color='primary' style={{ marginBottom: 8 }}>
          Workout Summary
        </Text>
        <Text variant='body' color='secondary'>
          No session data available.
        </Text>
      </View>
    );
  }

  const sets = session.sets || [];
  const weightDisplay = (kg?: number | null) => {
    if (!kg) return "Bodyweight";
    if (isImperial()) return formatKgToLbsDisplay(kg);
    return `${kg} kg`;
  };
  // Temporary placeholder while the summary screen is under development
  return (
    <View style={styles.container}>
      <Text variant='h1'>WIP</Text>
    </View>
  );

  // return (
  //   <View style={styles.container}>
  //     <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
  //       <Text variant='h1' color='primary' style={styles.title}>
  //         Workout Complete! 🎉
  //       </Text>

  //       <View style={styles.meta}>
  //         <Text variant='body' color='secondary'>
  //           Session ID: {session.id}
  //         </Text>
  //         <Text variant='body' color='secondary'>
  //           Name: {session.name || "Workout"}
  //         </Text>
  //         <Text variant='body' color='secondary'>
  //           Duration: {session.durationMinutes ?? "—"} min
  //         </Text>
  //         <Text variant='body' color='secondary'>
  //           Sets logged: {sets.length}
  //         </Text>
  //         <Text variant='body' color='secondary'>
  //           Total volume:{" "}
  //           {session.totalVolumeKg
  //             ? isImperial()
  //               ? formatKgToLbsDisplay(session.totalVolumeKg)
  //               : `${session.totalVolumeKg} kg`
  //             : "—"}
  //         </Text>
  //         <Text variant='body' color='secondary'>
  //           Avg RPE: {session.averageRpe ?? "—"}
  //         </Text>
  //       </View>

  //       <View style={styles.section}>
  //         <Text variant='h3' color='primary' style={styles.sectionTitle}>
  //           Sets
  //         </Text>

  //         {sets.length === 0 ? (
  //           <Text variant='body' color='secondary'>
  //             No sets recorded for this session.
  //           </Text>
  //         ) : (
  //           sets.map((s, idx) => (
  //             <View key={s.id ?? idx} style={styles.setItem}>
  //               <Text variant='body' color='primary'>
  //                 Set {s.setNumber}: {s.weightKg ? `${weightDisplay(s.weightKg)}` : "Bodyweight"} × {s.reps}
  //               </Text>
  //               {s.rpe ? (
  //                 <Text variant='bodySmall' color='secondary'>
  //                   RPE {s.rpe}
  //                 </Text>
  //               ) : null}
  //               {s.isWarmup ? (
  //                 <Text variant='bodySmall' color='tertiary'>
  //                   {" "}
  //                   - Warmup
  //                 </Text>
  //               ) : null}
  //             </View>
  //           ))
  //         )}
  //       </View>
  //     </ScrollView>
  //   </View>
  // );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  containerCentered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 20,
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
  meta: {
    marginBottom: 20,
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  setItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
});

export default WorkoutSummaryScreen;
