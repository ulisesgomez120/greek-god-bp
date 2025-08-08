// ============================================================================
// PROGRESS NAVIGATOR
// ============================================================================
// Progress tracking stack navigation with dashboard, history, and charts

import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

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
  return (
    <ProgressStack.Navigator
      initialRouteName='ProgressDashboard'
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: "#FFFFFF",
          borderBottomColor: "#F2F2F7",
          borderBottomWidth: 1,
        },
        headerTitleStyle: {
          fontSize: 17,
          fontWeight: "600",
          color: "#1C1C1E",
        },
        headerBackTitleVisible: false,
        headerTintColor: "#B5CFF8",
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
