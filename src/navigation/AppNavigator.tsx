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
  const {
    isAuthenticated,
    user,
    loading,
    isInitialized,
    login,
    signup,
    logout,
    error,
    clearError,
    resetPassword,
    resendEmailVerification,
    updateProfile,
  } = useAuth();
  const { isConnected } = useNetworkState();

  // Check if user has completed onboarding
  const isOnboardingComplete = user?.user_metadata?.onboarding_complete === true;

  // Show splash screen while initializing
  if (!isInitialized || loading.initialization) {
    return <SplashScreen />;
  }

  // For debugging
  console.log("AppNavigator: Navigation state", {
    isAuthenticated,
    isOnboardingComplete,
    isInitialized,
    loadingInitialization: loading.initialization,
  });

  return (
    <>
      <StatusBar style='auto' />
      <NavigationContainer theme={NavigationTheme} linking={linking}>
        <RootStack.Navigator
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
          {isAuthenticated && isOnboardingComplete ? (
            <RootStack.Screen name='Main' component={TabNavigator} />
          ) : (
            <RootStack.Screen name='Auth'>
              {() => (
                <AuthNavigator
                  authState={{
                    isAuthenticated,
                    user,
                    login,
                    signup,
                    logout,
                    loading,
                    error,
                    clearError,
                    resetPassword,
                    resendEmailVerification,
                    updateProfile,
                  }}
                />
              )}
            </RootStack.Screen>
          )}
        </RootStack.Navigator>
      </NavigationContainer>

      {/* Connection Status Indicator */}
      <ConnectionStatusIndicator />
    </>
  );
};

export default AppNavigator;
