// ============================================================================
// INPUT STYLES CONSTANTS
// ============================================================================
// Centralized styling system for TextInput components following TrainSmart
// design system. Use direct TextInput components with these style constants.

import { TextStyle, ViewStyle } from "react-native";

// ============================================================================
// DESIGN SYSTEM COLORS
// ============================================================================

const COLORS = {
  // Primary Colors
  primary: {
    blue: "#B5CFF8",
    white: "#FFFFFF",
    dark: "#1C1C1E",
  },

  // Text Colors
  text: {
    primary: "#000000",
    secondary: "#8E8E93",
    placeholder: "#8E8E93",
    disabled: "rgba(0, 0, 0, 0.3)",
  },

  // State Colors
  states: {
    default: "#8E8E93",
    focused: "#B5CFF8",
    error: "#FF3B30",
    success: "#34C759",
    disabled: "rgba(142, 142, 147, 0.3)",
  },

  // Background Colors
  backgrounds: {
    default: "#FFFFFF",
    light: "#F8FAFD",
    error: "rgba(255, 59, 48, 0.05)",
    success: "rgba(52, 199, 89, 0.05)",
    disabled: "#F2F2F7",
  },
} as const;

// ============================================================================
// INPUT STYLE CONSTANTS
// ============================================================================

const INPUT_STYLES = {
  // Base styles applied to all TextInput components
  base: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 17,
    backgroundColor: COLORS.backgrounds.default,
    color: COLORS.text.primary,
    includeFontPadding: false,
    textAlignVertical: "center" as const,
  } as TextStyle,

  // State variations
  states: {
    default: {
      borderColor: COLORS.states.default,
      backgroundColor: COLORS.backgrounds.default,
    } as TextStyle,

    focused: {
      borderColor: COLORS.states.focused,
      borderWidth: 2,
      shadowColor: COLORS.states.focused,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 0 },
      elevation: 2, // Android shadow
    } as TextStyle,

    error: {
      borderColor: COLORS.states.error,
      backgroundColor: COLORS.backgrounds.error,
    } as TextStyle,

    success: {
      borderColor: COLORS.states.success,
      backgroundColor: COLORS.backgrounds.success,
    } as TextStyle,

    disabled: {
      borderColor: COLORS.states.disabled,
      backgroundColor: COLORS.backgrounds.disabled,
      color: COLORS.text.disabled,
    } as TextStyle,
  },

  // Input type variants
  variants: {
    // Search/filter inputs
    search: {
      height: 36,
      borderRadius: 18,
      backgroundColor: COLORS.backgrounds.light,
      borderWidth: 0,
      fontSize: 15,
      paddingHorizontal: 12,
    } as TextStyle,

    // RPE/number inputs
    rpe: {
      textAlign: "center" as const,
      fontWeight: "600" as const,
      fontSize: 20,
    } as TextStyle,

    // Large text areas
    textarea: {
      height: 120,
      paddingTop: 16,
      paddingBottom: 16,
      textAlignVertical: "top" as const,
    } as TextStyle,

    // Compact inputs for forms
    compact: {
      height: 44,
      fontSize: 15,
      paddingHorizontal: 12,
    } as TextStyle,
  },
} as const;

// ============================================================================
// LABEL STYLES
// ============================================================================

const LABEL_STYLES = {
  base: {
    fontSize: 16,
    fontWeight: "500" as const,
    color: COLORS.text.primary,
    marginBottom: 8,
  } as TextStyle,

  required: {
    color: COLORS.states.error,
    fontWeight: "500" as const,
  } as TextStyle,

  small: {
    fontSize: 14,
    fontWeight: "400" as const,
    color: COLORS.text.secondary,
    marginBottom: 6,
  } as TextStyle,
} as const;

// ============================================================================
// ERROR TEXT STYLES
// ============================================================================

const ERROR_STYLES = {
  text: {
    fontSize: 13,
    color: COLORS.states.error,
    marginTop: 6,
    paddingHorizontal: 4,
    lineHeight: 16,
  } as TextStyle,

  container: {
    marginTop: 6,
  } as ViewStyle,
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get combined input styles based on variant and state
 * @param variant - Input variant type ('search', 'rpe', etc.)
 * @param state - Input state ('focused', 'error', 'success', etc.)
 * @returns Array of style objects to apply to TextInput
 */
export const getInputStyle = (
  variant?: keyof typeof INPUT_STYLES.variants,
  state?: keyof typeof INPUT_STYLES.states
): TextStyle[] => {
  const styles = [INPUT_STYLES.base];

  if (variant && INPUT_STYLES.variants[variant]) {
    styles.push(INPUT_STYLES.variants[variant]);
  }

  if (state && INPUT_STYLES.states[state]) {
    styles.push(INPUT_STYLES.states[state]);
  }

  return styles;
};

/**
 * Get input state based on focus and error conditions
 * @param isFocused - Whether input is currently focused
 * @param hasError - Whether input has validation error
 * @param isDisabled - Whether input is disabled
 * @returns State key for styling
 */
export const getInputState = (
  isFocused: boolean,
  hasError: boolean,
  isDisabled: boolean = false
): keyof typeof INPUT_STYLES.states => {
  if (isDisabled) return "disabled";
  if (hasError) return "error";
  if (isFocused) return "focused";
  return "default";
};

/**
 * Get common TextInput props for consistent behavior
 * @param type - Input type for specific configurations
 * @returns Common props object
 */
export const getInputProps = (type?: "email" | "password" | "search" | "number") => {
  const baseProps = {
    autoCorrect: false,
    spellCheck: false,
    placeholderTextColor: COLORS.text.placeholder,
    selectionColor: COLORS.primary.blue,
  };

  switch (type) {
    case "email":
      return {
        ...baseProps,
        keyboardType: "email-address" as const,
        autoCapitalize: "none" as const,
        autoComplete: "email" as const,
        textContentType: "emailAddress" as const,
      };

    case "password":
      return {
        ...baseProps,
        secureTextEntry: true,
        autoComplete: "new-password" as const,
        textContentType: "newPassword" as const,
        autoCapitalize: "none" as const,
      };

    case "search":
      return {
        ...baseProps,
        returnKeyType: "search" as const,
        autoCapitalize: "none" as const,
      };

    case "number":
      return {
        ...baseProps,
        keyboardType: "numeric" as const,
        returnKeyType: "done" as const,
      };

    default:
      return baseProps;
  }
};

// ============================================================================
// FIELD CONTAINER STYLES
// ============================================================================

const FIELD_STYLES = {
  container: {
    marginBottom: 20,
  } as ViewStyle,

  containerCompact: {
    marginBottom: 16,
  } as ViewStyle,

  containerLarge: {
    marginBottom: 24,
  } as ViewStyle,
} as const;

// ============================================================================
// EXPORT ALL
// ============================================================================

export { COLORS, INPUT_STYLES, LABEL_STYLES, ERROR_STYLES, FIELD_STYLES };

// Export types for TypeScript
export type InputVariant = keyof typeof INPUT_STYLES.variants;
export type InputState = keyof typeof INPUT_STYLES.states;
export type InputType = "email" | "password" | "search" | "number";
