// ============================================================================
// WORKOUT HISTORY SCREEN
// ============================================================================
// Detailed workout history with filtering and search functionality

import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, TextInput } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAppSelector } from "../../hooks/redux";
import { useProgressData } from "../../hooks/useProgressData";
import { Text } from "../../components/ui/Text";
import { Button } from "../../components/ui/Button";
import SkeletonLoader from "../../components/ui/SkeletonLoader";
import { logger } from "../../utils/logger";
import type { WorkoutSession } from "../../types";

// ============================================================================
// TYPES
// ============================================================================

interface WorkoutHistoryProps {
  navigation: any;
}

interface WorkoutHistoryFilters {
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  minDuration?: number;
  maxDuration?: number;
}

interface WorkoutItemProps {
  workout: WorkoutSession;
  onPress: (workout: WorkoutSession) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatWorkoutDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return "Today";
  } else if (diffDays === 2) {
    return "Yesterday";
  } else if (diffDays <= 7) {
    return `${diffDays - 1} days ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
}

function formatWorkoutDuration(minutes?: number): string {
  if (!minutes) return "—";

  if (minutes < 60) {
    return `${minutes}min`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  }
}

function getWorkoutSummary(workout: WorkoutSession): string {
  const setCount = workout.sets?.length || 0;
  const exerciseCount = new Set(workout.sets?.map((set) => set.exerciseId)).size || 0;

  if (exerciseCount === 0) return "No exercises";
  if (exerciseCount === 1) return `1 exercise, ${setCount} sets`;
  return `${exerciseCount} exercises, ${setCount} sets`;
}

// ============================================================================
// WORKOUT ITEM COMPONENT
// ============================================================================

const WorkoutItem: React.FC<WorkoutItemProps> = ({ workout, onPress }) => {
  const handlePress = () => {
    onPress(workout);
  };

  return (
    <TouchableOpacity style={styles.workoutItem} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.workoutHeader}>
        <View style={styles.workoutTitleContainer}>
          <Text style={styles.workoutTitle}>{workout.name}</Text>
          <Text style={styles.workoutDate}>{formatWorkoutDate(workout.startedAt)}</Text>
        </View>
        <View style={styles.workoutStats}>
          <Text style={styles.workoutDuration}>{formatWorkoutDuration(workout.durationMinutes)}</Text>
        </View>
      </View>

      <View style={styles.workoutDetails}>
        <Text style={styles.workoutSummary}>{getWorkoutSummary(workout)}</Text>
        {workout.totalVolumeKg && (
          <Text style={styles.workoutVolume}>{Math.round(workout.totalVolumeKg)}kg total volume</Text>
        )}
        {workout.averageRpe && <Text style={styles.workoutRpe}>Avg RPE: {workout.averageRpe.toFixed(1)}</Text>}
      </View>

      {workout.notes && (
        <View style={styles.workoutNotes}>
          <Text style={styles.workoutNotesText} numberOfLines={2}>
            "{workout.notes}"
          </Text>
        </View>
      )}

      <View style={styles.workoutArrow}>
        <Text style={styles.workoutArrowText}>›</Text>
      </View>
    </TouchableOpacity>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const WorkoutHistory: React.FC<WorkoutHistoryProps> = ({ navigation }) => {
  const user = useAppSelector((state) => state.auth.user);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<WorkoutHistoryFilters>({});
  const [page, setPage] = useState(1);

  // Progress data hook
  const { workoutHistory, hasMoreWorkouts, workoutHistoryLoading, workoutHistoryError, fetchWorkoutHistory } =
    useProgressData({
      userId: user?.id,
      autoRefresh: false,
    });

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Initial data load
  useEffect(() => {
    if (user?.id) {
      loadWorkouts(true);
    }
  }, [user?.id, filters]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user?.id && !workoutHistoryLoading) {
        loadWorkouts(true);
      }
    }, [user?.id, workoutHistoryLoading])
  );

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const loadWorkouts = async (reset = false) => {
    if (!user?.id) return;

    try {
      const currentPage = reset ? 1 : page;
      const searchFilters = {
        ...filters,
        searchQuery: searchQuery.trim() || undefined,
      };

      await fetchWorkoutHistory(searchFilters, currentPage, 20, reset);

      if (reset) {
        setPage(1);
      }
    } catch (error) {
      logger.error("Failed to load workout history", error, "progress");
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadWorkouts(true);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    if (hasMoreWorkouts && !workoutHistoryLoading) {
      const nextPage = page + 1;
      setPage(nextPage);
      await loadWorkouts(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
  };

  const handleSearchSubmit = () => {
    loadWorkouts(true);
  };

  const handleWorkoutPress = (workout: WorkoutSession) => {
    // Navigate to workout details
    navigation.navigate("WorkoutDetails", { workoutId: workout.id });
  };

  const handleFilterPress = () => {
    // Navigate to filter screen or show filter modal
    navigation.navigate("WorkoutFilters", {
      currentFilters: filters,
      onFiltersChange: (newFilters: WorkoutHistoryFilters) => {
        setFilters(newFilters);
      },
    });
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <TextInput
        style={styles.searchInput}
        placeholder='Search workouts...'
        value={searchQuery}
        onChangeText={handleSearchChange}
        onSubmitEditing={handleSearchSubmit}
        returnKeyType='search'
        clearButtonMode='while-editing'
      />
      <TouchableOpacity style={styles.filterButton} onPress={handleFilterPress}>
        <Text style={styles.filterButtonText}>⚙️</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>💪</Text>
      <Text style={styles.emptyStateTitle}>No workouts found</Text>
      <Text style={styles.emptyStateText}>
        {searchQuery || Object.keys(filters).length > 0
          ? "Try adjusting your search or filters"
          : "Start your first workout to see it here"}
      </Text>
      {!searchQuery && Object.keys(filters).length === 0 && (
        <Button
          onPress={() => navigation.navigate("WorkoutSelection")}
          variant='primary'
          style={styles.emptyStateButton}>
          Start First Workout
        </Button>
      )}
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorState}>
      <Text style={styles.errorTitle}>Unable to Load Workouts</Text>
      <Text style={styles.errorText}>
        We're having trouble loading your workout history. Please check your connection and try again.
      </Text>
      <Button onPress={() => loadWorkouts(true)} variant='primary' style={styles.errorButton}>
        Retry
      </Button>
    </View>
  );

  const renderLoadingState = () => (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <SkeletonLoader width='60%' height={32} style={styles.titleSkeleton} />
      </View>
      {renderSearchBar()}
      <View style={styles.workoutsList}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.workoutItem}>
            <SkeletonLoader width='100%' height={80} />
          </View>
        ))}
      </View>
    </ScrollView>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  if (workoutHistoryLoading && workoutHistory.length === 0) {
    return renderLoadingState();
  }

  if (workoutHistoryError && workoutHistory.length === 0) {
    return renderErrorState();
  }

  if (workoutHistory.length === 0) {
    return (
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        <View style={styles.header}>
          <Text style={styles.title}>Workout History</Text>
        </View>
        {renderSearchBar()}
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
        <Text style={styles.title}>Workout History</Text>
        <Text style={styles.subtitle}>
          {workoutHistory.length} workout{workoutHistory.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Search Bar */}
      {renderSearchBar()}

      {/* Workouts List */}
      <View style={styles.workoutsList}>
        {workoutHistory.map((workout) => (
          <WorkoutItem key={workout.id} workout={workout} onPress={handleWorkoutPress} />
        ))}
      </View>

      {/* Load More Button */}
      {hasMoreWorkouts && (
        <View style={styles.loadMoreContainer}>
          <Button
            onPress={handleLoadMore}
            variant='secondary'
            loading={workoutHistoryLoading}
            style={styles.loadMoreButton}>
            Load More Workouts
          </Button>
        </View>
      )}
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
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: "#F8FAFD",
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#1C1C1E",
  },
  filterButton: {
    width: 40,
    height: 40,
    backgroundColor: "#F8FAFD",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonText: {
    fontSize: 16,
  },
  workoutsList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  workoutItem: {
    backgroundColor: "#F8FAFD",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F2F2F7",
  },
  workoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  workoutTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  workoutTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 2,
  },
  workoutDate: {
    fontSize: 13,
    color: "#8E8E93",
  },
  workoutStats: {
    alignItems: "flex-end",
  },
  workoutDuration: {
    fontSize: 15,
    fontWeight: "500",
    color: "#B5CFF8",
  },
  workoutDetails: {
    marginBottom: 8,
  },
  workoutSummary: {
    fontSize: 14,
    color: "#1C1C1E",
    marginBottom: 4,
  },
  workoutVolume: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 2,
  },
  workoutRpe: {
    fontSize: 13,
    color: "#8E8E93",
  },
  workoutNotes: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  workoutNotesText: {
    fontSize: 13,
    color: "#8E8E93",
    fontStyle: "italic",
  },
  workoutArrow: {
    position: "absolute",
    right: 16,
    top: "50%",
    marginTop: -10,
  },
  workoutArrowText: {
    fontSize: 20,
    color: "#8E8E93",
    fontWeight: "300",
  },
  loadMoreContainer: {
    padding: 20,
    paddingTop: 12,
  },
  loadMoreButton: {
    alignSelf: "center",
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

export default WorkoutHistory;
