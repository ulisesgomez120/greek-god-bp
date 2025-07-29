// ============================================================================
// INPUT COMPONENT
// ============================================================================
// Styled input component following TrainSmart design system with validation
// states, accessibility support, and keyboard handling

import React, { forwardRef, useState, useRef, useImperativeHandle } from "react";
import {
  TextInput,
  TextInputProps,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
  Platform,
} from "react-native";
import Text from "./Text";

// ============================================================================
// TYPES
// ============================================================================

export type InputVariant = "default" | "search" | "rpe";
export type InputState = "default" | "focused" | "error" | "success" | "disabled";

export interface InputProps extends Omit<TextInputProps, "style" | "value"> {
  variant?: InputVariant;
  state?: InputState;
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  required?: boolean;
  defaultValue?: string;
}

// Imperative methods exposed by the Input component
export interface InputRef {
  getValue: () => string;
  setValue: (value: string) => void;
  focus: () => void;
  blur: () => void;
  clear: () => void;
}

// ============================================================================
// DESIGN SYSTEM CONSTANTS
// ============================================================================

const INPUT_STYLES = {
  default: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
  },
  search: {
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: "#F8FAFD",
    borderWidth: 0,
  },
  rpe: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
  },
};

const STATE_STYLES = {
  default: {
    borderColor: "#8E8E93",
    backgroundColor: "#FFFFFF",
  },
  focused: {
    borderColor: "#B5CFF8",
    borderWidth: 2,
    shadowColor: "#B5CFF8",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  error: {
    borderColor: "#FF3B30",
    backgroundColor: "rgba(255, 59, 48, 0.05)",
  },
  success: {
    borderColor: "#34C759",
    backgroundColor: "rgba(52, 199, 89, 0.05)",
  },
  disabled: {
    borderColor: "rgba(142, 142, 147, 0.3)",
    backgroundColor: "#F2F2F7",
  },
};

const TEXT_COLORS = {
  default: "#000000",
  placeholder: "#8E8E93",
  error: "#FF3B30",
  success: "#34C759",
  disabled: "rgba(0, 0, 0, 0.3)",
};

// ============================================================================
// COMPONENT
// ============================================================================

const InputComponent = forwardRef<InputRef, InputProps>(
  (
    {
      variant = "default",
      state = "default",
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      showPasswordToggle = false,
      containerStyle,
      inputStyle,
      required = false,
      secureTextEntry,
      onFocus,
      onBlur,
      editable = true,
      defaultValue = "",
      ...props
    },
    ref
  ) => {
    // Internal ref to the TextInput
    const inputRef = useRef<TextInput>(null);

    // Remove isFocused state to prevent re-renders during focus events
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    // Track current value internally for getValue method
    const [currentValue, setCurrentValue] = useState(defaultValue);

    // Expose imperative methods via useImperativeHandle
    useImperativeHandle(
      ref,
      () => ({
        getValue: () => {
          return currentValue;
        },
        setValue: (value: string) => {
          setCurrentValue(value);
          inputRef.current?.setNativeProps({ text: value });
        },
        focus: () => {
          inputRef.current?.focus();
        },
        blur: () => {
          inputRef.current?.blur();
        },
        clear: () => {
          setCurrentValue("");
          inputRef.current?.clear();
        },
      }),
      [currentValue]
    );

    // Handle text changes to keep track of current value
    const handleChangeText = (text: string) => {
      setCurrentValue(text);
      props.onChangeText?.(text);
    };

    // Determine current state without internal focus tracking
    const currentState = !editable ? "disabled" : error ? "error" : state;

    const handleFocus = (event: any) => {
      onFocus?.(event);
    };

    const handleBlur = (event: any) => {
      onBlur?.(event);
    };

    const togglePasswordVisibility = () => {
      setIsPasswordVisible(!isPasswordVisible);
    };

    // Get styles based on variant and state
    const baseInputStyle = INPUT_STYLES[variant];
    const stateStyle = STATE_STYLES[currentState];
    const textColor = editable ? TEXT_COLORS.default : TEXT_COLORS.disabled;

    const containerStyles = [styles.container, containerStyle].filter(Boolean) as ViewStyle[];

    const inputContainerStyles = [
      styles.inputContainer,
      baseInputStyle,
      stateStyle,
      leftIcon && styles.inputWithLeftIcon,
      (rightIcon || showPasswordToggle) && styles.inputWithRightIcon,
    ].filter(Boolean) as ViewStyle[];

    const textInputStyles = [
      styles.textInput,
      {
        fontSize: baseInputStyle.fontSize,
        color: textColor,
      },
      inputStyle,
    ].filter(Boolean) as TextStyle[];

    return (
      <View style={containerStyles}>
        {label && (
          <View style={styles.labelContainer}>
            <Text variant='body' color='primary' style={styles.label}>
              {label}
              {required && <Text color='error'> *</Text>}
            </Text>
          </View>
        )}

        <View style={inputContainerStyles}>
          {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}

          <TextInput
            ref={inputRef}
            style={textInputStyles}
            defaultValue={defaultValue}
            placeholderTextColor={TEXT_COLORS.placeholder}
            secureTextEntry={showPasswordToggle ? !isPasswordVisible : secureTextEntry}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChangeText={handleChangeText}
            editable={editable}
            accessibilityLabel={label}
            accessibilityHint={helperText || error}
            accessibilityState={{
              disabled: !editable,
            }}
            {...props}
          />

          {showPasswordToggle && (
            <TouchableOpacity
              style={styles.rightIconContainer}
              onPress={togglePasswordVisibility}
              accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}
              accessibilityRole='button'>
              <Text variant='body' color='secondary'>
                {isPasswordVisible ? "Hide" : "Show"}
              </Text>
            </TouchableOpacity>
          )}

          {rightIcon && !showPasswordToggle && <View style={styles.rightIconContainer}>{rightIcon}</View>}
        </View>

        {(error || helperText) && (
          <View style={styles.messageContainer}>
            <Text variant='bodySmall' color={error ? "error" : "secondary"} style={styles.messageText}>
              {error || helperText}
            </Text>
          </View>
        )}
      </View>
    );
  }
);

export const Input = InputComponent;

Input.displayName = "Input";

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  labelContainer: {
    marginBottom: 8,
  },
  label: {
    fontWeight: "500",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  inputWithLeftIcon: {
    paddingLeft: 44,
  },
  inputWithRightIcon: {
    paddingRight: 44,
  },
  textInput: {
    flex: 1,
    height: "100%",
    paddingVertical: 0, // Remove default padding
    includeFontPadding: false, // Android-specific
    textAlignVertical: "center", // Android-specific
  },
  leftIconContainer: {
    position: "absolute",
    left: 12,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rightIconContainer: {
    position: "absolute",
    right: 12,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  messageContainer: {
    marginTop: 6,
    paddingHorizontal: 4,
  },
  messageText: {
    lineHeight: 16,
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default Input;
