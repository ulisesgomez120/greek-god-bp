// ============================================================================
// PROGRESS NAVIGATOR
// ============================================================================
// Progress tracking stack navigation with dashboard, history, and charts

import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import useTheme from "@/hooks/useTheme";

// ============================================================================
// TYPES
// ============================================================================

export type ProgressStackParamList = {
  ProgressDashboard: undefined;
  WorkoutHistory: undefined;
  StrengthCharts: { exerciseId?: string };
  ExerciseDetailProgress: { exerciseId?: string; plannedExerciseId?: string };
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
      screenOptions={{ headerStyle: { backgroundColor: colors.background } }}>
      <ProgressStack.Screen
        name='ExerciseDetailProgress'
        component={require("../screens/progress/ExerciseDetailProgress").default}
        options={{ title: "Exercise" }}
      />
    </ProgressStack.Navigator>
  );
};

export default ProgressNavigator;
