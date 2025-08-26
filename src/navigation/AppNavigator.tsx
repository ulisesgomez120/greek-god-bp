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
import useTheme from "@/hooks/useTheme";
import store from "@/store";
import { syncAuthState } from "@/utils/authValidation";

// Navigators
import AuthNavigator from "./AuthNavigator";
import TabNavigator from "./TabNavigator";

// Components
import SplashScreen from "../components/ui/SplashScreen";

// ============================================================================
// TYPES
// ============================================================================

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

/* Navigation theme is derived from the active app theme at runtime (see inside component) */

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

  const { colors } = useTheme();

  useEffect(() => {
    console.log("AppNavigator: mounted");

    // Perform a best-effort sync of client + Redux auth state when the navigator mounts.
    // This helps catch edge cases where auth state might have desynchronized after the
    // splash or during background operation. syncAuthState may dispatch forceLogout()
    // if it finds unrecoverable token issues.
    (async () => {
      try {
        await syncAuthState(store);
      } catch (err) {
        console.warn("AppNavigator: syncAuthState failed", err);
      }
    })();

    return () => {
      console.log("AppNavigator: unmounted");
    };
  }, []);

  useEffect(() => {
    console.log("AppNavigator: auth state change", {
      isAuthenticated,
      isOnboardingComplete: user?.user_metadata?.onboarding_complete === true,
      isInitialized: !loading.initialization,
      userId: user?.id ?? null,
    });
  }, [isAuthenticated, user?.id, loading.initialization]);

  // Check if user has completed onboarding
  const isOnboardingComplete = user?.user_metadata?.onboarding_complete === true;

  // Show splash screen while initialization is actively loading.
  // Use the stable isInitialized flag from useAuth so once initialization has
  // completed it won't flip back and remount navigators if a brief re-init occurs.
  if (!isInitialized) {
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
      <NavigationContainer
        theme={{
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            primary: colors.primary,
            background: colors.background,
            card: colors.card ?? colors.surface,
            text: colors.text,
            border: colors.border ?? colors.surface,
            notification: colors.error,
          },
        }}
        linking={linking}
        onReady={() => {
          console.log("NavigationContainer: ready");
        }}
        onStateChange={(state) => {
          try {
            console.log("NavigationContainer: state change", {
              timestamp: Date.now(),
              stateSnapshot: state,
            });
          } catch (err) {
            console.warn("NavigationContainer: failed to stringify state", err);
          }
        }}>
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
    </>
  );
};

export default AppNavigator;
