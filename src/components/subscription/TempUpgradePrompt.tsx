// ============================================================================
// TEMPORARY UPGRADE PROMPT COMPONENT
// ============================================================================
// Modal component for showing upgrade prompts with testing context and
// feature-specific messaging during the testing phase.

import React, { useState, useEffect } from "react";
import { View, Modal, TouchableOpacity, StyleSheet, Animated, ScrollView } from "react-native";
import { Text } from "../ui/Text";
import { useFeatureGate } from "../../hooks/useFeatureAccess";
import { useTempSubscription } from "../../hooks/useTempSubscription";
import type { FeatureKey } from "../../constants/subscriptionTiers";

// ============================================================================
// TYPES
// ============================================================================

export interface TempUpgradePromptProps {
  featureKey: FeatureKey;
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => Promise<void>;
  showPreview?: boolean;
}

interface FeatureBenefitProps {
  benefit: string;
  index: number;
}

interface PlanComparisonProps {
  currentPlan: string;
  recommendedPlan: string;
  newFeatures: string[];
}

// ============================================================================
// FEATURE BENEFIT COMPONENT
// ============================================================================

function FeatureBenefit({ benefit, index }: FeatureBenefitProps) {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      delay: index * 100,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, index]);

  return (
    <Animated.View style={[styles.benefitItem, { opacity: fadeAnim }]}>
      <View style={styles.benefitIcon}>
        <Text style={styles.benefitIconText}>✓</Text>
      </View>
      <Text style={styles.benefitText}>{benefit}</Text>
    </Animated.View>
  );
}

// ============================================================================
// PLAN COMPARISON COMPONENT
// ============================================================================

function PlanComparison({ currentPlan, recommendedPlan, newFeatures }: PlanComparisonProps) {
  return (
    <View style={styles.planComparison}>
      <Text style={styles.comparisonTitle}>What you'll unlock:</Text>

      <View style={styles.comparisonRow}>
        <View style={styles.currentPlanBox}>
          <Text style={styles.currentPlanLabel}>Current</Text>
          <Text style={styles.currentPlanName}>{currentPlan}</Text>
        </View>

        <View style={styles.arrow}>
          <Text style={styles.arrowText}>→</Text>
        </View>

        <View style={styles.recommendedPlanBox}>
          <Text style={styles.recommendedPlanLabel}>Upgrade to</Text>
          <Text style={styles.recommendedPlanName}>{recommendedPlan}</Text>
        </View>
      </View>

      {newFeatures.length > 0 && (
        <View style={styles.newFeatures}>
          <Text style={styles.newFeaturesTitle}>New features you'll get:</Text>
          {newFeatures.slice(0, 3).map((feature, index) => (
            <View key={index} style={styles.newFeatureItem}>
              <Text style={styles.newFeatureIcon}>+</Text>
              <Text style={styles.newFeatureText}>{feature}</Text>
            </View>
          ))}
          {newFeatures.length > 3 && <Text style={styles.moreFeatures}>+ {newFeatures.length - 3} more features</Text>}
        </View>
      )}
    </View>
  );
}

// ============================================================================
// TESTING BANNER COMPONENT
// ============================================================================

function TestingBanner({ testingNote }: { testingNote: string }) {
  return (
    <View style={styles.testingBanner}>
      <View style={styles.testingIcon}>
        <Text style={styles.testingIconText}>🧪</Text>
      </View>
      <View style={styles.testingContent}>
        <Text style={styles.testingTitle}>Testing Mode</Text>
        <Text style={styles.testingDescription}>{testingNote}</Text>
      </View>
    </View>
  );
}

// ============================================================================
// MAIN UPGRADE PROMPT COMPONENT
// ============================================================================

export function TempUpgradePrompt({
  featureKey,
  visible,
  onClose,
  onUpgrade,
  showPreview = true,
}: TempUpgradePromptProps) {
  const [slideAnim] = useState(new Animated.Value(0));
  const [upgrading, setUpgrading] = useState(false);

  const { subscription } = useTempSubscription();
  const { upgradePrompt, featureInfo, canStartPreview, startPreview, accessResult } = useFeatureGate(featureKey, {
    allowPreview: true,
  });

  // Animate modal appearance
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  // Handle upgrade
  const handleUpgrade = async () => {
    try {
      setUpgrading(true);
      await onUpgrade();
    } catch (error) {
      console.error("Upgrade failed:", error);
    } finally {
      setUpgrading(false);
    }
  };

  // Handle preview
  const handlePreview = () => {
    const success = startPreview();
    if (success) {
      onClose();
    }
  };

  if (!upgradePrompt || !featureInfo) {
    return null;
  }

  const currentPlanName =
    subscription?.plan === "free"
      ? "Free"
      : subscription?.plan === "premium"
      ? "Premium (Testing)"
      : subscription?.plan === "coach"
      ? "Coach (Testing)"
      : "Free";

  const recommendedPlanName =
    accessResult.recommendedTier === "premium"
      ? "Premium (Testing)"
      : accessResult.recommendedTier === "coach"
      ? "Coach (Testing)"
      : "Premium (Testing)";

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackground} activeOpacity={1} onPress={onClose} />

        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [300, 0],
                  }),
                },
                {
                  scale: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
            },
          ]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Feature Icon and Title */}
            <View style={styles.featureHeader}>
              <View style={styles.featureIconContainer}>
                <Text style={styles.featureIcon}>{featureInfo.icon}</Text>
              </View>
              <Text style={styles.upgradeTitle}>{upgradePrompt.title}</Text>
              <Text style={styles.upgradeDescription}>{upgradePrompt.description}</Text>
            </View>

            {/* Testing Banner */}
            <TestingBanner testingNote={upgradePrompt.testingNote} />

            {/* Benefits List */}
            <View style={styles.benefitsSection}>
              <Text style={styles.benefitsTitle}>What you'll get:</Text>
              {upgradePrompt.benefits.map((benefit: string, index: number) => (
                <FeatureBenefit key={index} benefit={benefit} index={index} />
              ))}
            </View>

            {/* Plan Comparison */}
            <PlanComparison
              currentPlan={currentPlanName}
              recommendedPlan={recommendedPlanName}
              newFeatures={upgradePrompt.benefits}
            />

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {/* Preview Button */}
              {showPreview && canStartPreview && (
                <TouchableOpacity style={styles.previewButton} onPress={handlePreview} activeOpacity={0.7}>
                  <Text style={styles.previewButtonText}>👁️ Try Preview First</Text>
                </TouchableOpacity>
              )}

              {/* Upgrade Button */}
              <TouchableOpacity
                style={[styles.upgradeButton, upgrading && styles.upgradeButtonLoading]}
                onPress={handleUpgrade}
                disabled={upgrading}
                activeOpacity={0.7}>
                <Text style={styles.upgradeButtonText}>{upgrading ? "Upgrading..." : upgradePrompt.ctaText}</Text>
              </TouchableOpacity>

              {/* Cancel Button */}
              <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>Maybe Later</Text>
              </TouchableOpacity>
            </View>

            {/* Footer Note */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>You can cancel anytime during testing. No payment required.</Text>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingBottom: 34, // Safe area padding
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 16,
    paddingBottom: 0,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 16,
    color: "#8E8E93",
    fontWeight: "600",
  },
  featureHeader: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  featureIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F8FAFD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  featureIcon: {
    fontSize: 32,
  },
  upgradeTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000000",
    textAlign: "center",
    marginBottom: 8,
  },
  upgradeDescription: {
    fontSize: 17,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 22,
  },
  testingBanner: {
    flexDirection: "row",
    backgroundColor: "#FFF4E6",
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FF9500",
  },
  testingIcon: {
    marginRight: 12,
  },
  testingIconText: {
    fontSize: 20,
  },
  testingContent: {
    flex: 1,
  },
  testingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FF9500",
    marginBottom: 4,
  },
  testingDescription: {
    fontSize: 13,
    color: "#8E8E93",
    lineHeight: 18,
  },
  benefitsSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  benefitIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  benefitIconText: {
    fontSize: 12,
    color: "#34C759",
    fontWeight: "700",
  },
  benefitText: {
    fontSize: 15,
    color: "#000000",
    flex: 1,
    lineHeight: 20,
  },
  planComparison: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 16,
    backgroundColor: "#F8FAFD",
    borderRadius: 12,
  },
  comparisonTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 16,
    textAlign: "center",
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  currentPlanBox: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F2F2F7",
  },
  currentPlanLabel: {
    fontSize: 11,
    color: "#8E8E93",
    fontWeight: "500",
    marginBottom: 4,
  },
  currentPlanName: {
    fontSize: 15,
    color: "#000000",
    fontWeight: "600",
  },
  arrow: {
    paddingHorizontal: 16,
  },
  arrowText: {
    fontSize: 20,
    color: "#B5CFF8",
    fontWeight: "600",
  },
  recommendedPlanBox: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    backgroundColor: "#B5CFF8",
    borderRadius: 8,
  },
  recommendedPlanLabel: {
    fontSize: 11,
    color: "#1C1C1E",
    fontWeight: "500",
    marginBottom: 4,
  },
  recommendedPlanName: {
    fontSize: 15,
    color: "#1C1C1E",
    fontWeight: "700",
  },
  newFeatures: {
    marginTop: 8,
  },
  newFeaturesTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
    marginBottom: 8,
  },
  newFeatureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  newFeatureIcon: {
    fontSize: 12,
    color: "#34C759",
    fontWeight: "700",
    marginRight: 8,
    width: 16,
    textAlign: "center",
  },
  newFeatureText: {
    fontSize: 13,
    color: "#8E8E93",
    flex: 1,
  },
  moreFeatures: {
    fontSize: 13,
    color: "#B5CFF8",
    fontWeight: "500",
    marginTop: 4,
    textAlign: "center",
  },
  actionButtons: {
    paddingHorizontal: 24,
    gap: 12,
  },
  previewButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "#F8FAFD",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#B5CFF8",
    alignItems: "center",
  },
  previewButtonText: {
    fontSize: 17,
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
    fontWeight: "700",
    color: "#1C1C1E",
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: "500",
    color: "#8E8E93",
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: "center",
  },
  footerText: {
    fontSize: 13,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 18,
  },
});

export default TempUpgradePrompt;
