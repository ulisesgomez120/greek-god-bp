// ============================================================================
// EMAIL VERIFICATION SCREEN
// ============================================================================
// Email verification screen with resend functionality, countdown timer,
// and clear success/error states

import React, { useState, useEffect } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { AUTH_FLOWS } from "@/constants/auth";
import AuthForm from "@/components/auth/AuthForm";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";

// ============================================================================
// TYPES
// ============================================================================

export interface EmailVerificationScreenProps {
  navigation: any;
  route?: {
    params?: {
      email?: string;
    };
  };
}

type VerificationState = "waiting" | "resending" | "sent" | "error";

// ============================================================================
// COMPONENT
// ============================================================================

export const EmailVerificationScreen: React.FC<EmailVerificationScreenProps> = ({ navigation, route }) => {
  const { resendEmailVerification, loading, error, clearError } = useAuth();
  const [verificationState, setVerificationState] = useState<VerificationState>("waiting");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [email, setEmail] = useState("");

  // Get email from navigation params
  useEffect(() => {
    const emailParam = route?.params?.email;
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [route?.params?.email]);

  // Start initial cooldown
  useEffect(() => {
    startResendCooldown();
  }, []);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleResendEmail = async () => {
    if (resendCooldown > 0 || !email) return;

    try {
      clearError();
      setVerificationState("resending");

      const result = await resendEmailVerification({
        email,
      });

      if (result.success) {
        setVerificationState("sent");
        startResendCooldown();
        Alert.alert("Email Sent", "Verification email has been resent successfully.");
      } else if (result.error) {
        setVerificationState("error");

        // Handle specific error types
        switch (result.error.code) {
          case "TOO_MANY_REQUESTS":
            Alert.alert(
              "Too Many Requests",
              "You've requested too many verification emails. Please wait a few minutes before trying again.",
              [{ text: "OK" }]
            );
            setVerificationState("waiting");
            break;
          case "EMAIL_ALREADY_CONFIRMED":
            Alert.alert("Email Already Verified", "Your email has already been verified. You can now sign in.", [
              { text: "OK", onPress: () => navigation.navigate("Login") },
            ]);
            break;
          default:
            Alert.alert("Resend Failed", result.error.message);
            setVerificationState("waiting");
            break;
        }
      }
    } catch (error) {
      console.error("Resend verification error:", error);
      setVerificationState("error");
      Alert.alert("Resend Failed", "An unexpected error occurred. Please try again.");
    }
  };

  const startResendCooldown = () => {
    setResendCooldown(60); // 60 seconds cooldown

    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setVerificationState("waiting");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const navigateToLogin = () => {
    navigation.navigate("Login");
  };

  const navigateToSignup = () => {
    navigation.navigate("Register");
  };

  const tryAgain = () => {
    setVerificationState("waiting");
    clearError();
  };

  // ============================================================================
  // RENDER STATES
  // ============================================================================

  const renderWaitingState = () => (
    <AuthForm
      title={AUTH_FLOWS.emailVerification.title}
      subtitle={AUTH_FLOWS.emailVerification.subtitle}
      secondaryAction={{
        text: "Back to Sign In",
        onPress: navigateToLogin,
      }}
      showKeyboardAvoidance={false}>
      <View style={styles.contentContainer}>
        <View style={styles.emailIcon}>
          <Text variant='h1' style={styles.emailEmoji}>
            📧
          </Text>
        </View>

        <Text variant='bodyLarge' color='primary' align='center' style={styles.mainMessage}>
          We've sent a verification link to:
        </Text>

        <Text variant='body' color='coach' align='center' style={styles.emailText}>
          {email}
        </Text>

        <View style={styles.instructionsContainer}>
          <Text variant='body' color='secondary' align='center' style={styles.instructionText}>
            1. Check your email inbox (and spam folder)
          </Text>
          <Text variant='body' color='secondary' align='center' style={styles.instructionText}>
            2. Click the verification link in the email
          </Text>
          <Text variant='body' color='secondary' align='center' style={styles.instructionText}>
            3. Return to the app and sign in
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
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : AUTH_FLOWS.emailVerification.resendText}
          </Button>
        </View>

        <View style={styles.changeEmailContainer}>
          <Text variant='bodySmall' color='secondary' align='center' style={styles.changeEmailText}>
            Wrong email address?
          </Text>

          <Button variant='text' size='small' onPress={navigateToSignup} style={styles.changeEmailButton}>
            Sign up with different email
          </Button>
        </View>
      </View>
    </AuthForm>
  );

  const renderResendingState = () => (
    <AuthForm
      title='Sending Verification Email'
      subtitle='Please wait while we send your verification email'
      showKeyboardAvoidance={false}>
      <View style={styles.loadingContainer}>
        <View style={styles.loadingSpinner}>
          <Text variant='body' color='secondary' align='center'>
            Sending email...
          </Text>
        </View>
      </View>
    </AuthForm>
  );

  const renderSentState = () => (
    <AuthForm
      title='Email Sent Successfully'
      subtitle="We've resent the verification email to your inbox"
      secondaryAction={{
        text: "Back to Sign In",
        onPress: navigateToLogin,
      }}
      showKeyboardAvoidance={false}>
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <Text variant='h1' style={styles.successEmoji}>
            ✅
          </Text>
        </View>

        <Text variant='bodyLarge' color='primary' align='center' style={styles.successMessage}>
          Verification email has been sent successfully!
        </Text>

        <Text variant='body' color='secondary' align='center' style={styles.successSubMessage}>
          Please check your email and click the verification link to activate your account.
        </Text>

        <View style={styles.actionContainer}>
          <Button variant='primary' size='medium' onPress={navigateToLogin} style={styles.actionButton}>
            Go to Sign In
          </Button>
        </View>
      </View>
    </AuthForm>
  );

  const renderErrorState = () => (
    <AuthForm
      title='Something Went Wrong'
      subtitle="We couldn't send the verification email"
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
          We encountered an issue while trying to send your verification email.
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
    </AuthForm>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  switch (verificationState) {
    case "resending":
      return renderResendingState();
    case "sent":
      return renderSentState();
    case "error":
      return renderErrorState();
    default:
      return renderWaitingState();
  }
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emailIcon: {
    marginBottom: 24,
  },
  emailEmoji: {
    fontSize: 64,
    textAlign: "center",
  },
  mainMessage: {
    marginBottom: 8,
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
    marginBottom: 24,
  },
  resendText: {
    marginBottom: 8,
  },
  resendButton: {
    marginTop: 4,
  },
  changeEmailContainer: {
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  changeEmailText: {
    marginBottom: 8,
  },
  changeEmailButton: {
    marginTop: 4,
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
  successSubMessage: {
    marginBottom: 32,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  actionContainer: {
    width: "100%",
    alignItems: "center",
  },
  actionButton: {
    minWidth: 200,
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
    paddingHorizontal: 16,
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default EmailVerificationScreen;
