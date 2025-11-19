import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";

export default function ProgressLanding() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Progress</Text>

      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("ExerciseSearch")}
        accessibilityRole='button'>
        <Text style={styles.cardTitle}>Exercise Detail</Text>
        <Text style={styles.cardDesc}>
          Search and select a planned exercise to view volume progression, PRs, and recent sessions.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("StrengthCharts")}
        accessibilityRole='button'>
        <Text style={styles.cardTitle}>Strength Charts</Text>
        <Text style={styles.cardDesc}>View strength progression charts across exercises.</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  card: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  cardTitle: { fontWeight: "700" },
  cardDesc: { color: "#666", marginTop: 6 },
});
