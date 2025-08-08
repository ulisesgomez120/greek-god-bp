// ============================================================================
// MONTHLY REVIEW SCREEN
// ============================================================================
// Screen for displaying AI-generated monthly reviews

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

type MonthlyReviewScreenNavigationProp = StackNavigationProp<AICoachStackParamList, "MonthlyReview">;
type MonthlyReviewScreenRouteProp = RouteProp<AICoachStackParamList, "MonthlyReview">;

interface MonthlyReviewScreenProps {
  navigation: MonthlyReviewScreenNavigationProp;
  route: MonthlyReviewScreenRouteProp;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const MonthlyReviewScreen: React.FC<MonthlyReviewScreenProps> = ({ navigation, route }) => {
  const { reviewId } = route.params;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text variant='h1' color='primary' style={styles.title}>
          Monthly Review
        </Text>
        <Text variant='body' color='secondary'>
          Review ID: {reviewId}
        </Text>
        <Text variant='body' color='secondary' style={styles.placeholder}>
          Monthly review content will be displayed here.
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

export default MonthlyReviewScreen;
