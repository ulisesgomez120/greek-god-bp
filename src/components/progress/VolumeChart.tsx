import React, { useState, useMemo } from "react";
import { View, Text, LayoutChangeEvent } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import useTheme from "@/hooks/useTheme";
import useUnitPreferences from "@/hooks/useUnitPreferences";
import { kgToLbs, formatKgToLbsDisplay } from "@/utils/unitConversions";
import { adjustHexAlpha } from "@/utils/colorUtils";
import { getChartConfig } from "@/utils/chartUtils";
import { formatShortDate } from "@/utils/dateUtils";
import type { VolumeDataPoint, TimeframeOption } from "@/types";

function transformToGifted(data: VolumeDataPoint[], timeframe: TimeframeOption, isMetric: boolean) {
  // Map volume points to array of { value, label } using compact date labels
  return (data || []).map((d) => {
    const valueKg = d.totalVolume || 0;
    const numericValue = isMetric ? Math.round(valueKg) : Math.round(kgToLbs(valueKg));
    return { value: numericValue, label: formatShortDate(d.date, timeframe) };
  });
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
  const { isMetric } = useUnitPreferences();
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w > 0) setContainerWidth(w);
  };

  const chartConfig = getChartConfig(containerWidth || 0, (data || []).length);

  const chartData = useMemo(() => transformToGifted(data || [], timeframe, isMetric()), [data, timeframe, isMetric]);

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
    <View onLayout={onLayout} style={{ height: 220, width: "100%" }}>
      <LineChart
        data={chartData}
        areaChart
        spacing={chartConfig.spacing}
        initialSpacing={chartConfig.initialSpacing}
        endSpacing={chartConfig.endSpacing}
        height={200}
        color={lineColor}
        dataPointsColor={dotColor}
        xAxisLabelTextStyle={{ color: axisTextColor, fontSize: 11 }}
        xAxisLabelsHeight={34}
        xAxisLabelsVerticalShift={-8}
        yAxisTextStyle={{ color: axisTextColor }}
        rulesColor={rulesColor}
        startFillColor={startFill}
        endFillColor={endFill}
      />
    </View>
  );
}
