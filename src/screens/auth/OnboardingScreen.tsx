// ============================================================================
// ONBOARDING SCREEN
// ============================================================================
// User profile setup and experience level selection after successful registration
// with motivational copy and smooth transitions

import React, { useState, useRef } from "react";
import { View, StyleSheet, Alert, TextInput } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { EXPERIENCE_LEVELS, FITNESS_GOALS } from "@/constants/auth";
import AuthForm from "@/components/auth/AuthForm";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";
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

export interface OnboardingScreenProps {
  navigation: any;
  onOnboardingComplete?: () => void;
}

type OnboardingStep = "welcome" | "profile" | "goals" | "complete";

// ============================================================================
// COMPONENT
// ============================================================================

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation, onOnboardingComplete }) => {
  const { updateProfile, loading, error, clearError, user } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState<string>(
    (user?.user_metadata?.experience_level as string) || "untrained"
  );
  const [errors, setErrors] = useState<{ displayName?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form field refs
  const displayNameFieldRef = useRef<TextInput>(null);

  // Initialize form values
  const initialDisplayName = (user?.user_metadata?.display_name as string) || "";

  // ============================================================================
  // STEP MANAGEMENT
  // ============================================================================

  const getStepProgress = () => {
    const steps = ["welcome", "profile", "goals", "complete"];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case "welcome":
        return true;
      case "profile":
        const displayName = (displayNameFieldRef.current as any)?._lastNativeText || "";
        return displayName.trim().length > 0 && experienceLevel && !errors.displayName;
      case "goals":
        return selectedGoals.length > 0;
      case "complete":
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    const steps: OnboardingStep[] = ["welcome", "profile", "goals", "complete"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const previousStep = () => {
    const steps: OnboardingStep[] = ["welcome", "profile", "goals", "complete"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

  const handleDisplayNameChange = (value: string) => {
    if (errors.displayName) {
      setErrors((prev) => ({ ...prev, displayName: undefined }));
    }
  };

  const handleGoalToggle = (goalKey: string) => {
    const newGoals = selectedGoals.includes(goalKey)
      ? selectedGoals.filter((g) => g !== goalKey)
      : [...selectedGoals, goalKey];

    setSelectedGoals(newGoals);
  };

  const onSubmit = async () => {
    try {
      const displayName = (displayNameFieldRef.current as any)?._lastNativeText || "";

      // Validate display name
      if (!displayName.trim()) {
        setErrors({ displayName: "Display name is required" });
        return;
      }

      clearError();
      setErrors({});
      setIsSubmitting(true);

      const result = await updateProfile({
        displayName: displayName.trim(),
        experienceLevel: experienceLevel as any,
        fitnessGoals: selectedGoals,
        heightCm: undefined,
        weightKg: undefined,
      });

      if (result.success) {
        setCurrentStep("complete");
      } else if (result.error) {
        Alert.alert("Profile Update Failed", result.error.message);
      }
    } catch (error) {
      console.error("Profile update error:", error);
      Alert.alert("Profile Update Failed", "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeOnboarding = () => {
    onOnboardingComplete?.();
  };

  // ============================================================================
  // STEP RENDERERS
  // ============================================================================

  const renderWelcomeStep = () => (
    <AuthForm
      title='Welcome to TrainSmart! 🎉'
      subtitle="Let's set up your profile to provide personalized workout recommendations"
      onSubmit={nextStep}
      submitText='Get Started'
      showKeyboardAvoidance={false}>
      <View style={styles.welcomeContainer}>
        <View style={styles.welcomeIcon}>
          <Text variant='h1' style={styles.welcomeEmoji}>
            💪
          </Text>
        </View>

        <Text variant='bodyLarge' color='primary' align='center' style={styles.welcomeMessage}>
          You're about to embark on your fitness journey with AI-powered coaching and smart progression tracking.
        </Text>

        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <Text variant='body' style={styles.featureIcon}>
              🎯
            </Text>
            <Text variant='body' color='primary' style={styles.featureText}>
              Personalized workout recommendations
            </Text>
          </View>

          <View style={styles.featureItem}>
            <Text variant='body' style={styles.featureIcon}>
              📈
            </Text>
            <Text variant='body' color='primary' style={styles.featureText}>
              Smart progression tracking with RPE
            </Text>
          </View>

          <View style={styles.featureItem}>
            <Text variant='body' style={styles.featureIcon}>
              🤖
            </Text>
            <Text variant='body' color='primary' style={styles.featureText}>
              AI coaching for form and technique
            </Text>
          </View>
        </View>
      </View>
    </AuthForm>
  );

  const renderProfileStep = () => (
    <AuthForm
      title='Tell Us About Yourself'
      subtitle='Help us customize your experience'
      onSubmit={nextStep}
      submitText='Continue'
      submitDisabled={!canProceedToNextStep()}
      secondaryAction={{
        text: "Back",
        onPress: previousStep,
      }}>
      <View style={FIELD_STYLES.container}>
        <Text style={LABEL_STYLES.base}>Display Name *</Text>
        <TextInput
          ref={displayNameFieldRef}
          style={getInputStyle(undefined, getInputState(false, !!errors.displayName))}
          defaultValue={initialDisplayName}
          onChangeText={handleDisplayNameChange}
          autoCapitalize='words'
          autoComplete='name'
          textContentType='name'
          placeholder='How should we call you?'
        />
        {errors.displayName && <Text style={ERROR_STYLES.text}>{errors.displayName}</Text>}
      </View>

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
            onPress={() => setExperienceLevel(key)}>
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
    </AuthForm>
  );

  const renderGoalsStep = () => (
    <AuthForm
      title='Your Fitness Goals'
      subtitle='What do you want to achieve?'
      onSubmit={onSubmit}
      submitText='Complete Setup'
      submitLoading={isSubmitting || loading.profileUpdate}
      submitDisabled={!canProceedToNextStep() || isSubmitting}
      secondaryAction={{
        text: "Back",
        onPress: previousStep,
      }}>
      <View style={styles.goalsContainer}>
        <Text variant='body' color='primary' style={styles.sectionLabel}>
          Select Your Goals *
        </Text>
        <Text variant='bodySmall' color='secondary' style={styles.sectionDescription}>
          Choose one or more goals that match your fitness aspirations
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
    </AuthForm>
  );

  const renderCompleteStep = () => (
    <AuthForm
      title="You're All Set! 🚀"
      subtitle='Your profile has been created successfully'
      onSubmit={completeOnboarding}
      submitText='Start Training'
      showKeyboardAvoidance={false}>
      <View style={styles.completeContainer}>
        <View style={styles.completeIcon}>
          <Text variant='h1' style={styles.completeEmoji}>
            ✨
          </Text>
        </View>

        <Text variant='bodyLarge' color='primary' align='center' style={styles.completeMessage}>
          Welcome to TrainSmart, {(displayNameFieldRef.current as any)?._lastNativeText || ""}! Your personalized
          fitness journey starts now.
        </Text>

        <View style={styles.summaryContainer}>
          <Text variant='body' color='secondary' align='center' style={styles.summaryTitle}>
            Your Profile Summary:
          </Text>

          <View style={styles.summaryItem}>
            <Text variant='body' color='primary' weight='medium'>
              Experience Level: {EXPERIENCE_LEVELS[experienceLevel as keyof typeof EXPERIENCE_LEVELS]?.label}
            </Text>
          </View>

          <View style={styles.summaryItem}>
            <Text variant='body' color='primary' weight='medium'>
              Goals: {selectedGoals.length} selected
            </Text>
          </View>
        </View>

        <View style={styles.motivationContainer}>
          <Text variant='body' color='coach' align='center' style={styles.motivationText}>
            "The journey of a thousand miles begins with one step. Your first workout awaits!"
          </Text>
        </View>
      </View>
    </AuthForm>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  const getProgressFooter = () => {
    if (currentStep === "complete") return null;

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${getStepProgress()}%` }]} />
        </View>
        <Text variant='caption' color='secondary' style={styles.progressText}>
          Step {["welcome", "profile", "goals", "complete"].indexOf(currentStep) + 1} of 4
        </Text>
      </View>
    );
  };

  switch (currentStep) {
    case "welcome":
      return renderWelcomeStep();
    case "profile":
      return renderProfileStep();
    case "goals":
      return renderGoalsStep();
    case "complete":
      return renderCompleteStep();
    default:
      return renderWelcomeStep();
  }
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
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
  welcomeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  welcomeIcon: {
    marginBottom: 24,
  },
  welcomeEmoji: {
    fontSize: 64,
    textAlign: "center",
  },
  welcomeMessage: {
    marginBottom: 32,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  featuresContainer: {
    width: "100%",
    paddingHorizontal: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 24,
    textAlign: "center",
  },
  featureText: {
    flex: 1,
    lineHeight: 20,
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
  completeContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  completeIcon: {
    marginBottom: 24,
  },
  completeEmoji: {
    fontSize: 64,
    textAlign: "center",
  },
  completeMessage: {
    marginBottom: 32,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  summaryContainer: {
    width: "100%",
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  summaryTitle: {
    marginBottom: 16,
    fontWeight: "600",
  },
  summaryItem: {
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  motivationContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "rgba(181, 207, 248, 0.1)",
    borderRadius: 12,
    marginHorizontal: 16,
  },
  motivationText: {
    fontStyle: "italic",
    lineHeight: 20,
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default OnboardingScreen;
