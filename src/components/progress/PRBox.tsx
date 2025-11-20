import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import useTheme from "@/hooks/useTheme";
import type { PersonalRecord } from "@/types";

export default function PRBox({ prs, onPress }: { prs: PersonalRecord[]; onPress?: () => void }) {
  const { colors } = useTheme();

  if (!prs || prs.length === 0) {
    return (
      <View style={{ padding: 12, borderRadius: 8, backgroundColor: colors.surfaceElevated }}>
        <Text style={{ fontWeight: "600", color: colors.text }}>No PRs yet</Text>
        <Text style={{ color: colors.subtext, marginTop: 6 }}>Complete your first workout to record a PR.</Text>
      </View>
    );
  }

  const best = prs[0];

  return (
    <TouchableOpacity onPress={onPress} accessibilityRole='button' accessibilityLabel={`Personal record: ${best.type}`}>
      <View
        style={{
          padding: 12,
          borderRadius: 8,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
        <Text style={{ fontWeight: "700", fontSize: 16, color: colors.text }}>{best.type.toUpperCase()}</Text>
        <Text style={{ marginTop: 6, fontSize: 20, color: colors.text }}>{best.value}</Text>
        <Text style={{ color: colors.subtext, marginTop: 4 }}>{new Date(best.achievedAt).toLocaleDateString()}</Text>
      </View>
    </TouchableOpacity>
  );
}
