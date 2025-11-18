import React from "react";
import { View, Text } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import type { VolumeDataPoint, TimeframeOption } from "@/types";

function transformToGifted(data: VolumeDataPoint[], timeframe: TimeframeOption) {
  // Map weekly volume points to array of { value, label }
  return (data || []).map((d) => ({ value: d.totalVolume || 0, label: new Date(d.date).toLocaleDateString() }));
}

export default function VolumeChart({ data, timeframe }: { data: VolumeDataPoint[]; timeframe: TimeframeOption }) {
  const chartData = transformToGifted(data || [], timeframe);

  if (!data || data.length === 0) {
    return (
      <View style={{ padding: 12 }}>
        <Text style={{ color: "#666" }}>No volume data available yet.</Text>
      </View>
    );
  }

  return (
    <View style={{ height: 220, paddingHorizontal: 8 }}>
      <LineChart
        data={chartData}
        hideRules
        areaChart
        spacing={20}
        initialSpacing={10}
        height={200}
        color='rgb(31,111,235)'
      />
    </View>
  );
}
