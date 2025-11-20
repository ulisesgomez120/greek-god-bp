import React, { useState } from "react";
import { View, Text, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { useRoute } from "@react-navigation/native";
import { useExerciseProgress } from "@/hooks/useExerciseProgress";
import PRBox from "@/components/progress/PRBox";
import VolumeChart from "@/components/progress/VolumeChart";
import TimeframeSelector from "@/components/progress/TimeframeSelector";
import LastSessionsList from "@/components/progress/LastSessionsList";
import { exerciseLookupService } from "@/services/exerciseLookup.service";
import useAuth from "@/hooks/useAuth";
import useTheme from "@/hooks/useTheme";
import type { TimeframeOption } from "@/types";

export default function ExerciseDetailProgress() {
  const route: any = useRoute();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const exerciseId: string | undefined = route.params?.exerciseId;
  const plannedExerciseId: string | undefined = route.params?.plannedExerciseId;

  const [timeframe, setTimeframe] = useState<TimeframeOption>("8w");

  const { loading, error, volume, sessions, prs } = useExerciseProgress(
    userId,
    exerciseId ?? "",
    plannedExerciseId,
    timeframe
  );

  // Try to resolve exercise name from cache (may be null)
  const exerciseName = exerciseId ? exerciseLookupService.getName(exerciseId) : null;
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <ScrollView contentContainerStyle={styles.container} accessibilityRole='scrollbar'>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode='tail'>
          {exerciseName || "Exercise Details"}
        </Text>
        {plannedExerciseId ? null : (
          <Text style={styles.muted}>Open the exercise from a plan to see scoped progress.</Text>
        )}
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size='small' />
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Text style={{ color: colors.error }}>{error}</Text>
        </View>
      )}

      {!loading && !error && (
        <View>
          <View style={{ marginVertical: 8 }}>
            <PRBox prs={prs || []} />
          </View>

          <View style={{ marginVertical: 8 }}>
            <TimeframeSelector value={timeframe} onChange={(v) => setTimeframe(v)} />
            <VolumeChart data={volume || []} timeframe={timeframe} />
          </View>

          <View style={{ marginVertical: 8 }}>
            <Text style={styles.sectionTitle}>Last Sessions</Text>
            <LastSessionsList
              sessions={sessions || []}
              onPressSession={(id) => {
                /* navigate to session detail if desired */
              }}
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { padding: 16, backgroundColor: colors.background },
    header: { marginBottom: 8 },
    title: { fontSize: 20, fontWeight: "700", color: colors.text },
    muted: { color: colors.subtext, marginTop: 4 },
    center: { alignItems: "center", justifyContent: "center", padding: 12 },
    sectionTitle: { fontWeight: "700", marginBottom: 6, color: colors.text },
  });
