// ============================================================================
// PROFILE NAVIGATOR
// ============================================================================
// Profile and settings stack navigation

import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

// Screens
import ProfileEditScreen from "../screens/profile/ProfileEditScreen";
import ExperienceLevelScreen from "../screens/profile/ExperienceLevelScreen";
import TempSubscriptionScreen from "../screens/subscription/TempSubscriptionScreen";

// Placeholder screens (will be created)
import { SettingsScreen } from "../screens/profile/SettingsScreen";

// ============================================================================
// TYPES
// ============================================================================

export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
  Subscription: undefined;
  ExperienceLevel: undefined;
};

// ============================================================================
// STACK NAVIGATOR
// ============================================================================

const ProfileStack = createStackNavigator<ProfileStackParamList>();

// ============================================================================
// PROFILE NAVIGATOR COMPONENT
// ============================================================================

const ProfileNavigator: React.FC = () => {
  return (
    <ProfileStack.Navigator
      initialRouteName='Profile'
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
      <ProfileStack.Screen
        name='Profile'
        component={ProfileEditScreen}
        options={{
          title: "Profile",
        }}
      />
      <ProfileStack.Screen
        name='Settings'
        component={SettingsScreen}
        options={{
          title: "Settings",
        }}
      />
      <ProfileStack.Screen
        name='Subscription'
        component={TempSubscriptionScreen}
        options={{
          title: "Subscription",
        }}
      />
      <ProfileStack.Screen
        name='ExperienceLevel'
        component={ExperienceLevelScreen}
        options={{
          title: "Experience Level",
        }}
      />
    </ProfileStack.Navigator>
  );
};

export default ProfileNavigator;
