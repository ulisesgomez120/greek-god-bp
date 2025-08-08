// ============================================================================
// AI COACH SCREEN
// ============================================================================
// Main AI coaching interface screen

import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";

// Components
import Text from "../../components/ui/Text";

// Types
import { AICoachStackParamList } from "../../types/navigation";

// ============================================================================
// TYPES
// ============================================================================

type AICoachScreenNavigationProp = StackNavigationProp<AICoachStackParamList, "AICoach">;
type AICoachScreenRouteProp = RouteProp<AICoachStackParamList, "AICoach">;

interface AICoachScreenProps {
  navigation: AICoachScreenNavigationProp;
  route: AICoachScreenRouteProp;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const AICoachScreen: React.FC<AICoachScreenProps> = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text variant='h1' color='primary' style={styles.title}>
          AI Coach
        </Text>
        <Text variant='body' color='secondary' style={styles.placeholder}>
          AI coaching interface will be implemented here.
        </Text>
      </ScrollView>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    marginBottom: 16,
  },
  placeholder: {
    marginTop: 32,
    fontStyle: "italic",
  },
});

export default AICoachScreen;
