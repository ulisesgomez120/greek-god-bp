import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import useTheme from "@/hooks/useTheme";
import type { PersonalRecord } from "@/types";

function round1(v: number) {
  return Math.round(v * 10) / 10;
}

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

  // Helper to get a single PR by type
  const get = (type: PersonalRecord["type"]) => prs.find((p) => p.type === type) as PersonalRecord | undefined;

  const maxWeight = get("max_weight");
  const est1rm = get("estimated_1rm");
  const volume = get("volume");
  const reps = get("reps");

  // Formatters
  const formatMaxWeight = (r?: PersonalRecord) => {
    if (!r) return "—";
    const w = r.metadata?.weight ?? r.value;
    const rp = r.metadata?.reps ?? undefined;
    return rp ? `${round1(w)} kg × ${rp} reps` : `${round1(w)} kg`;
  };

  const formatEst1RM = (r?: PersonalRecord) => {
    if (!r) return "—";
    return `${round1(r.value)} kg`;
  };

  const formatVolume = (r?: PersonalRecord) => {
    if (!r) return "—";
    const w = r.metadata?.weight;
    const rp = r.metadata?.reps;
    const ctx = w && rp ? ` (${round1(w)}×${rp})` : "";
    return `${Math.round(r.value)} kg${ctx}`;
  };

  const formatReps = (r?: PersonalRecord) => {
    if (!r) return "—";
    const w = r.metadata?.weight;
    return w ? `${r.value} reps @ ${round1(w)} kg` : `${r.value} reps`;
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
