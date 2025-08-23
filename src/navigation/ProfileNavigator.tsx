// ============================================================================
// PROFILE NAVIGATOR
// ============================================================================
// Profile and settings stack navigation

import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import useTheme from "@/hooks/useTheme";

// Screens
import ProfileEditScreen from "../screens/profile/ProfileEditScreen";
import ExperienceLevelScreen from "../screens/profile/ExperienceLevelScreen";
import TempSubscriptionScreen from "../screens/subscription/TempSubscriptionScreen";

// ============================================================================
// TYPES
// ============================================================================

export type ProfileStackParamList = {
  Profile: undefined;
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
  const { colors } = useTheme();
  return (
    <ProfileStack.Navigator
      initialRouteName='Profile'
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
      <ProfileStack.Screen
        name='Profile'
        component={ProfileEditScreen}
        options={{
          title: "Profile",
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
