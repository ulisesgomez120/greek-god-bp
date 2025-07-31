// ============================================================================
// REGISTER SCREEN - BASIC INPUT TEST
// ============================================================================
// Testing basic TextInput components to isolate keyboard focus issues

import React, { useState } from "react";
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

  // Basic state management
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});

  console.log("RegisterScreen: Basic test render", {
    email: email.length,
    password: password.length,
    confirmPassword: confirmPassword.length,
    timestamp: Date.now(),
  });

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      clearError();

      const result = await signup({
        email,
        password,
        profile: {
          displayName: "",
          experienceLevel: "untrained",
          fitnessGoals: [],
        },
      });

      if (result.success) {
        if (result.requiresEmailConfirmation) {
          navigation.navigate("EmailVerification", { email });
        } else {
          onRegistrationSuccess?.();
        }
      } else if (result.error) {
        Alert.alert("Registration Failed", result.error.message);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps='handled'>
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <Text variant='h1' color='primary' align='center' style={styles.title}>
                Create Account
              </Text>
              <Text variant='bodyLarge' color='secondary' align='center' style={styles.subtitle}>
                Join TrainSmart and start your fitness journey
              </Text>
            </View>

            {/* Form Fields */}
            <View style={styles.formContent}>
              {/* Email Field */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Email Address *</Text>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) {
                      setErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  placeholder='Enter your email'
                  keyboardType='email-address'
                  autoCapitalize='none'
                  autoComplete='email'
                  textContentType='emailAddress'
                  autoCorrect={false}
                  spellCheck={false}
                />
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              {/* Password Field */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Password *</Text>
                <TextInput
                  style={[styles.input, errors.password && styles.inputError]}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) {
                      setErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  placeholder='Create a strong password'
                  secureTextEntry
                  autoComplete='new-password'
                  textContentType='newPassword'
                  autoCorrect={false}
                  spellCheck={false}
                />
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>

              {/* Confirm Password Field */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Confirm Password *</Text>
                <TextInput
                  style={[styles.input, errors.confirmPassword && styles.inputError]}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errors.confirmPassword) {
                      setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }
                  }}
                  placeholder='Confirm your password'
                  secureTextEntry
                  autoComplete='new-password'
                  textContentType='newPassword'
                  autoCorrect={false}
                  spellCheck={false}
                />
                {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, loading.signup && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading.signup}>
              <Text style={styles.submitButtonText}>{loading.signup ? "Creating Account..." : "Create Account"}</Text>
            </TouchableOpacity>

            {/* Secondary Action */}
            <TouchableOpacity style={styles.secondaryButton} onPress={navigateToLogin}>
              <Text style={styles.secondaryButtonText}>Already have an account? Sign In</Text>
            </TouchableOpacity>

            {/* Global Error */}
            {error && (
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
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000000",
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#8E8E93",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    fontSize: 17,
    color: "#000000",
  },
  inputError: {
    borderColor: "#FF3B30",
    backgroundColor: "rgba(255, 59, 48, 0.05)",
  },
  errorText: {
    fontSize: 13,
    color: "#FF3B30",
    marginTop: 6,
    paddingHorizontal: 4,
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
