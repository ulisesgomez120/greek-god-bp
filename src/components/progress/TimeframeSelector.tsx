import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import useTheme from "@/hooks/useTheme";
import type { TimeframeOption } from "@/types";

const OPTIONS: TimeframeOption[] = ["4w", "8w", "3m", "6m", "all"];

export default function TimeframeSelector({
  value,
  onChange,
}: {
  value: TimeframeOption;
  onChange: (v: TimeframeOption) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", marginVertical: 8 }}>
      {OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt}
          onPress={() => onChange(opt)}
          style={{
            paddingVertical: 6,
            paddingHorizontal: 10,
            marginHorizontal: 4,
            borderRadius: 16,
            backgroundColor: opt === value ? colors.primary : "transparent",
            borderWidth: opt === value ? 0 : 1,
            borderColor: opt === value ? "transparent" : colors.border,
          }}
          accessibilityRole='button'
          accessibilityState={{ selected: opt === value }}>
          <Text
            style={{ color: opt === value ? colors.buttonTextOnPrimary ?? "#fff" : colors.text, fontWeight: "600" }}>
            {opt.toUpperCase()}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
