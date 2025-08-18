// ============================================================================
// SYNC INDICATOR COMPONENT
// ============================================================================
// Sync status indicator component with progress display, conflict resolution,
// and user-friendly sync state communication

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { useAppSelector } from "../../hooks/redux";
import { logger } from "../../utils/logger";
import { selectOfflineQueue, selectSyncStatus } from "../../store/workout/workoutSlice";

// ============================================================================
// TYPES
// ============================================================================

export interface SyncIndicatorProps {
  style?: any;
  showDetails?: boolean;
  onPress?: () => void;
  compact?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SyncIndicator({ style, showDetails = false, onPress, compact = false }: SyncIndicatorProps) {
  // Online-first: derive network and pending state from Redux; background sync hooks removed.
  const networkStatus = useAppSelector((state) => state.ui.networkStatus);
  // Read pending items from workout slice via selectors (safe fallbacks handled in slice)
  const pendingWorkouts = useAppSelector(selectOfflineQueue);
  const sliceSyncStatus = useAppSelector(selectSyncStatus);

  // Maintain minimal syncState and conflicts placeholders for UI compatibility.
  const syncState = { isActive: false, progress: 0, currentWorkout: undefined, lastSyncTime: undefined, errorCount: 0 };
  const conflicts: any[] = [];
  const canSync = networkStatus === "online";
  // startSync/retry functions removed in online-first mode.
  const startSync = async () => {
    logger.info("startSync called, but background sync is disabled in online-first mode", undefined, "sync");
  };
  const retryFailedSync = async () => {
    logger.info("retryFailedSync called, but background sync is disabled in online-first mode", undefined, "sync");
  };

  // ============================================================================
  // SYNC STATUS LOGIC
  // ============================================================================

  const getSyncStatus = () => {
    if (!canSync) {
      return {
        status: "offline",
        color: "#FF9500",
        text: "Offline",
        icon: "📱",
        description: "Changes saved locally",
      };
    }

    if (syncState.isActive) {
      return {
        status: "syncing",
        color: "#64D2FF",
        text: "Syncing...",
        icon: "🔄",
        description: `${syncState.progress}% complete`,
      };
    }

    if (conflicts.length > 0) {
      return {
        status: "conflicts",
        color: "#FF9500",
        text: "Conflicts",
        icon: "⚠️",
        description: `${conflicts.length} conflict${conflicts.length !== 1 ? "s" : ""} need resolution`,
      };
    }

    if (syncState.errorCount > 0) {
      return {
        status: "error",
        color: "#FF3B30",
        text: "Sync Failed",
        icon: "❌",
        description: `${syncState.errorCount} workout${syncState.errorCount !== 1 ? "s" : ""} failed to sync`,
      };
    }

    if (pendingWorkouts.length > 0) {
      return {
        status: "pending",
        color: "#FF9500",
        text: "Pending",
        icon: "⏳",
        description: `${pendingWorkouts.length} workout${pendingWorkouts.length !== 1 ? "s" : ""} to sync`,
      };
    }

    if (syncState.lastSyncTime) {
      const lastSync = new Date(syncState.lastSyncTime);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - lastSync.getTime()) / (1000 * 60));

      let timeText = "just now";
      if (diffMinutes > 0) {
        if (diffMinutes < 60) {
          timeText = `${diffMinutes}m ago`;
        } else {
          const diffHours = Math.floor(diffMinutes / 60);
          timeText = `${diffHours}h ago`;
        }
      }

      return {
        status: "synced",
        color: "#34C759",
        text: "Synced",
        icon: "✅",
        description: `Last sync ${timeText}`,
      };
    }

    return {
      status: "idle",
      color: "#8E8E93",
      text: "Ready",
      icon: "☁️",
      description: "Ready to sync",
    };
  };

  const statusInfo = getSyncStatus();

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handlePress = () => {
    try {
      if (onPress) {
        onPress();
        return;
      }

      // Online-first: no background sync. Provide information to user/developers.
      if (pendingWorkouts.length > 0) {
        logger.info(
          "Pending workouts exist; user should retry when online or inspect offline queue",
          undefined,
          "sync"
        );
      } else {
        logger.info("Sync indicator pressed - no action in online-first mode", undefined, "sync");
      }
    } catch (error) {
      logger.error("Sync indicator action failed", error, "sync");
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderCompactIndicator = () => (
    <TouchableOpacity
      style={[styles.compactContainer, { borderColor: statusInfo.color }, style]}
      onPress={handlePress}
      activeOpacity={0.7}>
      <Text style={styles.compactIcon}>{statusInfo.icon}</Text>
      {syncState.isActive && <View style={[styles.progressDot, { backgroundColor: statusInfo.color }]} />}
    </TouchableOpacity>
  );

  const renderFullIndicator = () => (
    <TouchableOpacity style={[styles.container, style]} onPress={handlePress} activeOpacity={0.8}>
      <View style={styles.statusRow}>
        <Text style={styles.icon}>{statusInfo.icon}</Text>
        <View style={styles.textContainer}>
          <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.text}</Text>
          {showDetails && <Text style={styles.descriptionText}>{statusInfo.description}</Text>}
        </View>
        {syncState.isActive && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>{syncState.progress}%</Text>
          </View>
        )}
      </View>

      {syncState.isActive && (
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${syncState.progress}%`,
                backgroundColor: statusInfo.color,
              },
            ]}
          />
        </View>
      )}

      {showDetails && syncState.currentWorkout && (
        <Text style={styles.currentWorkoutText}>Syncing: {syncState.currentWorkout}</Text>
      )}
    </TouchableOpacity>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  if (compact) {
    return renderCompactIndicator();
  }

  return renderFullIndicator();
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  compactContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
  },
  compactIcon: {
    fontSize: 14,
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  descriptionText: {
    fontSize: 13,
    color: "#8E8E93",
    lineHeight: 18,
    marginTop: 2,
  },
  currentWorkoutText: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 8,
    fontStyle: "italic",
  },
  progressContainer: {
    marginLeft: 8,
  },
  progressText: {
    fontSize: 12,
    color: "#8E8E93",
    fontWeight: "500",
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: "#F2F2F7",
    borderRadius: 1.5,
    marginTop: 8,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 1.5,
  },
  progressDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
});

export default SyncIndicator;
