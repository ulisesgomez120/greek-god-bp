// ============================================================================
// FORM FIELD COMPONENT
// ============================================================================
// Simplified form field component that eliminates keyboard interference by
// removing conditional rendering and complex state management

import React, { useRef, forwardRef, useImperativeHandle } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import Input, { InputProps, InputRef } from "./Input";
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

// FormField ref interface for imperative access
export interface FormFieldRef {
  getValue: () => string;
  setValue: (value: string) => void;
  focus: () => void;
  blur: () => void;
  clear: () => void;
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

const FormFieldComponent = forwardRef<FormFieldRef, FormFieldProps | FormFieldWrapperProps>((props, ref) => {
  // Type guard to determine if this is a wrapper usage
  const isWrapper = "children" in props;

  if (isWrapper) {
    // Wrapper mode - display children with label and error
    const { label, error, containerStyle, children } = props;
    console.log("📝 FormField WRAPPER RENDER - label:", label, "error:", error);

    return (
      <View style={[styles.container, containerStyle]}>
        {label && <Text style={styles.label}>{label}</Text>}
        {children}
        {/* Always render error container to prevent layout shifts */}
        <View style={styles.errorContainer}>{error && <Text style={styles.errorText}>{error}</Text>}</View>
      </View>
    );
  } else {
    // Standard mode - handle input internally with uncontrolled pattern
    const {
      name,
      defaultValue,
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

    // Create ref to the Input component
    const inputRef = useRef<InputRef>(null);

    // Expose FormField methods via useImperativeHandle
    useImperativeHandle(
      ref,
      () => ({
        getValue: () => inputRef.current?.getValue() || "",
        setValue: (value: string) => inputRef.current?.setValue(value),
        focus: () => inputRef.current?.focus(),
        blur: () => inputRef.current?.blur(),
        clear: () => inputRef.current?.clear(),
      }),
      []
    );

    console.log(
      "📝 FormField STANDARD RENDER (UNCONTROLLED) - name:",
      name,
      "defaultValue:",
      defaultValue,
      "error:",
      error
    );

    return (
      <View style={[styles.container, containerStyle]}>
        <Input
          ref={inputRef}
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
        {/* Always render error container to prevent layout shifts */}
        <View style={styles.errorContainer}>{error && <Text style={styles.errorText}>{error}</Text>}</View>
      </View>
    );
  }
});

// Custom comparison function to ensure React.memo works properly
const arePropsEqual = (
  prevProps: FormFieldProps | FormFieldWrapperProps,
  nextProps: FormFieldProps | FormFieldWrapperProps
) => {
  console.log("🔍 React.memo comparison called for FormField");
  // Handle wrapper props
  if ("children" in prevProps && "children" in nextProps) {
    const isEqual =
      prevProps.label === nextProps.label &&
      prevProps.error === nextProps.error &&
      prevProps.containerStyle === nextProps.containerStyle &&
      prevProps.children === nextProps.children;

    if (!isEqual) {
      console.log("� FormField WRAPPER props changed:", {
        label: prevProps.label !== nextProps.label,
        error: prevProps.error !== nextProps.error,
        containerStyle: prevProps.containerStyle !== nextProps.containerStyle,
        children: prevProps.children !== nextProps.children,
      });
    }

    return isEqual;
  }

  // Handle standard FormField props
  if ("name" in prevProps && "name" in nextProps) {
    const propComparisons = {
      name: prevProps.name === nextProps.name,
      defaultValue: prevProps.defaultValue === nextProps.defaultValue,
      onChangeText: prevProps.onChangeText === nextProps.onChangeText,
      onBlur: prevProps.onBlur === nextProps.onBlur,
      error: prevProps.error === nextProps.error,
      label: prevProps.label === nextProps.label,
      placeholder: prevProps.placeholder === nextProps.placeholder,
      keyboardType: prevProps.keyboardType === nextProps.keyboardType,
      autoCapitalize: prevProps.autoCapitalize === nextProps.autoCapitalize,
      autoComplete: prevProps.autoComplete === nextProps.autoComplete,
      textContentType: prevProps.textContentType === nextProps.textContentType,
      secureTextEntry: prevProps.secureTextEntry === nextProps.secureTextEntry,
      showPasswordToggle: prevProps.showPasswordToggle === nextProps.showPasswordToggle,
      required: prevProps.required === nextProps.required,
      variant: prevProps.variant === nextProps.variant,
      helperText: prevProps.helperText === nextProps.helperText,
      leftIcon: prevProps.leftIcon === nextProps.leftIcon,
      rightIcon: prevProps.rightIcon === nextProps.rightIcon,
      inputStyle: prevProps.inputStyle === nextProps.inputStyle,
      editable: prevProps.editable === nextProps.editable,
      containerStyle: prevProps.containerStyle === nextProps.containerStyle,
    };

    const isEqual = Object.values(propComparisons).every(Boolean);

    if (!isEqual) {
      const changedProps = Object.entries(propComparisons)
        .filter(([_, isEqual]) => !isEqual)
        .map(([prop]) => prop);

      console.log(`🔍 FormField STANDARD props changed for ${nextProps.name}:`, changedProps);

      // Log specific values for debugging
      changedProps.forEach((prop) => {
        console.log(
          `  ${prop}: ${JSON.stringify(prevProps[prop as keyof typeof prevProps])} -> ${JSON.stringify(
            nextProps[prop as keyof typeof nextProps]
          )}`
        );
      });
    }

    return isEqual;
  }

  // Different prop types, not equal
  return false;
};

export const FormField = React.memo(FormFieldComponent, arePropsEqual);

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
