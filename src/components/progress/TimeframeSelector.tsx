import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import type { TimeframeOption } from "@/types";

const OPTIONS: TimeframeOption[] = ["4w", "8w", "3m", "6m", "all"];

export default function TimeframeSelector({
  value,
  onChange,
}: {
  value: TimeframeOption;
  onChange: (v: TimeframeOption) => void;
}) {
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
            backgroundColor: opt === value ? "#1f6feb" : "transparent",
            borderWidth: opt === value ? 0 : 1,
            borderColor: "#e6eef7",
          }}
          accessibilityRole='button'
          accessibilityState={{ selected: opt === value }}>
          <Text style={{ color: opt === value ? "#fff" : "#1f2d3d", fontWeight: "600" }}>{opt.toUpperCase()}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
