// ============================================================================
// PROGRESS DASHBOARD SCREEN
// ============================================================================
// Main progress overview screen with analytics, charts, and personal records

import React, { useEffect, useState, useCallback } from "react";
import { View, ScrollView, StyleSheet, RefreshControl, Alert, Dimensions } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAppSelector } from "../../hooks/redux";
import { useProgressData } from "../../hooks/useProgressData";
import { useTempSubscription } from "../../hooks/useTempSubscription";
import { TempFeatureGate } from "../../components/subscription/TempFeatureGate";
import { Text } from "../../components/ui/Text";
import { Button } from "../../components/ui/Button";
import SkeletonLoader from "../../components/ui/SkeletonLoader";
import Toast from "../../components/ui/Toast";
// import ProgressChart from "../../components/progress/ProgressChart";
import PersonalRecords from "../../components/progress/PersonalRecords";
import { logger } from "../../utils/logger";
import useUnitPreferences from "../../hooks/useUnitPreferences";
import { formatKgToLbsDisplay } from "../../utils/unitConversions";
import type { PersonalRecord } from "../../types";

// ============================================================================
// TYPES
// ============================================================================

interface ProgressDashboardProps {
  navigation: any;
}

interface ProgressSummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "stable";
  onPress?: () => void;
}

// ============================================================================
// COMPONENTS
// ============================================================================

const ProgressSummaryCard: React.FC<ProgressSummaryCardProps> = ({ title, value, subtitle, trend, onPress }) => {
  const getTrendIcon = () => {
    switch (trend) {
      case "up":
        return "↗️";
      case "down":
        return "↘️";
      case "stable":
        return "→";
      default:
        return "";
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case "up":
        return "#34C759";
      case "down":
        return "#FF3B30";
      case "stable":
        return "#8E8E93";
      default:
        return "#000000";
    }
  };

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.cardValueContainer}>
        <Text style={styles.cardValue}>{value}</Text>
        {trend && <Text style={[styles.trendIcon, { color: getTrendColor() }]}>{getTrendIcon()}</Text>}
      </View>
      {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
      {onPress && (
        <Button onPress={onPress} variant='text' size='small' style={styles.cardButton}>
          View Details
        </Button>
      )}
    </View>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({ navigation }) => {
  const user = useAppSelector((state) => state.auth.user);
  const { subscription } = useTempSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<"month" | "quarter" | "year">("quarter");

  // Progress data hook
  const {
    analytics,
    workoutHistory,
    personalRecords,
    isLoading,
    hasError,
    fetchAnalytics,
    fetchWorkoutHistory,
    fetchPersonalRecords,
    refreshAllData,
  } = useProgressData({
    userId: user?.id,
    autoRefresh: true,
    refreshInterval: 60000, // 1 minute
  });

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initial data load
  useEffect(() => {
    if (user?.id) {
      loadInitialData();
    }
  }, [user?.id, selectedTimeframe]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user?.id && !isLoading) {
        refreshData();
      }
    }, [user?.id, isLoading])
  );

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const loadInitialData = async () => {
    try {
      // personalRecords requires a plannedExerciseId to scope results.
      // The dashboard shows summary analytics and workout history; skip unscoped personal records here.
      await Promise.all([fetchAnalytics(selectedTimeframe), fetchWorkoutHistory({}, 1, 10)]);
    } catch (error) {
      logger.error("Failed to load initial progress data", error, "progress");
      // Toast functionality would be implemented here
      console.error("Failed to load initial progress data:", error);
    }
  };

  const refreshData = async () => {
    try {
      await refreshAllData();
    } catch (error) {
      logger.error("Failed to refresh progress data", error, "progress");
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleTimeframeChange = (timeframe: "month" | "quarter" | "year") => {
    setSelectedTimeframe(timeframe);
  };

  const handleViewWorkoutHistory = () => {
    navigation.navigate("WorkoutHistory");
  };

  const handleViewStrengthCharts = () => {
    navigation.navigate("StrengthCharts");
  };

  const handleViewPersonalRecords = () => {
    navigation.navigate("PersonalRecords");
  };

  const handleExportData = async () => {
    try {
      Alert.alert("Export Progress Data", "This feature allows you to export your workout data and progress metrics.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Export JSON",
          onPress: () => exportData("json"),
        },
        {
          text: "Export CSV",
          onPress: () => exportData("csv"),
        },
      ]);
    } catch (error) {
      logger.error("Failed to export data", error, "progress");
      console.error("Export failed:", error);
    }
  };

  const exportData = async (format: "json" | "csv") => {
    // This would integrate with the progress service export functionality
    console.log(`Export started: ${format.toUpperCase()} format`);
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderTimeframeSelector = () => (
    <View style={styles.timeframeSelector}>
      {(["month", "quarter", "year"] as const).map((timeframe) => (
        <Button
          key={timeframe}
          onPress={() => handleTimeframeChange(timeframe)}
          variant={selectedTimeframe === timeframe ? "primary" : "secondary"}
          size='small'
          style={styles.timeframeButton}>
          {timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}
        </Button>
      ))}
    </View>
  );

  const renderProgressSummary = () => {
    if (!analytics) return null;

    // Unit-aware volume display
    const { isImperial } = useUnitPreferences();
    const volumeDisplay =
      typeof analytics.totalVolumeLifted === "number"
        ? isImperial()
          ? formatKgToLbsDisplay(analytics.totalVolumeLifted)
          : `${Math.round(analytics.totalVolumeLifted)} kg`
        : "—";

    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.sectionTitle}>Progress Summary</Text>
        <View style={styles.summaryGrid}>
          <ProgressSummaryCard
            title='Total Workouts'
            value={analytics.totalWorkouts}
            subtitle={`${selectedTimeframe} period`}
            trend='up'
            onPress={handleViewWorkoutHistory}
          />
          <ProgressSummaryCard title='Volume Lifted' value={volumeDisplay} subtitle='Total weight moved' trend='up' />
          <ProgressSummaryCard
            title='Avg Duration'
            value={`${Math.round(analytics.averageWorkoutDuration)}min`}
            subtitle='Per workout'
            trend='stable'
          />
          <ProgressSummaryCard
            title='Strength Score'
            value={analytics.strengthScore}
            subtitle='Relative to bodyweight'
            trend='up'
            onPress={handleViewStrengthCharts}
          />
        </View>
      </View>
    );
  };

  const renderPersonalRecordsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Personal Records</Text>
        <Button onPress={handleViewPersonalRecords} variant='text' size='small'>
          View All
        </Button>
      </View>
      <View style={styles.premiumPrompt}>
        <Text style={styles.premiumText}>Personal Records component will be integrated here</Text>
        <Text style={styles.premiumText}>{personalRecords.length} personal records available</Text>
      </View>
    </View>
  );

  const renderVolumeChart = () => {
    // Attempt to derive a plannedExerciseId from recent workout history
    const firstPlannedExerciseId =
      workoutHistory?.[0]?.sets?.find((s: any) => s.plannedExerciseId)?.plannedExerciseId ||
      workoutHistory?.[0]?.sets?.[0]?.plannedExerciseId;

    if (!firstPlannedExerciseId) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Volume Progression</Text>
          <View style={styles.premiumPrompt}>
            <Text style={styles.premiumText}>
              Volume charts require a planned exercise context. Open an exercise or start a workout from a plan to view
              charts.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Volume Progression</Text>
        {/* <TempFeatureGate
          featureKey='advanced_analytics'
          fallback={
            <View style={styles.premiumPrompt}>
              <Text style={styles.premiumText}>Upgrade to Premium to view detailed progress charts</Text>
              <Button onPress={() => navigation.navigate("TempSubscription")} variant='primary' size='small'>
                Upgrade Now
              </Button>
            </View>
          }>
          <ProgressChart
            plannedExerciseId={firstPlannedExerciseId}
            type='volume'
            timeframe={selectedTimeframe}
            height={200}
            showTrendLine={true}
            interactive={true}
          />
        </TempFeatureGate> */}
      </View>
    );
  };

  const renderZeroState = () => (
    <View style={styles.zeroState}>
      <Text style={styles.zeroStateTitle}>Start Your Fitness Journey</Text>
      <Text style={styles.zeroStateText}>
        Complete your first workout to see your progress here. We'll track your strength gains, volume progression, and
        personal records automatically.
      </Text>
      <Button onPress={() => navigation.navigate("WorkoutSelection")} variant='primary' style={styles.zeroStateButton}>
        Start First Workout
      </Button>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorState}>
      <Text style={styles.errorTitle}>Unable to Load Progress</Text>
      <Text style={styles.errorText}>
        We're having trouble loading your progress data. Please check your connection and try again.
      </Text>
      <Button onPress={refreshData} variant='primary' style={styles.errorButton}>
        Retry
      </Button>
    </View>
  );

  const renderLoadingState = () => (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <SkeletonLoader width='60%' height={32} style={styles.titleSkeleton} />
        <SkeletonLoader width='40%' height={20} />
      </View>
      <View style={styles.summaryContainer}>
        <SkeletonLoader width='50%' height={24} style={styles.sectionSkeleton} />
        <View style={styles.summaryGrid}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.summaryCard}>
              <SkeletonLoader width='80%' height={16} />
              <SkeletonLoader width='60%' height={24} style={{ marginTop: 8 }} />
              <SkeletonLoader width='70%' height={14} style={{ marginTop: 4 }} />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.section}>
        <SkeletonLoader width='60%' height={24} style={styles.sectionSkeleton} />
        <SkeletonLoader width='100%' height={200} />
      </View>
    </ScrollView>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isLoading && !analytics) {
    return renderLoadingState();
  }

  if (hasError) {
    return renderErrorState();
  }

  if (!analytics || analytics.totalWorkouts === 0) {
    return renderZeroState();
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Progress Dashboard</Text>
        <Text style={styles.subtitle}>Track your fitness journey and celebrate your achievements</Text>
      </View>

      {/* Timeframe Selector */}
      {renderTimeframeSelector()}

      {/* Progress Summary */}
      {renderProgressSummary()}

      {/* Volume Chart */}
      {renderVolumeChart()}

      {/* Personal Records */}
      {renderPersonalRecordsSection()}

      {/* Export Data (Premium Feature) */}
      <TempFeatureGate featureKey='data_export' fallback={null}>
        <View style={styles.section}>
          <Button onPress={handleExportData} variant='secondary' style={styles.exportButton}>
            Export Progress Data
          </Button>
        </View>
      </TempFeatureGate>
    </ScrollView>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const { width } = Dimensions.get("window");
const cardWidth = (width - 48) / 2; // 2 cards per row with margins

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: "#8E8E93",
    lineHeight: 20,
  },
  timeframeSelector: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 8,
  },
  timeframeButton: {
    flex: 1,
  },
  summaryContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryCard: {
    width: cardWidth,
    backgroundColor: "#F8FAFD",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2F2F7",
  },
  cardTitle: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 8,
    fontWeight: "500",
  },
  cardValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1C1C1E",
    flex: 1,
  },
  trendIcon: {
    fontSize: 16,
    fontWeight: "600",
  },
  cardSubtitle: {
    fontSize: 11,
    color: "#8E8E93",
    marginBottom: 8,
  },
  cardButton: {
    alignSelf: "flex-start",
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  premiumPrompt: {
    backgroundColor: "#F8FAFD",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#B5CFF8",
    borderStyle: "dashed",
  },
  premiumText: {
    fontSize: 15,
    color: "#8E8E93",
    textAlign: "center",
    marginBottom: 12,
  },
  exportButton: {
    marginTop: 8,
  },
  zeroState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  zeroStateTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 12,
    textAlign: "center",
  },
  zeroStateText: {
    fontSize: 15,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  zeroStateButton: {
    minWidth: 200,
  },
  errorState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FF3B30",
    marginBottom: 12,
    textAlign: "center",
  },
  errorText: {
    fontSize: 15,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  errorButton: {
    minWidth: 120,
  },
  titleSkeleton: {
    marginBottom: 8,
  },
  sectionSkeleton: {
    marginBottom: 16,
  },
});

export default ProgressDashboard;
