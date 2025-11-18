import React from "react";
import { View, Text, TouchableOpacity, FlatList } from "react-native";
import type { ExerciseSessionSummary } from "@/types";

export default function LastSessionsList({
  sessions,
  onPressSession,
}: {
  sessions: ExerciseSessionSummary[];
  onPressSession?: (id: string) => void;
}) {
  if (!sessions || sessions.length === 0) {
    return (
      <View style={{ padding: 12 }}>
        <Text style={{ color: "#666" }}>No recent sessions for this exercise.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={sessions}
      keyExtractor={(item) => item.sessionId}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => onPressSession && onPressSession(item.sessionId)}
          style={{ paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: "#eee" }}
          accessibilityRole='button'>
          <Text style={{ fontWeight: "600" }}>{new Date(item.date).toLocaleDateString()}</Text>
          <Text style={{ color: "#666", marginTop: 4 }}>
            Sets: {item.sets.length} • Volume: {item.totalVolume} kg
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}
