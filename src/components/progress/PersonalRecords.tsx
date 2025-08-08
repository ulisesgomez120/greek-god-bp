// ============================================================================
// PERSONAL RECORDS COMPONENT
// ============================================================================
// PR tracking and celebration component with animations

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Text } from "../ui/Text";
import type { PersonalRecord } from "../../types";

// ============================================================================
// TYPES
// ============================================================================

export interface PersonalRecordsProps {
  records: PersonalRecord[];
  showCelebration?: boolean;
  onRecordPress?: (record: PersonalRecord) => void;
  maxRecords?: number;
  title?: string;
}

interface PersonalRecordItemProps {
  record: PersonalRecord;
  onPress?: (record: PersonalRecord) => void;
  showCelebration?: boolean;
  index: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getRecordTypeLabel(type: string): string {
  switch (type) {
    case "weight":
      return "1RM";
    case "volume":
      return "Volume";
    case "reps":
      return "Reps";
    default:
      return "Record";
  }
}

function getRecordTypeIcon(type: string): string {
  switch (type) {
    case "weight":
      return "🏋️";
    case "volume":
      return "📊";
    case "reps":
      return "🔥";
    default:
      return "🏆";
  }
}

function formatRecordValue(record: PersonalRecord): string {
  switch (record.type) {
    case "weight":
      return `${Math.round(record.value)}kg`;
    case "volume":
      return `${Math.round(record.value)}kg`;
    case "reps":
      return `${record.value} reps`;
    default:
      return record.value.toString();
  }
}

function formatRecordDate(dateString: string): string {
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
  } else if (diffDays <= 30) {
    const weeks = Math.floor((diffDays - 1) / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

function isRecentRecord(dateString: string): boolean {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 7; // Consider records from last 7 days as recent
}

// ============================================================================
// PERSONAL RECORD ITEM COMPONENT
// ============================================================================

const PersonalRecordItem: React.FC<PersonalRecordItemProps> = ({ record, onPress, showCelebration, index }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const isRecent = isRecentRecord(record.achievedAt);

  useEffect(() => {
    // Staggered entrance animation
    const delay = index * 100;

    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Celebration glow animation for recent records
    if (showCelebration && isRecent) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [scaleAnim, glowAnim, showCelebration, isRecent, index]);

  const handlePress = () => {
    if (onPress) {
      onPress(record);
    }
  };

  return (
    <Animated.View
      style={[
        styles.recordItem,
        isRecent && showCelebration && styles.recentRecord,
        {
          transform: [{ scale: scaleAnim }],
          opacity: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.8],
          }),
        },
      ]}>
      <TouchableOpacity style={styles.recordContent} onPress={handlePress} activeOpacity={0.7}>
        {/* Record Icon */}
        <View style={styles.recordIcon}>
          <Text style={styles.recordIconText}>{getRecordTypeIcon(record.type)}</Text>
        </View>

        {/* Record Details */}
        <View style={styles.recordDetails}>
          <View style={styles.recordHeader}>
            <Text style={styles.recordType}>{getRecordTypeLabel(record.type)}</Text>
            {isRecent && showCelebration && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW!</Text>
              </View>
            )}
          </View>
          <Text style={styles.recordValue}>{formatRecordValue(record)}</Text>
          <Text style={styles.recordDate}>{formatRecordDate(record.achievedAt)}</Text>
        </View>

        {/* Arrow */}
        <View style={styles.recordArrow}>
          <Text style={styles.recordArrowText}>›</Text>
        </View>
      </TouchableOpacity>

      {/* Celebration overlay for recent records */}
      {isRecent && showCelebration && (
        <Animated.View
          style={[
            styles.celebrationOverlay,
            {
              opacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.1],
              }),
            },
          ]}
        />
      )}
    </Animated.View>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const PersonalRecords: React.FC<PersonalRecordsProps> = ({
  records,
  showCelebration = true,
  onRecordPress,
  maxRecords = 10,
  title = "Personal Records",
}) => {
  // Limit records and sort by date (most recent first)
  const displayRecords = records
    .sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime())
    .slice(0, maxRecords);

  // Handle empty state
  if (records.length === 0) {
    return (
      <View style={styles.container}>
        {title && <Text style={styles.title}>{title}</Text>}
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>🏆</Text>
          <Text style={styles.emptyStateText}>No personal records yet</Text>
          <Text style={styles.emptyStateSubtext}>Complete some workouts to start setting records!</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}

      {/* Records List */}
      <View style={styles.recordsList}>
        {displayRecords.map((record, index) => (
          <PersonalRecordItem
            key={`${record.exerciseId}-${record.type}-${record.achievedAt}`}
            record={record}
            onPress={onRecordPress}
            showCelebration={showCelebration}
            index={index}
          />
        ))}
      </View>

      {/* Show more indicator */}
      {records.length > maxRecords && (
        <View style={styles.showMoreContainer}>
          <Text style={styles.showMoreText}>+{records.length - maxRecords} more records</Text>
        </View>
      )}
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
    marginBottom: 16,
  },
  recordsList: {
    gap: 8,
  },
  recordItem: {
    backgroundColor: "#F8FAFD",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F2F2F7",
    overflow: "hidden",
  },
  recentRecord: {
    borderColor: "#34C759",
    borderWidth: 2,
  },
  recordContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
  },
  recordIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#B5CFF8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  recordIconText: {
    fontSize: 18,
  },
  recordDetails: {
    flex: 1,
  },
  recordHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  recordType: {
    fontSize: 13,
    fontWeight: "500",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  newBadge: {
    backgroundColor: "#34C759",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  recordValue: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 2,
  },
  recordDate: {
    fontSize: 12,
    color: "#8E8E93",
  },
  recordArrow: {
    marginLeft: 8,
  },
  recordArrowText: {
    fontSize: 18,
    color: "#8E8E93",
    fontWeight: "300",
  },
  celebrationOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#34C759",
    borderRadius: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
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
  showMoreContainer: {
    alignItems: "center",
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  showMoreText: {
    fontSize: 13,
    color: "#B5CFF8",
    fontWeight: "500",
  },
});

export default PersonalRecords;
