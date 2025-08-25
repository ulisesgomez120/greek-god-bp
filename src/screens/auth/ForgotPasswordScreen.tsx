// ============================================================================
// FORGOT PASSWORD SCREEN
// ============================================================================
// Password reset screen with email validation, progress indicator, and
// clear success/error states

import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  Alert,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";
import { AUTH_FLOWS } from "@/constants/auth";
import Text from "@/components/ui/Text";
import useTheme from "@/hooks/useTheme";
import {
  getInputStyle,
  getInputState,
  getInputProps,
  LABEL_STYLES,
  ERROR_STYLES,
  FIELD_STYLES,
} from "@/styles/inputStyles";

// ============================================================================
// TYPES
// ============================================================================

export interface ForgotPasswordScreenProps {
  navigation: any;
  route?: {
    params?: {
      email?: string;
    };
  };
}

type ResetState = "form" | "sending" | "sent" | "error";

// ============================================================================
// COMPONENT
// ============================================================================

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ navigation, route }) => {
  const { resetPassword, loading, error, clearError } = useAuth();
  const { colors } = useTheme();
  const [resetState, setResetState] = useState<ResetState>("form");
  const [resetEmail, setResetEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errors, setErrors] = useState<{ email?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  // Pre-fill email if provided from navigation
  const initialEmail = route?.params?.email || "";

  // Initialize email with initial value
  React.useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

  const validateEmail = (email: string): string | undefined => {
    if (!email) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address";
    return undefined;
  };

  const handleEmailChange = (value: string) => {
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: undefined }));
    }
  };

  const onSubmit = async () => {
    try {
      // Validate email
      const emailError = validateEmail(email);
      if (emailError) {
        setErrors({ email: emailError });
        return;
      }

      clearError();
      setErrors({});
      setIsSubmitting(true);
      setResetState("sending");

      const result = await resetPassword({ email });

      if (result.success) {
        setResetEmail(email);
        setResetState("sent");
        startResendCooldown();
      } else if (result.error) {
        setResetState("error");

        // Handle specific error types
        switch (result.error.code) {
          case "INVALID_EMAIL":
            setErrors({ email: "Please enter a valid email address" });
            setResetState("form");
            break;
          case "USER_NOT_FOUND":
            // For security, we don't reveal if email exists
            // Show success state anyway
            setResetEmail(email);
            setResetState("sent");
            startResendCooldown();
            break;
          case "TOO_MANY_REQUESTS":
            Alert.alert(
              "Too Many Requests",
              "You've requested too many password resets. Please wait a few minutes before trying again.",
              [{ text: "OK" }]
            );
            setResetState("form");
            break;
          default:
            Alert.alert("Reset Failed", result.error.message);
            setResetState("form");
            break;
        }
      }
    } catch (error) {
      console.error("Password reset error:", error);
      setResetState("error");
      Alert.alert("Reset Failed", "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;

    try {
      setResetState("sending");

      const result = await resetPassword({
        email: resetEmail,
      });

      if (result.success) {
        setResetState("sent");
        startResendCooldown();
        Alert.alert("Email Sent", "Password reset email has been resent successfully.");
      } else {
        setResetState("error");
        Alert.alert("Resend Failed", "Failed to resend password reset email. Please try again.");
      }
    } catch (error) {
      console.error("Resend error:", error);
      setResetState("error");
      Alert.alert("Resend Failed", "An unexpected error occurred. Please try again.");
    }
  };

  const startResendCooldown = () => {
    setResendCooldown(60); // 60 seconds cooldown

    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const navigateToLogin = () => {
    navigation.navigate("Login");
  };

  const tryAgain = () => {
    setResetState("form");
    clearError();
    setErrors({});
  };

  // ============================================================================
  // RENDER STATES
  // ============================================================================

  const renderFormState = () => (
    <View style={styles.formContainer}>
      {/* Email Field */}
      <View style={FIELD_STYLES.container}>
        <Text style={[LABEL_STYLES.base, { color: colors.text }]}>Email Address *</Text>
        <TextInput
          style={getInputStyle(undefined, getInputState(focusedField === "email", !!errors.email))}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            handleEmailChange(text);
          }}
          onFocus={() => setFocusedField("email")}
          onBlur={() => setFocusedField(null)}
          {...getInputProps("email")}
          placeholder='Enter your email address'
        />
        {errors.email && <Text style={ERROR_STYLES.text}>{errors.email}</Text>}
      </View>

      <View style={styles.infoContainer}>
        <Text variant='bodySmall' color='secondary' align='center' style={styles.infoText}>
          Enter your email address and we'll send you instructions to reset your password.
        </Text>
      </View>
    </View>
  );

  const renderSendingState = () => (
    <View style={styles.loadingContainer}>
      <View style={styles.loadingSpinner}>
        <Text variant='body' color='secondary' align='center'>
          Sending email...
        </Text>
      </View>
    </View>
  );

  const renderSentState = () => (
    <View style={styles.successContainer}>
      <View style={styles.successIcon}>
        <Text variant='h1' style={styles.successEmoji}>
          📧
        </Text>
      </View>

      <Text variant='bodyLarge' color='primary' align='center' style={styles.successMessage}>
        Password reset instructions have been sent to your email address.
      </Text>

      <Text variant='body' color='coach' align='center' style={styles.emailText}>
        {resetEmail}
      </Text>

      <View style={styles.instructionsContainer}>
        <Text variant='body' color='secondary' align='center' style={styles.instructionText}>
          1. Check your email inbox (and spam folder)
        </Text>
        <Text variant='body' color='secondary' align='center' style={styles.instructionText}>
          2. Click the reset link in the email
        </Text>
        <Text variant='body' color='secondary' align='center' style={styles.instructionText}>
          3. Create a new password
        </Text>
      </View>

      <View style={styles.resendContainer}>
        <Text variant='bodySmall' color='secondary' align='center' style={styles.resendText}>
          Didn't receive the email?
        </Text>

        <TouchableOpacity
          style={[styles.resendButton, resendCooldown > 0 && styles.resendButtonDisabled]}
          onPress={handleResendEmail}
          disabled={resendCooldown > 0}>
          <Text style={[styles.resendButtonText, resendCooldown > 0 && styles.resendButtonTextDisabled]}>
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Email"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorStateContainer}>
      <View style={styles.errorIcon}>
        <Text variant='h1' style={styles.errorEmoji}>
          ⚠️
        </Text>
      </View>

      <Text variant='bodyLarge' color='primary' align='center' style={styles.errorMessage}>
        We encountered an issue while trying to send your password reset email.
      </Text>

      <Text variant='body' color='secondary' align='center' style={styles.errorSubMessage}>
        Please check your internet connection and try again. If the problem persists, contact support.
      </Text>

      {error && (
        <View style={styles.errorDetailsContainer}>
          <Text variant='bodySmall' color='error' align='center'>
            {error}
          </Text>
        </View>
      )}
    </View>
  );

  // ============================================================================
  // RENDER MAIN CONTENT
  // ============================================================================

  const renderContent = () => {
    switch (resetState) {
      case "sending":
        return renderSendingState();
      case "sent":
        return renderSentState();
      case "error":
        return renderErrorState();
      default:
        return renderFormState();
    }
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
                {AUTH_FLOWS.forgotPassword.title}
              </Text>
              <Text variant='bodyLarge' color='secondary' align='center' style={styles.subtitle}>
                {AUTH_FLOWS.forgotPassword.subtitle}
              </Text>
            </View>

            {/* Dynamic Content */}
            <View style={styles.formContent}>{renderContent()}</View>

            {/* Submit Button - Only show in form state */}
            {resetState === "form" && (
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: colors.primary },
                  (isSubmitting || loading.passwordReset) && styles.submitButtonDisabled,
                ]}
                onPress={onSubmit}
                disabled={isSubmitting || loading.passwordReset}>
                <Text
                  style={[
                    styles.submitButtonText,
                    { color: colors.buttonTextOnPrimary || colors.buttonText || colors.text },
                  ]}>
                  {isSubmitting || loading.passwordReset ? "Sending..." : AUTH_FLOWS.forgotPassword.submitText}
                </Text>
              </TouchableOpacity>
            )}

            {/* Try Again Button - Only show in error state */}
            {resetState === "error" && (
              <TouchableOpacity style={styles.submitButton} onPress={tryAgain}>
                <Text style={styles.submitButtonText}>Try Again</Text>
              </TouchableOpacity>
            )}

            {/* Back to Sign In */}
            <TouchableOpacity style={styles.secondaryButton} onPress={navigateToLogin}>
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Back to Sign In</Text>
            </TouchableOpacity>

            {/* Global Error - Only show in form state */}
            {resetState === "form" && error && (
              <View style={styles.globalErrorContainer}>
                <Text style={styles.globalErrorText}>{error}</Text>
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
  formContainer: {
    flex: 1,
    justifyContent: "center",
  },
  submitButton: {
    height: 50,
    backgroundColor: "#B5CFF8",
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
    color: "#1C1C1E",
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 24,
  },
  secondaryButtonText: {
    fontSize: 15,
    color: "#B5CFF8",
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
    color: "#FF3B30",
    textAlign: "center",
  },
  infoContainer: {
    marginTop: 16,
    paddingHorizontal: 8,
  },
  infoText: {
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingSpinner: {
    alignItems: "center",
  },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  successIcon: {
    marginBottom: 24,
  },
  successEmoji: {
    fontSize: 64,
    textAlign: "center",
  },
  successMessage: {
    marginBottom: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  emailText: {
    marginBottom: 32,
    fontWeight: "600",
    fontSize: 16,
  },
  instructionsContainer: {
    marginBottom: 40,
    paddingHorizontal: 16,
  },
  instructionText: {
    marginBottom: 8,
    lineHeight: 20,
  },
  resendContainer: {
    alignItems: "center",
  },
  resendText: {
    marginBottom: 8,
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendButtonText: {
    fontSize: 15,
    color: "#B5CFF8",
    textDecorationLine: "underline",
  },
  resendButtonTextDisabled: {
    textDecorationLine: "none",
  },
  errorStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  errorIcon: {
    marginBottom: 24,
  },
  errorEmoji: {
    fontSize: 64,
    textAlign: "center",
  },
  errorMessage: {
    marginBottom: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  errorSubMessage: {
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  errorDetailsContainer: {
    marginTop: 16,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default ForgotPasswordScreen;
