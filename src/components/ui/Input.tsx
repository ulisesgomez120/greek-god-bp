// ============================================================================
// INPUT COMPONENT
// ============================================================================
// React Hook Form compatible input component with enhanced UX, accessibility,
// and zero re-render issues

import React, { forwardRef, useState } from "react";
import { View, TextInput, StyleSheet, Pressable, Animated, ViewStyle, TextInputProps, Platform } from "react-native";
import { Controller, Control, FieldPath, FieldValues } from "react-hook-form";
import Text from "./Text";

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
// TYPES
// ============================================================================

interface BaseInputProps extends Omit<TextInputProps, "onChangeText" | "value"> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  variant?: keyof typeof INPUT_STYLES;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showPasswordToggle?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
  loading?: boolean;
  success?: boolean;
}

// For react-hook-form Controller integration
interface ControlledInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends BaseInputProps {
  name: TName;
  control: Control<TFieldValues>;
  rules?: any;
}

// For direct ref usage (backward compatibility)
interface RefInputProps extends BaseInputProps {
  onChangeText?: (text: string) => void;
  value?: string;
}

type InputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = ControlledInputProps<TFieldValues, TName> | RefInputProps;

// ============================================================================
// COMPONENT
// ============================================================================

const InputComponent = forwardRef<TextInput, RefInputProps>(
  (
    {
      label,
      error,
      helperText,
      required = false,
      variant = "default",
      leftIcon,
      rightIcon,
      showPasswordToggle = false,
      containerStyle,
      inputStyle,
      loading = false,
      success = false,
      secureTextEntry = false,
      editable = true,
      onChangeText,
      value,
      onFocus,
      onBlur,
      ...textInputProps
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);
    const [errorAnimation] = useState(new Animated.Value(0));

    // Log component renders to track rerender causes
    console.log("InputComponent: Render", {
      label,
      isFocused,
      hasError: !!error,
      hasValue: !!value,
      editable,
      variant,
      timestamp: Date.now(),
    });

    // Determine input state
    const getInputState = () => {
      if (!editable) return "disabled";
      if (error) return "error";
      if (success) return "success";
      if (isFocused) return "focused";
      return "default";
    };

    const inputState = getInputState();
    const baseStyle = INPUT_STYLES[variant];
    const stateStyle = STATE_STYLES[inputState];

    // Handle focus events
    const handleFocus = (e: any) => {
      console.log("InputComponent: Focus event", {
        label,
        timestamp: Date.now(),
        nativeEvent: e.nativeEvent,
      });
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: any) => {
      console.log("InputComponent: Blur event", {
        label,
        timestamp: Date.now(),
        nativeEvent: e.nativeEvent,
      });
      setIsFocused(false);
      onBlur?.(e);
    };

    // Animate error message
    React.useEffect(() => {
      Animated.timing(errorAnimation, {
        toValue: error ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, [error, errorAnimation]);

    // Password toggle
    const togglePasswordVisibility = () => {
      setIsPasswordVisible(!isPasswordVisible);
    };

    // Determine if we should show password toggle
    const shouldShowPasswordToggle = showPasswordToggle && secureTextEntry;
    const actualSecureTextEntry = secureTextEntry && !isPasswordVisible;

    // Build right icon
    const buildRightIcon = () => {
      if (shouldShowPasswordToggle) {
        return (
          <Pressable
            onPress={togglePasswordVisibility}
            style={styles.passwordToggle}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole='button'
            accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}>
            <Text style={styles.passwordToggleText}>{isPasswordVisible ? "👁️" : "👁️‍🗨️"}</Text>
          </Pressable>
        );
      }
      return rightIcon;
    };

    const finalRightIcon = buildRightIcon();

    return (
      <View style={[styles.container, containerStyle]}>
        {/* Label */}
        {label && (
          <View style={styles.labelContainer}>
            <Text variant='body' color='primary' style={styles.label}>
              {label}
              {required && <Text style={styles.required}> *</Text>}
            </Text>
          </View>
        )}

        {/* Input Container */}
        <View
          style={[
            styles.inputContainer,
            baseStyle,
            stateStyle,
            leftIcon ? styles.inputWithLeftIcon : null,
            finalRightIcon ? styles.inputWithRightIcon : null,
            inputStyle,
          ]}>
          {/* Left Icon */}
          {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}

          {/* Text Input */}
          <TextInput
            ref={ref}
            style={[
              styles.textInput,
              {
                color: editable ? TEXT_COLORS.default : TEXT_COLORS.disabled,
                fontSize: baseStyle.fontSize,
              },
            ]}
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            secureTextEntry={actualSecureTextEntry}
            editable={editable}
            placeholderTextColor={TEXT_COLORS.placeholder}
            selectionColor='#B5CFF8'
            autoCorrect={false}
            spellCheck={false}
            blurOnSubmit={false}
            returnKeyType='next'
            pointerEvents='auto'
            {...textInputProps}
          />

          {/* Right Icon */}
          {finalRightIcon && (
            <View style={[styles.rightIconContainer, shouldShowPasswordToggle && { pointerEvents: "auto" }]}>
              {finalRightIcon}
            </View>
          )}
        </View>

        {/* Error Message */}
        {error && (
          <Animated.View
            style={[
              styles.messageContainer,
              {
                opacity: errorAnimation,
                transform: [
                  {
                    translateY: errorAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    }),
                  },
                ],
              },
            ]}>
            <Text variant='bodySmall' color='error' style={styles.messageText}>
              {error}
            </Text>
          </Animated.View>
        )}

        {/* Helper Text */}
        {helperText && !error && (
          <View style={styles.messageContainer}>
            <Text variant='bodySmall' color='secondary' style={styles.messageText}>
              {helperText}
            </Text>
          </View>
        )}
      </View>
    );
  }
);

// ============================================================================
// CONTROLLED INPUT (React Hook Form)
// ============================================================================

function ControlledInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({ name, control, rules, ...inputProps }: ControlledInputProps<TFieldValues, TName>) {
  console.log("ControlledInput: Render", {
    name,
    timestamp: Date.now(),
  });

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field: { onChange, onBlur, value, ref }, fieldState: { error, isTouched } }) => {
        console.log("ControlledInput: Controller render", {
          name,
          hasValue: !!value,
          hasError: !!error,
          isTouched,
          timestamp: Date.now(),
        });

        return (
          <InputComponent
            {...inputProps}
            ref={ref}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={isTouched ? error?.message : undefined}
          />
        );
      }}
    />
  );
}

// ============================================================================
// MAIN INPUT COMPONENT
// ============================================================================

function Input<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(props: InputProps<TFieldValues, TName>) {
  // Check if this is a controlled input (has name and control props)
  if ("name" in props && "control" in props) {
    return <ControlledInput {...(props as ControlledInputProps<TFieldValues, TName>)} />;
  }

  // Otherwise, render as ref input
  return <InputComponent {...(props as RefInputProps)} />;
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 16,
  },
  labelContainer: {
    marginBottom: 8,
  },
  label: {
    fontWeight: "500",
  },
  required: {
    color: "#FF3B30",
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
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  leftIconContainer: {
    position: "absolute",
    left: 12,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  rightIconContainer: {
    position: "absolute",
    right: 12,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  passwordToggle: {
    padding: 4,
  },
  passwordToggleText: {
    fontSize: 16,
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
export { InputComponent };
export type { InputProps, BaseInputProps, ControlledInputProps, RefInputProps };
