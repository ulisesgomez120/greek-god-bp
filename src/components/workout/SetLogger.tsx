// ============================================================================
// SET LOGGER COMPONENT
// ============================================================================
// Improved set logging with direct inputs, auto-population, and compact design

import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ViewStyle } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
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
  suggestedReps?: number;
  // onSetComplete now returns a Promise with the workout service result so callers can await persistence
  onSetComplete: (setData: ExerciseSetFormData) => Promise<any>;
  isFirstSet: boolean;
  // Optional externally-controlled submitting state (Phase 2 compatibility)
  isSubmitting?: boolean;
  style?: ViewStyle;
}

interface SetLoggerState {
  weight: string;
  reps: string;
  rpe: string;
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
  suggestedReps,
  onSetComplete,
  isFirstSet,
  // rename prop locally to avoid collision with internal state
  isSubmitting: isSubmittingProp,
  style,
}) => {
  // ============================================================================
  // HOOKS & STATE
  // ============================================================================

  const { triggerHaptic, triggerSetCompleteHaptic } = useHapticFeedback();

  const [state, setState] = useState<SetLoggerState>({
    weight: suggestedWeight ? suggestedWeight.toString() : "",
    reps: suggestedReps ? suggestedReps.toString() : "",
    rpe: "",
    isWarmup: false,
    restSeconds: DEFAULT_REST_TIMES.working,
    notes: "",
  });

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showRPESelector, setShowRPESelector] = useState(false);
  // Local submitting state used only if parent doesn't control isSubmitting.
  const [isLocalSubmitting, setIsLocalSubmitting] = useState(false);
  // Effective submitting flag: prefer prop when provided (online-first UI control), otherwise use local state.
  const submitting = typeof isSubmittingProp !== "undefined" ? isSubmittingProp : isLocalSubmitting;

  // Refs for input focus management
  const weightInputRef = useRef<TextInput>(null);
  const repsInputRef = useRef<TextInput>(null);
  const rpeInputRef = useRef<TextInput>(null);
  const notesInputRef = useRef<TextInput>(null);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Update suggested values when they change (apply only when the input is empty;
  // do not override user edits while they are typing or when there is already a value)
  useEffect(() => {
    if (typeof suggestedWeight !== "undefined" && state.weight === "") {
      setState((prev) => ({ ...prev, weight: suggestedWeight.toString() }));
    }
    if (typeof suggestedReps !== "undefined" && state.reps === "") {
      setState((prev) => ({ ...prev, reps: suggestedReps.toString() }));
    }
    // Only depend on suggestions; avoid re-running due to state changes that happen while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedWeight, suggestedReps]);

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
      // Allow decimal numbers and allow empty string so deletion works
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
      // Allow only integers and allow empty string so deletion works
      const numericValue = value.replace(/[^0-9]/g, "");
      setState((prev) => ({ ...prev, reps: numericValue }));

      // Clear reps error if exists
      if (errors.reps) {
        setErrors((prev) => ({ ...prev, reps: "" }));
      }
    },
    [errors.reps]
  );

  const handleRPEChange = useCallback(
    (value: string) => {
      // Allow only numbers 1-10 or empty string
      const numericValue = value.replace(/[^0-9]/g, "");
      const rpeNumber = parseInt(numericValue);

      if (numericValue === "" || (rpeNumber >= 1 && rpeNumber <= 10)) {
        setState((prev) => ({ ...prev, rpe: numericValue }));

        // Auto-adjust rest time based on RPE
        if (!isNaN(rpeNumber)) {
          let restTime: number = DEFAULT_REST_TIMES.working;
          if (rpeNumber >= 9) {
            restTime = DEFAULT_REST_TIMES.heavy; // Longer rest for high RPE
          } else if (rpeNumber <= 6) {
            restTime = DEFAULT_REST_TIMES.warmup; // Shorter rest for low RPE
          }
          setState((prev) => ({ ...prev, restSeconds: restTime }));
        }
      }

      // Clear RPE error if exists
      if (errors.rpe) {
        setErrors((prev) => ({ ...prev, rpe: "" }));
      }
    },
    [errors.rpe]
  );

  const handleNotesChange = useCallback((value: string) => {
    setState((prev) => ({ ...prev, notes: value }));
  }, []);

  const handleWarmupToggle = useCallback(async () => {
    await triggerHaptic("light");

    setState((prev) => ({
      ...prev,
      isWarmup: !prev.isWarmup,
      restSeconds: !prev.isWarmup ? DEFAULT_REST_TIMES.warmup : DEFAULT_REST_TIMES.working,
    }));

    logger.debug("Warmup toggled", { exerciseId, isWarmup: !state.isWarmup }, "workout");
  }, [exerciseId, state.isWarmup, triggerHaptic]);

  const handleRPEInfoPress = useCallback(async () => {
    await triggerHaptic("light");
    setShowRPESelector(true);
  }, [triggerHaptic]);

  const handleRPESelect = useCallback(
    async (rpe: number) => {
      await triggerHaptic("medium");
      setState((prev) => ({ ...prev, rpe: rpe.toString() }));
      setShowRPESelector(false);

      // Auto-adjust rest time based on RPE
      let restTime: number = DEFAULT_REST_TIMES.working;
      if (rpe >= 9) {
        restTime = DEFAULT_REST_TIMES.heavy;
      } else if (rpe <= 6) {
        restTime = DEFAULT_REST_TIMES.warmup;
      }

      setState((prev) => ({ ...prev, restSeconds: restTime }));
      logger.debug("RPE selected", { exerciseId, rpe, restTime }, "workout");
    },
    [exerciseId, triggerHaptic]
  );

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
    if (!state.isWarmup && (!state.rpe || parseInt(state.rpe) < 1 || parseInt(state.rpe) > 10)) {
      newErrors.rpe = "RPE (1-10) is required for working sets";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [state]);

  const handleSubmit = useCallback(async () => {
    // Prevent duplicate submissions whether controlled externally or using local state.
    if (submitting) return;

    if (!validateForm()) {
      await triggerHaptic("error");
      return;
    }

    try {
      // If parent did not provide isSubmitting, manage local submitting state.
      if (typeof isSubmittingProp === "undefined") {
        setIsLocalSubmitting(true);
      }

      await triggerSetCompleteHaptic();

      const setData: ExerciseSetFormData = {
        exerciseId,
        weightKg: state.weight ? parseFloat(state.weight) : undefined,
        reps: parseInt(state.reps),
        rpe: state.rpe ? parseInt(state.rpe) : undefined,
        isWarmup: state.isWarmup,
        restSeconds: state.restSeconds,
        notes: state.notes.trim() || undefined,
      };

      // Await the persistence result from the parent handler (ExerciseDetailScreen)
      const result = await onSetComplete(setData);

      if (!result || !result.success) {
        // Persistence failed — inform user and keep inputs intact
        await triggerHaptic("error");
        Alert.alert("Error", result?.error || "Failed to save set. Please try again.");
        return;
      }

      // Success: reset only the fields we want to clear while keeping weight/reps for convenience
      setState((prev) => ({
        weight: prev.weight, // Keep weight for next set
        reps: prev.reps, // Keep reps for next set
        rpe: "", // Reset RPE (user should consciously choose)
        isWarmup: false, // Reset warmup
        restSeconds: DEFAULT_REST_TIMES.working,
        notes: "", // Reset notes
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
      if (typeof isSubmittingProp === "undefined") {
        setIsLocalSubmitting(false);
      }
    }
  }, [
    // do not include internal local state setter in deps; include external prop if referenced
    validateForm,
    triggerSetCompleteHaptic,
    triggerHaptic,
    exerciseId,
    setNumber,
    state,
    onSetComplete,
    isSubmittingProp,
  ]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.setTitle}>Log</Text>
      <TouchableOpacity
        style={[styles.warmupBadge, state.isWarmup && styles.warmupBadgeActive]}
        onPress={handleWarmupToggle}
        accessibilityLabel={`${state.isWarmup ? "Disable" : "Enable"} warmup set`}
        accessibilityRole='switch'
        accessibilityState={{ checked: state.isWarmup }}>
        <Text style={[styles.warmupBadgeText, state.isWarmup && styles.warmupBadgeTextActive]}>WARMUP</Text>
      </TouchableOpacity>
    </View>
  );

  const renderInputs = () => (
    <View style={styles.inputsContainer}>
      {/* Weight and Reps Row */}
      <View style={styles.inputRow}>
        <View style={[FIELD_STYLES.container, styles.inputColumn]}>
          <Text style={LABEL_STYLES.base}>Weight (kg)</Text>
          <TextInput
            ref={weightInputRef}
            style={getInputStyle(undefined, getInputState(focusedField === "weight", !!errors.weight))}
            value={state.weight}
            onChangeText={handleWeightChange}
            onFocus={() => setFocusedField("weight")}
            onBlur={() => setFocusedField(null)}
            placeholder='0'
            {...getInputProps("number")}
            accessibilityLabel='Exercise weight in kilograms'
          />
          {errors.weight && <Text style={ERROR_STYLES.text}>{errors.weight}</Text>}
        </View>

        <View style={[FIELD_STYLES.container, styles.inputColumn]}>
          <Text style={LABEL_STYLES.base}>Reps *</Text>
          <TextInput
            ref={repsInputRef}
            style={getInputStyle(undefined, getInputState(focusedField === "reps", !!errors.reps))}
            value={state.reps}
            onChangeText={handleRepsChange}
            onFocus={() => setFocusedField("reps")}
            onBlur={() => setFocusedField(null)}
            placeholder='0'
            {...getInputProps("number")}
            accessibilityLabel='Number of repetitions'
          />
          {errors.reps && <Text style={ERROR_STYLES.text}>{errors.reps}</Text>}
        </View>
      </View>

      {/* RPE Row */}
      <View style={FIELD_STYLES.container}>
        <View style={styles.rpeHeader}>
          <Text style={LABEL_STYLES.base}>RPE {!state.isWarmup && <Text style={LABEL_STYLES.required}>*</Text>}</Text>
          <TouchableOpacity style={styles.infoButton} onPress={handleRPEInfoPress} accessibilityLabel='RPE information'>
            <Icon name='info' size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
        <TextInput
          ref={rpeInputRef}
          style={getInputStyle(undefined, getInputState(focusedField === "rpe", !!errors.rpe))}
          value={state.rpe}
          onChangeText={handleRPEChange}
          onFocus={() => setFocusedField("rpe")}
          onBlur={() => setFocusedField(null)}
          placeholder='1-10'
          {...getInputProps("number")}
          accessibilityLabel='Rate of perceived exertion from 1 to 10'
        />
        {errors.rpe && <Text style={ERROR_STYLES.text}>{errors.rpe}</Text>}
      </View>

      {/* Notes Row */}
      <View style={FIELD_STYLES.container}>
        <Text style={LABEL_STYLES.base}>Notes</Text>
        <TextInput
          ref={notesInputRef}
          style={getInputStyle("textarea", getInputState(focusedField === "notes", false))}
          value={state.notes}
          onChangeText={handleNotesChange}
          onFocus={() => setFocusedField("notes")}
          onBlur={() => setFocusedField(null)}
          placeholder='Optional notes about this set...'
          multiline
          numberOfLines={2}
          textAlignVertical='top'
          accessibilityLabel='Optional notes for this set'
        />
      </View>
    </View>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <View style={[styles.container, style]}>
      {renderHeader()}
      {renderInputs()}

      <Button
        variant='primary'
        onPress={handleSubmit}
        disabled={submitting}
        style={styles.logButton}
        accessibilityLabel={`Log set`}>
        <Text style={styles.logButtonText}>{submitting ? "Logging..." : `Log Set`}</Text>
      </Button>

      {showRPESelector && (
        <RPESelector
          onSelect={handleRPESelect}
          onClose={() => setShowRPESelector(false)}
          selectedRPE={state.rpe ? parseInt(state.rpe) : null}
        />
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
    marginBottom: 20,
  },

  setTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },

  warmupBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.textSecondary,
    backgroundColor: "transparent",
  },

  warmupBadgeActive: {
    borderColor: COLORS.warning,
    backgroundColor: "rgba(255, 149, 0, 0.1)",
  },

  warmupBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },

  warmupBadgeTextActive: {
    color: COLORS.warning,
  },

  inputsContainer: {
    marginBottom: 20,
  },

  inputRow: {
    flexDirection: "row",
    gap: 16,
  },

  inputColumn: {
    flex: 1,
  },

  rpeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  infoButton: {
    marginLeft: 8,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  infoButtonText: {
    fontSize: 14,
  },

  logButton: {
    height: 56,
  },

  logButtonText: {
    fontSize: 18,
    fontWeight: "700",
  },
});

export default SetLogger;
