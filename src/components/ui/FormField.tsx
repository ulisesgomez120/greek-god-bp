// ============================================================================
// FORM FIELD COMPONENT
// ============================================================================
// Simplified form field component that eliminates keyboard interference by
// removing conditional rendering and complex state management

import React, { forwardRef } from "react";
import { View, StyleSheet, ViewStyle, TextInput } from "react-native";
import Input, { InputProps } from "./Input";
import Text from "./Text";

// ============================================================================
// TYPES
// ============================================================================

// Standard FormField props for internal input handling (now uncontrolled)
export interface FormFieldProps extends Omit<InputProps, "error" | "state"> {
  name: string;
  defaultValue?: string;
  onChangeText?: (text: string) => void;
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

const FormFieldComponent = forwardRef<TextInput, FormFieldProps | FormFieldWrapperProps>((props, ref) => {
  // Type guard to determine if this is a wrapper usage
  const isWrapper = "children" in props;

  if (isWrapper) {
    // Wrapper mode - display children with label and error
    const { label, error, containerStyle, children } = props;

    return (
      <View style={[styles.container, containerStyle]}>
        {label && <Text style={styles.label}>{label}</Text>}
        {children}
        {/* Error handling moved to Input component to prevent duplicates */}
      </View>
    );
  } else {
    // Standard mode - handle input internally with uncontrolled pattern
    const {
      name,
      defaultValue = "",
      onChangeText,
      onBlur,
      error,
      containerStyle,
      // Extract specific props - NO MORE SPREADING
      label,
      placeholder,
      keyboardType,
      autoCapitalize,
      autoComplete,
      textContentType,
      secureTextEntry,
      showPasswordToggle,
      required,
      variant,
      helperText,
      leftIcon,
      rightIcon,
      inputStyle,
      editable,
      // Additional Input props that might be passed
      maxLength,
      multiline,
      numberOfLines,
      returnKeyType,
      blurOnSubmit,
      selectTextOnFocus,
      autoFocus,
      caretHidden,
      contextMenuHidden,
      keyboardAppearance,
      scrollEnabled,
      spellCheck,
      textAlign,
      allowFontScaling,
      maxFontSizeMultiplier,
    } = props;

    return (
      <View style={[styles.container, containerStyle]}>
        <Input
          ref={ref}
          defaultValue={defaultValue}
          onChangeText={onChangeText}
          onBlur={onBlur}
          error={error}
          state={error ? "error" : "default"}
          label={label}
          placeholder={placeholder}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          textContentType={textContentType}
          secureTextEntry={secureTextEntry}
          showPasswordToggle={showPasswordToggle}
          required={required}
          variant={variant}
          helperText={helperText}
          leftIcon={leftIcon}
          rightIcon={rightIcon}
          inputStyle={inputStyle}
          editable={editable}
          accessibilityLabel={label || name}
          // Pass additional props explicitly (no spreading)
          maxLength={maxLength}
          multiline={multiline}
          numberOfLines={numberOfLines}
          returnKeyType={returnKeyType}
          blurOnSubmit={blurOnSubmit}
          selectTextOnFocus={selectTextOnFocus}
          autoFocus={autoFocus}
          caretHidden={caretHidden}
          contextMenuHidden={contextMenuHidden}
          keyboardAppearance={keyboardAppearance}
          scrollEnabled={scrollEnabled}
          spellCheck={spellCheck}
          textAlign={textAlign}
          allowFontScaling={allowFontScaling}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
        />
      </View>
    );
  }
});

export const FormField = FormFieldComponent;

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
});

// ============================================================================
// EXPORT
// ============================================================================

export default FormField;
