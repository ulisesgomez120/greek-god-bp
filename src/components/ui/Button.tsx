// ============================================================================
// BUTTON COMPONENT
// ============================================================================
// Base button component following TrainSmart design system with loading states,
// haptic feedback, and accessibility support

import React from "react";
import {
  TouchableOpacity,
  TouchableOpacityProps,
  StyleSheet,
  ViewStyle,
  ActivityIndicator,
  Platform,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import Text from "./Text";
import useTheme from "@/hooks/useTheme";

// ============================================================================
// TYPES
// ============================================================================

export type ButtonVariant = "primary" | "secondary" | "text" | "danger";
export type ButtonSize = "small" | "medium" | "large";

export interface ButtonProps extends Omit<TouchableOpacityProps, "style"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  hapticFeedback?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
}

// ============================================================================
// DESIGN SYSTEM CONSTANTS
// ============================================================================

/* BUTTON_STYLES derived from theme at runtime */

/* TEXT_COLORS derived from theme at runtime */

/* DISABLED_STYLES derived from theme at runtime */

/* DISABLED_TEXT_COLORS derived from theme at runtime */

const SIZE_STYLES = {
  small: {
    minHeight: 36,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  medium: {
    minHeight: 44,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  large: {
    minHeight: 50,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "medium",
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  hapticFeedback = true,
  style,
  children,
  onPress,
  ...props
}) => {
  const isDisabled = disabled || loading;

  const handlePress = async (event: any) => {
    if (isDisabled || !onPress) return;

    // Provide haptic feedback
    if (hapticFeedback && Platform.OS === "ios") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    onPress(event);
  };

  // Get styles based on theme and state
  const { colors } = useTheme();

  const sizeStyle = SIZE_STYLES[size];

  const variantStyles: Record<ButtonVariant, ViewStyle> = {
    primary: {
      backgroundColor: colors.primary,
      borderColor: "transparent",
      borderWidth: 0,
    } as ViewStyle,
    secondary: {
      backgroundColor: "transparent",
      borderColor: colors.primary,
      borderWidth: 2,
    } as ViewStyle,
    text: {
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderWidth: 0,
    } as ViewStyle,
    danger: {
      backgroundColor: colors.error,
      borderColor: "transparent",
      borderWidth: 0,
    } as ViewStyle,
  };

  const disabledVariantStyles: Record<ButtonVariant, ViewStyle> = {
    primary: {
      backgroundColor: `${colors.primary}66`, // 40% alpha with 8-digit hex
      borderColor: "transparent",
      borderWidth: 0,
    } as ViewStyle,
    secondary: {
      backgroundColor: "transparent",
      borderColor: `${colors.primary}66`,
      borderWidth: 2,
    } as ViewStyle,
    text: {
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderWidth: 0,
    } as ViewStyle,
    danger: {
      backgroundColor: `${colors.error}66`,
      borderColor: "transparent",
      borderWidth: 0,
    } as ViewStyle,
  };

  const textColorMap: Record<ButtonVariant, string> = {
    primary: colors.text,
    secondary: colors.primary,
    text: colors.primary,
    danger: colors.surface || "#FFFFFF",
  };

  const disabledTextColorMap: Record<ButtonVariant, string> = {
    primary: `${colors.text}66`,
    secondary: `${colors.primary}66`,
    text: `${colors.primary}66`,
    danger: `${(colors.surface || "#FFFFFF") + "66"}`,
  };

  const buttonStyle = isDisabled ? disabledVariantStyles[variant] : variantStyles[variant];
  const textColor = isDisabled ? disabledTextColorMap[variant] : textColorMap[variant];

  const containerStyle = [styles.base, sizeStyle, buttonStyle, fullWidth && styles.fullWidth, style].filter(
    Boolean
  ) as ViewStyle[];

  const contentStyle = [
    styles.content,
    leftIcon && styles.contentWithLeftIcon,
    rightIcon && styles.contentWithRightIcon,
  ].filter(Boolean) as ViewStyle[];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityRole='button'
      accessibilityState={{
        disabled: isDisabled,
        busy: loading,
      }}
      {...props}>
      <View style={contentStyle}>
        {leftIcon && !loading && <View style={styles.leftIcon}>{leftIcon}</View>}

        {loading ? <ActivityIndicator size='small' color={textColor} style={styles.loadingIndicator} /> : null}

        <Text
          variant='button'
          color='primary'
          numberOfLines={2}
          adjustsFontSizeToFit={true}
          minimumFontScale={0.8}
          style={[styles.text, { color: textColor }, loading && styles.textWithLoading]}>
          {children}
        </Text>

        {rightIcon && !loading && <View style={styles.rightIcon}>{rightIcon}</View>}
      </View>
    </TouchableOpacity>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2, // Android shadow
  },
  fullWidth: {
    width: "100%",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  contentWithLeftIcon: {
    paddingLeft: 4,
  },
  contentWithRightIcon: {
    paddingRight: 4,
  },
  text: {
    textAlign: "center",
    flexShrink: 1,
    flexWrap: "wrap",
  },
  textWithLoading: {
    marginLeft: 8,
  },
  leftIcon: {
    marginRight: 8,
  },
  rightIcon: {
    marginLeft: 8,
  },
  loadingIndicator: {
    marginRight: 8,
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default Button;
