import React, { useState } from "react";
import { View, StyleSheet, ActivityIndicator, Alert } from "react-native";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import useTheme from "@/hooks/useTheme";
import WarmupModal from "./WarmupModal";
import WorkoutCompletionModal from "./WorkoutCompletionModal";
import { workoutService } from "@/services/workout.service";

/**
 * WorkoutControlsSection
 *
 * Compact control section rendered under the header on ExerciseListScreen.
 * - Notes input (optional)
 * - Warmup button (opens WarmupModal)
 * - Complete button (calls workoutService.completeWorkout(notes) and navigates to WorkoutSummary)
 *
 * Keep UI compact so the main exercise list remains visually intact.
 */
interface Props {
  programId: string;
  phaseId: string;
  dayId: string;
  workoutName?: string | null;
  session?: any | null;
  navigation: any;
}

export default function WorkoutControlsSection({ programId, phaseId, dayId, workoutName, session, navigation }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [notes, setNotes] = useState<string>("");
  const [showWarmup, setShowWarmup] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const [showCompletion, setShowCompletion] = useState<boolean>(false);

  const handleConfirmComplete = async (notesFromModal?: string) => {
    try {
      setLoading(true);
      const res = await workoutService.completeWorkout(notesFromModal?.trim() ? notesFromModal.trim() : undefined);
      setLoading(false);

      if (res.success && res.data && res.data.id) {
        navigation.navigate("WorkoutSummary", { sessionId: res.data.id });
        return res;
      } else {
        Alert.alert("Unable to complete workout", res.error || "An unknown error occurred");
        return res;
      }
    } catch (err: any) {
      setLoading(false);
      Alert.alert("Error", err?.message || "Failed to complete workout");
      return { success: false, error: err?.message ?? "Failed to complete workout" };
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        <View style={styles.buttonWrapper}>
          <Button
            onPress={() => setShowWarmup(true)}
            testID='workout-warmup-button'
            variant='secondary'
            style={{ borderColor: colors.warning }}>
            <Text variant='button' style={{ color: colors.warning }}>
              Quick Warmup
            </Text>
          </Button>
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            onPress={() => setShowCompletion(true)}
            disabled={loading}
            testID='workout-complete-button'
            style={{ backgroundColor: colors.success }}>
            {loading ? (
              <ActivityIndicator color={colors.buttonTextOnPrimary || colors.buttonText} />
            ) : (
              "Complete Workout"
            )}
          </Button>
        </View>
      </View>

      <WarmupModal visible={showWarmup} onClose={() => setShowWarmup(false)} />
      <WorkoutCompletionModal
        visible={showCompletion}
        initialNotes={notes}
        onClose={() => setShowCompletion(false)}
        onConfirm={handleConfirmComplete}
      />
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    label: {
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.text,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      fontSize: 14,
    },
    buttonRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
    },
    buttonWrapper: {
      flex: 1,
      marginHorizontal: 4,
    },
  });
