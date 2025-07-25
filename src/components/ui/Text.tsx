// ============================================================================
// TEXT COMPONENT
// ============================================================================
// Typography component following TrainSmart design system with proper
// accessibility support and responsive scaling

import React from "react";
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from "react-native";

// ============================================================================
// TYPES
// ============================================================================

export type TextVariant = "h1" | "h2" | "h3" | "bodyLarge" | "body" | "bodySmall" | "caption" | "button" | "coachText";

export type TextColor = "primary" | "secondary" | "tertiary" | "success" | "warning" | "error" | "coach" | "white";

export interface TextProps extends Omit<RNTextProps, "style"> {
  variant?: TextVariant;
  color?: TextColor;
  align?: "left" | "center" | "right";
  weight?: "regular" | "medium" | "semibold" | "bold";
  style?: RNTextProps["style"];
  children: React.ReactNode;
}

// ============================================================================
// DESIGN SYSTEM CONSTANTS
// ============================================================================

const TYPOGRAPHY_STYLES = {
  h1: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700" as const,
    letterSpacing: -0.4,
  },
  h2: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700" as const,
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600" as const,
    letterSpacing: -0.1,
  },
  bodyLarge: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "400" as const,
    letterSpacing: -0.43,
  },
  body: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "400" as const,
    letterSpacing: -0.24,
  },
  bodySmall: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as const,
    letterSpacing: -0.08,
  },
  caption: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500" as const,
    letterSpacing: 0.06,
  },
  button: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "500" as const,
    letterSpacing: -0.43,
  },
  coachText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500" as const,
    letterSpacing: -0.24,
  },
};

const COLORS = {
  primary: "#1C1C1E",
  secondary: "#8E8E93",
  tertiary: "rgba(142, 142, 147, 0.6)",
  success: "#34C759",
  warning: "#FF9500",
  error: "#FF3B30",
  coach: "#B5CFF8",
  white: "#FFFFFF",
};

const FONT_WEIGHTS = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
};

// ============================================================================
// COMPONENT
// ============================================================================

export const Text: React.FC<TextProps> = ({
  variant = "body",
  color = "primary",
  align = "left",
  weight,
  style,
  children,
  ...props
}) => {
  const typographyStyle = TYPOGRAPHY_STYLES[variant];
  const textColor = COLORS[color];

  // Use weight from variant if not explicitly provided
  const fontWeight = weight ? FONT_WEIGHTS[weight] : typographyStyle.fontWeight;

  const textStyle = [
    styles.base,
    {
      fontSize: typographyStyle.fontSize,
      lineHeight: typographyStyle.lineHeight,
      fontWeight,
      letterSpacing: typographyStyle.letterSpacing,
      color: textColor,
      textAlign: align,
    },
    style,
  ];

  return (
    <RNText
      style={textStyle}
      allowFontScaling={true}
      maxFontSizeMultiplier={1.3} // Limit scaling for accessibility
      {...props}>
      {children}
    </RNText>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  base: {
    fontFamily: "System", // Uses SF Pro on iOS, Roboto on Android
    includeFontPadding: false, // Android-specific: removes extra padding
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default Text;
