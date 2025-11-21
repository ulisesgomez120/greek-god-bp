import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import useTheme from "@/hooks/useTheme";

export default function ProgressLanding() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = createStyles(colors);

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

      {/* <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("StrengthCharts")}
        accessibilityRole='button'>
        <Text style={styles.cardTitle}>Strength Charts</Text>
        <Text style={styles.cardDesc}>View strength progression charts across exercises.</Text>
      </TouchableOpacity> */}
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { padding: 16, backgroundColor: colors.background },
    title: { fontSize: 22, fontWeight: "700", marginBottom: 12, color: colors.text },
    card: {
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.surface,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: { fontWeight: "700", color: colors.text },
    cardDesc: { color: colors.subtext, marginTop: 6 },
  });
