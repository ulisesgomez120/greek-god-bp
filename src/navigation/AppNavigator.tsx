// ============================================================================
// APP NAVIGATOR
// ============================================================================
// Root navigation configuration with authentication handling, deep linking,
// and navigation state persistence

import React, { useEffect } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";

// Hooks
import { useAuth } from "../hooks/useAuth";
import { useNetworkState } from "../hooks/useNetworkState";

// Navigators
import AuthNavigator from "./AuthNavigator";
import TabNavigator from "./TabNavigator";

// Components
import ConnectionStatusIndicator from "../components/ui/ConnectionStatusIndicator";
import SplashScreen from "../components/ui/SplashScreen";

// ============================================================================
// TYPES
// ============================================================================

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

// ============================================================================
// NAVIGATION THEME
// ============================================================================

const NavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "#B5CFF8", // Primary Blue
    background: "#FFFFFF", // Background White
    card: "#FFFFFF", // Card backgrounds
    text: "#1C1C1E", // Primary Dark text
    border: "#F2F2F7", // Secondary Gray borders
    notification: "#FF3B30", // Error Red for badges
  },
};

// ============================================================================
// DEEP LINKING CONFIGURATION
// ============================================================================

const linking = {
  prefixes: [Linking.createURL("/"), "trainsmart://"],
  config: {
    screens: {
      Main: "main",
      Auth: "auth",
    },
  },
};

// ============================================================================
// STACK NAVIGATOR
// ============================================================================

const RootStack = createStackNavigator<RootStackParamList>();

// ============================================================================
// APP NAVIGATOR COMPONENT
// ============================================================================

const AppNavigator: React.FC = () => {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const { isConnected } = useNetworkState();

  // Check if user has completed onboarding
  const isOnboardingComplete = user?.user_metadata?.onboarding_complete === true;

  // Show splash screen while loading
  if (authLoading) {
    return <SplashScreen />;
  }

  // Determine initial route
  const getInitialRouteName = (): keyof RootStackParamList => {
    if (isAuthenticated && isOnboardingComplete) {
      return "Main";
    }
    return "Auth";
  };

  return (
    <>
      <StatusBar style='auto' />
      <NavigationContainer theme={NavigationTheme} linking={linking}>
        <RootStack.Navigator
          initialRouteName={getInitialRouteName()}
          screenOptions={{
            headerShown: false,
            gestureEnabled: false, // Disable swipe back for root navigator
            animationEnabled: true,
            cardStyleInterpolator: ({ current }) => ({
              cardStyle: {
                opacity: current.progress,
              },
            }),
          }}>
          <RootStack.Screen name='Auth' component={AuthNavigator} />
          <RootStack.Screen name='Main' component={TabNavigator} />
        </RootStack.Navigator>
      </NavigationContainer>

      {/* Connection Status Indicator */}
      <ConnectionStatusIndicator />
    </>
  );
};

export default AppNavigator;
