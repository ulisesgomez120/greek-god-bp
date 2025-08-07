// ============================================================================
// TEMPORARY PLAN SELECTOR COMPONENT
// ============================================================================
// Component for selecting temporary subscription plans during testing phase.
// This will be replaced with native IAP plan selector when ready for production.

import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Text } from "../ui/Text";
import type { TempSubscriptionPlan } from "../../types/tempSubscription";

// ============================================================================
// TYPES
// ============================================================================

interface TempPlanSelectorProps {
  selectedPlan: TempSubscriptionPlan;
  onPlanSelect: (plan: TempSubscriptionPlan) => void;
  currentPlan: TempSubscriptionPlan;
  disabled?: boolean;
}

interface PlanCardProps {
  plan: TempSubscriptionPlan;
  title: string;
  price: string;
  features: string[];
  isSelected: boolean;
  isCurrent: boolean;
  onSelect: () => void;
  disabled?: boolean;
  testingLabel?: string;
}

// ============================================================================
// PLAN CARD COMPONENT
// ============================================================================

function PlanCard({
  plan,
  title,
  price,
  features,
  isSelected,
  isCurrent,
  onSelect,
  disabled = false,
  testingLabel,
}: PlanCardProps) {
  const cardStyle = [
    styles.planCard,
    isSelected && styles.selectedCard,
    isCurrent && styles.currentCard,
    disabled && styles.disabledCard,
  ];

  const titleStyle = [styles.planTitle, isSelected && styles.selectedText, isCurrent && styles.currentText];

  const priceStyle = [styles.planPrice, isSelected && styles.selectedText, isCurrent && styles.currentText];

  return (
    <TouchableOpacity style={cardStyle} onPress={onSelect} disabled={disabled || isCurrent} activeOpacity={0.7}>
      {/* Testing Label */}
      {testingLabel && (
        <View style={styles.testingLabel}>
          <Text style={styles.testingLabelText}>{testingLabel}</Text>
        </View>
      )}

      {/* Current Plan Badge */}
      {isCurrent && (
        <View style={styles.currentBadge}>
          <Text style={styles.currentBadgeText}>Current</Text>
        </View>
      )}

      {/* Plan Header */}
      <View style={styles.planHeader}>
        <Text style={titleStyle}>{title}</Text>
        <Text style={priceStyle}>{price}</Text>
      </View>

      {/* Features List */}
      <View style={styles.featuresList}>
        {features.map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <Text style={styles.featureIcon}>✓</Text>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {/* Selection Indicator */}
      {isSelected && !isCurrent && (
        <View style={styles.selectionIndicator}>
          <Text style={styles.selectionText}>Selected</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ============================================================================
// TEMP PLAN SELECTOR COMPONENT
// ============================================================================

export function TempPlanSelector({ selectedPlan, onPlanSelect, currentPlan, disabled = false }: TempPlanSelectorProps) {
  // Plan configurations
  const plans = [
    {
      plan: "free" as TempSubscriptionPlan,
      title: "Free",
      price: "Always Free",
      features: ["Unlimited workout tracking", "Basic progress charts", "Exercise library access", "Community support"],
    },
    {
      plan: "premium" as TempSubscriptionPlan,
      title: "Premium",
      price: "Free Testing",
      testingLabel: "TESTING",
      features: [
        "Everything in Free",
        "AI coaching feedback",
        "Monthly progress reviews",
        "Custom workout programs",
        "Advanced analytics",
        "Data export",
        "Priority support",
      ],
    },
    {
      plan: "coach" as TempSubscriptionPlan,
      title: "Coach",
      price: "Free Testing",
      testingLabel: "TESTING",
      features: [
        "Everything in Premium",
        "Client management tools",
        "Coach dashboard",
        "Program templates",
        "Client progress tracking",
        "Bulk program assignment",
        "Coach analytics",
      ],
    },
  ];

  return (
    <View style={styles.container}>
      {plans.map((planConfig) => (
        <PlanCard
          key={planConfig.plan}
          plan={planConfig.plan}
          title={planConfig.title}
          price={planConfig.price}
          features={planConfig.features}
          testingLabel={planConfig.testingLabel}
          isSelected={selectedPlan === planConfig.plan}
          isCurrent={currentPlan === planConfig.plan}
          onSelect={() => onPlanSelect(planConfig.plan)}
          disabled={disabled}
        />
      ))}

      {/* Testing Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerTitle}>Testing Phase Notice</Text>
        <Text style={styles.disclaimerText}>
          All premium features are currently free during our development phase. This helps us gather feedback and
          improve the app before launch.
        </Text>
        <Text style={styles.disclaimerNote}>
          No payment information required • Full feature access • 30-day testing periods
        </Text>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  planCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: "#F2F2F7",
    position: "relative",
  },
  selectedCard: {
    borderColor: "#B5CFF8",
    backgroundColor: "#F8FAFD",
  },
  currentCard: {
    borderColor: "#34C759",
    backgroundColor: "#F0FDF4",
  },
  disabledCard: {
    opacity: 0.6,
  },
  testingLabel: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#FF9500",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  testingLabelText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  currentBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#34C759",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  planHeader: {
    marginBottom: 16,
  },
  planTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 4,
  },
  selectedText: {
    color: "#B5CFF8",
  },
  currentText: {
    color: "#34C759",
  },
  planPrice: {
    fontSize: 17,
    fontWeight: "500",
    color: "#8E8E93",
  },
  featuresList: {
    gap: 8,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureIcon: {
    fontSize: 16,
    color: "#34C759",
    fontWeight: "600",
  },
  featureText: {
    fontSize: 15,
    color: "#000000",
    flex: 1,
  },
  selectionIndicator: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#B5CFF8",
    alignItems: "center",
  },
  selectionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#B5CFF8",
  },
  disclaimer: {
    backgroundColor: "#F8FAFD",
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  disclaimerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 15,
    color: "#8E8E93",
    lineHeight: 20,
    marginBottom: 8,
  },
  disclaimerNote: {
    fontSize: 13,
    color: "#B5CFF8",
    fontWeight: "500",
    textAlign: "center",
  },
});

export default TempPlanSelector;
