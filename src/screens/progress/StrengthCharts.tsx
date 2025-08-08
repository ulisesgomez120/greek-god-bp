// ============================================================================
// STRENGTH CHARTS SCREEN
// ============================================================================
// Exercise-specific strength progression charts with multiple views

import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAppSelector } from "../../hooks/redux";
import { useProgressData } from "../../hooks/useProgressData";
import { Text } from "../../components/ui/Text";
import { Button } from "../../components/ui/Button";
import SkeletonLoader from "../../components/ui/SkeletonLoader";
import { logger } from "../../utils/logger";
import type { StrengthDataPoint } from "../../types";

// ============================================================================
// TYPES
// ============================================================================

interface StrengthChartsProps {
  navigation: any;
}

interface ExerciseStrengthData {
  exerciseId: string;
  exerciseName: string;
  data: StrengthDataPoint[];
  currentMax: number;
  previousMax: number;
  improvement: number;
  improvementPercentage: number;
}

interface ExerciseCardProps {
  exercise: ExerciseStrengthData;
  onPress: (exercise: ExerciseStrengthData) => void;
  timeframe: "month" | "quarter" | "year";
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatWeight(weight: number): string {
  return `${Math.round(weight)}kg`;
}

function formatImprovement(improvement: number, percentage: number): string {
  const sign = improvement >= 0 ? "+" : "";
  return `${sign}${Math.round(improvement)}kg (${sign}${percentage.toFixed(1)}%)`;
}

function getImprovementColor(improvement: number): string {
  if (improvement > 0) return "#34C759"; // Green for improvement
  if (improvement < 0) return "#FF3B30"; // Red for decline
  return "#8E8E93"; // Gray for no change
}

function getImprovementIcon(improvement: number): string {
  if (improvement > 0) return "↗️";
  if (improvement < 0) return "↘️";
  return "→";
}

function calculateStrengthMetrics(data: StrengthDataPoint[]): {
  currentMax: number;
  previousMax: number;
  improvement: number;
  improvementPercentage: number;
} {
  if (data.length === 0) {
    return { currentMax: 0, previousMax: 0, improvement: 0, improvementPercentage: 0 };
  }

  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const currentMax = sortedData[sortedData.length - 1]?.oneRepMax || 0;
  const previousMax = sortedData.length > 1 ? sortedData[0]?.oneRepMax || 0 : currentMax;

  const improvement = currentMax - previousMax;
  const improvementPercentage = previousMax > 0 ? (improvement / previousMax) * 100 : 0;

  return { currentMax, previousMax, improvement, improvementPercentage };
}

// ============================================================================
// EXERCISE CARD COMPONENT
// ============================================================================

const ExerciseCard: React.FC<ExerciseCardProps> = ({ exercise, onPress, timeframe }) => {
  const handlePress = () => {
    onPress(exercise);
  };

  const improvementColor = getImprovementColor(exercise.improvement);
  const improvementIcon = getImprovementIcon(exercise.improvement);

  return (
    <TouchableOpacity style={styles.exerciseCard} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
        <View style={styles.exerciseArrow}>
          <Text style={styles.exerciseArrowText}>›</Text>
        </View>
      </View>

      <View style={styles.exerciseStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Current 1RM</Text>
          <Text style={styles.statValue}>{formatWeight(exercise.currentMax)}</Text>
        </View>

        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Progress</Text>
          <View style={styles.improvementContainer}>
            <Text style={styles.improvementIcon}>{improvementIcon}</Text>
            <Text style={[styles.improvementText, { color: improvementColor }]}>
              {formatImprovement(exercise.improvement, exercise.improvementPercentage)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.exerciseFooter}>
        <Text style={styles.dataPointsText}>
          {exercise.data.length} data point{exercise.data.length !== 1 ? "s" : ""} • {timeframe}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const StrengthCharts: React.FC<StrengthChartsProps> = ({ navigation }) => {
  const user = useAppSelector((state) => state.auth.user);
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState<"month" | "quarter" | "year">("quarter");
  const [exerciseData, setExerciseData] = useState<ExerciseStrengthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Progress data hook
  const { strengthProgression, fetchStrengthProgression } = useProgressData({
    userId: user?.id,
    autoRefresh: false,
  });

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initial data load
  useEffect(() => {
    if (user?.id) {
      loadStrengthData();
    }
  }, [user?.id, timeframe]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user?.id && !loading) {
        loadStrengthData();
      }
    }, [user?.id, loading, timeframe])
  );

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const loadStrengthData = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      // For now, we'll use mock exercise IDs since we don't have a way to get all exercises
      // In a real implementation, you'd fetch the user's exercises first
      const mockExerciseIds = [
        "exercise-1", // Squat
        "exercise-2", // Bench Press
        "exercise-3", // Deadlift
        "exercise-4", // Overhead Press
      ];

      const mockExerciseNames = {
        "exercise-1": "Squat",
        "exercise-2": "Bench Press",
        "exercise-3": "Deadlift",
        "exercise-4": "Overhead Press",
      };

      const exerciseStrengthData: ExerciseStrengthData[] = [];

      for (const exerciseId of mockExerciseIds) {
        try {
          const data = await fetchStrengthProgression(exerciseId, timeframe);

          if (data && data.length > 0) {
            const metrics = calculateStrengthMetrics(data);

            exerciseStrengthData.push({
              exerciseId,
              exerciseName: mockExerciseNames[exerciseId as keyof typeof mockExerciseNames],
              data,
              ...metrics,
            });
          }
        } catch (exerciseError) {
          logger.warn(`Failed to load strength data for exercise ${exerciseId}`, exerciseError, "progress");
        }
      }

      setExerciseData(exerciseStrengthData);
    } catch (error) {
      logger.error("Failed to load strength charts data", error, "progress");
      setError("Failed to load strength data");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadStrengthData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleTimeframeChange = (newTimeframe: "month" | "quarter" | "year") => {
    setTimeframe(newTimeframe);
  };

  const handleExercisePress = (exercise: ExerciseStrengthData) => {
    // Navigate to detailed exercise chart view
    navigation.navigate("ExerciseChart", {
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      timeframe,
    });
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderTimeframeSelector = () => (
    <View style={styles.timeframeSelector}>
      {(["month", "quarter", "year"] as const).map((tf) => (
        <TouchableOpacity
          key={tf}
          style={[styles.timeframeButton, timeframe === tf && styles.timeframeButtonActive]}
          onPress={() => handleTimeframeChange(tf)}>
          <Text style={[styles.timeframeButtonText, timeframe === tf && styles.timeframeButtonTextActive]}>
            {tf.charAt(0).toUpperCase() + tf.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>📈</Text>
      <Text style={styles.emptyStateTitle}>No strength data available</Text>
      <Text style={styles.emptyStateText}>
        Complete some workouts with tracked exercises to see your strength progression here.
      </Text>
      <Button onPress={() => navigation.navigate("WorkoutSelection")} variant='primary' style={styles.emptyStateButton}>
        Start Workout
      </Button>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorState}>
      <Text style={styles.errorTitle}>Unable to Load Charts</Text>
      <Text style={styles.errorText}>
        We're having trouble loading your strength data. Please check your connection and try again.
      </Text>
      <Button onPress={loadStrengthData} variant='primary' style={styles.errorButton}>
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
      {renderTimeframeSelector()}
      <View style={styles.exercisesList}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.exerciseCard}>
            <SkeletonLoader width='100%' height={120} />
          </View>
        ))}
      </View>
    </ScrollView>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading && exerciseData.length === 0) {
    return renderLoadingState();
  }

  if (error && exerciseData.length === 0) {
    return renderErrorState();
  }

  if (exerciseData.length === 0) {
    return (
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        <View style={styles.header}>
          <Text style={styles.title}>Strength Charts</Text>
          <Text style={styles.subtitle}>Track your strength progression over time</Text>
        </View>
        {renderTimeframeSelector()}
        {renderEmptyState()}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Strength Charts</Text>
        <Text style={styles.subtitle}>
          {exerciseData.length} exercise{exerciseData.length !== 1 ? "s" : ""} tracked
        </Text>
      </View>

      {/* Timeframe Selector */}
      {renderTimeframeSelector()}

      {/* Exercises List */}
      <View style={styles.exercisesList}>
        {exerciseData.map((exercise) => (
          <ExerciseCard
            key={exercise.exerciseId}
            exercise={exercise}
            onPress={handleExercisePress}
            timeframe={timeframe}
          />
        ))}
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>About Strength Charts</Text>
        <Text style={styles.infoText}>
          These charts show your estimated 1RM (one-rep max) progression over time. The calculations are based on your
          actual sets and RPE ratings to provide accurate strength tracking.
        </Text>
      </View>
    </ScrollView>
  );
};

// ============================================================================
// STYLES
// ============================================================================

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
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F8FAFD",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F2F2F7",
    alignItems: "center",
  },
  timeframeButtonActive: {
    backgroundColor: "#B5CFF8",
    borderColor: "#87B1F3",
  },
  timeframeButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#8E8E93",
  },
  timeframeButtonTextActive: {
    color: "#1C1C1E",
    fontWeight: "600",
  },
  exercisesList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  exerciseCard: {
    backgroundColor: "#F8FAFD",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2F2F7",
  },
  exerciseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1C1C1E",
    flex: 1,
  },
  exerciseArrow: {
    marginLeft: 8,
  },
  exerciseArrowText: {
    fontSize: 20,
    color: "#8E8E93",
    fontWeight: "300",
  },
  exerciseStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 4,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  improvementContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  improvementIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  improvementText: {
    fontSize: 14,
    fontWeight: "600",
  },
  exerciseFooter: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  dataPointsText: {
    fontSize: 12,
    color: "#8E8E93",
  },
  infoSection: {
    margin: 20,
    padding: 16,
    backgroundColor: "#F8FAFD",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F2F2F7",
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: "#8E8E93",
    lineHeight: 18,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateText: {
    fontSize: 15,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyStateButton: {
    minWidth: 200,
  },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
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
});

export default StrengthCharts;
