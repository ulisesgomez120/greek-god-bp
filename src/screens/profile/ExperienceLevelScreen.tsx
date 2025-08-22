// ============================================================================
// EXPERIENCE LEVEL SCREEN
// ============================================================================
// Dedicated screen for experience level assessment and selection with
// interactive questionnaire and detailed recommendations

import React, { useState, useCallback, useEffect } from "react";
import { View, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
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
import { logger } from "@/utils/logger";
import useUnitPreferences from "@/hooks/useUnitPreferences";
import {
  formatKgToLbsDisplay,
  parseDisplayWeightToKg,
  formatCmToFtIn,
  parseDisplayHeightToCm,
} from "@/utils/unitConversions";
import type { ExperienceLevelAssessment, ExperienceLevelRecommendation, ExperienceLevelInfo } from "@/types/profile";
import type { ExperienceLevel } from "@/types/database";
import { EXPERIENCE_LEVELS, getExperienceLevelInfo } from "@/types/profile";

// ============================================================================
// TYPES
// ============================================================================

interface ExperienceLevelScreenProps {}

interface AssessmentStep {
  id: string;
  title: string;
  description: string;
  component: string;
  required: boolean;
}

// ============================================================================
// ASSESSMENT STEPS CONFIGURATION
// ============================================================================

const ASSESSMENT_STEPS: AssessmentStep[] = [
  {
    id: "training_history",
    title: "Training History",
    description: "Tell us about your training background",
    component: "TrainingHistoryStep",
    required: true,
  },
  {
    id: "strength_standards",
    title: "Strength Assessment",
    description: "Help us understand your current strength levels",
    component: "StrengthStandardsStep",
    required: false,
  },
  {
    id: "knowledge_assessment",
    title: "Training Knowledge",
    description: "Rate your understanding of training concepts",
    component: "KnowledgeAssessmentStep",
    required: true,
  },
  {
    id: "recommendation",
    title: "Your Level",
    description: "Based on your assessment",
    component: "RecommendationStep",
    required: false,
  },
];

// ============================================================================
// STEP COMPONENTS
// ============================================================================

interface StepProps {
  assessment: ExperienceLevelAssessment;
  onUpdate: (updates: Partial<ExperienceLevelAssessment>) => void;
  onNext: () => void;
  onBack: () => void;
  canGoNext: boolean;
  isFirst: boolean;
  isLast: boolean;
}

const TrainingHistoryStep: React.FC<StepProps> = ({ assessment, onUpdate, onNext, canGoNext }) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Unit-aware helpers
  const { isImperialWeight, isImperialHeight } = useUnitPreferences();

  const handleWeightInput = (key: keyof ExperienceLevelAssessment, text: string) => {
    if (isImperialWeight()) {
      const kg = parseDisplayWeightToKg(text);
      onUpdate({ [key]: kg != null ? Number(kg.toFixed(2)) : undefined } as any);
    } else {
      onUpdate({ [key]: text ? parseFloat(text) : undefined } as any);
    }
    setFocusedField(null);
  };

  const validateAndNext = () => {
    const newErrors: Record<string, string> = {};

    if (!assessment.monthsTraining || assessment.monthsTraining < 0) {
      newErrors.monthsTraining = "Please enter your training duration";
    }

    if (!assessment.trainingFrequency || assessment.trainingFrequency < 1 || assessment.trainingFrequency > 7) {
      newErrors.trainingFrequency = "Training frequency must be between 1-7 days per week";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onNext();
    }
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Training History</Text>
      <Text style={styles.stepDescription}>
        Help us understand your training background to provide accurate recommendations
      </Text>

      <View style={styles.formContainer}>
        {/* Months Training Field */}
        <View style={FIELD_STYLES.container}>
          <Text style={LABEL_STYLES.base}>How many months have you been training consistently? *</Text>
          <TextInput
            style={getInputStyle(undefined, getInputState(focusedField === "monthsTraining", !!errors.monthsTraining))}
            value={assessment.monthsTraining?.toString() || ""}
            onChangeText={(text: string) => {
              onUpdate({ monthsTraining: text ? parseInt(text) : undefined });
              if (errors.monthsTraining) {
                setErrors((prev) => {
                  const newErrors = { ...prev };
                  delete newErrors.monthsTraining;
                  return newErrors;
                });
              }
            }}
            onFocus={() => setFocusedField("monthsTraining")}
            onBlur={() => setFocusedField(null)}
            {...getInputProps("number")}
            placeholder='6'
          />
          {errors.monthsTraining && <Text style={ERROR_STYLES.text}>{errors.monthsTraining}</Text>}
        </View>

        {/* Training Frequency Field */}
        <View style={FIELD_STYLES.container}>
          <Text style={LABEL_STYLES.base}>How many days per week do you typically train? *</Text>
          <TextInput
            style={getInputStyle(
              undefined,
              getInputState(focusedField === "trainingFrequency", !!errors.trainingFrequency)
            )}
            value={assessment.trainingFrequency?.toString() || ""}
            onChangeText={(text: string) => {
              onUpdate({ trainingFrequency: text ? parseInt(text) : undefined });
              if (errors.trainingFrequency) {
                setErrors((prev) => {
                  const newErrors = { ...prev };
                  delete newErrors.trainingFrequency;
                  return newErrors;
                });
              }
            }}
            onFocus={() => setFocusedField("trainingFrequency")}
            onBlur={() => setFocusedField(null)}
            {...getInputProps("number")}
            placeholder='3'
          />
          {errors.trainingFrequency && <Text style={ERROR_STYLES.text}>{errors.trainingFrequency}</Text>}
        </View>

        {/* Current Program Field */}
        <View style={FIELD_STYLES.container}>
          <Text style={LABEL_STYLES.base}>What type of program are you currently following?</Text>
          <TextInput
            style={getInputStyle(undefined, getInputState(focusedField === "currentProgram", false))}
            value={assessment.currentProgram || ""}
            onChangeText={(text: string) => onUpdate({ currentProgram: text })}
            onFocus={() => setFocusedField("currentProgram")}
            onBlur={() => setFocusedField(null)}
            placeholder='e.g., Full body, Upper/Lower, PPL, etc.'
          />
        </View>
      </View>

      <Button onPress={validateAndNext} disabled={!canGoNext} style={styles.primaryButton}>
        Continue
      </Button>
    </View>
  );
};

const StrengthStandardsStep: React.FC<StepProps> = ({ assessment, onUpdate, onNext, canGoNext }) => {
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Unit-aware helpers
  const { isImperialWeight, isImperialHeight } = useUnitPreferences();

  const handleWeightInput = (key: keyof ExperienceLevelAssessment, text: string) => {
    if (isImperialWeight()) {
      const kg = parseDisplayWeightToKg(text);
      onUpdate({ [key]: kg != null ? Number(kg.toFixed(2)) : undefined } as any);
    } else {
      onUpdate({ [key]: text ? parseFloat(text) : undefined } as any);
    }
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Strength Assessment</Text>
      <Text style={styles.stepDescription}>
        Optional: Enter your current working weights to help us assess your strength level
      </Text>

      <View style={styles.formContainer}>
        {/* Body Weight Field */}
        <View style={FIELD_STYLES.container}>
          <Text style={LABEL_STYLES.base}>
            {isImperialWeight() ? "Current body weight (lbs)" : "Current body weight (kg)"}
          </Text>
          <TextInput
            style={getInputStyle(undefined, getInputState(focusedField === "bodyWeight", false))}
            value={
              isImperialWeight()
                ? assessment.bodyWeight
                  ? formatKgToLbsDisplay(assessment.bodyWeight).replace(" lbs", "")
                  : ""
                : assessment.bodyWeight?.toString() || ""
            }
            onChangeText={(text: string) => handleWeightInput("bodyWeight", text)}
            onFocus={() => setFocusedField("bodyWeight")}
            onBlur={() => setFocusedField(null)}
            {...getInputProps(isImperialWeight() ? undefined : "number")}
            placeholder={isImperialWeight() ? "180" : "70"}
          />
        </View>

        {/* Bench Press Weight Field */}
        <View style={FIELD_STYLES.container}>
          <Text style={LABEL_STYLES.base}>
            {isImperialWeight() ? "Bench Press working weight (lbs)" : "Bench Press working weight (kg)"}
          </Text>
          <TextInput
            style={getInputStyle(undefined, getInputState(focusedField === "benchPressWeight", false))}
            value={
              isImperialWeight()
                ? assessment.benchPressWeight
                  ? formatKgToLbsDisplay(assessment.benchPressWeight).replace(" lbs", "")
                  : ""
                : assessment.benchPressWeight?.toString() || ""
            }
            onChangeText={(text: string) => handleWeightInput("benchPressWeight", text)}
            onFocus={() => setFocusedField("benchPressWeight")}
            onBlur={() => setFocusedField(null)}
            {...getInputProps(isImperialWeight() ? undefined : "number")}
            placeholder={isImperialWeight() ? "135" : "60"}
          />
        </View>

        {/* Squat Weight Field */}
        <View style={FIELD_STYLES.container}>
          <Text style={LABEL_STYLES.base}>
            {isImperialWeight() ? "Squat working weight (lbs)" : "Squat working weight (kg)"}
          </Text>
          <TextInput
            style={getInputStyle(undefined, getInputState(focusedField === "squatWeight", false))}
            value={
              isImperialWeight()
                ? assessment.squatWeight
                  ? formatKgToLbsDisplay(assessment.squatWeight).replace(" lbs", "")
                  : ""
                : assessment.squatWeight?.toString() || ""
            }
            onChangeText={(text: string) => handleWeightInput("squatWeight", text)}
            onFocus={() => setFocusedField("squatWeight")}
            onBlur={() => setFocusedField(null)}
            {...getInputProps(isImperialWeight() ? undefined : "number")}
            placeholder={isImperialWeight() ? "176" : "80"}
          />
        </View>

        {/* Deadlift Weight Field */}
        <View style={FIELD_STYLES.container}>
          <Text style={LABEL_STYLES.base}>
            {isImperialWeight() ? "Deadlift working weight (lbs)" : "Deadlift working weight (kg)"}
          </Text>
          <TextInput
            style={getInputStyle(undefined, getInputState(focusedField === "deadliftWeight", false))}
            value={
              isImperialWeight()
                ? assessment.deadliftWeight
                  ? formatKgToLbsDisplay(assessment.deadliftWeight).replace(" lbs", "")
                  : ""
                : assessment.deadliftWeight?.toString() || ""
            }
            onChangeText={(text: string) => handleWeightInput("deadliftWeight", text)}
            onFocus={() => setFocusedField("deadliftWeight")}
            onBlur={() => setFocusedField(null)}
            {...getInputProps(isImperialWeight() ? undefined : "number")}
            placeholder={isImperialWeight() ? "220" : "100"}
          />
        </View>

        <Text style={styles.hintText}>
          💡 These are optional but help provide more accurate recommendations. Enter your typical working weight for
          5-8 reps.
        </Text>
      </View>

      <Button onPress={onNext} style={styles.primaryButton}>
        Continue
      </Button>
    </View>
  );
};

const KnowledgeAssessmentStep: React.FC<StepProps> = ({ assessment, onUpdate, onNext, canGoNext }) => {
  const knowledgeQuestions = [
    {
      key: "formConfidence" as keyof ExperienceLevelAssessment,
      question: "How confident are you with exercise form and technique?",
      scale: "1 = Very unsure, 10 = Perfect form on all exercises",
    },
    {
      key: "progressionKnowledge" as keyof ExperienceLevelAssessment,
      question: "How well do you understand progression and programming?",
      scale: "1 = No idea when/how to progress, 10 = Fully understand periodization",
    },
  ];

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Training Knowledge</Text>
      <Text style={styles.stepDescription}>Rate your understanding of key training concepts (1-10 scale)</Text>

      <View style={styles.formContainer}>
        {knowledgeQuestions.map((question) => (
          <View key={question.key} style={styles.knowledgeQuestion}>
            <Text style={styles.questionText}>{question.question}</Text>
            <Text style={styles.scaleText}>{question.scale}</Text>

            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                <Button
                  key={rating}
                  onPress={() => onUpdate({ [question.key]: rating })}
                  variant={assessment[question.key] === rating ? "primary" : "secondary"}
                  style={styles.ratingButton}>
                  {rating.toString()}
                </Button>
              ))}
            </View>
          </View>
        ))}
      </View>

      <Button onPress={onNext} disabled={!canGoNext} style={styles.primaryButton}>
        Get Recommendation
      </Button>
    </View>
  );
};

const RecommendationStep: React.FC<StepProps & { recommendation: ExperienceLevelRecommendation | null }> = ({
  recommendation,
  onNext,
}) => {
  if (!recommendation) {
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Calculating...</Text>
      </View>
    );
  }

  const levelInfo = getExperienceLevelInfo(recommendation.recommendedLevel);
  const confidencePercentage = Math.round(recommendation.confidence * 100);

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Your Recommended Level</Text>

      <View style={styles.recommendationCard}>
        <View style={styles.recommendationHeader}>
          <Text style={styles.recommendedLevel}>{levelInfo.name}</Text>
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceText}>{confidencePercentage}% confidence</Text>
          </View>
        </View>

        <Text style={styles.levelDescription}>{levelInfo.description}</Text>
        <Text style={styles.levelDuration}>Typical duration: {levelInfo.duration}</Text>

        <View style={styles.strategyContainer}>
          <Text style={styles.strategyTitle}>Your Progression Strategy:</Text>
          <Text style={styles.strategyText}>{levelInfo.progressionStrategy}</Text>
        </View>

        <View style={styles.characteristicsContainer}>
          <Text style={styles.characteristicsTitle}>What this means for you:</Text>
          {levelInfo.characteristics.map((characteristic, index) => (
            <Text key={index} style={styles.characteristicItem}>
              • {characteristic}
            </Text>
          ))}
        </View>
      </View>

      {recommendation.reasoning.length > 0 && (
        <View style={styles.reasoningContainer}>
          <Text style={styles.reasoningTitle}>Why we recommend this level:</Text>
          {recommendation.reasoning.map((reason, index) => (
            <Text key={index} style={styles.reasoningItem}>
              • {reason}
            </Text>
          ))}
        </View>
      )}

      {recommendation.alternatives && recommendation.alternatives.length > 0 && (
        <View style={styles.alternativesContainer}>
          <Text style={styles.alternativesTitle}>Alternative considerations:</Text>
          {recommendation.alternatives.map((alt, index) => (
            <View key={index} style={styles.alternativeItem}>
              <Text style={styles.alternativeLevel}>{getExperienceLevelInfo(alt.level).name}</Text>
              <Text style={styles.alternativeReason}>{alt.reason}</Text>
            </View>
          ))}
        </View>
      )}

      <Button onPress={onNext} style={styles.primaryButton}>
        Accept Recommendation
      </Button>
    </View>
  );
};

// =======================================================================ew=====
// MAIN COMPONENT
// ============================================================================

export const ExperienceLevelScreen: React.FC<ExperienceLevelScreenProps> = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { profile, updateProfile, assessExperienceLevel } = useProfile();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [assessment, setAssessment] = useState<ExperienceLevelAssessment>({});
  const [recommendation, setRecommendation] = useState<ExperienceLevelRecommendation | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const currentStep = ASSESSMENT_STEPS[currentStepIndex];
  const isFromOnboarding = (route.params as any)?.fromOnboarding || false;

  // ============================================================================
  // NAVIGATION HANDLERS
  // ============================================================================

  const handleNext = useCallback(async () => {
    if (currentStep.id === "knowledge_assessment") {
      // Generate recommendation
      const rec = assessExperienceLevel(assessment);
      setRecommendation(rec);
    } else if (currentStep.id === "recommendation") {
      // Apply the recommendation
      if (recommendation) {
        setIsUpdating(true);
        try {
          const success = await updateProfile(
            { experienceLevel: recommendation.recommendedLevel },
            { optimistic: true }
          );

          if (success) {
            logger.info(
              "Experience level updated",
              {
                level: recommendation.recommendedLevel,
                confidence: recommendation.confidence,
              },
              "profile"
            );

            if (isFromOnboarding) {
              navigation.navigate("ProfileSetup" as never);
            } else {
              navigation.goBack();
            }
          } else {
            Alert.alert("Error", "Failed to update experience level. Please try again.");
          }
        } catch (error) {
          logger.error("Experience level update error", error, "profile");
          Alert.alert("Error", "An unexpected error occurred. Please try again.");
        } finally {
          setIsUpdating(false);
        }
      }
      return;
    }

    if (currentStepIndex < ASSESSMENT_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [
    currentStepIndex,
    currentStep.id,
    assessment,
    recommendation,
    updateProfile,
    assessExperienceLevel,
    navigation,
    isFromOnboarding,
  ]);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    } else {
      navigation.goBack();
    }
  }, [currentStepIndex, navigation]);

  // ============================================================================
  // VALIDATION
  // ============================================================================

  const canGoNext = useCallback(() => {
    switch (currentStep.id) {
      case "training_history":
        return !!(assessment.monthsTraining && assessment.trainingFrequency);
      case "strength_standards":
        return true; // Optional step
      case "knowledge_assessment":
        return !!(assessment.formConfidence && assessment.progressionKnowledge);
      case "recommendation":
        return !!recommendation;
      default:
        return false;
    }
  }, [currentStep.id, assessment, recommendation]);

  // ============================================================================
  // STEP COMPONENT RENDERING
  // ============================================================================

  const renderStepComponent = () => {
    const stepProps = {
      assessment,
      onUpdate: (updates: Partial<ExperienceLevelAssessment>) => setAssessment((prev) => ({ ...prev, ...updates })),
      onNext: handleNext,
      onBack: handleBack,
      canGoNext: canGoNext(),
      isFirst: currentStepIndex === 0,
      isLast: currentStepIndex === ASSESSMENT_STEPS.length - 1,
    };

    switch (currentStep.component) {
      case "TrainingHistoryStep":
        return <TrainingHistoryStep {...stepProps} />;
      case "StrengthStandardsStep":
        return <StrengthStandardsStep {...stepProps} />;
      case "KnowledgeAssessmentStep":
        return <KnowledgeAssessmentStep {...stepProps} />;
      case "RecommendationStep":
        return <RecommendationStep {...stepProps} recommendation={recommendation} />;
      default:
        return null;
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isUpdating) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Updating your experience level...</Text>
          <LoadingButton loading={true}>Updating...</LoadingButton>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {/* Header */}
        <View style={styles.header}>
          <Button onPress={handleBack} variant='secondary' style={styles.headerButton}>
            Back
          </Button>
          <Text style={styles.headerTitle}>Experience Assessment</Text>
          <View style={styles.headerButton} />
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${((currentStepIndex + 1) / ASSESSMENT_STEPS.length) * 100}%` }]}
            />
          </View>
          <Text style={styles.progressText}>
            Step {currentStepIndex + 1} of {ASSESSMENT_STEPS.length}
          </Text>
        </View>

        {/* Step Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}>
          {renderStepComponent()}
        </ScrollView>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  headerButton: {
    minWidth: 80,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
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
  hintText: {
    fontSize: 15,
    color: "#8E8E93",
    fontStyle: "italic",
    marginTop: 16,
    lineHeight: 20,
  },
  knowledgeQuestion: {
    marginBottom: 32,
  },
  questionText: {
    fontSize: 17,
    fontWeight: "500",
    color: "#1C1C1E",
    marginBottom: 8,
  },
  scaleText: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 16,
    lineHeight: 18,
  },
  ratingContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  ratingButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  recommendationCard: {
    backgroundColor: "#F8FAFD",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#B5CFF8",
  },
  recommendationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  recommendedLevel: {
    fontSize: 24,
    fontWeight: "700",
    color: "#B5CFF8",
  },
  confidenceBadge: {
    backgroundColor: "#34C759",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  levelDescription: {
    fontSize: 17,
    color: "#1C1C1E",
    marginBottom: 8,
    lineHeight: 22,
  },
  levelDuration: {
    fontSize: 15,
    color: "#8E8E93",
    marginBottom: 16,
  },
  strategyContainer: {
    marginBottom: 16,
  },
  strategyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 8,
  },
  strategyText: {
    fontSize: 15,
    color: "#B5CFF8",
    fontWeight: "500",
    lineHeight: 20,
  },
  characteristicsContainer: {
    marginBottom: 16,
  },
  characteristicsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 8,
  },
  characteristicItem: {
    fontSize: 15,
    color: "#1C1C1E",
    marginBottom: 4,
    lineHeight: 20,
  },
  reasoningContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F2F2F7",
  },
  reasoningTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 8,
  },
  reasoningItem: {
    fontSize: 15,
    color: "#8E8E93",
    marginBottom: 4,
    lineHeight: 20,
  },
  alternativesContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#F2F2F7",
  },
  alternativesTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 12,
  },
  alternativeItem: {
    marginBottom: 8,
  },
  alternativeLevel: {
    fontSize: 15,
    fontWeight: "500",
    color: "#B5CFF8",
  },
  alternativeReason: {
    fontSize: 13,
    color: "#8E8E93",
    lineHeight: 18,
  },
  primaryButton: {
    marginTop: "auto",
  },
});

export default ExperienceLevelScreen;
