import React from "react";
import { Modal, View, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import Text from "@/components/ui/Text";
import Button from "../ui/Button";
import useTheme from "@/hooks/useTheme";

interface WarmupModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * WarmupModal
 *
 * - Simple, compact modal that displays a short, scrollable list of general warmup
 *   instructions/exercises. No per-workout logic.
 * - Follows the Modal pattern used elsewhere in the app (see HeightPicker).
 */
export default function WarmupModal({ visible, onClose }: WarmupModalProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const warmupItems: string[] = [
    "5–10 min light cardio (jog, bike, row) — increase heart rate gradually",
    "Dynamic leg swings — 10 each side",
    "Arm circles — 10 forward / 10 backward",
    "World's greatest stretch — 6–8 per side",
    "Bodyweight squats — 2 sets of 8–12 reps",
    "Hip hinge / good mornings (bodyweight) — 2 sets of 8",
    "Light warm-up sets for first working exercise (50–60% of working weight)",
    "Activation: glute bridges / band pull-aparts — 2 sets of 10–15",
  ];

  return (
    <Modal visible={visible} animationType='slide' onRequestClose={onClose} transparent={false}>
      <View style={styles.container}>
        <Text variant='h2' color='primary' style={styles.title}>
          Warmup & Mobility
        </Text>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {warmupItems.map((item, idx) => (
            <View key={idx} style={styles.item}>
              <Text variant='body' color='primary' style={styles.bullet}>
                {`\u2022`}
              </Text>
              <Text variant='body' color='primary' style={styles.itemText}>
                {item}
              </Text>
            </View>
          ))}

          <Text variant='bodySmall' color='secondary' style={styles.note}>
            These are general warmup suggestions. Adjust volume and movements to suit your needs.
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <Button onPress={onClose} testID='warmup-close-button'>
            Close
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
      backgroundColor: colors.background,
      paddingTop: 48,
      paddingHorizontal: 16,
    },
    title: {
      marginBottom: 12,
    },
    list: {
      paddingBottom: 24,
    },
    item: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    bullet: {
      marginRight: 8,
      lineHeight: 20,
      width: 20,
      textAlign: "center",
      color: colors.text,
    },
    itemText: {
      flex: 1,
      color: colors.text,
    },
    note: {
      marginTop: 12,
      color: colors.subtext,
    },
    footer: {
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: "center",
    },
  });
