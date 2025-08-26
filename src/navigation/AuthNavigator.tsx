// ============================================================================
// AUTH NAVIGATOR
// ============================================================================
// Authentication stack navigation for login, register, and onboarding flows

import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import type { UseAuthReturn } from "../types/auth";

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

export interface AuthNavigatorProps {
  authState: Pick<
    UseAuthReturn,
    | "isAuthenticated"
    | "user"
    | "login"
    | "signup"
    | "logout"
    | "loading"
    | "error"
    | "clearError"
    | "resetPassword"
    | "resendEmailVerification"
    | "updateProfile"
  >;
}

const AuthStack = createStackNavigator<AuthStackParamList>();

// ============================================================================
// AUTH NAVIGATOR COMPONENT
// ============================================================================

const AuthNavigator: React.FC<AuthNavigatorProps> = ({ authState }) => {
  const { isAuthenticated, user } = authState;

  React.useEffect(() => {
    console.log("AuthNavigator: mounted");
    return () => {
      console.log("AuthNavigator: unmounted");
    };
  }, []);

  React.useEffect(() => {
    console.log("AuthNavigator: authState changed", {
      isAuthenticated,
      userId: user?.id ?? null,
    });
  }, [isAuthenticated, user?.id]);

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
      key={`${isAuthenticated ? "auth-authenticated" : "auth-guest"}-${
        isOnboardingComplete ? "onboarded" : "onboarding"
      }`}
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
      <AuthStack.Screen name='Login'>
        {(props) => (
          <LoginScreen
            {...props}
            authState={authState}
            onLoginSuccess={() => {
              try {
                // Post-login: always navigate to Onboarding as a safe landing.
                // If the user has already completed onboarding the root navigator
                // will immediately switch to the Main stack so this is safe.
                props.navigation.replace("Onboarding");
              } catch (err) {
                console.warn("AuthNavigator: onLoginSuccess navigation failed", err);
              }
            }}
          />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name='Register' component={RegisterScreen} />
      <AuthStack.Screen name='ForgotPassword' component={ForgotPasswordScreen} />
      <AuthStack.Screen name='EmailVerification' component={EmailVerificationScreen} />
      <AuthStack.Screen name='Onboarding' component={OnboardingScreen} />
    </AuthStack.Navigator>
  );
};

export default AuthNavigator;
