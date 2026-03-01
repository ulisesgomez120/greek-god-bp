import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, View, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import Text from "@/components/ui/Text";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import useTheme from "@/hooks/useTheme";
import useUnitPreferences from "@/hooks/useUnitPreferences";
import { kgToLbs, parseDisplayWeightToKg, roundToNearest } from "@/utils/unitConversions";
import {
  getInputProps,
  getInputState,
  getInputStyle,
  FIELD_STYLES,
  LABEL_STYLES,
  ERROR_STYLES,
} from "@/styles/inputStyles";
import type { ExerciseSet } from "@/types";

type Props = {
  visible: boolean;
  setLabel?: string;
  initialSet: {
    id: string;
    weightKg?: number;
    reps: number;
    rpe?: number;
    notes?: string;
    isWarmup: boolean;
  } | null;
  onClose: () => void;
  onSave: (setId: string, updates: Partial<ExerciseSet>) => Promise<{ success: boolean; error?: string }>;
};

type FormState = {
  weight: string;
  reps: string;
  rpe: string;
  notes: string;
  isWarmup: boolean;
};

export default function EditExerciseSetModal({ visible, setLabel, initialSet, onClose, onSave }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isImperial } = useUnitPreferences();

  const [state, setState] = useState<FormState>({
    weight: "",
    reps: "",
    rpe: "",
    notes: "",
    isWarmup: false,
  });

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const weightLabel = isImperial() ? "Weight (lbs)" : "Weight (kg)";

  useEffect(() => {
    if (!visible) return;
    if (!initialSet) return;

    const displayWeight = (() => {
      if (!initialSet.weightKg) return "";
      if (isImperial()) return String(roundToNearest(kgToLbs(initialSet.weightKg), 0.5));
      return String(initialSet.weightKg);
    })();

    setState({
      weight: displayWeight,
      reps: String(initialSet.reps ?? ""),
      rpe: initialSet.rpe ? String(initialSet.rpe) : "",
      notes: initialSet.notes ?? "",
      isWarmup: !!initialSet.isWarmup,
    });
    setErrors({});
    setFocusedField(null);
  }, [visible, initialSet, isImperial]);

  const validate = useCallback(() => {
    const next: Record<string, string> = {};

    // reps required
    if (!state.reps || parseInt(state.reps, 10) <= 0) {
      next.reps = "Reps are required";
    } else if (parseInt(state.reps, 10) > 100) {
      next.reps = "Reps seem too high";
    }

    // weight optional
    if (state.weight) {
      const maxKg = 1000;
      const kgVal = isImperial() ? parseDisplayWeightToKg(state.weight) : parseFloat(state.weight);
      if (kgVal == null || isNaN(kgVal) || kgVal < 0 || kgVal > maxKg) {
        next.weight = isImperial()
          ? `Weight must be between 0 and ${roundToNearest(kgToLbs(maxKg), 0.5)} lbs`
          : `Weight must be between 0 and ${maxKg}kg`;
      }
    }

    // rpe required for working sets
    if (!state.isWarmup) {
      const rpeVal = state.rpe ? parseInt(state.rpe, 10) : NaN;
      if (!state.rpe || isNaN(rpeVal) || rpeVal < 1 || rpeVal > 10) {
        next.rpe = "RPE (1-10) is required for working sets";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [state, isImperial]);

  const handleSave = useCallback(async () => {
    if (!initialSet?.id) {
      Alert.alert("Unable to edit", "This set is missing an id.");
      return;
    }

    if (!validate()) return;

    // Convert display weight to kg
    let weightKgValue: number | undefined = undefined;
    if (state.weight) {
      if (isImperial()) {
        const parsed = parseDisplayWeightToKg(state.weight);
        weightKgValue = parsed ?? undefined;
      } else {
        const parsed = parseFloat(state.weight);
        weightKgValue = isNaN(parsed) ? undefined : parsed;
      }
    }

    const updates: Partial<ExerciseSet> = {
      weightKg: typeof weightKgValue === "number" ? weightKgValue : undefined,
      reps: parseInt(state.reps, 10),
      rpe: state.isWarmup ? undefined : state.rpe ? parseInt(state.rpe, 10) : undefined,
      notes: state.notes.trim() ? state.notes.trim() : undefined,
      isWarmup: state.isWarmup,
    };

    try {
      setLoading(true);
      const res = await onSave(initialSet.id, updates);
      setLoading(false);

      if (res?.success) {
        onClose();
      } else {
        Alert.alert("Unable to save", res?.error || "An unknown error occurred");
      }
    } catch (e: any) {
      setLoading(false);
      Alert.alert("Error", e?.message || "Failed to save changes");
    }
  }, [initialSet, isImperial, onClose, onSave, state, validate]);

  const handleToggleWarmup = useCallback(() => {
    setState((prev) => ({ ...prev, isWarmup: !prev.isWarmup }));
    // clear rpe error if switching to warmup
    if (!state.isWarmup) {
      setErrors((prev) => ({ ...prev, rpe: "" }));
    }
  }, [state.isWarmup]);

  return (
    <Modal visible={visible} animationType='slide' onRequestClose={onClose} transparent={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text variant='h2' color='primary' style={styles.title}>
            {setLabel ? `Edit ${setLabel}` : "Edit Set"}
          </Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel='Close edit modal' style={styles.closeButton}>
            <Icon name='close' size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Warmup toggle */}
        <TouchableOpacity
          style={[styles.warmupBadge, state.isWarmup && styles.warmupBadgeActive]}
          onPress={handleToggleWarmup}
          accessibilityRole='switch'
          accessibilityState={{ checked: state.isWarmup }}
          accessibilityLabel={state.isWarmup ? "Disable warmup" : "Enable warmup"}>
          <Text style={[styles.warmupBadgeText, state.isWarmup && styles.warmupBadgeTextActive]}>WARMUP</Text>
        </TouchableOpacity>

        {/* Inputs */}
        <View style={styles.inputs}>
          <View style={styles.inputRow}>
            <View style={[FIELD_STYLES.container, styles.inputColumn]}>
              <Text style={[LABEL_STYLES.base, { color: colors.subtext }]}>{weightLabel}</Text>
              <TextInput
                style={getInputStyle(colors, undefined, getInputState(focusedField === "weight", !!errors.weight))}
                value={state.weight}
                onChangeText={(v) => {
                  const numericValue = v.replace(/[^0-9.]/g, "");
                  setState((prev) => ({ ...prev, weight: numericValue }));
                  if (errors.weight) setErrors((prev) => ({ ...prev, weight: "" }));
                }}
                onFocus={() => setFocusedField("weight")}
                onBlur={() => setFocusedField(null)}
                placeholder='0'
                {...getInputProps("number")}
              />
              {errors.weight ? <Text style={[ERROR_STYLES.text, { color: colors.error }]}>{errors.weight}</Text> : null}
            </View>

            <View style={[FIELD_STYLES.container, styles.inputColumn]}>
              <Text style={[LABEL_STYLES.base, { color: colors.subtext }]}>
                Reps <Text style={[LABEL_STYLES.required, { color: colors.error }]}>*</Text>
              </Text>
              <TextInput
                style={getInputStyle(colors, undefined, getInputState(focusedField === "reps", !!errors.reps))}
                value={state.reps}
                onChangeText={(v) => {
                  const numericValue = v.replace(/[^0-9]/g, "");
                  setState((prev) => ({ ...prev, reps: numericValue }));
                  if (errors.reps) setErrors((prev) => ({ ...prev, reps: "" }));
                }}
                onFocus={() => setFocusedField("reps")}
                onBlur={() => setFocusedField(null)}
                placeholder='0'
                {...getInputProps("number")}
              />
              {errors.reps ? <Text style={[ERROR_STYLES.text, { color: colors.error }]}>{errors.reps}</Text> : null}
            </View>
          </View>

          <View style={FIELD_STYLES.container}>
            <Text style={[LABEL_STYLES.base, { color: colors.subtext }]}>
              RPE {!state.isWarmup && <Text style={[LABEL_STYLES.required, { color: colors.error }]}>*</Text>}
            </Text>
            <TextInput
              editable={!state.isWarmup}
              style={getInputStyle(
                colors,
                undefined,
                getInputState(focusedField === "rpe", !!errors.rpe, state.isWarmup),
              )}
              value={state.isWarmup ? "" : state.rpe}
              onChangeText={(v) => {
                const numericValue = v.replace(/[^0-9]/g, "");
                const rpeNumber = parseInt(numericValue, 10);
                if (numericValue === "" || (rpeNumber >= 1 && rpeNumber <= 10)) {
                  setState((prev) => ({ ...prev, rpe: numericValue }));
                  if (errors.rpe) setErrors((prev) => ({ ...prev, rpe: "" }));
                }
              }}
              onFocus={() => setFocusedField("rpe")}
              onBlur={() => setFocusedField(null)}
              placeholder={state.isWarmup ? "Warmup" : "1-10"}
              {...getInputProps("number")}
            />
            {errors.rpe ? <Text style={[ERROR_STYLES.text, { color: colors.error }]}>{errors.rpe}</Text> : null}
          </View>

          <View style={FIELD_STYLES.container}>
            <Text style={[LABEL_STYLES.base, { color: colors.subtext }]}>Notes</Text>
            <TextInput
              style={getInputStyle(colors, "textarea", getInputState(focusedField === "notes", false))}
              value={state.notes}
              onChangeText={(v) => setState((prev) => ({ ...prev, notes: v }))}
              onFocus={() => setFocusedField("notes")}
              onBlur={() => setFocusedField(null)}
              placeholder='Optional notes about this set...'
              {...getInputProps()}
              multiline
              numberOfLines={3}
              textAlignVertical='top'
            />
          </View>
        </View>

        <View style={styles.actions}>
          <Button variant='secondary' onPress={onClose} style={styles.actionBtn} disabled={loading}>
            Cancel
          </Button>
          <Button onPress={handleSave} loading={loading} style={styles.actionBtn}>
            {loading ? <ActivityIndicator color={colors.buttonTextOnPrimary || colors.buttonText} /> : "Save Changes"}
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: 48,
      paddingHorizontal: 16,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    title: {
      flex: 1,
    },
    closeButton: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    warmupBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.subtext,
      marginBottom: 12,
    },
    warmupBadgeActive: {
      borderColor: colors.warning,
    },
    warmupBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.subtext,
      letterSpacing: 0.5,
    },
    warmupBadgeTextActive: {
      color: colors.warning,
    },
    inputs: {
      marginTop: 8,
      flex: 1,
    },
    inputRow: {
      flexDirection: "row",
      gap: 16,
    },
    inputColumn: {
      flex: 1,
    },
    actions: {
      flexDirection: "row",
      gap: 12,
      paddingBottom: 16,
    },
    actionBtn: {
      flex: 1,
      height: 56,
    },
  });
