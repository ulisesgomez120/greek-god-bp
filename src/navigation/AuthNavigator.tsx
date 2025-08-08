// ============================================================================
// AUTH NAVIGATOR
// ============================================================================
// Main navigation component that handles authentication routing and
// transitions between auth and main app screens

import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";

// Hooks
import { useAuth } from "../hooks/useAuth";

// Auth Screens
import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";
import EmailVerificationScreen from "../screens/auth/EmailVerificationScreen";
import OnboardingScreen from "../screens/auth/OnboardingScreen";

// Main App (placeholder for now)
import MainAppNavigator from "./MainAppNavigator";

// ============================================================================
// TYPES
// ============================================================================

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: { email?: string };
  EmailVerification: { email: string };
  Onboarding: undefined;
};

// ============================================================================
// STACK NAVIGATOR
// ============================================================================

const AuthStack = createStackNavigator<AuthStackParamList>();

// ============================================================================
// AUTH NAVIGATOR COMPONENT
// ============================================================================

const AuthNavigatorComponent: React.FC = () => {
  console.log("🔄 AuthNavigator RENDER - Testing parent re-render");
  const { isAuthenticated, user } = useAuth();

  // Check if user has completed onboarding
  const isOnboardingComplete = user?.user_metadata?.onboarding_complete === true;

  console.log("AuthNavigator: Navigation state", {
    isAuthenticated,
    hasUser: !!user,
    isOnboardingComplete,
    userMetadata: user?.user_metadata,
  });

  // Show main app if authenticated and onboarded
  if (isAuthenticated && isOnboardingComplete) {
    console.log("AuthNavigator: Showing main app");
    return <MainAppNavigator />;
  }

  // Show onboarding if authenticated but not onboarded
  if (isAuthenticated && !isOnboardingComplete) {
    console.log("AuthNavigator: Showing onboarding");
    return (
      <NavigationContainer>
        <AuthStack.Navigator
          screenOptions={{
            headerShown: false,
            gestureEnabled: false,
          }}>
          <AuthStack.Screen name='Onboarding' component={OnboardingScreen} />
        </AuthStack.Navigator>
      </NavigationContainer>
    );
  }

  // Show auth flow if not authenticated
  return (
    <NavigationContainer>
      <AuthStack.Navigator
        initialRouteName='Login'
        screenOptions={{
          headerShown: false,
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
        <AuthStack.Screen name='Login' component={LoginScreen} />
        <AuthStack.Screen name='Register' component={RegisterScreen} />
        <AuthStack.Screen name='ForgotPassword' component={ForgotPasswordScreen} />
        <AuthStack.Screen name='EmailVerification' component={EmailVerificationScreen} />
      </AuthStack.Navigator>
    </NavigationContainer>
  );
};

const AuthNavigator = React.memo(AuthNavigatorComponent);

export default AuthNavigator;
