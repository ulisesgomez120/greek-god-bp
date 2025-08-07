// ============================================================================
// TEMPORARY FEATURE GATE COMPONENT
// ============================================================================
// Wrapper component that controls access to premium features during testing
// phase. Shows upgrade prompts and handles feature previews elegantly.

import React, { useState, useEffect } from "react";
import { View, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Text } from "../ui/Text";
import { useFeatureGate } from "../../hooks/useFeatureAccess";
import { TempUpgradePrompt } from "./TempUpgradePrompt";
import type { FeatureKey } from "../../constants/subscriptionTiers";

// ============================================================================
// TYPES
// ============================================================================

export interface TempFeatureGateProps {
  featureKey: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
  allowPreview?: boolean;
  onUpgradePress?: () => void;
  onPreviewStart?: () => void;
  onPreviewEnd?: () => void;
  style?: any;
}

interface FeatureLockOverlayProps {
  featureInfo: any;
  upgradePrompt: any;
  canStartPreview: boolean;
  isPreviewActive: boolean;
  previewTimeRemaining: number;
  onUpgrade: () => void;
  onStartPreview: () => void;
  onEndPreview: () => void;
  upgrading: boolean;
}

// ============================================================================
// FEATURE LOCK OVERLAY COMPONENT
// ============================================================================

function FeatureLockOverlay({
  featureInfo,
  upgradePrompt,
  canStartPreview,
  isPreviewActive,
  previewTimeRemaining,
  onUpgrade,
  onStartPreview,
  onEndPreview,
  upgrading,
}: FeatureLockOverlayProps) {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      {/* Background blur effect */}
      <View style={styles.overlayBackground} />

      {/* Lock icon and feature info */}
      <View style={styles.lockContainer}>
        <View style={styles.lockIcon}>
          <Text style={styles.lockIconText}>🔒</Text>
        </View>

        <Text style={styles.featureName}>{featureInfo.name}</Text>
        <Text style={styles.featureDescription}>{featureInfo.description}</Text>

        {/* Preview status */}
        {isPreviewActive && (
          <View style={styles.previewStatus}>
            <Text style={styles.previewLabel}>Preview Active</Text>
            <Text style={styles.previewTime}>{formatTime(previewTimeRemaining)} remaining</Text>
            <TouchableOpacity style={styles.endPreviewButton} onPress={onEndPreview} activeOpacity={0.7}>
              <Text style={styles.endPreviewText}>End Preview</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action buttons */}
        {!isPreviewActive && (
          <View style={styles.actionButtons}>
            {/* Preview button */}
            {canStartPreview && (
              <TouchableOpacity style={styles.previewButton} onPress={onStartPreview} activeOpacity={0.7}>
                <Text style={styles.previewButtonText}>👁️ Try Preview</Text>
              </TouchableOpacity>
            )}

            {/* Upgrade button */}
            <TouchableOpacity
              style={[styles.upgradeButton, upgrading && styles.upgradeButtonLoading]}
              onPress={onUpgrade}
              disabled={upgrading}
              activeOpacity={0.7}>
              <Text style={styles.upgradeButtonText}>{upgrading ? "Upgrading..." : upgradePrompt.ctaText}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Testing note */}
        <View style={styles.testingNote}>
          <Text style={styles.testingNoteText}>{upgradePrompt.testingNote}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ============================================================================
// PREVIEW TIMER COMPONENT
// ============================================================================

function PreviewTimer({ timeRemaining, onEnd }: { timeRemaining: number; onEnd: () => void }) {
  const [progress] = useState(new Animated.Value(1));

  useEffect(() => {
    if (timeRemaining <= 0) {
      onEnd();
      return;
    }

    // Animate progress bar
    Animated.timing(progress, {
      toValue: 0,
      duration: timeRemaining * 1000,
      useNativeDriver: false,
    }).start();
  }, [timeRemaining, progress, onEnd]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <View style={styles.previewTimer}>
      <View style={styles.previewTimerHeader}>
        <Text style={styles.previewTimerLabel}>Preview Mode</Text>
        <Text style={styles.previewTimerTime}>{formatTime(timeRemaining)}</Text>
      </View>
      <View style={styles.previewProgressBar}>
        <Animated.View
          style={[
            styles.previewProgress,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

// ============================================================================
// MAIN FEATURE GATE COMPONENT
// ============================================================================

export function TempFeatureGate({
  featureKey,
  children,
  fallback,
  showUpgradePrompt = true,
  allowPreview = true,
  onUpgradePress,
  onPreviewStart,
  onPreviewEnd,
  style,
}: TempFeatureGateProps) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const {
    hasAccess,
    accessResult,
    isPreviewActive,
    previewTimeRemaining,
    canStartPreview,
    startPreview,
    endPreview,
    handleUpgrade,
    upgradePrompt,
    featureInfo,
    loading,
    upgrading,
  } = useFeatureGate(featureKey, { allowPreview });

  // Handle preview start
  const handlePreviewStart = () => {
    const success = startPreview();
    if (success) {
      onPreviewStart?.();
    }
  };

  // Handle preview end
  const handlePreviewEnd = () => {
    endPreview();
    onPreviewEnd?.();
  };

  // Handle upgrade
  const handleUpgradePress = async () => {
    if (onUpgradePress) {
      onUpgradePress();
    } else if (showUpgradePrompt) {
      setShowUpgradeModal(true);
    } else {
      await handleUpgrade();
    }
  };

  // Show loading state
  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Checking access...</Text>
        </View>
      </View>
    );
  }

  // Show content if user has access
  if (hasAccess) {
    return (
      <View style={[styles.container, style]}>
        {/* Show preview timer if in preview mode */}
        {isPreviewActive && <PreviewTimer timeRemaining={previewTimeRemaining} onEnd={handlePreviewEnd} />}
        {children}
      </View>
    );
  }

  // Show fallback if provided and no upgrade prompt
  if (fallback && !showUpgradePrompt) {
    return <View style={[styles.container, style]}>{fallback}</View>;
  }

  // Show feature lock overlay
  return (
    <View style={[styles.container, style]}>
      {/* Render children with reduced opacity to show what's locked */}
      <View style={styles.lockedContent}>{children}</View>

      {/* Feature lock overlay */}
      <FeatureLockOverlay
        featureInfo={featureInfo}
        upgradePrompt={upgradePrompt}
        canStartPreview={canStartPreview && allowPreview}
        isPreviewActive={isPreviewActive}
        previewTimeRemaining={previewTimeRemaining}
        onUpgrade={handleUpgradePress}
        onStartPreview={handlePreviewStart}
        onEndPreview={handlePreviewEnd}
        upgrading={upgrading}
      />

      {/* Upgrade modal */}
      {showUpgradeModal && (
        <TempUpgradePrompt
          featureKey={featureKey}
          visible={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          onUpgrade={async () => {
            await handleUpgrade();
            setShowUpgradeModal(false);
          }}
        />
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFD",
    borderRadius: 12,
  },
  loadingText: {
    fontSize: 15,
    color: "#8E8E93",
  },
  lockedContent: {
    opacity: 0.3,
    pointerEvents: "none",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  overlayBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
  },
  lockContainer: {
    alignItems: "center",
    padding: 24,
    maxWidth: 280,
  },
  lockIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  lockIconText: {
    fontSize: 24,
  },
  featureName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000000",
    textAlign: "center",
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 15,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  previewStatus: {
    alignItems: "center",
    marginBottom: 20,
    padding: 16,
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#34C759",
  },
  previewLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#34C759",
    marginBottom: 4,
  },
  previewTime: {
    fontSize: 17,
    fontWeight: "700",
    color: "#34C759",
    marginBottom: 12,
  },
  endPreviewButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#34C759",
    borderRadius: 8,
  },
  endPreviewText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  actionButtons: {
    width: "100%",
    gap: 12,
  },
  previewButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#F8FAFD",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#B5CFF8",
    alignItems: "center",
  },
  previewButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#B5CFF8",
  },
  upgradeButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "#B5CFF8",
    borderRadius: 12,
    alignItems: "center",
  },
  upgradeButtonLoading: {
    opacity: 0.6,
  },
  upgradeButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  testingNote: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  testingNoteText: {
    fontSize: 13,
    color: "#B5CFF8",
    textAlign: "center",
    fontWeight: "500",
  },
  previewTimer: {
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#34C759",
  },
  previewTimerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  previewTimerLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#34C759",
  },
  previewTimerTime: {
    fontSize: 15,
    fontWeight: "700",
    color: "#34C759",
  },
  previewProgressBar: {
    height: 4,
    backgroundColor: "rgba(52, 199, 89, 0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  previewProgress: {
    height: "100%",
    backgroundColor: "#34C759",
    borderRadius: 2,
  },
});

export default TempFeatureGate;
