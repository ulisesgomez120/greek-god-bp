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
};

export default ProgressNavigator;
