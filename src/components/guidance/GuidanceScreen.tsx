import React from "react";
import { View, ScrollView, StyleSheet, AccessibilityRole } from "react-native";
import type { GuidanceContent } from "../../types/guidance";
import Text from "../ui/Text";
import Button from "../ui/Button";

type Props = {
  guidance: GuidanceContent;
  onDismiss?: () => void;
  onPrimaryAction?: () => void;
  primaryLabel?: string;
  style?: any;
};

/**
 * GuidanceScreen
 *
 * Minimal, accessible presentation component for a guidance payload.
 * - Renders a heading, 1..N bullets, and an optional primary action / dismiss control.
 * - Keeps layout simple so it can be used as a full-screen screen or embedded card.
 */
export default function GuidanceScreen({
  guidance,
  onDismiss,
  onPrimaryAction,
  primaryLabel = "Got it",
  style,
}: Props) {
  const headingRole = "header" as AccessibilityRole;

  return (
    <ScrollView
      contentContainerStyle={[styles.container, style]}
      accessible
      accessibilityLabel={`${guidance.title || "Guidance"} guidance`}>
      <View style={styles.inner}>
        <Text style={styles.title} accessibilityRole={headingRole}>
          {guidance.title}
        </Text>

        <View style={styles.bullets}>
          {guidance.bullets.map((b, idx) => (
            <View key={`${guidance.id}-bullet-${idx}`} style={styles.bulletRow} accessible accessibilityRole='text'>
              <Text style={styles.bulletIndex} accessibilityLabel={`Bullet ${idx + 1}`}>
                {idx + 1}.
              </Text>
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          {onPrimaryAction ? (
            <Button onPress={onPrimaryAction} accessibilityLabel={primaryLabel}>
              {primaryLabel}
            </Button>
          ) : null}

          {onDismiss ? (
            <Button variant='text' onPress={onDismiss} accessibilityLabel='Dismiss guidance' style={styles.dismiss}>
              Dismiss
            </Button>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: "transparent",
  },
  inner: {
    flex: 1,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  bullets: {
    marginTop: 6,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  bulletIndex: {
    width: 22,
    fontWeight: "700",
  },
  bulletText: {
    flex: 1,
    lineHeight: 20,
  },
  actions: {
    marginTop: 18,
    flexDirection: "row",
    gap: 12,
  },
  dismiss: {
    marginLeft: 8,
  },
});
