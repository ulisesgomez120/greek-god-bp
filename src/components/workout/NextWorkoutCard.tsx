// NextWorkoutCard - shows Resume / Start Next / Program Complete
import React from "react";
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import Text from "@/components/ui/Text";
import useTheme from "@/hooks/useTheme";
import type { NextWorkoutInfo } from "@/types/workoutProgress";

interface Props {
  loading?: boolean;
  info: NextWorkoutInfo | null;
  onResume?: () => void;
  onStartNext?: () => void;
}

const NextWorkoutCard: React.FC<Props> = ({ loading, info, onResume, onStartNext }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size='small' color={colors.primary} />
      </View>
    );
  }

  if (!info) return null;
  if (info.type === "complete") {
    return (
      <View style={styles.card}>
        <Text variant='h3' color='primary'>
          Program Complete
        </Text>
        <Text variant='body' color='secondary' style={{ marginTop: 8 }}>
          You have completed all phases for this program. Great job!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {info.resumeSession ? (
        <View style={{ marginBottom: 12 }}>
          <Text variant='bodySmall' color='tertiary'>
            Resume last workout
          </Text>
          <Text variant='h3' color='primary' style={{ marginTop: 6 }}>
            {info.resumeSession.workoutName}
          </Text>
          <TouchableOpacity style={styles.buttonPrimary} onPress={onResume} activeOpacity={0.8}>
            <Text variant='body' color='white'>
              Resume Workout
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {info.nextSession ? (
        <View>
          <Text variant='bodySmall' color='tertiary'>
            Next workout
          </Text>
          <Text variant='h3' color='primary' style={{ marginTop: 6 }}>
            {info.nextSession.workoutName}
          </Text>
          <Text variant='bodySmall' color='secondary' style={{ marginTop: 6 }}>
            Phase {info.nextSession.phaseNumber} — Day {info.nextSession.dayNumber} (Repetition{" "}
            {info.nextSession.repetition} of {info.nextSession.totalRepetitions})
          </Text>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <TouchableOpacity style={styles.buttonSecondary} onPress={onStartNext} activeOpacity={0.8}>
              <Text variant='body' color='primary'>
                Start Next Workout
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.surfaceElevated,
    },
    buttonPrimary: {
      marginTop: 12,
      backgroundColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 8,
      alignItems: "center",
    },
    buttonSecondary: {
      marginTop: 12,
      backgroundColor: colors.surfaceElevated,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 8,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.primary,
    },
  });

export default NextWorkoutCard;
