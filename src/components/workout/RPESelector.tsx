// ============================================================================
// RPE SELECTOR COMPONENT
// ============================================================================
// RPE selection with educational content and intuitive interface

import React, { useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Dimensions } from "react-native";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import Icon from "react-native-vector-icons/MaterialIcons";
import { Button } from "../ui/Button";

// ============================================================================
// TYPES
// ============================================================================

interface RPESelectorProps {
  onSelect: (rpe: number) => void;
  onClose: () => void;
  selectedRPE: number | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary: "#B5CFF8",
  success: "#34C759",
  warning: "#FF9500",
  error: "#FF3B30",
  text: "#1C1C1E",
  textSecondary: "#8E8E93",
  background: "#FFFFFF",
  backgroundLight: "#F8FAFD",
  overlay: "rgba(0, 0, 0, 0.5)",
} as const;

const RPE_DESCRIPTIONS = [
  {
    rpe: 1,
    description: "Very Easy",
    detail: "Could do many more reps",
    color: "#34C759",
  },
  {
    rpe: 2,
    description: "Easy",
    detail: "Could do many more reps",
    color: "#34C759",
  },
  {
    rpe: 3,
    description: "Moderate",
    detail: "Could do several more reps",
    color: "#34C759",
  },
  {
    rpe: 4,
    description: "Somewhat Hard",
    detail: "Could do several more reps",
    color: "#64D2FF",
  },
  {
    rpe: 5,
    description: "Hard",
    detail: "Could do a few more reps",
    color: "#64D2FF",
  },
  {
    rpe: 6,
    description: "Hard",
    detail: "Could do 4 more reps",
    color: "#64D2FF",
  },
  {
    rpe: 7,
    description: "Very Hard",
    detail: "Could do 3 more reps",
    color: "#B5CFF8",
  },
  {
    rpe: 8,
    description: "Very Hard",
    detail: "Could do 2 more reps",
    color: "#FF9500",
  },
  {
    rpe: 9,
    description: "Extremely Hard",
    detail: "Could do 1 more rep",
    color: "#FF9500",
  },
  {
    rpe: 10,
    description: "Maximum Effort",
    detail: "Could not do more reps",
    color: "#FF3B30",
  },
] as const;

const { height: screenHeight } = Dimensions.get("window");

// ============================================================================
// COMPONENT
// ============================================================================

export const RPESelector: React.FC<RPESelectorProps> = ({ onSelect, onClose, selectedRPE }) => {
  // ============================================================================
  // HOOKS
  // ============================================================================

  const { triggerHaptic } = useHapticFeedback();

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleRPESelect = useCallback(
    async (rpe: number) => {
      await triggerHaptic("medium");
      onSelect(rpe);
    },
    [onSelect, triggerHaptic]
  );

  const handleClose = useCallback(async () => {
    await triggerHaptic("light");
    onClose();
  }, [onClose, triggerHaptic]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderRPEOption = (rpeData: (typeof RPE_DESCRIPTIONS)[number]) => {
    const isSelected = selectedRPE === rpeData.rpe;

    return (
      <TouchableOpacity
        key={rpeData.rpe}
        style={[styles.rpeOption, isSelected && styles.rpeOptionSelected, { borderLeftColor: rpeData.color }]}
        onPress={() => handleRPESelect(rpeData.rpe)}
        accessibilityLabel={`RPE ${rpeData.rpe}: ${rpeData.description}`}
        accessibilityRole='button'>
        <View style={styles.rpeNumber}>
          <Text style={[styles.rpeNumberText, isSelected && styles.rpeNumberTextSelected]}>{rpeData.rpe}</Text>
        </View>

        <View style={styles.rpeContent}>
          <Text style={[styles.rpeDescription, isSelected && styles.rpeDescriptionSelected]}>
            {rpeData.description}
          </Text>
          <Text style={[styles.rpeDetail, isSelected && styles.rpeDetailSelected]}>{rpeData.detail}</Text>
        </View>

        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Text style={styles.selectedIndicatorText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>Rate of Perceived Exertion</Text>
      <Text style={styles.subtitle}>How hard did that set feel? Be honest with yourself.</Text>
    </View>
  );

  const renderFooter = () => (
    <View style={styles.footer}>
      <View style={styles.footerHint}>
        <Icon name='lightbulb' size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
        <Text style={styles.footerText}>RPE helps track your training intensity and guides progression decisions.</Text>
      </View>
      <Button
        variant='secondary'
        onPress={handleClose}
        style={styles.closeButton}
        accessibilityLabel='Close RPE selector'>
        <Text style={styles.closeButtonText}>Cancel</Text>
      </Button>
    </View>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Modal visible={true} animationType='slide' presentationStyle='pageSheet' onRequestClose={handleClose}>
      <View style={styles.container}>
        {renderHeader()}

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {RPE_DESCRIPTIONS.map(renderRPEOption)}
        </ScrollView>

        {renderFooter()}
      </View>
    </Modal>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.backgroundLight,
  },

  title: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
    textAlign: "center",
  },

  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  rpeOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.backgroundLight,
    borderLeftWidth: 4,
    marginBottom: 8,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  rpeOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(181, 207, 248, 0.1)",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  rpeNumber: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },

  rpeNumberText: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },

  rpeNumberTextSelected: {
    color: COLORS.primary,
  },

  rpeContent: {
    flex: 1,
  },

  rpeDescription: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },

  rpeDescriptionSelected: {
    color: COLORS.primary,
  },

  rpeDetail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  rpeDetailSelected: {
    color: COLORS.primary,
  },

  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },

  selectedIndicatorText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.background,
  },

  footer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.backgroundLight,
  },

  footerHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  footerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    textAlign: "center",
  },

  closeButton: {
    height: 48,
  },

  closeButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default RPESelector;
