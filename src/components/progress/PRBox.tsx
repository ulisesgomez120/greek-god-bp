import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import useTheme from "@/hooks/useTheme";
import useUnitPreferences from "@/hooks/useUnitPreferences";
import { formatKgToLbsDisplay } from "@/utils/unitConversions";
import type { PersonalRecord } from "@/types";

function round1(v: number) {
  return Math.round(v * 10) / 10;
}

export default function PRBox({ prs, onPress }: { prs: PersonalRecord[]; onPress?: () => void }) {
  const { colors } = useTheme();
  const { isMetric } = useUnitPreferences();

  if (!prs || prs.length === 0) {
    return (
      <View style={{ padding: 12, borderRadius: 8, backgroundColor: colors.surfaceElevated }}>
        <Text style={{ fontWeight: "600", color: colors.text }}>No PRs yet</Text>
        <Text style={{ color: colors.subtext, marginTop: 6 }}>Complete your first workout to record a PR.</Text>
      </View>
    );
  }

  // Helper to get a single PR by type
  const get = (type: PersonalRecord["type"]) => prs.find((p) => p.type === type) as PersonalRecord | undefined;

  const maxWeight = get("max_weight");
  const est1rm = get("estimated_1rm");
  const volume = get("volume");
  const reps = get("reps");

  // Formatters
  const formatMaxWeight = (r?: PersonalRecord) => {
    if (!r) return "—";
    const kg = r.metadata?.weight ?? r.value;
    const repsMeta = r.metadata?.reps;
    if (isMetric()) {
      const kgDisplay = Math.round(kg);
      return repsMeta ? `${kgDisplay} kg × ${repsMeta} reps` : `${kgDisplay} kg`;
    } else {
      // Show whole pounds for MAX WEIGHT (user-entered style)
      const lbsDisplay = formatKgToLbsDisplay(kg, 1); // step = 1 lb
      return repsMeta ? `${lbsDisplay} × ${repsMeta} reps` : lbsDisplay;
    }
  };

  const formatEst1RM = (r?: PersonalRecord) => {
    if (!r) return "—";
    const kg = r.value;
    if (isMetric()) {
      return `${round1(kg)} kg`;
    } else {
      return formatKgToLbsDisplay(kg, 0.5);
    }
  };

  const formatVolume = (r?: PersonalRecord) => {
    if (!r) return "—";
    const kgValue = r.value;
    const w = r.metadata?.weight;
    const rp = r.metadata?.reps;
    if (isMetric()) {
      const ctx = w && rp ? ` (${Math.round(w)}×${rp})` : "";
      return `${Math.round(kgValue)} kg${ctx}`;
    } else {
      const display = formatKgToLbsDisplay(kgValue, 1);
      const ctx = w && rp ? ` (${formatKgToLbsDisplay(w, 1)}×${rp})` : "";
      return `${display}${ctx}`;
    }
  };

  const formatReps = (r?: PersonalRecord) => {
    if (!r) return "—";
    const kg = r.metadata?.weight;
    if (kg) {
      if (isMetric()) {
        return `${r.value} reps @ ${Math.round(kg)} kg`;
      } else {
        return `${r.value} reps @ ${formatKgToLbsDisplay(kg, 1)}`;
      }
    }
    return `${r.value} reps`;
  };

  const formatDate = (r?: PersonalRecord) => {
    if (!r) return "";
    try {
      return new Date(r.achievedAt).toLocaleDateString();
    } catch {
      return "";
    }
  };

  return (
    <TouchableOpacity onPress={onPress} accessibilityRole='button' accessibilityLabel='Personal records'>
      <View
        style={{
          padding: 12,
          borderRadius: 8,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
        <Text style={{ fontWeight: "700", fontSize: 16, color: colors.text, marginBottom: 8 }}>Personal Records</Text>

        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flex: 1, padding: 8, borderRadius: 6, backgroundColor: colors.surfaceElevated }}>
            <Text style={{ fontWeight: "600", color: colors.text }}>MAX WEIGHT</Text>
            <Text style={{ marginTop: 6, fontSize: 16, color: colors.text }}>{formatMaxWeight(maxWeight)}</Text>
            <Text style={{ color: colors.subtext, marginTop: 4 }}>{formatDate(maxWeight)}</Text>
          </View>

          <View style={{ flex: 1, padding: 8, borderRadius: 6, backgroundColor: colors.surfaceElevated }}>
            <Text style={{ fontWeight: "600", color: colors.text }}>EST. 1RM</Text>
            <Text style={{ marginTop: 6, fontSize: 16, color: colors.text }}>{formatEst1RM(est1rm)}</Text>
            <Text style={{ color: colors.subtext, marginTop: 4 }}>{formatDate(est1rm)}</Text>
          </View>
        </View>

        <View style={{ height: 8 }} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flex: 1, padding: 8, borderRadius: 6, backgroundColor: colors.surfaceElevated }}>
            <Text style={{ fontWeight: "600", color: colors.text }}>MAX VOLUME</Text>
            <Text style={{ marginTop: 6, fontSize: 16, color: colors.text }}>{formatVolume(volume)}</Text>
            <Text style={{ color: colors.subtext, marginTop: 4 }}>{formatDate(volume)}</Text>
          </View>

          <View style={{ flex: 1, padding: 8, borderRadius: 6, backgroundColor: colors.surfaceElevated }}>
            <Text style={{ fontWeight: "600", color: colors.text }}>MAX REPS</Text>
            <Text style={{ marginTop: 6, fontSize: 16, color: colors.text }}>{formatReps(reps)}</Text>
            <Text style={{ color: colors.subtext, marginTop: 4 }}>{formatDate(reps)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
