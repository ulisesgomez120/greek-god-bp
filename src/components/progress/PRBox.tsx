import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import type { PersonalRecord } from "@/types";

export default function PRBox({ prs, onPress }: { prs: PersonalRecord[]; onPress?: () => void }) {
  if (!prs || prs.length === 0) {
    return (
      <View style={{ padding: 12, borderRadius: 8, backgroundColor: "#f4f6f8" }}>
        <Text style={{ fontWeight: "600" }}>No PRs yet</Text>
        <Text style={{ color: "#666", marginTop: 6 }}>Complete your first workout to record a PR.</Text>
      </View>
    );
  }

  const best = prs[0];

  return (
    <TouchableOpacity onPress={onPress} accessibilityRole='button' accessibilityLabel={`Personal record: ${best.type}`}>
      <View style={{ padding: 12, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e6eef7" }}>
        <Text style={{ fontWeight: "700", fontSize: 16 }}>{best.type.toUpperCase()}</Text>
        <Text style={{ marginTop: 6, fontSize: 20 }}>{best.value}</Text>
        <Text style={{ color: "#666", marginTop: 4 }}>{new Date(best.achievedAt).toLocaleDateString()}</Text>
      </View>
    </TouchableOpacity>
  );
}
