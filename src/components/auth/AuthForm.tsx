// ============================================================================
// AUTH FORM COMPONENT
// ============================================================================
// Reusable form wrapper component for authentication screens with validation,
// loading states, and consistent styling

import React from "react";
import { View, StyleSheet, ViewStyle, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Text from "../ui/Text";
import LoadingButton from "../ui/LoadingButton";

// ============================================================================
// TYPES
// ============================================================================

export interface AuthFormProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onSubmit?: () => void;
  submitText?: string;
  submitLoading?: boolean;
  submitDisabled?: boolean;
  secondaryAction?: {
    text: string;
    onPress: () => void;
  };
  footerContent?: React.ReactNode;
  containerStyle?: ViewStyle;
  showKeyboardAvoidance?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const AuthForm: React.FC<AuthFormProps> = ({
  title,
  subtitle,
  children,
  onSubmit,
  submitText = "Continue",
  submitLoading = false,
  submitDisabled = false,
  secondaryAction,
  footerContent,
  containerStyle,
  showKeyboardAvoidance = true,
}) => {
  const FormContent = () => (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}>
        <View style={[styles.container, containerStyle]}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant='h1' color='primary' align='center' style={styles.title}>
              {title}
            </Text>
            {subtitle && (
              <Text variant='bodyLarge' color='secondary' align='center' style={styles.subtitle}>
                {subtitle}
              </Text>
            )}
          </View>

          {/* Form Fields */}
          <View style={styles.formContent}>{children}</View>

          {/* Submit Button */}
          {onSubmit && (
            <View style={styles.submitContainer}>
              <LoadingButton
                variant='primary'
                size='large'
                fullWidth
                loading={submitLoading}
                disabled={submitDisabled}
                onPress={onSubmit}
                loadingText='Please wait...'>
                {submitText}
              </LoadingButton>
            </View>
          )}

          {/* Secondary Action */}
          {secondaryAction && (
            <View style={styles.secondaryActionContainer}>
              <LoadingButton variant='text' size='medium' onPress={secondaryAction.onPress}>
                {secondaryAction.text}
              </LoadingButton>
            </View>
          )}

          {/* Footer Content */}
          {footerContent && <View style={styles.footerContainer}>{footerContent}</View>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  if (showKeyboardAvoidance) {
    return (
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>
        <FormContent />
      </KeyboardAvoidingView>
    );
  }

  return <FormContent />;
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    minHeight: "100%",
    justifyContent: "center",
  },
  header: {
    marginBottom: 40,
    alignItems: "center",
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 24,
  },
  formContent: {
    flex: 1,
    marginBottom: 32,
  },
  submitContainer: {
    marginBottom: 16,
  },
  secondaryActionContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  footerContainer: {
    alignItems: "center",
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default AuthForm;
