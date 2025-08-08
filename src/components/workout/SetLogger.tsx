// ============================================================================
// SET LOGGER COMPONENT
// ============================================================================
// Set logging with weight/reps/RPE input, thumb-friendly controls,
// and haptic feedback

import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ViewStyle } from "react-native";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import RPESelector from "./RPESelector";
import { Button } from "../ui/Button";
import { logger } from "../../utils/logger";
import {
  getInputStyle,
  getInputState,
  getInputProps,
  FIELD_STYLES,
  LABEL_STYLES,
  ERROR_STYLES,
} from "../../styles/inputStyles";
import type { ExerciseSetFormData } from "../../types";

// ============================================================================
// TYPES
// ============================================================================

interface SetLoggerProps {
  exerciseId: string;
  setNumber: number;
  suggestedWeight?: number;
  onSetComplete: (setData: ExerciseSetFormData) => void;
  isFirstSet: boolean;
  style?: ViewStyle;
}

interface SetLoggerState {
  weight: string;
  reps: string;
  rpe: number | null;
  isWarmup: boolean;
  restSeconds: number;
  notes: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary: "#B5CFF8",
  success: "#34C759",
  warning: "#FF9500",
  error: "#FF3B30",
  text: "#1C1C1E",
  textSecondary: "#8E8E93",
  background: "#FFFFFF",
  backgroundLight: "#F8FAFD",
} as const;

const DEFAULT_REST_TIMES = {
  warmup: 60, // 1 minute
  working: 180, // 3 minutes
  heavy: 300, // 5 minutes
} as const;

// ============================================================================
// COMPONENT
// ============================================================================

export const SetLogger: React.FC<SetLoggerProps> = ({
  exerciseId,
  setNumber,
  suggestedWeight,
  onSetComplete,
  isFirstSet,
  style,
}) => {
  // ============================================================================
  // HOOKS & STATE
  // ============================================================================

  const { triggerHaptic, triggerSetCompleteHaptic } = useHapticFeedback();

  const [state, setState] = useState<SetLoggerState>({
    weight: suggestedWeight ? suggestedWeight.toString() : "",
    reps: "",
    rpe: null,
    isWarmup: false,
    restSeconds: DEFAULT_REST_TIMES.working,
    notes: "",
  });

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showRPESelector, setShowRPESelector] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs for input focus management
  const weightInputRef = useRef<TextInput>(null);
  const repsInputRef = useRef<TextInput>(null);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Update suggested weight when it changes
  useEffect(() => {
    if (suggestedWeight && !state.weight) {
      setState((prev) => ({ ...prev, weight: suggestedWeight.toString() }));
    }
  }, [suggestedWeight, state.weight]);

  // Auto-focus weight input on first set
  useEffect(() => {
    if (isFirstSet && weightInputRef.current) {
      setTimeout(() => {
        weightInputRef.current?.focus();
      }, 500);
    }
  }, [isFirstSet]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleWeightChange = useCallback(
    (value: string) => {
      // Allow decimal numbers
      const numericValue = value.replace(/[^0-9.]/g, "");
      setState((prev) => ({ ...prev, weight: numericValue }));

      // Clear weight error if exists
      if (errors.weight) {
        setErrors((prev) => ({ ...prev, weight: "" }));
      }
    },
    [errors.weight]
  );

  const handleRepsChange = useCallback(
    (value: string) => {
      // Allow only integers
      const numericValue = value.replace(/[^0-9]/g, "");
      setState((prev) => ({ ...prev, reps: numericValue }));

      // Clear reps error if exists
      if (errors.reps) {
        setErrors((prev) => ({ ...prev, reps: "" }));
      }
    },
    [errors.reps]
  );

  const handleWeightAdjust = useCallback(
    async (increment: number) => {
      await triggerHaptic("light");

      const currentWeight = parseFloat(state.weight) || 0;
      const newWeight = Math.max(0, currentWeight + increment);
      setState((prev) => ({ ...prev, weight: newWeight.toString() }));

      logger.debug(
        "Weight adjusted",
        {
          exerciseId,
          from: currentWeight,
          to: newWeight,
          increment,
        },
        "workout"
      );
    },
    [state.weight, exerciseId, triggerHaptic]
  );

  const handleRepsAdjust = useCallback(
    async (increment: number) => {
      await triggerHaptic("light");

      const currentReps = parseInt(state.reps) || 0;
      const newReps = Math.max(0, currentReps + increment);
      setState((prev) => ({ ...prev, reps: newReps.toString() }));

      logger.debug(
        "Reps adjusted",
        {
          exerciseId,
          from: currentReps,
          to: newReps,
          increment,
        },
        "workout"
      );
    },
    [state.reps, exerciseId, triggerHaptic]
  );

  const handleRPESelect = useCallback(
    async (rpe: number) => {
      await triggerHaptic("medium");
      setState((prev) => ({ ...prev, rpe }));
      setShowRPESelector(false);

      // Auto-adjust rest time based on RPE
      let restTime: number = DEFAULT_REST_TIMES.working;
      if (rpe >= 9) {
        restTime = DEFAULT_REST_TIMES.heavy; // Longer rest for high RPE
      } else if (rpe <= 6) {
        restTime = DEFAULT_REST_TIMES.warmup; // Shorter rest for low RPE
      }

      setState((prev) => ({ ...prev, restSeconds: restTime }));

      logger.debug("RPE selected", { exerciseId, rpe, restTime }, "workout");
    },
    [exerciseId, triggerHaptic]
  );

  const handleWarmupToggle = useCallback(async () => {
    await triggerHaptic("light");

    setState((prev) => ({
      ...prev,
      isWarmup: !prev.isWarmup,
      restSeconds: !prev.isWarmup ? DEFAULT_REST_TIMES.warmup : DEFAULT_REST_TIMES.working,
    }));

    logger.debug("Warmup toggled", { exerciseId, isWarmup: !state.isWarmup }, "workout");
  }, [exerciseId, state.isWarmup, triggerHaptic]);

  const validateForm = useCallback((): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Validate reps (required)
    if (!state.reps || parseInt(state.reps) <= 0) {
      newErrors.reps = "Reps are required";
    } else if (parseInt(state.reps) > 100) {
      newErrors.reps = "Reps seem too high";
    }

    // Validate weight (optional but if provided, must be valid)
    if (state.weight && (parseFloat(state.weight) < 0 || parseFloat(state.weight) > 1000)) {
      newErrors.weight = "Weight must be between 0-1000kg";
    }

    // Validate RPE for working sets
    if (!state.isWarmup && !state.rpe) {
      newErrors.rpe = "RPE is required for working sets";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [state]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;

    if (!validateForm()) {
      await triggerHaptic("error");
      return;
    }

    try {
      setIsSubmitting(true);
      await triggerSetCompleteHaptic();

      const setData: ExerciseSetFormData = {
        exerciseId,
        weightKg: state.weight ? parseFloat(state.weight) : undefined,
        reps: parseInt(state.reps),
        rpe: state.rpe || undefined,
        isWarmup: state.isWarmup,
        restSeconds: state.restSeconds,
        notes: state.notes.trim() || undefined,
      };

      onSetComplete(setData);

      // Reset form for next set
      setState((prev) => ({
        weight: prev.weight, // Keep weight for next set
        reps: "",
        rpe: null,
        isWarmup: false,
        restSeconds: DEFAULT_REST_TIMES.working,
        notes: "",
      }));

      setShowRPESelector(false);
      setErrors({});

      logger.info(
        "Set logged successfully",
        {
          exerciseId,
          setNumber,
          weight: setData.weightKg,
          reps: setData.reps,
          rpe: setData.rpe,
          isWarmup: setData.isWarmup,
        },
        "workout"
      );
    } catch (error) {
      logger.error("Failed to log set", error, "workout");
      Alert.alert("Error", "Failed to log set. Please try again.");
      await triggerHaptic("error");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    validateForm,
    triggerSetCompleteHaptic,
    triggerHaptic,
    exerciseId,
    setNumber,
    state,
    onSetComplete,
  ]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderWeightInput = () => (
    <View style={FIELD_STYLES.container}>
      <Text style={LABEL_STYLES.base}>Weight (kg)</Text>
      <View style={styles.inputWithControls}>
        <TouchableOpacity
          style={styles.adjustButton}
          onPress={() => handleWeightAdjust(-2.5)}
          accessibilityLabel='Decrease weight by 2.5kg'>
          <Text style={styles.adjustButtonText}>-2.5</Text>
        </TouchableOpacity>

        <TextInput
          ref={weightInputRef}
          style={getInputStyle("rpe", getInputState(focusedField === "weight", !!errors.weight))}
          value={state.weight}
          onChangeText={handleWeightChange}
          onFocus={() => setFocusedField("weight")}
          onBlur={() => setFocusedField(null)}
          placeholder='0'
          {...getInputProps("number")}
          accessibilityLabel='Exercise weight in kilograms'
        />

        <TouchableOpacity
          style={styles.adjustButton}
          onPress={() => handleWeightAdjust(2.5)}
          accessibilityLabel='Increase weight by 2.5kg'>
          <Text style={styles.adjustButtonText}>+2.5</Text>
        </TouchableOpacity>
      </View>
      {errors.weight && <Text style={ERROR_STYLES.text}>{errors.weight}</Text>}
    </View>
  );

  const renderRepsInput = () => (
    <View style={FIELD_STYLES.container}>
      <Text style={LABEL_STYLES.base}>Reps *</Text>
      <View style={styles.inputWithControls}>
        <TouchableOpacity
          style={styles.adjustButton}
          onPress={() => handleRepsAdjust(-1)}
          accessibilityLabel='Decrease reps by 1'>
          <Text style={styles.adjustButtonText}>-1</Text>
        </TouchableOpacity>

        <TextInput
          ref={repsInputRef}
          style={getInputStyle("rpe", getInputState(focusedField === "reps", !!errors.reps))}
          value={state.reps}
          onChangeText={handleRepsChange}
          onFocus={() => setFocusedField("reps")}
          onBlur={() => setFocusedField(null)}
          placeholder='0'
          {...getInputProps("number")}
          accessibilityLabel='Number of repetitions'
        />

        <TouchableOpacity
          style={styles.adjustButton}
          onPress={() => handleRepsAdjust(1)}
          accessibilityLabel='Increase reps by 1'>
          <Text style={styles.adjustButtonText}>+1</Text>
        </TouchableOpacity>
      </View>
      {errors.reps && <Text style={ERROR_STYLES.text}>{errors.reps}</Text>}
    </View>
  );

  const renderRPEInput = () => (
    <View style={FIELD_STYLES.container}>
      <Text style={LABEL_STYLES.base}>RPE {!state.isWarmup && <Text style={LABEL_STYLES.required}>*</Text>}</Text>

      <TouchableOpacity
        style={[
          styles.rpeButton,
          state.rpe ? styles.rpeButtonSelected : null,
          errors.rpe ? styles.rpeButtonError : null,
        ]}
        onPress={() => setShowRPESelector(true)}
        accessibilityLabel={state.rpe ? `RPE ${state.rpe} selected` : "Select RPE"}>
        <Text style={[styles.rpeButtonText, state.rpe ? styles.rpeButtonTextSelected : null]}>
          {state.rpe ? `RPE ${state.rpe}` : "Select RPE"}
        </Text>
        <Text style={styles.rpeButtonArrow}>▼</Text>
      </TouchableOpacity>

      {errors.rpe && <Text style={ERROR_STYLES.text}>{errors.rpe}</Text>}
    </View>
  );

  const renderWarmupToggle = () => (
    <TouchableOpacity
      style={[styles.warmupToggle, state.isWarmup && styles.warmupToggleActive]}
      onPress={handleWarmupToggle}
      accessibilityLabel={`${state.isWarmup ? "Disable" : "Enable"} warmup set`}
      accessibilityRole='switch'
      accessibilityState={{ checked: state.isWarmup }}>
      <Text style={[styles.warmupToggleText, state.isWarmup && styles.warmupToggleTextActive]}>🔥 Warmup Set</Text>
    </TouchableOpacity>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.setTitle}>Set {setNumber}</Text>
        {suggestedWeight && <Text style={styles.suggestion}>Suggested: {suggestedWeight}kg</Text>}
      </View>

      {renderWarmupToggle()}

      <View style={styles.inputRow}>
        <View style={styles.inputColumn}>{renderWeightInput()}</View>
        <View style={styles.inputColumn}>{renderRepsInput()}</View>
      </View>

      {renderRPEInput()}

      <Button
        variant='primary'
        onPress={handleSubmit}
        disabled={isSubmitting}
        style={styles.logButton}
        accessibilityLabel={`Log set ${setNumber}`}>
        <Text style={styles.logButtonText}>{isSubmitting ? "Logging..." : `Log Set ${setNumber}`}</Text>
      </Button>

      {showRPESelector && (
        <RPESelector onSelect={handleRPESelect} onClose={() => setShowRPESelector(false)} selectedRPE={state.rpe} />
      )}
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  setTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },

  suggestion: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "500",
  },

  warmupToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.textSecondary,
    marginBottom: 20,
  },

  warmupToggleActive: {
    borderColor: COLORS.warning,
    backgroundColor: "rgba(255, 149, 0, 0.1)",
  },

  warmupToggleText: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },

  warmupToggleTextActive: {
    color: COLORS.warning,
  },

  inputRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 20,
  },

  inputColumn: {
    flex: 1,
  },

  inputWithControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  adjustButton: {
    width: 60,
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.textSecondary,
  },

  adjustButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },

  rpeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.textSecondary,
    backgroundColor: COLORS.background,
  },

  rpeButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(181, 207, 248, 0.1)",
  },

  rpeButtonError: {
    borderColor: COLORS.error,
    backgroundColor: "rgba(255, 59, 48, 0.05)",
  },

  rpeButtonText: {
    fontSize: 17,
    color: COLORS.textSecondary,
  },

  rpeButtonTextSelected: {
    color: COLORS.primary,
    fontWeight: "600",
  },

  rpeButtonArrow: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  logButton: {
    height: 56,
    marginTop: 20,
  },

  logButtonText: {
    fontSize: 18,
    fontWeight: "700",
  },
});

export default SetLogger;
