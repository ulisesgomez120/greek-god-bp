// ============================================================================
// FORGOT PASSWORD SCREEN
// ============================================================================
// Password reset screen with email validation, progress indicator, and
// clear success/error states

import React, { useState, useRef } from "react";
import { View, StyleSheet, Alert, TextInput } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { AUTH_FLOWS } from "@/constants/auth";
import AuthForm from "@/components/auth/AuthForm";
import FormField from "@/components/ui/FormField";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";

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
  const [resetState, setResetState] = useState<ResetState>("form");
  const [resetEmail, setResetEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errors, setErrors] = useState<{ email?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill email if provided from navigation
  const initialEmail = route?.params?.email || "";

  // Form field refs
  const emailFieldRef = useRef<TextInput>(null);

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
      const email = (emailFieldRef.current as any)?._lastNativeText || "";

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
    <AuthForm
      title={AUTH_FLOWS.forgotPassword.title}
      subtitle={AUTH_FLOWS.forgotPassword.subtitle}
      onSubmit={onSubmit}
      submitText={AUTH_FLOWS.forgotPassword.submitText}
      submitLoading={isSubmitting || loading.passwordReset}
      submitDisabled={isSubmitting}
      secondaryAction={{
        text: AUTH_FLOWS.forgotPassword.switchText,
        onPress: navigateToLogin,
      }}
      footerContent={
        error && (
          <View style={styles.errorContainer}>
            <Text variant='bodySmall' color='error' align='center'>
              {error}
            </Text>
          </View>
        )
      }>
      <FormField
        ref={emailFieldRef}
        name='email'
        label='Email Address'
        placeholder='Enter your email address'
        defaultValue={initialEmail}
        onChangeText={handleEmailChange}
        error={errors.email}
        keyboardType='email-address'
        autoCapitalize='none'
        autoComplete='email'
        textContentType='emailAddress'
        required
      />

      <View style={styles.infoContainer}>
        <Text variant='bodySmall' color='secondary' align='center' style={styles.infoText}>
          Enter your email address and we'll send you instructions to reset your password.
        </Text>
      </View>
    </AuthForm>
  );

  const renderSendingState = () => (
    <AuthForm
      title='Sending Reset Email'
      subtitle='Please wait while we send your password reset instructions'
      showKeyboardAvoidance={false}>
      <View style={styles.loadingContainer}>
        <View style={styles.loadingSpinner}>
          {/* Add loading spinner component here */}
          <Text variant='body' color='secondary' align='center'>
            Sending email...
          </Text>
        </View>
      </View>
    </AuthForm>
  );

  const renderSentState = () => (
    <AuthForm
      title='Check Your Email'
      subtitle={`We've sent password reset instructions to ${resetEmail}`}
      secondaryAction={{
        text: "Back to Sign In",
        onPress: navigateToLogin,
      }}
      showKeyboardAvoidance={false}>
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <Text variant='h1' style={styles.successEmoji}>
            📧
          </Text>
        </View>

        <Text variant='bodyLarge' color='primary' align='center' style={styles.successMessage}>
          Password reset instructions have been sent to your email address.
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

          <Button
            variant='text'
            size='small'
            onPress={handleResendEmail}
            disabled={resendCooldown > 0}
            style={styles.resendButton}>
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Email"}
          </Button>
        </View>
      </View>
    </AuthForm>
  );

  const renderErrorState = () => (
    <AuthForm
      title='Something Went Wrong'
      subtitle="We couldn't send the password reset email"
      onSubmit={tryAgain}
      submitText='Try Again'
      secondaryAction={{
        text: "Back to Sign In",
        onPress: navigateToLogin,
      }}
      showKeyboardAvoidance={false}>
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
      </View>
    </AuthForm>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

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
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  errorContainer: {
    marginTop: 8,
    paddingHorizontal: 16,
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
    marginBottom: 32,
    textAlign: "center",
    lineHeight: 24,
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
    marginTop: 4,
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
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default ForgotPasswordScreen;
