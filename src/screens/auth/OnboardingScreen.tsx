// ============================================================================
// ONBOARDING SCREEN
// ============================================================================
// User profile setup and experience level selection after successful registration
// with motivational copy and smooth transitions

import React, { useState } from "react";
import { View, StyleSheet, Alert, TextInput, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";
import { EXPERIENCE_LEVELS, DEFAULT_FITNESS_GOALS, getExperienceLevelInfo } from "@/types/profile";
import type { ExperienceLevel } from "@/types/database";
import Text from "@/components/ui/Text";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
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

export interface OnboardingScreenProps {
  navigation: any;
  onOnboardingComplete?: () => void;
}

type OnboardingStep = "welcome" | "profile" | "goals" | "complete";

// ============================================================================
// COMPONENT
// ============================================================================

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation, onOnboardingComplete }) => {
  const { updateProfile, completeOnboarding, loading, error, clearError, user } = useAuth();
  const { colors } = useTheme();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState<string>(
    (user?.user_metadata?.experience_level as string) || "untrained"
  );
  const [errors, setErrors] = useState<{ displayName?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Controlled form state
  const [displayName, setDisplayName] = useState((user?.user_metadata?.display_name as string) || "");

  const isWeb = Platform.OS === "web";

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
    setDisplayName(value);
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

  const handleSetExperienceLevel = (level: string) => {
    setExperienceLevel(level);
  };

  const onSubmit = async () => {
    try {
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

  const handleCompleteOnboarding = async () => {
    try {
      clearError();
      setIsSubmitting(true);

      const result = await completeOnboarding();

      if (result.success) {
        onOnboardingComplete?.();
      } else {
        Alert.alert(
          "Start Training Failed",
          result.error?.message || "Failed to complete onboarding. Please try again."
        );
      }
    } catch (err) {
      console.error("completeOnboarding error:", err);
      Alert.alert("Start Training Failed", "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================================
  // STEP RENDERERS
  // ============================================================================

  const renderWelcomeStep = () => (
    <SafeAreaView style={[styles.safeArea, isWeb && styles.webSafeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={[styles.keyboardAvoidingView, isWeb && styles.webKeyboardAvoiding]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={[styles.scrollView, isWeb && styles.webScrollView]}
          contentContainerStyle={[styles.scrollContent, isWeb && styles.webScrollContent]}
          keyboardShouldPersistTaps='handled'>
          <View style={[styles.container, isWeb && styles.webContainer]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
                <Text variant='h1' color='primary' align='center' style={styles.title}>
                  Welcome to TrainSmart!
                </Text>
                <Icon name='star-outline' size={28} style={{ marginLeft: 8 }} accessibilityLabel='Welcome' />
              </View>
              <Text variant='bodyLarge' color='secondary' align='center' style={styles.subtitle}>
                Let's set up your profile to provide personalized workout recommendations
              </Text>
            </View>

            {/* Content */}
            <View style={styles.formContent}>
              <View style={styles.welcomeContainer}>
                <View style={styles.welcomeIcon}>
                  <Icon name='fitness-outline' size={64} accessibilityLabel='Strength' />
                </View>

                <Text variant='bodyLarge' color='primary' align='center' style={styles.welcomeMessage}>
                  You're about to embark on your fitness journey with AI-powered coaching and smart progression
                  tracking.
                </Text>

                <View style={styles.featuresContainer}>
                  <View style={styles.featureItem}>
                    <Icon
                      name='fitness-outline'
                      size={20}
                      style={styles.featureIcon}
                      accessibilityLabel='Personalized workout'
                    />
                    <Text variant='body' color='primary' style={styles.featureText}>
                      Personalized workout recommendations
                    </Text>
                  </View>

                  <View style={styles.featureItem}>
                    <Icon
                      name='trending-up-outline'
                      size={20}
                      style={styles.featureIcon}
                      accessibilityLabel='Progress tracking'
                    />
                    <Text variant='body' color='primary' style={styles.featureText}>
                      Smart progression tracking with RPE
                    </Text>
                  </View>

                  <View style={styles.featureItem}>
                    <Icon name='bulb-outline' size={20} style={styles.featureIcon} accessibilityLabel='AI coaching' />
                    <Text variant='body' color='primary' style={styles.featureText}>
                      AI coaching for form and technique
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Submit Button */}
            <Button variant='primary' size='large' style={styles.submitButton} onPress={nextStep}>
              Get Started
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  const renderProfileStep = () => (
    <SafeAreaView style={[styles.safeArea, isWeb && styles.webSafeArea]}>
      <KeyboardAvoidingView
        style={[styles.keyboardAvoidingView, isWeb && styles.webKeyboardAvoiding]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={[styles.scrollView, isWeb && styles.webScrollView]}
          contentContainerStyle={[styles.scrollContent, isWeb && styles.webScrollContent]}
          keyboardShouldPersistTaps='handled'>
          <View style={[styles.container, isWeb && styles.webContainer]}>
            {/* Header */}
            <View style={styles.header}>
              <Text variant='h1' color='primary' align='center' style={styles.title}>
                Tell Us About Yourself
              </Text>
              <Text variant='bodyLarge' color='secondary' align='center' style={styles.subtitle}>
                Help us customize your experience
              </Text>
            </View>

            {/* Form Content */}
            <View style={styles.formContent}>
              <View style={FIELD_STYLES.container}>
                <Text style={[LABEL_STYLES.base, { color: colors.text }]}>Display Name *</Text>
                <TextInput
                  style={getInputStyle(
                    colors,
                    undefined,
                    getInputState(focusedField === "displayName", !!errors.displayName)
                  )}
                  value={displayName}
                  placeholderTextColor={colors.placeholder}
                  selectionColor={colors.primary}
                  onChangeText={handleDisplayNameChange}
                  onFocus={() => setFocusedField("displayName")}
                  onBlur={() => setFocusedField(null)}
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

                {EXPERIENCE_LEVELS.map((level) => (
                  <Button
                    key={level.level}
                    variant={experienceLevel === level.level ? "primary" : "secondary"}
                    size='medium'
                    style={styles.experienceButton}
                    onPress={() => handleSetExperienceLevel(level.level)}>
                    <View style={styles.experienceButtonContent}>
                      <Text
                        variant='body'
                        color={experienceLevel === level.level ? "white" : "primary"}
                        weight='medium'>
                        {level.name}
                      </Text>
                      <Text
                        variant='bodySmall'
                        color={experienceLevel === level.level ? "white" : "secondary"}
                        style={styles.experienceDescription}>
                        {level.description}
                      </Text>
                    </View>
                  </Button>
                ))}
              </View>
            </View>

            {/* Action Buttons */}
            <Button
              variant='primary'
              size='large'
              style={styles.submitButton}
              disabled={!canProceedToNextStep()}
              onPress={nextStep}>
              Continue
            </Button>

            <Button variant='text' size='medium' style={styles.secondaryButton} onPress={previousStep}>
              Back
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  const renderGoalsStep = () => (
    <SafeAreaView style={[styles.safeArea, isWeb && styles.webSafeArea]}>
      <KeyboardAvoidingView
        style={[styles.keyboardAvoidingView, isWeb && styles.webKeyboardAvoiding]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={[styles.scrollView, isWeb && styles.webScrollView]}
          contentContainerStyle={[styles.scrollContent, isWeb && styles.webScrollContent]}
          keyboardShouldPersistTaps='handled'>
          <View style={[styles.container, isWeb && styles.webContainer]}>
            {/* Header */}
            <View style={styles.header}>
              <Text variant='h1' color='primary' align='center' style={styles.title}>
                Your Fitness Goals
              </Text>
              <Text variant='bodyLarge' color='secondary' align='center' style={styles.subtitle}>
                What do you want to achieve?
              </Text>
            </View>

            {/* Form Content */}
            <View style={styles.formContent}>
              <View style={styles.goalsContainer}>
                <Text variant='body' color='primary' style={styles.sectionLabel}>
                  Select Your Goals *
                </Text>
                <Text variant='bodySmall' color='secondary' style={styles.sectionDescription}>
                  Choose one or more goals that match your fitness aspirations
                </Text>

                <View style={styles.goalsGrid}>
                  {DEFAULT_FITNESS_GOALS.map((goal) => (
                    <Button
                      key={goal.id}
                      variant={selectedGoals.includes(goal.id) ? "primary" : "secondary"}
                      size='medium'
                      style={styles.goalButton}
                      onPress={() => handleGoalToggle(goal.id)}>
                      <View style={styles.goalButtonContent}>
                        <Icon
                          name={goal.icon.name}
                          size={28}
                          color={selectedGoals.includes(goal.id) ? "white" : colors.primary}
                          style={styles.goalIcon}
                          accessibilityLabel={`${goal.name} icon`}
                        />
                        <Text
                          variant='body'
                          color={selectedGoals.includes(goal.id) ? "white" : "primary"}
                          weight='medium'
                          align='center'
                          numberOfLines={1}
                          ellipsizeMode='tail'>
                          {goal.name}
                        </Text>
                        <Text
                          variant='bodySmall'
                          color={selectedGoals.includes(goal.id) ? "white" : "secondary"}
                          align='center'
                          style={[styles.goalDescription, { flexShrink: 1 }]}
                          numberOfLines={2}
                          ellipsizeMode='tail'>
                          {goal.description}
                        </Text>
                      </View>
                    </Button>
                  ))}
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <Button
              variant='primary'
              size='large'
              style={styles.submitButton}
              disabled={!canProceedToNextStep() || isSubmitting}
              onPress={onSubmit}>
              {isSubmitting || loading.profileUpdate ? "Setting up..." : "Complete Setup"}
            </Button>

            <Button variant='text' size='medium' style={styles.secondaryButton} onPress={previousStep}>
              Back
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  const renderCompleteStep = () => (
    <SafeAreaView style={[styles.safeArea, isWeb && styles.webSafeArea]}>
      <KeyboardAvoidingView
        style={[styles.keyboardAvoidingView, isWeb && styles.webKeyboardAvoiding]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={[styles.scrollView, isWeb && styles.webScrollView]}
          contentContainerStyle={[styles.scrollContent, isWeb && styles.webScrollContent]}
          keyboardShouldPersistTaps='handled'>
          <View style={[styles.container, isWeb && styles.webContainer]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
                <Text variant='h1' color='primary' align='center' style={styles.title}>
                  You're All Set!
                </Text>
                <Icon name='rocket-outline' size={28} style={{ marginLeft: 8 }} accessibilityLabel='Complete' />
              </View>
              <Text variant='bodyLarge' color='secondary' align='center' style={styles.subtitle}>
                Your profile has been created successfully
              </Text>
            </View>

            {/* Content */}
            <View style={styles.formContent}>
              <View style={styles.completeContainer}>
                <View style={styles.completeIcon}>
                  <Icon name='checkmark-circle-outline' size={64} accessibilityLabel='All set' />
                </View>

                <Text variant='bodyLarge' color='primary' align='center' style={styles.completeMessage}>
                  Welcome to TrainSmart, {displayName || ""}! Your personalized fitness journey starts now.
                </Text>

                <View style={styles.summaryContainer}>
                  <Text variant='body' color='secondary' align='center' style={styles.summaryTitle}>
                    Your Profile Summary:
                  </Text>

                  <View style={styles.summaryItem}>
                    <Text variant='body' color='primary' weight='medium'>
                      Experience Level: {getExperienceLevelInfo(experienceLevel as ExperienceLevel).name}
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
            </View>

            {/* Submit Button */}
            <Button
              variant='primary'
              size='large'
              style={styles.submitButton}
              onPress={handleCompleteOnboarding}
              disabled={isSubmitting}>
              Start Training
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  safeArea: {
    flex: 1,
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
    marginBottom: 16,
  },
  secondaryButton: {
    alignItems: "center",
    marginBottom: 24,
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
  webSafeArea: {
    minHeight: "100%",
    display: "flex",
    flex: 1,
  },
  webKeyboardAvoiding: {
    minHeight: "100%",
    display: "flex",
    flex: 1,
  },
  webScrollView: {
    flex: 1,
  },
  webScrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  webContainer: {
    minHeight: "100%",
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default OnboardingScreen;
