import React from "react";
import { View, Text } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import useTheme from "@/hooks/useTheme";
import { adjustHexAlpha } from "@/utils/colorUtils";
import type { VolumeDataPoint, TimeframeOption } from "@/types";

function transformToGifted(data: VolumeDataPoint[], timeframe: TimeframeOption) {
  // Map weekly volume points to array of { value, label }
  console.log("Transforming volume data for timeframe:", data);
  return (data || []).map((d) => ({ value: d.totalVolume || 0, label: new Date(d.date).toLocaleDateString() }));
}

export default function VolumeChart({
  data,
  timeframe,
  colorOverrides,
}: {
  data: VolumeDataPoint[];
  timeframe: TimeframeOption;
  colorOverrides?: {
    line?: string;
    dot?: string;
    axisText?: string;
    rules?: string;
    startFill?: string;
    endFill?: string;
  };
}) {
  const chartData = transformToGifted(data || [], timeframe);
  const { colors } = useTheme();

  // Determine colors with sensible fallbacks and allow optional overrides
  const lineColor = colorOverrides?.line || colors.primary;
  const dotColor = colorOverrides?.dot || lineColor;
  const axisTextColor = colorOverrides?.axisText || colors.subtext;
  const rulesColor = colorOverrides?.rules || colors.border;

  // Use subtle area fill derived from the line color when not overridden
  const startFill = colorOverrides?.startFill || adjustHexAlpha(lineColor, 0.15);
  const endFill = colorOverrides?.endFill || adjustHexAlpha(lineColor, 0.03);

  if (!data || data.length === 0) {
    return (
      <View style={{ padding: 12 }}>
        <Text style={{ color: colors.subtext }}>No volume data available yet.</Text>
      </View>
    );
  }

  return (
    <View style={{ height: 220, paddingHorizontal: 8 }}>
      <LineChart
        data={chartData}
        areaChart
        spacing={20}
        initialSpacing={10}
        height={200}
        color={lineColor}
        dataPointsColor={dotColor}
        xAxisLabelTextStyle={{ color: axisTextColor }}
        yAxisTextStyle={{ color: axisTextColor }}
        rulesColor={rulesColor}
        startFillColor={startFill}
        endFillColor={endFill}
      />
    </View>
  );
}
