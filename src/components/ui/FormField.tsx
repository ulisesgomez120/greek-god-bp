// ============================================================================
// FORM FIELD COMPONENT
// ============================================================================
// Base form field component with validation, error states, and accessibility
// support for TrainSmart authentication forms

import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import Input, { InputProps } from "./Input";
import Text from "./Text";

// ============================================================================
// TYPES
// ============================================================================

export interface FormFieldProps extends InputProps {
  name: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  touched?: boolean;
  showError?: boolean;
  containerStyle?: ViewStyle;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const FormField: React.FC<FormFieldProps> = ({
  name,
  value,
  onChangeText,
  onBlur,
  error,
  touched = false,
  showError = true,
  containerStyle,
  ...inputProps
}) => {
  // Only show error if field has been touched and has an error
  const shouldShowError = showError && touched && error;

  const handleBlur = () => {
    onBlur?.();
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Input
        value={value}
        onChangeText={onChangeText}
        onBlur={handleBlur}
        error={shouldShowError ? error : undefined}
        state={shouldShowError ? "error" : "default"}
        accessibilityLabel={inputProps.label || name}
        {...inputProps}
      />
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default FormField;
