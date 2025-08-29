import React from "react";
import type { StyleProp, ViewStyle, TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import useTheme from "@/hooks/useTheme";

/**
 * Reusable Icon component that standardizes on Ionicons and integrates with theme.
 *
 * Props:
 * - name: Ionicons glyph name (string)
 * - size: numeric size (default 20)
 * - color: optional color; if omitted, uses theme.text or theme.icon (fallback)
 * - style: optional style object passed to the icon
 *
 * This wrapper makes swapping icon libraries easier because callers import from a single place.
 */

type IconProps = {
  name: string;
  size?: number;
  color?: string;
  // Icon renders as text-based glyphs (Ionicons) so accept TextStyle as well as ViewStyle.
  style?: StyleProp<ViewStyle | TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

const Icon: React.FC<IconProps> = ({ name, size = 20, color, style, accessibilityLabel, testID }) => {
  const { colors } = useTheme();
  const resolvedColor = color ?? (colors.text || "#000");

  return (
    <Ionicons
      name={name as any}
      size={size}
      color={resolvedColor}
      style={style as any}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    />
  );
};

export default Icon;
