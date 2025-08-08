// ============================================================================
// AI INSIGHT COMPONENT
// ============================================================================
// Component for displaying AI progression insights and recommendations

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from "@/config/constants";
import { useAIUsage, getUsageStatusMessage, getUsageStatusColor } from "@/hooks/useAIUsage";
import type { AIInsightProps } from "@/types/ai";

// ============================================================================
// AI INSIGHT COMPONENT
// ============================================================================

export function AIInsight({
  insight,
  recommendation,
  loading = false,
  error,
  onAccept,
  onReject,
  onBookmark,
  onFeedback,
  compact = false,
  showActions = true,
}: AIInsightProps) {
  const { usage } = useAIUsage();

  // Show loading state
  if (loading) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingDot} />
          <View style={[styles.loadingDot, styles.loadingDotDelay1]} />
          <View style={[styles.loadingDot, styles.loadingDotDelay2]} />
        </View>
        <Text style={styles.loadingText}>AI coach is analyzing...</Text>
        {usage && <Text style={styles.usageStatus}>{getUsageStatusMessage(usage)}</Text>}
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.errorTitle}>AI Coach Unavailable</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <Text style={styles.fallbackMessage}>
          Continue with your current routine and focus on consistent training. Progress comes with time and dedication!
        </Text>
      </View>
    );
  }

  // Show insight content
  if (insight) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{insight.title}</Text>
            <View style={[styles.categoryBadge, getCategoryBadgeStyle(insight.category)]}>
              <Text style={styles.categoryText}>{insight.category.toUpperCase()}</Text>
            </View>
          </View>
          {insight.confidenceScore && (
            <View style={styles.confidenceContainer}>
              <Text style={styles.confidenceText}>{Math.round(insight.confidenceScore * 100)}% confidence</Text>
            </View>
          )}
        </View>

        <Text style={styles.summary}>{insight.summary}</Text>

        {!compact && insight.keyFindings.length > 0 && (
          <View style={styles.findingsContainer}>
            <Text style={styles.findingsTitle}>Key Findings:</Text>
            {insight.keyFindings.map((finding, index) => (
              <Text key={index} style={styles.findingItem}>
                • {finding}
              </Text>
            ))}
          </View>
        )}

        {insight.actionableRecommendations.length > 0 && (
          <View style={styles.recommendationsContainer}>
            <Text style={styles.recommendationsTitle}>Recommendations:</Text>
            {insight.actionableRecommendations.slice(0, compact ? 2 : 4).map((rec, index) => (
              <Text key={index} style={styles.recommendationItem}>
                {index + 1}. {rec}
              </Text>
            ))}
          </View>
        )}

        {showActions && (
          <View style={styles.actionsContainer}>
            {onBookmark && (
              <TouchableOpacity
                style={[styles.actionButton, styles.bookmarkButton]}
                onPress={() => onBookmark(insight.id)}>
                <Text style={styles.bookmarkButtonText}>{insight.isBookmarked ? "Bookmarked" : "Bookmark"}</Text>
              </TouchableOpacity>
            )}
            {onFeedback && (
              <TouchableOpacity
                style={[styles.actionButton, styles.feedbackButton]}
                onPress={() => onFeedback(insight.id, "helpful")}>
                <Text style={styles.feedbackButtonText}>Helpful</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.privacyText}>🔒 Your workout data is always private</Text>
          {usage && (
            <Text
              style={[
                styles.usageStatus,
                {
                  color:
                    getUsageStatusColor(usage) === "error" ? COLORS.accent.errorRed : COLORS.functional.neutralGray,
                },
              ]}>
              {getUsageStatusMessage(usage)}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Show recommendation content
  if (recommendation) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{recommendation.title}</Text>
            <View style={[styles.priorityBadge, getPriorityBadgeStyle(recommendation.priority)]}>
              <Text style={styles.priorityText}>{recommendation.priority.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.summary}>{recommendation.description}</Text>

        {recommendation.reasoning && !compact && (
          <View style={styles.reasoningContainer}>
            <Text style={styles.reasoningTitle}>Why this recommendation:</Text>
            <Text style={styles.reasoningText}>{recommendation.reasoning}</Text>
          </View>
        )}

        {showActions && (
          <View style={styles.actionsContainer}>
            {onAccept && (
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={() => onAccept(recommendation.id)}>
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
            )}
            {onReject && (
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => onReject(recommendation.id)}>
                <Text style={styles.rejectButtonText}>Not Now</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.privacyText}>🔒 Your workout data is always private</Text>
          {usage && (
            <Text
              style={[
                styles.usageStatus,
                {
                  color:
                    getUsageStatusColor(usage) === "error" ? COLORS.accent.errorRed : COLORS.functional.neutralGray,
                },
              ]}>
              {getUsageStatusMessage(usage)}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Empty state
  return (
    <View style={[styles.container, styles.emptyContainer]}>
      <Text style={styles.emptyTitle}>AI Coach Ready</Text>
      <Text style={styles.emptyMessage}>
        Complete a few workouts to get personalized progression insights from your AI coach.
      </Text>
      {usage && <Text style={styles.usageStatus}>{getUsageStatusMessage(usage)}</Text>}
    </View>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getCategoryBadgeStyle(category: string) {
  const categoryColors = {
    strength: COLORS.accent.successGreen,
    endurance: COLORS.accent.progressTeal,
    recovery: COLORS.accent.warningAmber,
    motivation: COLORS.primary.blue,
    technique: COLORS.secondary.blueDeep,
    planning: COLORS.functional.neutralGray,
  };

  return {
    backgroundColor: categoryColors[category as keyof typeof categoryColors] || COLORS.functional.neutralGray,
  };
}

function getPriorityBadgeStyle(priority: string) {
  const priorityColors = {
    low: COLORS.functional.neutralGray,
    medium: COLORS.accent.warningAmber,
    high: COLORS.accent.errorRed,
    urgent: COLORS.accent.errorRed,
  };

  return {
    backgroundColor: priorityColors[priority as keyof typeof priorityColors] || COLORS.functional.neutralGray,
  };
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.backgrounds.backgroundWhite,
    borderRadius: BORDER_RADIUS.large,
    padding: SPACING.lg,
    marginVertical: SPACING.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  containerCompact: {
    padding: SPACING.md,
    marginVertical: SPACING.xs,
  },

  // Loading states
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary.blue,
    marginHorizontal: 2,
    opacity: 0.4,
  },
  loadingDotDelay1: {
    opacity: 0.7,
  },
  loadingDotDelay2: {
    opacity: 1,
  },
  loadingText: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.primary.blue,
    textAlign: "center",
    fontWeight: TYPOGRAPHY.weights.medium,
    marginBottom: SPACING.sm,
  },

  // Error states
  errorContainer: {
    backgroundColor: COLORS.backgrounds.backgroundLight,
    borderColor: COLORS.accent.errorRed,
    borderWidth: 1,
  },
  errorTitle: {
    fontSize: TYPOGRAPHY.sizes.h3,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.accent.errorRed,
    marginBottom: SPACING.sm,
  },
  errorMessage: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.functional.neutralGray,
    marginBottom: SPACING.md,
  },
  fallbackMessage: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.functional.darkText,
    fontStyle: "italic",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.md,
  },
  titleContainer: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.h3,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.functional.darkText,
    marginBottom: SPACING.xs,
  },
  categoryBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.small,
    alignSelf: "flex-start",
  },
  categoryText: {
    fontSize: TYPOGRAPHY.sizes.caption,
    fontWeight: TYPOGRAPHY.weights.medium,
    color: COLORS.functional.lightText,
  },
  priorityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.small,
    alignSelf: "flex-start",
  },
  priorityText: {
    fontSize: TYPOGRAPHY.sizes.caption,
    fontWeight: TYPOGRAPHY.weights.medium,
    color: COLORS.functional.lightText,
  },
  confidenceContainer: {
    alignItems: "flex-end",
  },
  confidenceText: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    color: COLORS.functional.neutralGray,
    fontWeight: TYPOGRAPHY.weights.medium,
  },

  // Content
  summary: {
    fontSize: TYPOGRAPHY.sizes.bodyLarge,
    color: COLORS.functional.darkText,
    lineHeight: TYPOGRAPHY.lineHeights.bodyLarge,
    marginBottom: SPACING.md,
  },

  // Findings
  findingsContainer: {
    marginBottom: SPACING.md,
  },
  findingsTitle: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.functional.darkText,
    marginBottom: SPACING.sm,
  },
  findingItem: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.functional.darkText,
    marginBottom: SPACING.xs,
    paddingLeft: SPACING.sm,
  },

  // Recommendations
  recommendationsContainer: {
    marginBottom: SPACING.md,
  },
  recommendationsTitle: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.primary.blue,
    marginBottom: SPACING.sm,
  },
  recommendationItem: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.functional.darkText,
    marginBottom: SPACING.sm,
    lineHeight: TYPOGRAPHY.lineHeights.body,
  },

  // Reasoning
  reasoningContainer: {
    backgroundColor: COLORS.backgrounds.backgroundLight,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.medium,
    marginBottom: SPACING.md,
  },
  reasoningTitle: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.functional.neutralGray,
    marginBottom: SPACING.xs,
  },
  reasoningText: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.functional.darkText,
    lineHeight: TYPOGRAPHY.lineHeights.body,
  },

  // Actions
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  actionButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.medium,
    minWidth: 80,
    alignItems: "center",
  },
  acceptButton: {
    backgroundColor: COLORS.primary.blue,
  },
  acceptButtonText: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.medium,
    color: COLORS.functional.darkText,
  },
  rejectButton: {
    backgroundColor: "transparent",
    borderColor: COLORS.functional.neutralGray,
    borderWidth: 1,
  },
  rejectButtonText: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.medium,
    color: COLORS.functional.neutralGray,
  },
  bookmarkButton: {
    backgroundColor: "transparent",
    borderColor: COLORS.primary.blue,
    borderWidth: 1,
  },
  bookmarkButtonText: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.medium,
    color: COLORS.primary.blue,
  },
  feedbackButton: {
    backgroundColor: COLORS.accent.successGreen,
  },
  feedbackButtonText: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.medium,
    color: COLORS.functional.lightText,
  },

  // Footer
  footer: {
    borderTopColor: COLORS.secondary.gray,
    borderTopWidth: 1,
    paddingTop: SPACING.sm,
  },
  privacyText: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    color: COLORS.functional.neutralGray,
    textAlign: "center",
    marginBottom: SPACING.xs,
  },
  usageStatus: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    color: COLORS.functional.neutralGray,
    textAlign: "center",
    fontWeight: TYPOGRAPHY.weights.medium,
  },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    backgroundColor: COLORS.backgrounds.backgroundLight,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.sizes.h3,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.primary.blue,
    marginBottom: SPACING.sm,
  },
  emptyMessage: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.functional.neutralGray,
    textAlign: "center",
    lineHeight: TYPOGRAPHY.lineHeights.body,
    marginBottom: SPACING.md,
  },
});

export default AIInsight;
