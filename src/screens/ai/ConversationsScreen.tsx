// ============================================================================
// CONVERSATIONS SCREEN
// ============================================================================
// Screen for viewing AI coaching conversation history

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

type ConversationsScreenNavigationProp = StackNavigationProp<AICoachStackParamList, "Conversations">;
type ConversationsScreenRouteProp = RouteProp<AICoachStackParamList, "Conversations">;

interface ConversationsScreenProps {
  navigation: ConversationsScreenNavigationProp;
  route: ConversationsScreenRouteProp;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ConversationsScreen: React.FC<ConversationsScreenProps> = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text variant='h1' color='primary' style={styles.title}>
          Conversations
        </Text>
        <Text variant='body' color='secondary' style={styles.placeholder}>
          AI coaching conversation history will be displayed here.
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

export default ConversationsScreen;
