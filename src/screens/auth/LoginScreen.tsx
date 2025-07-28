// ============================================================================
// LOGIN SCREEN
// ============================================================================
// Login screen with email/password authentication, form validation, biometric
// support, and smooth error handling

import React, { useState, useEffect } from "react";
import { View, StyleSheet, Alert, Platform, TextInput } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useAuth } from "@/hooks/useAuth";
import { useSimpleForm } from "@/hooks/useSimpleForm";
import { loginFormSchema, type LoginFormData } from "@/utils/validation";
import { AUTH_FLOWS, LOADING_MESSAGES } from "@/constants/auth";
import AuthForm from "@/components/auth/AuthForm";
import FormField from "@/components/ui/FormField";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";

// ============================================================================
// TYPES
// ============================================================================

export interface LoginScreenProps {
  navigation: any;
  onLoginSuccess?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation, onLoginSuccess }) => {
  const { login, loading, error, clearError } = useAuth();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>("");

  // Simple form state - no complex validation during typing
  const { values, errors, isSubmitting, handleChange, setError, clearAllErrors, validateAndSubmit } =
    useSimpleForm<LoginFormData>({
      email: "",
      password: "",
      rememberMe: false,
    });

  // ============================================================================
  // BIOMETRIC AUTHENTICATION
  // ============================================================================

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      if (compatible && enrolled) {
        setBiometricAvailable(true);

        // Determine biometric type
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType("Face ID");
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType("Touch ID");
        } else {
          setBiometricType("Biometric");
        }
      }
    } catch (error) {
      console.warn("Biometric check failed:", error);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Sign in with ${biometricType}`,
        fallbackLabel: "Use Password",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });

      if (result.success) {
        // In a real app, you would retrieve stored credentials here
        // For now, we'll show a message that biometric login would work
        Alert.alert(
          "Biometric Login",
          "Biometric authentication successful! In a production app, this would automatically sign you in with stored credentials.",
          [{ text: "OK" }]
        );
      } else if (result.error === "user_cancel") {
        // User cancelled, do nothing
      } else {
        Alert.alert("Authentication Failed", "Please try again or use your password.");
      }
    } catch (error) {
      console.error("Biometric authentication error:", error);
      Alert.alert("Error", "Biometric authentication is not available.");
    }
  };

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

  const onSubmit = validateAndSubmit(loginFormSchema, async (formData: LoginFormData) => {
    try {
      clearError();

      const result = await login({
        email: formData.email,
        password: formData.password,
        rememberMe: formData.rememberMe,
      });

      if (result.success) {
        onLoginSuccess?.();
      } else if (result.error) {
        // Handle specific error types
        switch (result.error.code) {
          case "INVALID_CREDENTIALS":
            setError("email", "Invalid email or password");
            setError("password", "Invalid email or password");
            break;
          case "EMAIL_NOT_CONFIRMED":
            Alert.alert(
              "Email Not Verified",
              "Please check your email and click the verification link before signing in.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Resend Email",
                  onPress: () => navigation.navigate("EmailVerification", { email: formData.email }),
                },
              ]
            );
            break;
          case "TOO_MANY_ATTEMPTS":
            Alert.alert(
              "Account Temporarily Locked",
              "Too many failed login attempts. Please try again in a few minutes.",
              [{ text: "OK" }]
            );
            break;
          default:
            setError("email", result.error.message);
            break;
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Login Failed", "An unexpected error occurred. Please try again.");
    }
  });

  const navigateToSignup = () => {
    navigation.navigate("Register");
  };

  const navigateToForgotPassword = () => {
    navigation.navigate("ForgotPassword");
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <AuthForm
      title={AUTH_FLOWS.login.title}
      subtitle={AUTH_FLOWS.login.subtitle}
      onSubmit={onSubmit}
      submitText={AUTH_FLOWS.login.submitText}
      submitLoading={isSubmitting || loading.login}
      submitDisabled={isSubmitting}
      secondaryAction={{
        text: AUTH_FLOWS.login.switchText,
        onPress: navigateToSignup,
      }}
      footerContent={
        <View style={styles.footer}>
          {/* Biometric Login */}
          {biometricAvailable && (
            <View style={styles.biometricContainer}>
              <Button variant='secondary' size='medium' onPress={handleBiometricLogin} style={styles.biometricButton}>
                Sign in with {biometricType}
              </Button>
            </View>
          )}

          {/* Forgot Password */}
          <Button variant='text' size='small' onPress={navigateToForgotPassword} style={styles.forgotPasswordButton}>
            Forgot your password?
          </Button>

          {/* Global Error */}
          {error && (
            <View style={styles.errorContainer}>
              <Text variant='bodySmall' color='error' align='center'>
                {error}
              </Text>
            </View>
          )}
        </View>
      }>
      <FormField
        name='email'
        label='Email Address'
        placeholder='Enter your email'
        value={values.email}
        onChangeText={handleChange("email")}
        error={errors.email}
        keyboardType='email-address'
        autoCapitalize='none'
        autoComplete='email'
        textContentType='emailAddress'
        required
      />

      <FormField
        name='password'
        label='Password'
        placeholder='Enter your password'
        value={values.password}
        onChangeText={handleChange("password")}
        error={errors.password}
        secureTextEntry
        showPasswordToggle
        autoComplete='current-password'
        textContentType='password'
        required
      />

      {/* Remember Me - Future Enhancement */}
      {/* <View style={styles.rememberMeContainer}>
        <Switch
          value={values.rememberMe}
          onValueChange={handleChange("rememberMe")}
        />
        <Text variant="body" style={styles.rememberMeText}>
          Remember me
        </Text>
      </View> */}
    </AuthForm>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  footer: {
    width: "100%",
    alignItems: "center",
  },
  biometricContainer: {
    marginBottom: 16,
    width: "100%",
  },
  biometricButton: {
    width: "100%",
  },
  forgotPasswordButton: {
    marginBottom: 16,
  },
  errorContainer: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  rememberMeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  rememberMeText: {
    marginLeft: 12,
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default LoginScreen;
