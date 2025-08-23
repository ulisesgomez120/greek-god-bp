// ============================================================================
// AI COACH NAVIGATOR
// ============================================================================
// AI coaching stack navigation with chat interface, reviews, and conversations

import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import useTheme from "@/hooks/useTheme";

// Components
import { TempFeatureGate } from "../components/subscription/TempFeatureGate";

// AI Coach screens
import { AICoachScreen } from "../screens/ai/AICoachScreen";
import { MonthlyReviewScreen } from "../screens/ai/MonthlyReviewScreen";
import { ConversationsScreen } from "../screens/ai/ConversationsScreen";

// Types
import { AICoachStackParamList } from "../types/navigation";

// ============================================================================
// STACK NAVIGATOR
// ============================================================================

const AICoachStack = createStackNavigator<AICoachStackParamList>();

// ============================================================================
// AI COACH NAVIGATOR COMPONENT
// ============================================================================

const AICoachNavigator: React.FC = () => {
  const { colors } = useTheme();
  return (
    <TempFeatureGate featureKey='ai_coaching'>
      <AICoachStack.Navigator
        initialRouteName='AICoach'
        screenOptions={{
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.background,
            borderBottomColor: colors.border ?? colors.surface,
            borderBottomWidth: 1,
          },
          headerTitleStyle: {
            fontSize: 17,
            fontWeight: "600",
            color: colors.text,
          },
          headerBackTitleVisible: false,
          headerTintColor: colors.primary,
          gestureEnabled: true,
          cardStyleInterpolator: ({ current, layouts }) => {
            return {
              cardStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [layouts.screen.width, 0],
                    }),
                  },
                ],
              },
            };
          },
        }}>
        <AICoachStack.Screen
          name='AICoach'
          component={AICoachScreen}
          options={{
            title: "AI Coach",
          }}
        />
        <AICoachStack.Screen
          name='MonthlyReview'
          component={MonthlyReviewScreen}
          options={{
            title: "Monthly Review",
          }}
        />
        <AICoachStack.Screen
          name='Conversations'
          component={ConversationsScreen}
          options={{
            title: "Conversations",
          }}
        />
      </AICoachStack.Navigator>
    </TempFeatureGate>
  );
};

export default AICoachNavigator;
