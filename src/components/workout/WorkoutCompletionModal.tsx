import React, { useState } from "react";
import { Modal, View, StyleSheet, TextInput, ActivityIndicator, Alert } from "react-native";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import useTheme from "@/hooks/useTheme";

interface Props {
  visible: boolean;
  initialNotes?: string;
  onClose: () => void;
  /**
   * Called when the user confirms completion.
   * Should return an object with a boolean `success` field (matching WorkoutServiceResult).
   */
  onConfirm: (notes?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
}

export default function WorkoutCompletionModal({ visible, initialNotes, onClose, onConfirm }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [notes, setNotes] = useState<string>(initialNotes ?? "");
  const [loading, setLoading] = useState<boolean>(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      const res = await onConfirm(notes?.trim() ? notes.trim() : undefined);
      setLoading(false);

      if (res && res.success) {
        onClose();
      } else {
        Alert.alert("Unable to complete workout", res?.error || "An unknown error occurred");
      }
    } catch (err: any) {
      setLoading(false);
      Alert.alert("Error", err?.message || "Failed to complete workout");
    }
  };

  return (
    <Modal visible={visible} animationType='slide' onRequestClose={onClose} transparent={false}>
      <View style={styles.container}>
        <Text variant='h2' color='primary' style={styles.title}>
          Complete Workout
        </Text>

        <Text variant='bodySmall' color='secondary' style={styles.prompt}>
          Add any final notes about your session (optional)
        </Text>

        <TextInput
          style={styles.input}
          placeholder='Notes about this workout...'
          placeholderTextColor={colors.subtext}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={6}
          textAlignVertical='top'
          testID='completion-notes-input'
        />

        <View style={styles.actions}>
          <Button variant='secondary' onPress={onClose} style={styles.cancelButton} testID='completion-cancel-button'>
            Cancel
          </Button>
          <Button
            onPress={handleConfirm}
            loading={loading}
            style={styles.confirmButton}
            testID='completion-confirm-button'>
            {loading ? (
              <ActivityIndicator color={colors.buttonTextOnPrimary || colors.buttonText} />
            ) : (
              "Confirm Completion"
            )}
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: 48,
      paddingHorizontal: 16,
      backgroundColor: colors.background,
    },
    title: {
      marginBottom: 8,
    },
    prompt: {
      marginBottom: 12,
      color: colors.subtext,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      color: colors.text,
      padding: 12,
      minHeight: 140,
      marginBottom: 20,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      borderColor: colors.border,
    },
    confirmButton: {
      flex: 1,
      backgroundColor: colors.success,
    },
  });
