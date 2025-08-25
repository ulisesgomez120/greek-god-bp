// ============================================================================
// TEMPORARY PLAN SELECTOR COMPONENT
// ============================================================================
// Component for selecting temporary subscription plans during testing phase.
// This will be replaced with native IAP plan selector when ready for production.

import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Text } from "../ui/Text";
import useTheme from "@/hooks/useTheme";
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
  styles?: any;
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
  styles: stylesProp,
}: PlanCardProps) {
  // allow callers to pass styles in so PlanCard can be used as a top-level function
  const styles = stylesProp || ({} as any);

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
  const { colors } = useTheme();
  const styles = createStyles(colors);

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
          styles={styles}
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

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      gap: 16,
    },
    planCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 2,
      borderColor: colors.border,
      position: "relative",
    },
    selectedCard: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceElevated || colors.surface,
    },
    currentCard: {
      borderColor: colors.success,
      backgroundColor: colors.surfaceElevated || colors.surface,
    },
    disabledCard: {
      opacity: 0.6,
    },
    testingLabel: {
      position: "absolute",
      top: 12,
      right: 12,
      backgroundColor: colors.warning || "#FF9500",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    testingLabelText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.buttonTextOnPrimary || colors.buttonText || "#FFFFFF",
      letterSpacing: 0.5,
    },
    currentBadge: {
      position: "absolute",
      top: 12,
      right: 12,
      backgroundColor: colors.success,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    currentBadgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.buttonTextOnPrimary || colors.buttonText || "#FFFFFF",
    },
    planHeader: {
      marginBottom: 16,
    },
    planTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 4,
    },
    selectedText: {
      color: colors.primary,
    },
    currentText: {
      color: colors.success,
    },
    planPrice: {
      fontSize: 17,
      fontWeight: "500",
      color: colors.subtext,
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
      color: colors.success,
      fontWeight: "600",
    },
    featureText: {
      fontSize: 15,
      color: colors.text,
      flex: 1,
    },
    selectionIndicator: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.primary,
      alignItems: "center",
    },
    selectionText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.primary,
    },
    disclaimer: {
      backgroundColor: colors.surfaceElevated || colors.surface,
      padding: 16,
      borderRadius: 12,
      marginTop: 8,
    },
    disclaimerTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
    },
    disclaimerText: {
      fontSize: 15,
      color: colors.subtext,
      lineHeight: 20,
      marginBottom: 8,
    },
    disclaimerNote: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: "500",
      textAlign: "center",
    },
  });

export default TempPlanSelector;
