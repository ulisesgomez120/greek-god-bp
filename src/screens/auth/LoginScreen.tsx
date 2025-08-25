// ============================================================================
// LOGIN SCREEN
// ============================================================================
// Login screen with email/password authentication using react-hook-form,
// biometric support, and smooth error handling

import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Alert,
  Platform,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as LocalAuthentication from "expo-local-authentication";
// import { useAuth } from "@/hooks/useAuth"; // Removed - now using props
import { loginFormSchema, type LoginFormData } from "@/utils/validation";
import { AUTH_FLOWS, LOADING_MESSAGES } from "@/constants/auth";
import Text from "@/components/ui/Text";
import useTheme from "@/hooks/useTheme";
import Button from "@/components/ui/Button";
import {
  getInputStyle,
  getInputState,
  getInputProps,
  LABEL_STYLES,
  ERROR_STYLES,
  FIELD_STYLES,
} from "@/styles/inputStyles";
import type { UseAuthReturn } from "@/types/auth";

// ============================================================================
// TYPES
// ============================================================================

export interface LoginScreenProps {
  navigation: any;
  onLoginSuccess?: () => void;
  authState: Pick<UseAuthReturn, "login" | "loading" | "error" | "clearError">;
}

// ============================================================================
// COMPONENT
// ============================================================================

const LoginScreenComponent: React.FC<LoginScreenProps> = ({ navigation, onLoginSuccess, authState }) => {
  const { login, loading, error, clearError } = authState;
  const { colors } = useTheme();

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>("");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // React Hook Form setup
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    setError,
    clearErrors,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    mode: "onSubmit", // Only validate on submit initially
    reValidateMode: "onChange", // Re-validate on change after first submit
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  // Log component renders to track rerender causes
  console.log("LoginScreen: Component render", {
    isSubmitting,
    loadingLogin: loading.login,
    hasError: !!error,
    hasFormErrors: Object.keys(errors).length > 0,
    biometricAvailable,
    timestamp: Date.now(),
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

  const onSubmit = async (data: LoginFormData) => {
    try {
      clearError();
      clearErrors();

      const result = await login({
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe,
      });

      if (result.success) {
        onLoginSuccess?.();
      } else if (result.error) {
        // Handle specific error types
        switch (result.error.code) {
          case "INVALID_CREDENTIALS":
            setError("email", {
              type: "manual",
              message: "Invalid email or password",
            });
            setError("password", {
              type: "manual",
              message: "Invalid email or password",
            });
            break;
          case "EMAIL_NOT_CONFIRMED":
            Alert.alert(
              "Email Not Verified",
              "Please check your email and click the verification link before signing in.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Resend Email",
                  onPress: () => navigation.navigate("EmailVerification", { email: data.email }),
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
            setError("email", {
              type: "manual",
              message: result.error.message,
            });
            break;
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Login Failed", "An unexpected error occurred. Please try again.");
    }
  };

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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps='handled'>
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <Text variant='h1' color='primary' align='center' style={styles.title}>
                {AUTH_FLOWS.login.title}
              </Text>
              <Text variant='bodyLarge' color='secondary' align='center' style={styles.subtitle}>
                {AUTH_FLOWS.login.subtitle}
              </Text>
            </View>

            {/* Form Fields */}
            <View style={styles.formContent}>
              {/* Email Field */}
              <Controller
                name='email'
                control={control}
                render={({ field: { onChange, onBlur, value }, fieldState: { error, isTouched } }) => (
                  <View style={FIELD_STYLES.container}>
                    <Text style={[LABEL_STYLES.base, { color: colors.text }]}>Email Address *</Text>
                    <TextInput
                      style={getInputStyle(colors, undefined, getInputState(focusedField === "email", !!error))}
                      value={value}
                      onChangeText={onChange}
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => {
                        setFocusedField(null);
                        onBlur();
                      }}
                      {...getInputProps("email")}
                      placeholder='Enter your email'
                    />
                    {isTouched && error && <Text style={ERROR_STYLES.text}>{error.message}</Text>}
                  </View>
                )}
              />

              {/* Password Field */}
              <Controller
                name='password'
                control={control}
                render={({ field: { onChange, onBlur, value }, fieldState: { error, isTouched } }) => (
                  <View style={FIELD_STYLES.container}>
                    <Text style={[LABEL_STYLES.base, { color: colors.text }]}>Password *</Text>
                    <TextInput
                      style={getInputStyle(colors, undefined, getInputState(focusedField === "password", !!error))}
                      value={value}
                      onChangeText={onChange}
                      onFocus={() => setFocusedField("password")}
                      onBlur={() => {
                        setFocusedField(null);
                        onBlur();
                      }}
                      {...getInputProps("password")}
                      placeholder='Enter your password'
                    />
                    {isTouched && error && <Text style={ERROR_STYLES.text}>{error.message}</Text>}
                  </View>
                )}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
                (isSubmitting || loading.login) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting || loading.login}>
              <Text
                style={[
                  styles.submitButtonText,
                  { color: colors.buttonTextOnPrimary || colors.buttonText || colors.text },
                ]}>
                {isSubmitting || loading.login ? "Signing In..." : AUTH_FLOWS.login.submitText}
              </Text>
            </TouchableOpacity>

            {/* Secondary Action */}
            <TouchableOpacity style={styles.secondaryButton} onPress={navigateToSignup}>
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>{AUTH_FLOWS.login.switchText}</Text>
            </TouchableOpacity>

            {/* Biometric Login */}
            {biometricAvailable && (
              <TouchableOpacity
                style={[styles.biometricButton, { borderColor: colors.primary }]}
                onPress={handleBiometricLogin}>
                <Text style={[styles.biometricButtonText, { color: colors.primary }]}>
                  Sign in with {biometricType}
                </Text>
              </TouchableOpacity>
            )}

            {/* Forgot Password */}
            <TouchableOpacity style={styles.forgotPasswordButton} onPress={navigateToForgotPassword}>
              <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>Forgot your password?</Text>
            </TouchableOpacity>

            {/* Global Error */}
            {error && (
              <View style={styles.globalErrorContainer}>
                <Text style={[styles.globalErrorText, { color: colors.error }]}>{error}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    justifyContent: "center",
  },
  header: {
    marginBottom: 40,
    alignItems: "center",
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 24,
  },
  formContent: {
    flex: 1,
    marginBottom: 32,
  },
  submitButton: {
    height: 50,
    /* backgroundColor is applied via theme at runtime where component renders */
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: "500",
    /* color is applied via theme at runtime where component renders */
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 16,
  },
  secondaryButtonText: {
    fontSize: 15,
    /* color is applied via theme at runtime where component renders */
    textDecorationLine: "underline",
  },
  biometricButton: {
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 2,
    /* borderColor is applied via theme at runtime where component renders */
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  biometricButtonText: {
    fontSize: 15,
    /* color is applied via theme at runtime where component renders */
    fontWeight: "500",
  },
  forgotPasswordButton: {
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    /* color is applied via theme at runtime where component renders */
    textDecorationLine: "underline",
  },
  globalErrorContainer: {
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  globalErrorText: {
    fontSize: 14,
    /* color is applied via theme at runtime where component renders */
    textAlign: "center",
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default LoginScreenComponent;
