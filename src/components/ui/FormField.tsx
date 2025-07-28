// ============================================================================
// FORM FIELD COMPONENT
// ============================================================================
// Simplified form field component that eliminates keyboard interference by
// removing conditional rendering and complex state management

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
  containerStyle?: ViewStyle;
}

// Wrapper FormField props for custom children
export interface FormFieldWrapperProps {
  label: string;
  error?: string;
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
    const { label, error, containerStyle, children } = props;

    return (
      <View style={[styles.container, containerStyle]}>
        {label && <Text style={styles.label}>{label}</Text>}
        {children}
        {/* Always render error container to prevent layout shifts */}
        <View style={styles.errorContainer}>{error && <Text style={styles.errorText}>{error}</Text>}</View>
      </View>
    );
  } else {
    // Standard mode - handle input internally
    const { name, value, onChangeText, onBlur, error, containerStyle, ...inputProps } = props;

    return (
      <View style={[styles.container, containerStyle]}>
        <Input
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          error={error}
          state={error ? "error" : "default"}
          accessibilityLabel={inputProps.label || name}
          {...inputProps}
        />
        {/* Always render error container to prevent layout shifts */}
        <View style={styles.errorContainer}>{error && <Text style={styles.errorText}>{error}</Text>}</View>
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
  errorContainer: {
    minHeight: 20, // Reserve space to prevent layout shifts
    marginTop: 4,
  },
  errorText: {
    fontSize: 13,
    color: "#FF3B30",
    lineHeight: 18,
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default FormField;
