// ============================================================================
// REGISTER SCREEN
// ============================================================================
// Registration screen with multi-step onboarding, form validation, and
// experience level selection

import React, { useState } from "react";
import { View, StyleSheet, Alert, ScrollView } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { useSimpleForm } from "@/hooks/useSimpleForm";
import { registrationFormSchema, type RegistrationFormData } from "@/utils/validation";
import { AUTH_FLOWS, EXPERIENCE_LEVELS, FITNESS_GOALS } from "@/constants/auth";
import AuthForm from "@/components/auth/AuthForm";
import FormField from "@/components/ui/FormField";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";

// ============================================================================
// TYPES
// ============================================================================

export interface RegisterScreenProps {
  navigation: any;
  onRegistrationSuccess?: () => void;
}

type RegistrationStep = "credentials" | "profile" | "goals" | "stats";

// ============================================================================
// COMPONENT
// ============================================================================

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation, onRegistrationSuccess }) => {
  const { signup, loading, error, clearError } = useAuth();
  const [currentStep, setCurrentStep] = useState<RegistrationStep>("credentials");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  // Simple form state - no complex validation during typing
  const { values, errors, isSubmitting, handleChange, setError, clearAllErrors, setValue, validateAndSubmit } =
    useSimpleForm<RegistrationFormData>({
      email: "",
      password: "",
      confirmPassword: "",
      displayName: "",
      experienceLevel: "untrained",
      fitnessGoals: [],
      heightCm: undefined,
      weightKg: undefined,
      agreeToTerms: false,
      subscribeToNewsletter: false,
    });

  // ============================================================================
  // STEP MANAGEMENT
  // ============================================================================

  const getStepProgress = () => {
    const steps = ["credentials", "profile", "goals", "stats"];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case "credentials":
        return (
          values.email &&
          values.password &&
          values.confirmPassword &&
          !errors.email &&
          !errors.password &&
          !errors.confirmPassword
        );
      case "profile":
        return values.displayName && values.experienceLevel && !errors.displayName;
      case "goals":
        return selectedGoals.length > 0;
      case "stats":
        return true; // Optional step
      default:
        return false;
    }
  };

  const nextStep = () => {
    const steps: RegistrationStep[] = ["credentials", "profile", "goals", "stats"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const previousStep = () => {
    const steps: RegistrationStep[] = ["credentials", "profile", "goals", "stats"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

  const handleGoalToggle = (goalKey: string) => {
    const newGoals = selectedGoals.includes(goalKey)
      ? selectedGoals.filter((g) => g !== goalKey)
      : [...selectedGoals, goalKey];

    setSelectedGoals(newGoals);
    setValue("fitnessGoals", newGoals);
  };

  const onSubmit = validateAndSubmit(registrationFormSchema, async (formData: RegistrationFormData) => {
    try {
      clearError();

      const result = await signup({
        email: formData.email,
        password: formData.password,
        profile: {
          displayName: formData.displayName,
          experienceLevel: formData.experienceLevel,
          fitnessGoals: formData.fitnessGoals,
          heightCm: formData.heightCm,
          weightKg: formData.weightKg,
        },
      });

      if (result.success) {
        if (result.requiresEmailConfirmation) {
          navigation.navigate("EmailVerification", { email: formData.email });
        } else {
          onRegistrationSuccess?.();
        }
      } else if (result.error) {
        // Handle specific error types
        switch (result.error.code) {
          case "EMAIL_EXISTS":
            setCurrentStep("credentials");
            setError("email", "An account with this email already exists");
            break;
          case "WEAK_PASSWORD":
            setCurrentStep("credentials");
            setError("password", result.error.message);
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
  });

  const navigateToLogin = () => {
    navigation.navigate("Login");
  };

  // ============================================================================
  // STEP RENDERERS
  // ============================================================================

  const renderCredentialsStep = () => (
    <>
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
        placeholder='Create a strong password'
        value={values.password}
        onChangeText={handleChange("password")}
        error={errors.password}
        secureTextEntry
        showPasswordToggle
        autoComplete='new-password'
        textContentType='newPassword'
        helperText='Must be at least 12 characters with uppercase, lowercase, numbers, and special characters'
        required
      />

      <FormField
        name='confirmPassword'
        label='Confirm Password'
        placeholder='Confirm your password'
        value={values.confirmPassword}
        onChangeText={handleChange("confirmPassword")}
        error={errors.confirmPassword}
        secureTextEntry
        autoComplete='new-password'
        textContentType='newPassword'
        required
      />
    </>
  );

  const renderProfileStep = () => (
    <>
      <FormField
        name='displayName'
        label='Display Name'
        placeholder='How should we call you?'
        value={values.displayName}
        onChangeText={handleChange("displayName")}
        error={errors.displayName}
        autoCapitalize='words'
        autoComplete='name'
        textContentType='name'
        required
      />

      <View style={styles.experienceLevelContainer}>
        <Text variant='body' color='primary' style={styles.sectionLabel}>
          Experience Level *
        </Text>
        <Text variant='bodySmall' color='secondary' style={styles.sectionDescription}>
          This helps us customize your workout recommendations
        </Text>

        {Object.entries(EXPERIENCE_LEVELS).map(([key, level]) => (
          <Button
            key={key}
            variant={values.experienceLevel === key ? "primary" : "secondary"}
            size='medium'
            style={styles.experienceButton}
            onPress={() => setValue("experienceLevel", key)}>
            <View style={styles.experienceButtonContent}>
              <Text variant='body' color={values.experienceLevel === key ? "white" : "primary"} weight='medium'>
                {level.label}
              </Text>
              <Text
                variant='bodySmall'
                color={values.experienceLevel === key ? "white" : "secondary"}
                style={styles.experienceDescription}>
                {level.description}
              </Text>
            </View>
          </Button>
        ))}
      </View>
    </>
  );

  const renderGoalsStep = () => (
    <View style={styles.goalsContainer}>
      <Text variant='body' color='primary' style={styles.sectionLabel}>
        Fitness Goals *
      </Text>
      <Text variant='bodySmall' color='secondary' style={styles.sectionDescription}>
        Select one or more goals that match your fitness aspirations
      </Text>

      <View style={styles.goalsGrid}>
        {Object.entries(FITNESS_GOALS).map(([key, goal]) => (
          <Button
            key={key}
            variant={selectedGoals.includes(key) ? "primary" : "secondary"}
            size='medium'
            style={styles.goalButton}
            onPress={() => handleGoalToggle(key)}>
            <View style={styles.goalButtonContent}>
              <Text variant='h3' style={styles.goalIcon}>
                {goal.icon}
              </Text>
              <Text
                variant='body'
                color={selectedGoals.includes(key) ? "white" : "primary"}
                weight='medium'
                align='center'>
                {goal.label}
              </Text>
              <Text
                variant='bodySmall'
                color={selectedGoals.includes(key) ? "white" : "secondary"}
                align='center'
                style={styles.goalDescription}>
                {goal.description}
              </Text>
            </View>
          </Button>
        ))}
      </View>
    </View>
  );

  const renderStatsStep = () => (
    <>
      <Text variant='body' color='primary' style={styles.sectionLabel}>
        Physical Stats (Optional)
      </Text>
      <Text variant='bodySmall' color='secondary' style={styles.sectionDescription}>
        Help us provide more accurate recommendations
      </Text>

      <View style={styles.statsRow}>
        <FormField
          name='heightCm'
          label='Height (cm)'
          placeholder='170'
          value={values.heightCm?.toString() || ""}
          onChangeText={(text) => setValue("heightCm", text ? parseInt(text) : undefined)}
          error={errors.heightCm}
          keyboardType='numeric'
          containerStyle={styles.statField}
        />

        <FormField
          name='weightKg'
          label='Weight (kg)'
          placeholder='70'
          value={values.weightKg?.toString() || ""}
          onChangeText={(text) => setValue("weightKg", text ? parseFloat(text) : undefined)}
          error={errors.weightKg}
          keyboardType='numeric'
          containerStyle={styles.statField}
        />
      </View>
    </>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  const getStepTitle = () => {
    switch (currentStep) {
      case "credentials":
        return "Create Account";
      case "profile":
        return "Tell Us About You";
      case "goals":
        return "Your Fitness Goals";
      case "stats":
        return "Physical Stats";
      default:
        return AUTH_FLOWS.signup.title;
    }
  };

  const getStepSubtitle = () => {
    switch (currentStep) {
      case "credentials":
        return "Enter your email and create a secure password";
      case "profile":
        return "Help us personalize your experience";
      case "goals":
        return "What do you want to achieve?";
      case "stats":
        return "Optional information for better recommendations";
      default:
        return AUTH_FLOWS.signup.subtitle;
    }
  };

  const isLastStep = currentStep === "stats";

  return (
    <AuthForm
      title={getStepTitle()}
      subtitle={getStepSubtitle()}
      onSubmit={isLastStep ? onSubmit : nextStep}
      submitText={isLastStep ? "Create Account" : "Continue"}
      submitLoading={isSubmitting || loading.signup}
      submitDisabled={!canProceedToNextStep() || isSubmitting}
      secondaryAction={{
        text: currentStep === "credentials" ? AUTH_FLOWS.signup.switchText : "Back",
        onPress: currentStep === "credentials" ? navigateToLogin : previousStep,
      }}
      footerContent={
        <View style={styles.footer}>
          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${getStepProgress()}%` }]} />
            </View>
            <Text variant='caption' color='secondary' style={styles.progressText}>
              Step {["credentials", "profile", "goals", "stats"].indexOf(currentStep) + 1} of 4
            </Text>
          </View>

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
      {currentStep === "credentials" && renderCredentialsStep()}
      {currentStep === "profile" && renderProfileStep()}
      {currentStep === "goals" && renderGoalsStep()}
      {currentStep === "stats" && renderStatsStep()}
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
  progressContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  progressBar: {
    width: "100%",
    height: 4,
    backgroundColor: "#F2F2F7",
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#B5CFF8",
    borderRadius: 2,
  },
  progressText: {
    marginTop: 4,
  },
  errorContainer: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    marginBottom: 4,
    fontWeight: "600",
  },
  sectionDescription: {
    marginBottom: 16,
    lineHeight: 18,
  },
  experienceLevelContainer: {
    marginBottom: 16,
  },
  experienceButton: {
    marginBottom: 12,
    paddingVertical: 16,
  },
  experienceButtonContent: {
    alignItems: "flex-start",
  },
  experienceDescription: {
    marginTop: 4,
    textAlign: "left",
  },
  goalsContainer: {
    marginBottom: 16,
  },
  goalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  goalButton: {
    width: "48%",
    marginBottom: 12,
    paddingVertical: 20,
    minHeight: 120,
  },
  goalButtonContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  goalIcon: {
    marginBottom: 8,
  },
  goalDescription: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 14,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statField: {
    width: "48%",
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default RegisterScreen;
