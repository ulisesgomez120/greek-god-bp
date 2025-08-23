// ============================================================================
// PROGRESS NAVIGATOR
// ============================================================================
// Progress tracking stack navigation with dashboard, history, and charts

import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import useTheme from "@/hooks/useTheme";

// Screens
import ProgressDashboard from "../screens/progress/ProgressDashboard";
import WorkoutHistory from "../screens/progress/WorkoutHistory";
import StrengthCharts from "../screens/progress/StrengthCharts";

// ============================================================================
// TYPES
// ============================================================================

export type ProgressStackParamList = {
  ProgressDashboard: undefined;
  WorkoutHistory: undefined;
  StrengthCharts: { exerciseId?: string };
};

// ============================================================================
// STACK NAVIGATOR
// ============================================================================

const ProgressStack = createStackNavigator<ProgressStackParamList>();

// ============================================================================
// PROGRESS NAVIGATOR COMPONENT
// ============================================================================

const ProgressNavigator: React.FC = () => {
  const { colors } = useTheme();
  return (
    <ProgressStack.Navigator
      initialRouteName='ProgressDashboard'
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
      <ProgressStack.Screen
        name='ProgressDashboard'
        component={ProgressDashboard}
        options={{
          title: "Progress",
        }}
      />
      <ProgressStack.Screen
        name='WorkoutHistory'
        component={WorkoutHistory}
        options={{
          title: "Workout History",
        }}
      />
      <ProgressStack.Screen
        name='StrengthCharts'
        component={StrengthCharts}
        options={({ route }) => ({
          title: "Strength Progress",
        })}
      />
    </ProgressStack.Navigator>
  );
};

export default ProgressNavigator;
