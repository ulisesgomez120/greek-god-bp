// ============================================================================
// REGISTER SCREEN
// ============================================================================
// Simplified registration screen using react-hook-form with email, password,
// and confirm password only. Profile setup moved to onboarding.

import React from "react";
import { View, StyleSheet, Alert } from "react-native";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { registrationFormSchema, type RegistrationFormData } from "@/utils/validation";
import { AUTH_FLOWS } from "@/constants/auth";
import AuthForm from "@/components/auth/AuthForm";
import Input from "@/components/ui/Input";
import Text from "@/components/ui/Text";

// ============================================================================
// TYPES
// ============================================================================

export interface RegisterScreenProps {
  navigation: any;
  onRegistrationSuccess?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const RegisterScreenComponent: React.FC<RegisterScreenProps> = ({ navigation, onRegistrationSuccess }) => {
  const { signup, loading, error, clearError } = useAuth();

  // React Hook Form setup
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    setError,
    clearErrors,
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationFormSchema),
    mode: "onSubmit", // Only validate on submit initially
    reValidateMode: "onChange", // Re-validate on change after first submit
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Log component renders to track rerender causes
  console.log("RegisterScreen: Component render", {
    isSubmitting,
    loadingSignup: loading.signup,
    hasError: !!error,
    hasFormErrors: Object.keys(errors).length > 0,
    timestamp: Date.now(),
  });

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

  const onSubmit = async (data: RegistrationFormData) => {
    try {
      clearError();
      clearErrors();

      const result = await signup({
        email: data.email,
        password: data.password,
        profile: {
          displayName: "", // Will be set in onboarding
          experienceLevel: "untrained", // Default, will be updated in onboarding
          fitnessGoals: [], // Will be set in onboarding
        },
      });

      if (result.success) {
        if (result.requiresEmailConfirmation) {
          navigation.navigate("EmailVerification", { email: data.email });
        } else {
          onRegistrationSuccess?.();
        }
      } else if (result.error) {
        // Handle specific error types
        switch (result.error.code) {
          case "EMAIL_EXISTS":
            setError("email", {
              type: "manual",
              message: "An account with this email already exists",
            });
            break;
          case "WEAK_PASSWORD":
            setError("password", {
              type: "manual",
              message: result.error.message,
            });
            break;
          case "INVALID_EMAIL":
            setError("email", {
              type: "manual",
              message: "Please enter a valid email address",
            });
            break;
          default:
            Alert.alert("Registration Failed", result.error.message);
            break;
        }
      }
    } catch (error) {
      console.error("Registration error:", error);
      Alert.alert("Registration Failed", "An unexpected error occurred. Please try again.");
    }
  };

  const navigateToLogin = () => {
    navigation.navigate("Login");
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const footerContent = (
    <View style={styles.footer}>
      {/* Global Error */}
      {error && (
        <View style={styles.errorContainer}>
          <Text variant='bodySmall' color='error' align='center'>
            {error}
          </Text>
        </View>
      )}

      {/* Terms Notice */}
      <View style={styles.termsContainer}>
        <Text variant='bodySmall' color='secondary' align='center' style={styles.termsText}>
          By creating an account, you agree to our{" "}
          <Text variant='bodySmall' color='primary' style={styles.termsLink}>
            Terms of Service
          </Text>{" "}
          and{" "}
          <Text variant='bodySmall' color='primary' style={styles.termsLink}>
            Privacy Policy
          </Text>
        </Text>
      </View>
    </View>
  );

  return (
    <AuthForm
      title={AUTH_FLOWS.signup.title}
      subtitle={AUTH_FLOWS.signup.subtitle}
      onSubmit={handleSubmit(onSubmit)}
      submitText={AUTH_FLOWS.signup.submitText}
      submitLoading={isSubmitting || loading.signup}
      submitDisabled={isSubmitting}
      secondaryAction={{
        text: AUTH_FLOWS.signup.switchText,
        onPress: navigateToLogin,
      }}
      footerContent={footerContent}>
      {/* Email Field */}
      <Input
        name='email'
        control={control}
        label='Email Address'
        placeholder='Enter your email'
        keyboardType='email-address'
        autoCapitalize='none'
        autoComplete='email'
        textContentType='emailAddress'
        required
      />

      {/* Password Field */}
      <Input
        name='password'
        control={control}
        label='Password'
        placeholder='Create a strong password'
        secureTextEntry
        showPasswordToggle
        autoComplete='new-password'
        textContentType='newPassword'
        helperText='Must be at least 12 characters with uppercase, lowercase, numbers, and special characters'
        required
      />

      {/* Confirm Password Field */}
      <Input
        name='confirmPassword'
        control={control}
        label='Confirm Password'
        placeholder='Confirm your password'
        secureTextEntry
        showPasswordToggle
        autoComplete='new-password'
        textContentType='newPassword'
        required
      />
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
  errorContainer: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  termsContainer: {
    paddingHorizontal: 16,
  },
  termsText: {
    lineHeight: 18,
  },
  termsLink: {
    textDecorationLine: "underline",
  },
});

// ============================================================================
// MEMOIZED COMPONENT
// ============================================================================

// Wrap with React.memo to prevent unnecessary rerenders
export const RegisterScreen = React.memo(RegisterScreenComponent, (prevProps, nextProps) => {
  // Custom comparison to prevent rerenders when navigation object changes
  return (
    prevProps.onRegistrationSuccess === nextProps.onRegistrationSuccess &&
    prevProps.navigation?.state?.key === nextProps.navigation?.state?.key
  );
});

// ============================================================================
// EXPORT
// ============================================================================

export default RegisterScreen;
