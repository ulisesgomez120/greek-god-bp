import React from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import usePerformedPlannedExercises, { PlannedExerciseSearchResult } from "../../hooks/usePerformedPlannedExercises";
import { useNavigation } from "@react-navigation/native";
import useAuth from "@/hooks/useAuth";

export default function ExerciseSearchScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { searchQuery, setSearchQuery, results, loading, error, fetchMore, hasMore } = usePerformedPlannedExercises(
    "",
    {
      userId: user?.id,
      debounceMs: 300,
      pageSize: 20,
    }
  );

  const renderItem = ({ item }: { item: PlannedExerciseSearchResult }) => (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate(
          "ExerciseDetailProgress" as never,
          { exerciseId: item.exerciseId, plannedExerciseId: item.plannedExerciseId } as never
        )
      }
      style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee" }}>
      <Text style={{ fontWeight: "600" }}>{item.exerciseName}</Text>
      <Text style={{ color: "#666", marginTop: 4 }}>
        {item.planName ? `${item.planName} — ${item.sessionName || ""}` : item.sessionName}
      </Text>
      <Text style={{ color: "#999", marginTop: 6 }}>{`Sets ${item.targetSets} • Reps ${item.targetRepsMin} • last: ${
        item.lastPerformed ? new Date(item.lastPerformed).toLocaleDateString() : "N/A"
      }`}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <TextInput
        placeholder='Search performed planned exercises'
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={{ padding: 12, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, marginBottom: 12 }}
        accessibilityLabel='Search performed planned exercises'
      />

      {loading && results.length === 0 ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(i) => i.plannedExerciseId}
          renderItem={renderItem}
          onEndReached={() => {
            if (hasMore) fetchMore();
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={() => (
            <View style={{ padding: 24 }}>
              <Text style={{ textAlign: "center", color: "#666" }}>No performed planned exercises found.</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
