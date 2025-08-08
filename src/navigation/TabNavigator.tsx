// ============================================================================
// TAB NAVIGATOR
// ============================================================================
// Bottom tab navigation with badge support, hiding on scroll, and accessibility

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Platform } from "react-native";

// Navigators
import WorkoutNavigator from "./WorkoutNavigator";
import ProgressNavigator from "./ProgressNavigator";
import AICoachNavigator from "./AICoachNavigator";
import ProfileNavigator from "./ProfileNavigator";

// Hooks
import { useFeatureAccess } from "../hooks/useFeatureAccess";

// Icons (using system icons for now - can be replaced with custom icons)
import { Ionicons } from "@expo/vector-icons";

// ============================================================================
// TYPES
// ============================================================================

export type TabParamList = {
  WorkoutTab: undefined;
  ProgressTab: undefined;
  AICoachTab: undefined;
  ProfileTab: undefined;
};

// ============================================================================
// TAB NAVIGATOR
// ============================================================================

const Tab = createBottomTabNavigator<TabParamList>();

// ============================================================================
// TAB NAVIGATOR COMPONENT
// ============================================================================

const TabNavigator: React.FC = () => {
  const { hasAccess } = useFeatureAccess();

  return (
    <Tab.Navigator
      initialRouteName='WorkoutTab'
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case "WorkoutTab":
              iconName = focused ? "fitness" : "fitness-outline";
              break;
            case "ProgressTab":
              iconName = focused ? "trending-up" : "trending-up-outline";
              break;
            case "AICoachTab":
              iconName = focused ? "bulb" : "bulb-outline";
              break;
            case "ProfileTab":
              iconName = focused ? "person" : "person-outline";
              break;
            default:
              iconName = "help-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#B5CFF8", // Primary Blue
        tabBarInactiveTintColor: "#8E8E93", // Neutral Gray
        tabBarStyle: {
          backgroundColor: "#FFFFFF", // Background White
          borderTopColor: "#F2F2F7", // Secondary Gray
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 20 : 8,
          height: Platform.OS === "ios" ? 88 : 68,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
        // Badge support for notifications
        tabBarBadge: route.name === "WorkoutTab" ? undefined : undefined, // Will be dynamic based on state
      })}>
      <Tab.Screen
        name='WorkoutTab'
        component={WorkoutNavigator}
        options={{
          tabBarLabel: "Workout",
          tabBarAccessibilityLabel: "Workout tab",
        }}
      />
      <Tab.Screen
        name='ProgressTab'
        component={ProgressNavigator}
        options={{
          tabBarLabel: "Progress",
          tabBarAccessibilityLabel: "Progress tracking tab",
        }}
      />
      <Tab.Screen
        name='AICoachTab'
        component={AICoachNavigator}
        options={{
          tabBarLabel: "AI Coach",
          tabBarAccessibilityLabel: hasAccess("ai_coaching") ? "AI Coach tab" : "AI Coach tab - Premium feature",
        }}
      />
      <Tab.Screen
        name='ProfileTab'
        component={ProfileNavigator}
        options={{
          tabBarLabel: "Profile",
          tabBarAccessibilityLabel: "Profile and settings tab",
        }}
      />
    </Tab.Navigator>
  );
};

export default TabNavigator;
