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

// Standard FormField props for internal input handling
export interface FormFieldProps extends Omit<InputProps, "error" | "state"> {
  name: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  touched?: boolean;
  showError?: boolean;
  containerStyle?: ViewStyle;
}

// Wrapper FormField props for custom children
export interface FormFieldWrapperProps {
  label: string;
  error?: string;
  touched?: boolean;
  showError?: boolean;
  containerStyle?: ViewStyle;
  children: React.ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const FormField: React.FC<FormFieldProps | FormFieldWrapperProps> = (props) => {
  // Type guard to determine if this is a wrapper usage
  const isWrapper = "children" in props;

  if (isWrapper) {
    // Wrapper mode - display children with label and error
    const { label, error, touched = false, showError = true, containerStyle, children } = props;
    const shouldShowError = showError && touched && error;

    return (
      <View style={[styles.container, containerStyle]}>
        {label && <Text style={styles.label}>{label}</Text>}
        {children}
        {shouldShowError && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  } else {
    // Standard mode - handle input internally
    const {
      name,
      value,
      onChangeText,
      onBlur,
      error,
      touched = false,
      showError = true,
      containerStyle,
      ...inputProps
    } = props;

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
  }
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1C1C1E",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    color: "#FF3B30",
    marginTop: 4,
    lineHeight: 18,
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default FormField;
