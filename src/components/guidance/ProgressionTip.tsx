import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import Text from "../ui/Text";
import type { GuidanceContent, ExperienceLevel } from "../../types/guidance";
import { getGuidanceForLevel } from "../../utils/guidance";

type Props = {
  guidance?: GuidanceContent;
  level?: ExperienceLevel;
  compact?: boolean; // when true render single-line compact tip
  onPress?: () => void; // optional action (e.g., open full guidance)
  testID?: string;
};

/**
 * ProgressionTip
 *
 * Small inline guidance tip used in exercise screens and set logger.
 * - If guidance prop provided, uses that content.
 * - Otherwise derives inline guidance for provided level (or defaults to 'beginner').
 * - compact=true renders a single-line, single-bullet view suitable for toolbars/first-set hints.
 */
export default function ProgressionTip({ guidance, level = "beginner", compact = false, onPress, testID }: Props) {
  const content: GuidanceContent = guidance ?? getGuidanceForLevel(level, "inline");

  const bullet = content.bullets && content.bullets.length > 0 ? content.bullets[0] : "";

  if (compact) {
    return (
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole='button'
        accessibilityLabel='Progression tip'
        testID={testID}>
        <View style={styles.compact}>
          <Text variant='caption' numberOfLines={1} style={styles.compactText}>
            {bullet}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      <Text variant='bodySmall' style={styles.title}>
        {content.title || "Tip"}
      </Text>
      {content.bullets.map((b, i) => (
        <View key={`tip-${i}`} style={styles.row}>
          <Text style={styles.bulletIndex}>{i + 1}.</Text>
          <Text style={styles.bulletText}>{b}</Text>
        </View>
      ))}
      {onPress ? (
        <TouchableOpacity onPress={onPress} accessibilityRole='button' accessibilityLabel='Open guidance'>
          <Text variant='button' color='primary' style={styles.link}>
            Learn more
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  title: {
    fontWeight: "700",
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  bulletIndex: {
    width: 20,
    fontWeight: "700",
  },
  bulletText: {
    flex: 1,
    lineHeight: 18,
  },
  compact: {
    paddingVertical: 6,
  },
  compactText: {
    color: "#6b7280",
  },
  link: {
    marginTop: 8,
  },
});
