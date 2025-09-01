// ============================================================================
// PROGRESS CHART COMPONENT
// ============================================================================
// Simple placeholder chart component (charts will be implemented later)

import React, { useMemo } from "react";
import { View, StyleSheet, Dimensions, Platform } from "react-native";
import { Text } from "../ui/Text";
import useUnitPreferences from "../../hooks/useUnitPreferences";
import { formatKgToLbsDisplay } from "../../utils/unitConversions";
import type { VolumeDataPoint, StrengthDataPoint } from "../../types";

// Victory Native imports (native only)
let CartesianChart: any = null;
let Line: any = null;
let Axis: any = null;

if (Platform.OS !== "web") {
  try {
    const victoryNative = require("victory-native");
    CartesianChart = victoryNative.CartesianChart;
    Line = victoryNative.Line;
    Axis = victoryNative.Axis;
  } catch (error) {
    console.warn("Victory Native not available:", error);
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface ProgressChartProps {
  plannedExerciseId: string;
  type: "volume" | "strength" | "rpe" | "trend";
  data?: VolumeDataPoint[] | StrengthDataPoint[];
  timeframe: "month" | "quarter" | "year";
  height?: number;
  showTrendLine?: boolean;
  interactive?: boolean;
  colorScheme?: "default" | "colorblind";
  onDataPointPress?: (dataPoint: any, index: number) => void;
  title?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getYAxisLabel(type: string): string {
  switch (type) {
    case "volume":
      return "Volume";
    case "strength":
      return "1RM";
    case "rpe":
      return "Average RPE";
    default:
      return "Value";
  }
}

function calculateStats(data: VolumeDataPoint[] | StrengthDataPoint[] | undefined, type: string) {
  if (!data || data.length === 0) {
    return { current: 0, previous: 0, change: 0, changePercent: 0 };
  }

  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let currentValue = 0;
  let previousValue = 0;

  if (type === "volume") {
    const volumeData = sortedData as VolumeDataPoint[];
    currentValue = volumeData[volumeData.length - 1]?.totalVolume || volumeData[volumeData.length - 1]?.volume || 0;
    previousValue = volumeData.length > 1 ? volumeData[0]?.totalVolume || volumeData[0]?.volume || 0 : currentValue;
  } else if (type === "strength") {
    const strengthData = sortedData as StrengthDataPoint[];
    currentValue =
      strengthData[strengthData.length - 1]?.oneRepMax || strengthData[strengthData.length - 1]?.estimatedMax || 0;
    previousValue =
      strengthData.length > 1 ? strengthData[0]?.oneRepMax || strengthData[0]?.estimatedMax || 0 : currentValue;
  } else if (type === "rpe") {
    const volumeData = sortedData as VolumeDataPoint[];
    currentValue = volumeData[volumeData.length - 1]?.averageRpe || 7;
    previousValue = volumeData.length > 1 ? volumeData[0]?.averageRpe || 7 : currentValue;
  }

  const change = currentValue - previousValue;
  const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;

  return { current: currentValue, previous: previousValue, change, changePercent };
}

function transformDataForChart(data: VolumeDataPoint[] | StrengthDataPoint[], type: string) {
  if (!data || data.length === 0) return [];

  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return sortedData.map((item, index) => {
    let yValue = 0;

    if (type === "volume") {
      const volumeItem = item as VolumeDataPoint;
      yValue = volumeItem.totalVolume || volumeItem.volume || 0;
    } else if (type === "strength") {
      const strengthItem = item as StrengthDataPoint;
      yValue = strengthItem.oneRepMax || strengthItem.estimatedMax || 0;
    } else if (type === "rpe") {
      const volumeItem = item as VolumeDataPoint;
      yValue = volumeItem.averageRpe || 7;
    }

    return {
      x: index, // Use index for x-axis to ensure consistent spacing
      y: yValue,
      date: item.date, // Keep original date for reference
    };
  });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ProgressChart: React.FC<ProgressChartProps> = ({ type, data, timeframe, height = 200, title }) => {
  const stats = useMemo(() => calculateStats(data, type), [data, type]);
  const chartData = useMemo(() => transformDataForChart(data || [], type), [data, type]);
  const { isImperial } = useUnitPreferences();

  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        {title && <Text style={styles.title}>{title}</Text>}
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No data available</Text>
          <Text style={styles.emptyStateSubtext}>Complete some workouts to see your progress here</Text>
        </View>
      </View>
    );
  }

  // Format values based on type
  const formatValue = (value: number) => {
    if (type === "rpe") {
      return value.toFixed(1);
    }
    return Math.round(value).toString();
  };

  const formatChange = (change: number, percent: number) => {
    const sign = change >= 0 ? "+" : "";
    if (type === "rpe") {
      return `${sign}${change.toFixed(1)} (${sign}${percent.toFixed(1)}%)`;
    }
    return `${sign}${Math.round(change)} (${sign}${percent.toFixed(1)}%)`;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return "#34C759"; // Green for improvement
    if (change < 0) return "#FF3B30"; // Red for decline
    return "#8E8E93"; // Gray for no change
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return "↗️";
    if (change < 0) return "↘️";
    return "→";
  };

  // Get chart dimensions
  const { width: screenWidth } = Dimensions.get("window");
  const chartWidth = screenWidth - 64; // Account for container padding
  const chartHeight = Math.max(120, height - 160); // Reserve space for stats and info

  // Render chart or fallback
  const renderChart = () => {
    // Web fallback
    if (Platform.OS === "web" || !CartesianChart || !Line || !Axis) {
      return (
        <View style={styles.chartPlaceholder}>
          <Text style={styles.placeholderText}>📊</Text>
          <Text style={styles.placeholderSubtext}>
            {Platform.OS === "web" ? "Chart available on mobile" : "Chart loading..."}
          </Text>
        </View>
      );
    }

    // Native chart rendering
    try {
      return (
        <View style={styles.chartContainer}>
          <CartesianChart
            data={chartData}
            xKey='x'
            yKeys={["y"]}
            padding={{ left: 40, right: 20, top: 10, bottom: 30 }}
            domainPadding={{ left: 20, right: 20, top: 20, bottom: 20 }}>
            {({ points, chartBounds }: { points: any; chartBounds: any }) => (
              <>
                <Axis
                  key='bottom'
                  orientation='bottom'
                  font={{ size: 12, color: "#8E8E93" }}
                  lineColor='#E5E5EA'
                  labelOffset={{ x: 0, y: 8 }}
                />
                <Axis
                  key='left'
                  orientation='left'
                  font={{ size: 12, color: "#8E8E93" }}
                  lineColor='#E5E5EA'
                  labelOffset={{ x: -8, y: 0 }}
                />
                <Line points={points.y} color='#007AFF' strokeWidth={2} animate={{ type: "timing", duration: 300 }} />
              </>
            )}
          </CartesianChart>
        </View>
      );
    } catch (error) {
      console.warn("Error rendering chart:", error);
      return (
        <View style={styles.chartPlaceholder}>
          <Text style={styles.placeholderText}>📊</Text>
          <Text style={styles.placeholderSubtext}>Chart error - check console</Text>
        </View>
      );
    }
  };

  return (
    <View style={[styles.container, { height }]}>
      {title && <Text style={styles.title}>{title}</Text>}

      {renderChart()}

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Current</Text>
          <Text style={styles.statValue}>
            {type === "volume" || type === "strength"
              ? isImperial()
                ? formatKgToLbsDisplay(stats.current)
                : `${Math.round(stats.current)} kg`
              : formatValue(stats.current)}
          </Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Change</Text>
          <View style={styles.changeContainer}>
            <Text style={styles.changeIcon}>{getChangeIcon(stats.change)}</Text>
            <Text style={[styles.changeText, { color: getChangeColor(stats.change) }]}>
              {formatChange(stats.change, stats.changePercent)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.chartInfo}>
        <Text style={styles.chartInfoLabel}>
          {getYAxisLabel(type)}
          {(type === "volume" || type === "strength") && (isImperial() ? " (lbs)" : " (kg)")}
        </Text>
        <Text style={styles.chartInfoValue}>
          {data.length} data point{data.length !== 1 ? "s" : ""} • {timeframe}
        </Text>
      </View>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 12,
  },
  chartContainer: {
    backgroundColor: "#F8FAFD",
    borderRadius: 8,
    marginBottom: 16,
    minHeight: 120,
    overflow: "hidden",
  },
  chartPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFD",
    borderRadius: 8,
    marginBottom: 16,
    minHeight: 120,
  },
  placeholderText: {
    fontSize: 32,
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 13,
    color: "#8E8E93",
    textAlign: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#8E8E93",
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: "#8E8E93",
    textAlign: "center",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
    paddingVertical: 12,
    backgroundColor: "#F8FAFD",
    borderRadius: 8,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statLabel: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 4,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  changeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  changeIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  changeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  chartInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  chartInfoLabel: {
    fontSize: 13,
    color: "#8E8E93",
    fontWeight: "500",
  },
  chartInfoValue: {
    fontSize: 13,
    color: "#8E8E93",
  },
});

export default ProgressChart;
