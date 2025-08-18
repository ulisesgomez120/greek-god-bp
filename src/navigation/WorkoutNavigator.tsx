// ============================================================================
// WORKOUT NAVIGATOR
// ============================================================================
// Workout flow stack navigation with program selection, active workout, and exercise details

import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

// Workout screens
import ProgramSelectionScreen from "../screens/workout/ProgramSelectionScreen";
import PhaseSelectionScreen from "../screens/workout/PhaseSelectionScreen";
import DaySelectionScreen from "../screens/workout/DaySelectionScreen";
import ExerciseListScreen from "../screens/workout/ExerciseListScreen";
import ExerciseDetailScreen from "../screens/workout/ExerciseDetailScreen";
import WorkoutSummaryScreen from "../screens/workout/WorkoutSummaryScreen";

// Types
import { WorkoutStackParamList } from "../types/navigation";

// ============================================================================
// STACK NAVIGATOR
// ============================================================================

const WorkoutStack = createStackNavigator<WorkoutStackParamList>();

// ============================================================================
// WORKOUT NAVIGATOR COMPONENT
// ============================================================================

const WorkoutNavigator: React.FC = () => {
  return (
    <WorkoutStack.Navigator
      initialRouteName='WorkoutHome'
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
      <WorkoutStack.Screen
        name='WorkoutHome'
        component={ProgramSelectionScreen as any}
        options={{
          title: "Choose Program",
        }}
      />
      <WorkoutStack.Screen
        name='ProgramSelection'
        component={ProgramSelectionScreen as any}
        options={{
          title: "Choose Program",
        }}
      />
      <WorkoutStack.Screen
        name='PhaseSelection'
        component={PhaseSelectionScreen as any}
        options={({ route }) => ({
          title: "Choose Phase",
        })}
      />
      <WorkoutStack.Screen
        name='DaySelection'
        component={DaySelectionScreen as any}
        options={{
          title: "Choose Workout",
        }}
      />
      <WorkoutStack.Screen
        name='ExerciseList'
        component={ExerciseListScreen as any}
        options={{
          title: "Today's Workout",
        }}
      />
      <WorkoutStack.Screen
        name='ExerciseDetail'
        component={ExerciseDetailScreen as any}
        options={{
          title: "Exercise Details",
          presentation: "modal",
        }}
      />
      <WorkoutStack.Screen
        name='WorkoutSummary'
        component={WorkoutSummaryScreen as any}
        options={{
          title: "Workout Complete",
          gestureEnabled: false,
          headerLeft: () => null, // Prevent going back
        }}
      />
    </WorkoutStack.Navigator>
  );
};

export default WorkoutNavigator;
