import React from "react";
import { TouchableOpacity, View, StyleSheet } from "react-native";
import Text from "../ui/Text";
import type { ExperienceLevel } from "../../types/guidance";
import { getExperienceLevelInfo } from "../../types/profile";

type Props = {
  level: ExperienceLevel;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
};

/**
 * ExperienceLevelCard
 *
 * Small selectable card used on onboarding to choose experience level.
 * Keeps copy minimal and accessible.
 */
export default function ExperienceLevelCard({ level, selected = false, onPress, testID }: Props) {
  // Use the canonical experience-level descriptions from profile types
  const info = getExperienceLevelInfo(level as any);
  const focus = info?.description || "";

  const labelMap: Record<ExperienceLevel, string> = {
    untrained: "Untrained",
    beginner: "Beginner",
    early_intermediate: "Early intermediate",
    intermediate: "Intermediate",
    advanced: "Advanced",
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole='button'
      accessibilityState={{ selected }}
      accessibilityLabel={`${labelMap[level]} experience level`}
      style={[styles.container, selected && styles.selected]}
      testID={testID}>
      <View style={styles.inner}>
        <Text variant='h3' style={styles.title}>
          {labelMap[level]}
        </Text>
        {focus ? (
          <Text variant='body' style={styles.subtitle}>
            {focus}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "transparent",
    marginVertical: 6,
  },
  selected: {
    borderColor: "#2563eb", // fallback blue (theme will typically override)
    backgroundColor: "rgba(37,99,235,0.06)",
  },
  inner: {
    flexDirection: "column",
  },
  title: {
    marginBottom: 6,
  },
  subtitle: {
    color: "#6b7280",
  },
});
