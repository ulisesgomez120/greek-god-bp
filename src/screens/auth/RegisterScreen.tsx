// ============================================================================
// REGISTER SCREEN
// ============================================================================
// Registration screen with multi-step onboarding, form validation, and
// experience level selection

import React, { useState, useRef } from "react";
import { View, StyleSheet, Alert, ScrollView, TextInput } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import {
  registrationFormSchema,
  type RegistrationFormData,
  validateFormData,
  validateEmail,
  validatePassword,
  validateDisplayName,
} from "@/utils/validation";
import { AUTH_FLOWS, EXPERIENCE_LEVELS, FITNESS_GOALS } from "@/constants/auth";
import AuthForm from "@/components/auth/AuthForm";
import Input from "@/components/ui/Input";
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

  // Uncontrolled form with refs - no state-based re-renders!
  const emailFieldRef = useRef<TextInput>(null);
  const passwordFieldRef = useRef<TextInput>(null);
  const confirmPasswordFieldRef = useRef<TextInput>(null);
  const displayNameFieldRef = useRef<TextInput>(null);
  const heightFieldRef = useRef<TextInput>(null);
  const weightFieldRef = useRef<TextInput>(null);

  // Value tracking refs - updated via onChangeText callbacks
  const emailValueRef = useRef("");
  const passwordValueRef = useRef("");
  const confirmPasswordValueRef = useRef("");
  const displayNameValueRef = useRef("");
  const heightValueRef = useRef("");
  const weightValueRef = useRef("");

  const [experienceLevel, setExperienceLevel] = useState<
    "untrained" | "beginner" | "early_intermediate" | "intermediate"
  >("untrained");
  const [errors, setErrors] = useState<Partial<RegistrationFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track values without clearing errors on keystroke
  const handleEmailChange = (value: string) => {
    emailValueRef.current = value;
  };

  const handlePasswordChange = (value: string) => {
    passwordValueRef.current = value;
  };

  const handleConfirmPasswordChange = (value: string) => {
    confirmPasswordValueRef.current = value;
  };

  const handleDisplayNameChange = (value: string) => {
    displayNameValueRef.current = value;
  };

  const handleHeightChange = (value: string) => {
    heightValueRef.current = value;
  };

  const handleWeightChange = (value: string) => {
    weightValueRef.current = value;
  };

  const setFieldError = (field: keyof RegistrationFormData, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  };

  const clearAllErrors = () => {
    setErrors({});
  };

  // ============================================================================
  // STEP-SPECIFIC VALIDATION
  // ============================================================================

  const validateCredentialsStep = () => {
    const email = emailValueRef.current;
    const password = passwordValueRef.current;
    const confirmPassword = confirmPasswordValueRef.current;

    const stepErrors: Partial<RegistrationFormData> = {};

    // Validate email
    if (!email.trim()) {
      stepErrors.email = "Email is required";
    } else {
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        stepErrors.email = emailValidation.error;
      }
    }

    // Validate password
    if (!password) {
      stepErrors.password = "Password is required";
    } else {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        stepErrors.password = passwordValidation.errors[0]; // Show first error
      }
    }

    // Validate confirm password
    if (!confirmPassword) {
      stepErrors.confirmPassword = "Please confirm your password";
    } else if (password && confirmPassword !== password) {
      stepErrors.confirmPassword = "Passwords do not match";
    }

    return stepErrors;
  };

  const validateProfileStep = () => {
    const displayName = displayNameValueRef.current;
    const stepErrors: Partial<RegistrationFormData> = {};

    // Validate display name
    if (!displayName.trim()) {
      stepErrors.displayName = "Display name is required";
    } else {
      const nameValidation = validateDisplayName(displayName);
      if (!nameValidation.isValid) {
        stepErrors.displayName = nameValidation.error;
      }
    }

    return stepErrors;
  };

  const validateCurrentStep = () => {
    let stepErrors: Partial<RegistrationFormData> = {};

    switch (currentStep) {
      case "credentials":
        stepErrors = validateCredentialsStep();
        break;
      case "profile":
        stepErrors = validateProfileStep();
        break;
      case "goals":
        if (selectedGoals.length === 0) {
          // For goals, we'll show an alert since there's no specific field error
          Alert.alert("Selection Required", "Please select at least one fitness goal to continue.");
          return false;
        }
        break;
      case "stats":
        // Optional step, no validation needed
        break;
    }

    // Update errors state
    setErrors((prev) => ({ ...prev, ...stepErrors }));

    return Object.keys(stepErrors).length === 0;
  };

  // ============================================================================
  // STEP MANAGEMENT
  // ============================================================================

  const getStepProgress = () => {
    const steps = ["credentials", "profile", "goals", "stats"];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  const nextStep = () => {
    // Clear previous errors first
    clearAllErrors();

    // Validate current step before proceeding
    const isValid = validateCurrentStep();

    if (isValid) {
      // Proceed to next step if validation passes
      const steps: RegistrationStep[] = ["credentials", "profile", "goals", "stats"];
      const currentIndex = steps.indexOf(currentStep);
      if (currentIndex < steps.length - 1) {
        setCurrentStep(steps[currentIndex + 1]);
      }
    }
    // If validation fails, errors are already set by validateCurrentStep()
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
  };

  const onSubmit = async () => {
    setIsSubmitting(true);
    clearAllErrors();

    try {
      // Get values from refs
      const email = emailValueRef.current;
      const password = passwordValueRef.current;
      const confirmPassword = confirmPasswordValueRef.current;
      const displayName = displayNameValueRef.current;
      const heightCm = heightValueRef.current;
      const weightKg = weightValueRef.current;

      // Create form data
      const formData: RegistrationFormData = {
        email,
        password,
        confirmPassword,
        displayName,
        experienceLevel,
        fitnessGoals: selectedGoals,
        heightCm: heightCm ? parseInt(heightCm) : undefined,
        weightKg: weightKg ? parseFloat(weightKg) : undefined,
        agreeToTerms: false,
        subscribeToNewsletter: false,
      };

      // Validate form data
      const validationResult = validateFormData(registrationFormSchema, formData);

      if (!validationResult.isValid) {
        // Set validation errors
        Object.keys(validationResult.errors).forEach((key) => {
          if (validationResult.errors[key]) {
            setFieldError(key as keyof RegistrationFormData, validationResult.errors[key]);
          }
        });
        return;
      }

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
            setFieldError("email", "An account with this email already exists");
            break;
          case "WEAK_PASSWORD":
            setCurrentStep("credentials");
            setFieldError("password", result.error.message);
            break;
          default:
            Alert.alert("Registration Failed", result.error.message);
            break;
        }
      }
    } catch (error) {
      console.error("Registration error:", error);
      Alert.alert("Registration Failed", "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const navigateToLogin = () => {
    navigation.navigate("Login");
  };

  // ============================================================================
  // STEP RENDERERS
  // ============================================================================

  const renderCredentialsStep = () => (
    <>
      <Input
        ref={emailFieldRef}
        label='Email Address'
        placeholder='Enter your email'
        onChangeText={handleEmailChange}
        error={errors.email}
        keyboardType='email-address'
        autoCapitalize='none'
        autoComplete='email'
        textContentType='emailAddress'
        required
      />

      <Input
        ref={passwordFieldRef}
        label='Password'
        placeholder='Create a strong password'
        onChangeText={handlePasswordChange}
        error={errors.password}
        secureTextEntry
        showPasswordToggle
        autoComplete='new-password'
        textContentType='newPassword'
        helperText='Must be at least 12 characters with uppercase, lowercase, numbers, and special characters'
        required
      />

      <Input
        ref={confirmPasswordFieldRef}
        label='Confirm Password'
        placeholder='Confirm your password'
        onChangeText={handleConfirmPasswordChange}
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
      <Input
        ref={displayNameFieldRef}
        label='Display Name'
        placeholder='How should we call you?'
        onChangeText={handleDisplayNameChange}
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
            variant={experienceLevel === key ? "primary" : "secondary"}
            size='medium'
            style={styles.experienceButton}
            onPress={() => setExperienceLevel(key as any)}>
            <View style={styles.experienceButtonContent}>
              <Text variant='body' color={experienceLevel === key ? "white" : "primary"} weight='medium'>
                {level.label}
              </Text>
              <Text
                variant='bodySmall'
                color={experienceLevel === key ? "white" : "secondary"}
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
        <Input
          ref={heightFieldRef}
          label='Height (cm)'
          placeholder='170'
          onChangeText={handleHeightChange}
          error={typeof errors.heightCm === "string" ? errors.heightCm : undefined}
          keyboardType='numeric'
          containerStyle={styles.statField}
        />

        <Input
          ref={weightFieldRef}
          label='Weight (kg)'
          placeholder='70'
          onChangeText={handleWeightChange}
          error={typeof errors.weightKg === "string" ? errors.weightKg : undefined}
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
      submitDisabled={isSubmitting}
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
