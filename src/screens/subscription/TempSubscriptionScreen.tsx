// ============================================================================
// TEMPORARY SUBSCRIPTION SCREEN
// ============================================================================
// Screen for managing temporary subscriptions during testing phase.
// This will be replaced with native IAP screen when ready for production.

import React, { useState } from "react";
import { View, ScrollView, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/ui/Text";
import { Button } from "../../components/ui/Button";
import { LoadingButton } from "../../components/ui/LoadingButton";
import { TempPlanSelector } from "../../components/subscription/TempPlanSelector";
import { useTempSubscription, useSubscriptionStatus } from "../../hooks/useTempSubscription";
import { logger } from "../../utils/logger";
import type { TempSubscriptionPlan } from "../../types/tempSubscription";

// ============================================================================
// TEMPORARY SUBSCRIPTION SCREEN COMPONENT
// ============================================================================

export function TempSubscriptionScreen() {
  const { upgradeToPremium, upgradeToCoach, refreshSubscription, upgrading, error } = useTempSubscription();

  const {
    subscription,
    currentPlanName,
    statusMessage,
    isActive,
    isTesting,
    isPremium,
    isCoach,
    daysRemaining,
    isExpiringSoon,
    isExpired,
    shouldShowTestingBanner,
    loading,
  } = useSubscriptionStatus();

  const [selectedPlan, setSelectedPlan] = useState<TempSubscriptionPlan>("premium");

  // Handle plan upgrade
  const handleUpgrade = async (plan: TempSubscriptionPlan) => {
    try {
      if (plan === "free") {
        Alert.alert("Invalid Plan", "Cannot upgrade to free plan");
        return;
      }

      // Show confirmation dialog
      const planName = plan === "premium" ? "Premium (Testing)" : "Coach (Testing)";

      Alert.alert(
        "Confirm Upgrade",
        `Upgrade to ${planName} for 30 days of testing?\n\nThis is completely free and no payment is required.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Upgrade",
            onPress: async () => {
              if (plan === "premium") {
                await upgradeToPremium();
              } else {
                await upgradeToCoach();
              }
            },
          },
        ]
      );
    } catch (err) {
      logger.error("Upgrade error", err, "tempSubscription");
      Alert.alert("Upgrade Failed", "Please try again later");
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    try {
      await refreshSubscription();
    } catch (err) {
      logger.error("Refresh error", err, "tempSubscription");
    }
  };

  // Show error alert
  const showErrorAlert = () => {
    if (error) {
      Alert.alert("Error", error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Testing Banner */}
        {shouldShowTestingBanner && (
          <View style={styles.testingBanner}>
            <Text style={styles.testingBannerTitle}>🧪 Testing Mode</Text>
            <Text style={styles.testingBannerText}>You're testing premium features for free! No payment required.</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Subscription</Text>
          <Text style={styles.subtitle}>Test premium features during our development phase</Text>
        </View>

        {/* Current Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>Current Plan</Text>
            <Button variant='text' size='small' onPress={handleRefresh} disabled={loading}>
              Refresh
            </Button>
          </View>

          <Text style={styles.currentPlan}>{currentPlanName}</Text>
          <Text style={styles.statusMessage}>{statusMessage}</Text>

          {/* Expiry Warning */}
          {isExpiringSoon && daysRemaining !== null && (
            <View style={styles.expiryWarning}>
              <Text style={styles.expiryWarningText}>
                ⚠️ Your testing period expires in {daysRemaining} day{daysRemaining === 1 ? "" : "s"}
              </Text>
            </View>
          )}

          {/* Expired Notice */}
          {isExpired && (
            <View style={styles.expiredNotice}>
              <Text style={styles.expiredNoticeText}>
                Your testing period has expired. Upgrade again to continue testing premium features.
              </Text>
            </View>
          )}
        </View>

        {/* Plan Selector */}
        <View style={styles.planSection}>
          <Text style={styles.sectionTitle}>Available Plans</Text>
          <Text style={styles.sectionSubtitle}>All plans are free during testing phase</Text>

          <TempPlanSelector
            selectedPlan={selectedPlan}
            onPlanSelect={setSelectedPlan}
            currentPlan={subscription?.plan || "free"}
            disabled={upgrading}
          />
        </View>

        {/* Upgrade Button */}
        {selectedPlan !== "free" && selectedPlan !== subscription?.plan && (
          <View style={styles.upgradeSection}>
            <LoadingButton onPress={() => handleUpgrade(selectedPlan)} loading={upgrading} style={styles.upgradeButton}>
              Try {selectedPlan === "premium" ? "Premium" : "Coach"} (Testing)
            </LoadingButton>

            <Text style={styles.upgradeNote}>
              • 30 days of free testing • No payment required • All features unlocked • Can be renewed when expired
            </Text>
          </View>
        )}

        {/* Testing Information */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>About Testing Mode</Text>
          <Text style={styles.infoText}>
            During our development phase, all premium features are available for free testing. This helps us gather
            feedback and improve the app before launch.
          </Text>

          <View style={styles.infoList}>
            <Text style={styles.infoListItem}>• No credit card required</Text>
            <Text style={styles.infoListItem}>• Full access to all features</Text>
            <Text style={styles.infoListItem}>• 30-day testing periods</Text>
            <Text style={styles.infoListItem}>• Renewable when expired</Text>
            <Text style={styles.infoListItem}>• Your data is always safe</Text>
          </View>

          <Text style={styles.infoFooter}>
            When we launch, you'll be able to subscribe through your app store with real pricing.
          </Text>
        </View>

        {/* Error Display */}
        {error && (
          <View style={styles.errorSection}>
            <Text style={styles.errorText}>{error}</Text>
            <Button variant='text' size='small' onPress={showErrorAlert}>
              Dismiss
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
  },
  testingBanner: {
    backgroundColor: "#B5CFF8",
    padding: 16,
    margin: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  testingBannerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  testingBannerText: {
    fontSize: 15,
    color: "#1C1C1E",
    textAlign: "center",
  },
  header: {
    padding: 16,
    paddingTop: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    color: "#8E8E93",
    lineHeight: 22,
  },
  statusCard: {
    backgroundColor: "#F8FAFD",
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000000",
  },
  currentPlan: {
    fontSize: 24,
    fontWeight: "700",
    color: "#B5CFF8",
    marginBottom: 4,
  },
  statusMessage: {
    fontSize: 15,
    color: "#8E8E93",
  },
  expiryWarning: {
    backgroundColor: "#FF9500",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  expiryWarningText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "500",
    textAlign: "center",
  },
  expiredNotice: {
    backgroundColor: "#FF3B30",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  expiredNoticeText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "500",
    textAlign: "center",
  },
  planSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: "#8E8E93",
    marginBottom: 20,
  },
  upgradeSection: {
    padding: 16,
  },
  upgradeButton: {
    marginBottom: 16,
  },
  upgradeNote: {
    fontSize: 15,
    color: "#8E8E93",
    lineHeight: 20,
    textAlign: "center",
  },
  infoSection: {
    padding: 16,
    paddingTop: 32,
  },
  infoTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: "#8E8E93",
    lineHeight: 20,
    marginBottom: 16,
  },
  infoList: {
    marginBottom: 16,
  },
  infoListItem: {
    fontSize: 15,
    color: "#8E8E93",
    lineHeight: 20,
    marginBottom: 4,
  },
  infoFooter: {
    fontSize: 13,
    color: "#8E8E93",
    lineHeight: 18,
    fontStyle: "italic",
  },
  errorSection: {
    backgroundColor: "#FF3B30",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorText: {
    fontSize: 15,
    color: "#FFFFFF",
    flex: 1,
    marginRight: 12,
  },
});

export default TempSubscriptionScreen;
