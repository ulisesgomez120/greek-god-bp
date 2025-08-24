// ============================================================================
// AUTH NAVIGATOR
// ============================================================================
// Authentication stack navigation for login, register, and onboarding flows

import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { useAuth } from "../hooks/useAuth";

// Auth Screens
import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";
import EmailVerificationScreen from "../screens/auth/EmailVerificationScreen";
import OnboardingScreen from "../screens/auth/OnboardingScreen";

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

const AuthNavigator: React.FC = () => {
  const authState = useAuth();
  const { isAuthenticated, user } = authState;

  // Check if user has completed onboarding
  const isOnboardingComplete = user?.user_metadata?.onboarding_complete === true;

  // Determine initial route based on auth state
  const getInitialRouteName = (): keyof AuthStackParamList => {
    if (isAuthenticated && !isOnboardingComplete) {
      return "Onboarding";
    }
    return "Login";
  };

  console.log("AuthNavigator: Auth state", {
    isAuthenticated,
    isOnboardingComplete,
    initialRoute: getInitialRouteName(),
  });

  return (
    <AuthStack.Navigator
      initialRouteName={getInitialRouteName()}
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
      <AuthStack.Screen name='Login'>{(props) => <LoginScreen {...props} authState={authState} />}</AuthStack.Screen>
      <AuthStack.Screen name='Register' component={RegisterScreen} />
      <AuthStack.Screen name='ForgotPassword' component={ForgotPasswordScreen} />
      <AuthStack.Screen name='EmailVerification' component={EmailVerificationScreen} />
      <AuthStack.Screen name='Onboarding' component={OnboardingScreen} />
    </AuthStack.Navigator>
  );
};

export default AuthNavigator;
