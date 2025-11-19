// ============================================================================
// PROGRESS NAVIGATOR
// ============================================================================
// Progress tracking stack navigation with landing and exercise detail screens

import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import useTheme from "@/hooks/useTheme";

// Screens
import ProgressLanding from "@/screens/progress/ProgressLanding";
import ExerciseDetailProgress from "@/screens/progress/ExerciseDetailProgress";

// ============================================================================
// TYPES
// ============================================================================

export type ProgressStackParamList = {
  ProgressLanding: undefined;
  ExerciseSearch: undefined;
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
      initialRouteName='ProgressLanding'
      screenOptions={{ headerStyle: { backgroundColor: colors.background } }}>
      <ProgressStack.Screen name='ProgressLanding' component={ProgressLanding} options={{ title: "Progress" }} />
      <ProgressStack.Screen
        name='ExerciseSearch'
        component={require("@/screens/progress/ExerciseSearch").default}
        options={{ title: "Select Exercise" }}
      />
      <ProgressStack.Screen
        name='ExerciseDetailProgress'
        component={ExerciseDetailProgress}
        options={{ title: "Exercise" }}
      />
    </ProgressStack.Navigator>
  );
};

export default ProgressNavigator;
