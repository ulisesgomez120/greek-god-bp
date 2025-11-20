import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import useTheme from "@/hooks/useTheme";
import type { ExerciseSessionSummary } from "@/types";

export default function LastSessionsList({
  sessions,
  onPressSession,
}: {
  sessions: ExerciseSessionSummary[];
  onPressSession?: (id: string) => void;
}) {
  const { colors } = useTheme();

  if (!sessions || sessions.length === 0) {
    return (
      <View style={{ padding: 12 }}>
        <Text style={{ color: colors.subtext }}>No recent sessions for this exercise.</Text>
      </View>
    );
  }

  // For small lists (typical usage: last 5 sessions), a simple map is fine
  // and avoids nesting a VirtualizedList inside a ScrollView which causes RN warnings.
  return (
    <View>
      {sessions.map((item) => (
        <TouchableOpacity
          key={item.sessionId}
          onPress={() => onPressSession && onPressSession(item.sessionId)}
          style={{ paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: colors.border }}
          accessibilityRole='button'>
          <Text style={{ fontWeight: "600", color: colors.text }}>{new Date(item.date).toLocaleDateString()}</Text>
          <Text style={{ color: colors.subtext, marginTop: 4 }}>
            Sets: {item.sets.length} • Volume: {item.totalVolume} kg
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
