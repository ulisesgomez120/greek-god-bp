// ============================================================================
// PROFILE SETUP SCREEN
// ============================================================================
// Initial profile setup wizard with multi-step onboarding flow

import React, { useState, useCallback, useEffect } from "react";
import { View, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import {
  getInputStyle,
  getInputState,
  getInputProps,
  LABEL_STYLES,
  ERROR_STYLES,
  FIELD_STYLES,
} from "@/styles/inputStyles";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/utils/logger";
import { ExperienceLevelSelector } from "@/components/profile/ExperienceLevelSelector";
import type { ProfileSetupData, FitnessGoal, OnboardingStep, OnboardingProgress } from "@/types/profile";
import type { ExperienceLevel } from "@/types/database";
import { DEFAULT_FITNESS_GOALS, EXPERIENCE_LEVELS, getExperienceLevelInfo } from "@/types/profile";

// ============================================================================
// TYPES
// ============================================================================

interface ProfileSetupScreenProps {}

interface StepComponentProps {
  data: Partial<ProfileSetupData>;
  onUpdate: (updates: Partial<ProfileSetupData>) => void;
  onNext: () => void;
  onBack: () => void;
  canGoNext: boolean;
  isFirst: boolean;
  isLast: boolean;
}

// ============================================================================
// ONBOARDING STEPS CONFIGURATION
// ============================================================================

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to TrainSmart",
    description: "Let's set up your profile to get personalized recommendations",
    component: "WelcomeStep",
    required: false,
    order: 0,
    estimatedTime: 1,
  },
  {
    id: "basic_info",
    title: "Basic Information",
    description: "Tell us a bit about yourself",
    component: "BasicInfoStep",
    required: true,
    order: 1,
    estimatedTime: 2,
  },
  {
    id: "experience_level",
    title: "Experience Level",
    description: "Help us understand your training background",
    component: "ExperienceLevelStep",
    required: true,
    order: 2,
    estimatedTime: 3,
  },
  {
    id: "fitness_goals",
    title: "Fitness Goals",
    description: "What do you want to achieve?",
    component: "FitnessGoalsStep",
    required: true,
    order: 3,
    estimatedTime: 2,
  },
  {
    id: "completion",
    title: "All Set!",
    description: "Your profile is ready",
    component: "CompletionStep",
    required: false,
    order: 4,
    estimatedTime: 1,
  },
];

// ============================================================================
// STEP COMPONENTS
// ============================================================================

const WelcomeStep: React.FC<StepComponentProps> = ({ onNext }) => (
  <View style={styles.stepContainer}>
    <View style={styles.welcomeContent}>
      <Text style={styles.welcomeTitle}>Welcome to TrainSmart! 🏋️‍♂️</Text>
      <Text style={styles.welcomeDescription}>The only workout app that actually coaches you through progression.</Text>
      <Text style={styles.welcomeSubtext}>
        Let's set up your profile so we can provide personalized recommendations based on your experience level and
        goals.
      </Text>
    </View>
    <Button onPress={onNext} style={styles.primaryButton}>
      Get Started
    </Button>
  </View>
);

const BasicInfoStep: React.FC<StepComponentProps> = ({ data, onUpdate, onNext, canGoNext }) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const validateAndNext = () => {
    const newErrors: Record<string, string> = {};

    if (!data.displayName || data.displayName.trim().length < 2) {
      newErrors.displayName = "Display name must be at least 2 characters";
    }

    if (data.heightCm && (data.heightCm < 100 || data.heightCm > 250)) {
      newErrors.heightCm = "Height must be between 100cm and 250cm";
    }

    if (data.weightKg && (data.weightKg < 30 || data.weightKg > 300)) {
      newErrors.weightKg = "Weight must be between 30kg and 300kg";
    }

    if (data.birthDate) {
      const birthDate = new Date(data.birthDate);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();

      if (age < 13) {
        newErrors.birthDate = "You must be at least 13 years old";
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onNext();
    }
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Tell us about yourself</Text>
      <Text style={styles.stepDescription}>This helps us provide better recommendations</Text>

      <View style={styles.formContainer}>
        {/* Display Name Field */}
        <View style={FIELD_STYLES.container}>
          <Text style={LABEL_STYLES.base}>Display Name *</Text>
          <TextInput
            style={getInputStyle(undefined, getInputState(focusedField === "displayName", !!errors.displayName))}
            value={data.displayName || ""}
            onChangeText={(text: string) => {
              onUpdate({ displayName: text });
              if (errors.displayName) {
                setErrors((prev) => {
                  const newErrors = { ...prev };
                  delete newErrors.displayName;
                  return newErrors;
                });
              }
            }}
            onFocus={() => setFocusedField("displayName")}
            onBlur={() => setFocusedField(null)}
            placeholder='Enter your name'
            autoCapitalize='words'
            autoComplete='name'
          />
          {errors.displayName && <Text style={ERROR_STYLES.text}>{errors.displayName}</Text>}
        </View>

        {/* Height Field */}
        <View style={FIELD_STYLES.container}>
          <Text style={LABEL_STYLES.base}>Height (cm)</Text>
          <TextInput
            style={getInputStyle(undefined, getInputState(focusedField === "heightCm", !!errors.heightCm))}
            value={data.heightCm?.toString() || ""}
            onChangeText={(text: string) => {
              onUpdate({ heightCm: text ? parseInt(text) : undefined });
              if (errors.heightCm) {
                setErrors((prev) => {
                  const newErrors = { ...prev };
                  delete newErrors.heightCm;
                  return newErrors;
                });
              }
            }}
            onFocus={() => setFocusedField("heightCm")}
            onBlur={() => setFocusedField(null)}
            {...getInputProps("number")}
            placeholder='170'
          />
          {errors.heightCm && <Text style={ERROR_STYLES.text}>{errors.heightCm}</Text>}
        </View>

        {/* Weight Field */}
        <View style={FIELD_STYLES.container}>
          <Text style={LABEL_STYLES.base}>Weight (kg)</Text>
          <TextInput
            style={getInputStyle(undefined, getInputState(focusedField === "weightKg", !!errors.weightKg))}
            value={data.weightKg?.toString() || ""}
            onChangeText={(text: string) => {
              onUpdate({ weightKg: text ? parseFloat(text) : undefined });
              if (errors.weightKg) {
                setErrors((prev) => {
                  const newErrors = { ...prev };
                  delete newErrors.weightKg;
                  return newErrors;
                });
              }
            }}
            onFocus={() => setFocusedField("weightKg")}
            onBlur={() => setFocusedField(null)}
            {...getInputProps("number")}
            placeholder='70'
          />
          {errors.weightKg && <Text style={ERROR_STYLES.text}>{errors.weightKg}</Text>}
        </View>

        {/* Birth Date Field */}
        <View style={FIELD_STYLES.container}>
          <Text style={LABEL_STYLES.base}>Birth Date</Text>
          <TextInput
            style={getInputStyle(undefined, getInputState(focusedField === "birthDate", !!errors.birthDate))}
            value={data.birthDate || ""}
            onChangeText={(text: string) => {
              onUpdate({ birthDate: text });
              if (errors.birthDate) {
                setErrors((prev) => {
                  const newErrors = { ...prev };
                  delete newErrors.birthDate;
                  return newErrors;
                });
              }
            }}
            onFocus={() => setFocusedField("birthDate")}
            onBlur={() => setFocusedField(null)}
            placeholder='YYYY-MM-DD'
            keyboardType='numeric'
          />
          {errors.birthDate && <Text style={ERROR_STYLES.text}>{errors.birthDate}</Text>}
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>Gender</Text>
          <Text style={styles.fieldHint}>Optional - helps with strength standards</Text>
          <View style={styles.genderContainer}>
            {["male", "female", "other", "prefer_not_to_say"].map((gender) => (
              <Button
                key={gender}
                onPress={() => onUpdate({ gender: gender as any })}
                variant={data.gender === gender ? "primary" : "secondary"}
                style={styles.genderButton}>
                {gender.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              </Button>
            ))}
          </View>
        </View>
      </View>

      <Button onPress={validateAndNext} disabled={!canGoNext} style={styles.primaryButton}>
        Continue
      </Button>
    </View>
  );
};

const ExperienceLevelStep: React.FC<StepComponentProps> = ({ data, onUpdate, onNext, canGoNext }) => {
  const [selectedLevel, setSelectedLevel] = useState<ExperienceLevel | null>(data.experienceLevel || null);

  const handleLevelSelect = (level: ExperienceLevel) => {
    setSelectedLevel(level);
    onUpdate({ experienceLevel: level });
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What's your training experience?</Text>
      <Text style={styles.stepDescription}>This determines your progression strategy</Text>

      <ScrollView style={styles.experienceLevelsContainer} showsVerticalScrollIndicator={false}>
        {EXPERIENCE_LEVELS.slice(0, 4).map((levelInfo) => {
          const isSelected = selectedLevel === levelInfo.level;

          return (
            <View
              key={levelInfo.level}
              style={[styles.experienceLevelCard, isSelected && styles.experienceLevelCardSelected]}>
              <Button onPress={() => handleLevelSelect(levelInfo.level)} style={styles.experienceLevelButton}>
                <View style={styles.experienceLevelContent}>
                  <View style={styles.experienceLevelHeader}>
                    <Text style={[styles.experienceLevelName, isSelected && styles.experienceLevelNameSelected]}>
                      {levelInfo.name}
                    </Text>
                    <Text
                      style={[styles.experienceLevelDuration, isSelected && styles.experienceLevelDurationSelected]}>
                      {levelInfo.duration}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.experienceLevelDescription,
                      isSelected && styles.experienceLevelDescriptionSelected,
                    ]}>
                    {levelInfo.description}
                  </Text>

                  <Text style={[styles.experienceLevelStrategy, isSelected && styles.experienceLevelStrategySelected]}>
                    Strategy: {levelInfo.progressionStrategy}
                  </Text>
                </View>
              </Button>
            </View>
          );
        })}
      </ScrollView>

      <Button onPress={onNext} disabled={!canGoNext} style={styles.primaryButton}>
        Continue
      </Button>
    </View>
  );
};

const FitnessGoalsStep: React.FC<StepComponentProps> = ({ data, onUpdate, onNext, canGoNext }) => {
  const [selectedGoals, setSelectedGoals] = useState<string[]>(data.fitnessGoals || []);

  const toggleGoal = (goalId: string) => {
    const newGoals = selectedGoals.includes(goalId)
      ? selectedGoals.filter((id) => id !== goalId)
      : [...selectedGoals, goalId];

    setSelectedGoals(newGoals);
    onUpdate({ fitnessGoals: newGoals });
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What are your fitness goals?</Text>
      <Text style={styles.stepDescription}>Select all that apply - you can change these later</Text>

      <ScrollView style={styles.goalsContainer} showsVerticalScrollIndicator={false}>
        {DEFAULT_FITNESS_GOALS.map((goal) => {
          const isSelected = selectedGoals.includes(goal.id);

          return (
            <View key={goal.id} style={[styles.goalCard, isSelected && styles.goalCardSelected]}>
              <Button onPress={() => toggleGoal(goal.id)} style={styles.goalButton}>
                <View style={styles.goalContent}>
                  <View style={styles.goalHeader}>
                    <Text style={[styles.goalName, isSelected && styles.goalNameSelected]}>{goal.name}</Text>
                    {goal.popular && (
                      <View style={styles.popularBadge}>
                        <Text style={styles.popularBadgeText}>Popular</Text>
                      </View>
                    )}
                  </View>

                  <Text style={[styles.goalDescription, isSelected && styles.goalDescriptionSelected]}>
                    {goal.description}
                  </Text>
                </View>
              </Button>
            </View>
          );
        })}
      </ScrollView>

      <Button onPress={onNext} disabled={!canGoNext} style={styles.primaryButton}>
        Continue
      </Button>
    </View>
  );
};

const CompletionStep: React.FC<StepComponentProps> = ({ data, onNext }) => {
  const experienceLevelInfo = data.experienceLevel ? getExperienceLevelInfo(data.experienceLevel) : null;

  return (
    <View style={styles.stepContainer}>
      <View style={styles.completionContent}>
        <Text style={styles.completionTitle}>🎉 You're all set!</Text>
        <Text style={styles.completionDescription}>Your profile has been created successfully</Text>

        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Profile Summary:</Text>

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Name:</Text>
            <Text style={styles.summaryValue}>{data.displayName}</Text>
          </View>

          {experienceLevelInfo && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Experience:</Text>
              <Text style={styles.summaryValue}>{experienceLevelInfo.name}</Text>
            </View>
          )}

          {data.fitnessGoals && data.fitnessGoals.length > 0 && (
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Goals:</Text>
              <Text style={styles.summaryValue}>
                {data.fitnessGoals.length} goal{data.fitnessGoals.length !== 1 ? "s" : ""} selected
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.nextStepsText}>Ready to start your fitness journey with personalized coaching!</Text>
      </View>

      <Button onPress={onNext} style={styles.primaryButton}>
        Start Training
      </Button>
    </View>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ProfileSetupScreen: React.FC<ProfileSetupScreenProps> = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { createProfile } = useProfile();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [profileData, setProfileData] = useState<Partial<ProfileSetupData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStep = ONBOARDING_STEPS[currentStepIndex];
  const progress: OnboardingProgress = {
    currentStep: currentStepIndex,
    totalSteps: ONBOARDING_STEPS.length,
    completedSteps: ONBOARDING_STEPS.slice(0, currentStepIndex).map((s) => s.id),
    skippedSteps: [],
    timeSpent: 0,
  };

  // ============================================================================
  // NAVIGATION HANDLERS
  // ============================================================================

  const handleNext = useCallback(async () => {
    if (currentStepIndex === ONBOARDING_STEPS.length - 1) {
      // Final step - create profile
      await handleComplete();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [currentStepIndex, profileData]);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const handleComplete = useCallback(async () => {
    if (!user?.id) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    setIsSubmitting(true);

    try {
      const success = await createProfile(profileData as ProfileSetupData);

      if (success) {
        logger.info("Profile setup completed", { userId: user.id }, "profile");

        // Navigate to main app
        navigation.reset({
          index: 0,
          routes: [{ name: "MainApp" as never }],
        });
      } else {
        Alert.alert("Setup Failed", "There was an error creating your profile. Please try again.");
      }
    } catch (error) {
      logger.error("Profile setup error", error, "profile");
      Alert.alert("Setup Failed", "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [profileData, user?.id, createProfile, navigation]);

  // ============================================================================
  // VALIDATION
  // ============================================================================

  const canGoNext = useCallback(() => {
    switch (currentStep.id) {
      case "welcome":
        return true;
      case "basic_info":
        return !!(profileData.displayName && profileData.displayName.trim().length >= 2);
      case "experience_level":
        return !!profileData.experienceLevel;
      case "fitness_goals":
        return !!(profileData.fitnessGoals && profileData.fitnessGoals.length > 0);
      case "completion":
        return true;
      default:
        return false;
    }
  }, [currentStep.id, profileData]);

  // ============================================================================
  // STEP COMPONENT RENDERING
  // ============================================================================

  const renderStepComponent = () => {
    const stepProps: StepComponentProps = {
      data: profileData,
      onUpdate: (updates) => setProfileData((prev) => ({ ...prev, ...updates })),
      onNext: handleNext,
      onBack: handleBack,
      canGoNext: canGoNext(),
      isFirst: currentStepIndex === 0,
      isLast: currentStepIndex === ONBOARDING_STEPS.length - 1,
    };

    switch (currentStep.component) {
      case "WelcomeStep":
        return <WelcomeStep {...stepProps} />;
      case "BasicInfoStep":
        return <BasicInfoStep {...stepProps} />;
      case "ExperienceLevelStep":
        return <ExperienceLevelStep {...stepProps} />;
      case "FitnessGoalsStep":
        return <FitnessGoalsStep {...stepProps} />;
      case "CompletionStep":
        return <CompletionStep {...stepProps} />;
      default:
        return null;
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isSubmitting) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Creating your profile...</Text>
          <LoadingButton loading={true}>Creating...</LoadingButton>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${((currentStepIndex + 1) / ONBOARDING_STEPS.length) * 100}%` }]}
            />
          </View>
          <Text style={styles.progressText}>
            Step {currentStepIndex + 1} of {ONBOARDING_STEPS.length}
          </Text>
        </View>

        {/* Step Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}>
          {renderStepComponent()}
        </ScrollView>

        {/* Navigation */}
        {currentStepIndex > 0 && currentStep.id !== "completion" && (
          <View style={styles.navigationContainer}>
            <Button onPress={handleBack} variant='secondary' style={styles.backButton}>
              Back
            </Button>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 20,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  progressBar: {
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
    fontSize: 13,
    color: "#8E8E93",
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  stepContainer: {
    flex: 1,
    padding: 20,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 17,
    color: "#8E8E93",
    marginBottom: 32,
    lineHeight: 22,
  },
  formContainer: {
    flex: 1,
    marginBottom: 32,
  },
  genderContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  genderButton: {
    flex: 1,
    minWidth: "45%",
  },
  experienceLevelsContainer: {
    flex: 1,
    marginBottom: 32,
  },
  experienceLevelCard: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#F2F2F7",
    backgroundColor: "#FFFFFF",
  },
  experienceLevelCardSelected: {
    borderColor: "#B5CFF8",
    backgroundColor: "#F8FAFD",
  },
  experienceLevelButton: {
    padding: 0,
    backgroundColor: "transparent",
  },
  experienceLevelContent: {
    padding: 16,
  },
  experienceLevelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  experienceLevelName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  experienceLevelNameSelected: {
    color: "#B5CFF8",
  },
  experienceLevelDuration: {
    fontSize: 14,
    color: "#8E8E93",
    fontWeight: "500",
  },
  experienceLevelDurationSelected: {
    color: "#B5CFF8",
  },
  experienceLevelDescription: {
    fontSize: 15,
    color: "#8E8E93",
    marginBottom: 8,
    lineHeight: 20,
  },
  experienceLevelDescriptionSelected: {
    color: "#1C1C1E",
  },
  experienceLevelStrategy: {
    fontSize: 13,
    color: "#8E8E93",
    fontStyle: "italic",
    lineHeight: 18,
  },
  experienceLevelStrategySelected: {
    color: "#B5CFF8",
  },
  goalsContainer: {
    flex: 1,
    marginBottom: 32,
  },
  goalCard: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#F2F2F7",
    backgroundColor: "#FFFFFF",
  },
  goalCardSelected: {
    borderColor: "#B5CFF8",
    backgroundColor: "#F8FAFD",
  },
  goalButton: {
    padding: 0,
    backgroundColor: "transparent",
  },
  goalContent: {
    padding: 16,
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  goalName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1C1C1E",
    flex: 1,
  },
  goalNameSelected: {
    color: "#B5CFF8",
  },
  popularBadge: {
    backgroundColor: "#64D2FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  goalDescription: {
    fontSize: 15,
    color: "#8E8E93",
    lineHeight: 20,
  },
  goalDescriptionSelected: {
    color: "#1C1C1E",
  },
  welcomeContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1C1C1E",
    textAlign: "center",
    marginBottom: 16,
  },
  welcomeDescription: {
    fontSize: 20,
    fontWeight: "600",
    color: "#B5CFF8",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 26,
  },
  welcomeSubtext: {
    fontSize: 17,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  completionContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  completionTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1C1C1E",
    textAlign: "center",
    marginBottom: 16,
  },
  completionDescription: {
    fontSize: 17,
    color: "#8E8E93",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  summaryContainer: {
    backgroundColor: "#F8FAFD",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    marginBottom: 32,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 15,
    color: "#8E8E93",
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1C1C1E",
    flex: 1,
    textAlign: "right",
  },
  nextStepsText: {
    fontSize: 15,
    color: "#B5CFF8",
    textAlign: "center",
    fontWeight: "500",
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: "auto",
  },
  navigationContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  backButton: {
    width: 100,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  fieldHint: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 12,
  },
});

export default ProfileSetupScreen;
