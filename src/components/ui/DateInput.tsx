import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, Platform, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import useTheme from "@/hooks/useTheme";

interface Props {
  value?: Date | null;
  onChange: (d: Date | null) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  testID?: string;
}

/**
 * DateInput
 *
 * Simple wrapper around @react-native-community/datetimepicker that exposes a consistent button/display.
 * - value: current Date or null
 * - onChange: called with selected Date or null (if cleared)
 *
 * For Android we open the native picker directly; for iOS we show an inline picker in a modal.
 */
export default function DateInput({ value, onChange, minimumDate, maximumDate, testID }: Props) {
  const [open, setOpen] = useState(false);

  const { colors } = useTheme();
  const styles = createStyles(colors);

  const displayText = value ? format(value, "yyyy-MM-dd") : "Select date";

  const onChangeInternal = (_event: any, selected?: Date) => {
    // On Android this is called immediately; on iOS the modal keeps it open until closed.
    if (Platform.OS === "android") {
      setOpen(false);
      if (selected) {
        onChange(selected);
      }
    } else {
      // iOS: keep modal open until user taps Close, but still propagate selection realtime.
      if (selected) {
        onChange(selected);
      }
    }
  };

  return (
    <View>
      <TouchableOpacity onPress={() => setOpen(true)} style={styles.button} testID={testID ?? "date-input-button"}>
        <Text style={styles.text}>{displayText}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType='slide' onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <DateTimePicker
              value={value || new Date(1990, 0, 1)}
              mode='date'
              display={Platform.OS === "ios" ? "spinner" : "calendar"}
              onChange={onChangeInternal}
              maximumDate={maximumDate}
              minimumDate={minimumDate}
              testID='native-date-picker'
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setOpen(false);
                }}
                style={styles.actionButton}
                testID='date-input-close'>
                <Text style={styles.actionText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  // keep whatever is currently selected in picker (DateTimePicker calls onChange)
                  setOpen(false);
                }}
                style={[styles.actionButton, styles.actionButtonPrimary]}
                testID='date-input-done'>
                <Text style={[styles.actionText, styles.actionTextPrimary]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    button: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    text: {
      fontSize: 16,
      color: colors.text,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.background,
      paddingTop: 12,
      paddingBottom: 24,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    actionButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      marginLeft: 8,
    },
    actionButtonPrimary: {
      backgroundColor: colors.primary,
    },
    actionText: {
      fontSize: 16,
      color: colors.subtext,
    },
    actionTextPrimary: {
      color: colors.buttonTextOnPrimary || colors.buttonText || "#FFFFFF",
      fontWeight: "600",
    },
  });
