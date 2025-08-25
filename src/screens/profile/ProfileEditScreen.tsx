// ============================================================================
// PROFILE EDIT SCREEN
// ============================================================================
// Profile editing interface with form validation and real-time updates
// Following Direct TextInput Pattern for iOS keyboard compatibility

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Text } from "@/components/ui/Text";
import useTheme from "@/hooks/useTheme";
import { Button } from "@/components/ui/Button";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { useProfile } from "@/hooks/useProfile";
import { logger } from "@/utils/logger";
import useUnitPreferences from "@/hooks/useUnitPreferences";
import useAuth from "@/hooks/useAuth";
import {
  parseDisplayWeightToKg,
  parseDisplayHeightToCm,
  formatKgToLbsDisplay,
  formatCmToFtIn,
} from "@/utils/unitConversions";
import type { UserProfile, ProfileEditData, PrivacySettings, FitnessGoal } from "@/types/profile";
import HeightPicker from "./components/HeightPicker";
import DateInput from "@/components/ui/DateInput";
import { format as formatDate } from "date-fns";
import {
  DEFAULT_FITNESS_GOALS,
  EXPERIENCE_LEVELS,
  getExperienceLevelInfo,
  DEFAULT_PRIVACY_SETTINGS,
} from "@/types/profile";
import {
  getInputStyle,
  getInputState,
  getInputProps,
  LABEL_STYLES,
  ERROR_STYLES,
  FIELD_STYLES,
} from "@/styles/inputStyles";

// ============================================================================
// TYPES
// ============================================================================

interface ProfileEditScreenProps {}

interface FormErrors {
  [key: string]: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ProfileEditScreen: React.FC<ProfileEditScreenProps> = () => {
  const navigation = useNavigation();
  const { profile, updateProfile, updating, error } = useProfile();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [formData, setFormData] = useState<ProfileEditData>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("basic");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  // Local controlled inputs to avoid formatting interfering with typing
  const [heightInput, setHeightInput] = useState<string>("");
  const [weightInput, setWeightInput] = useState<string>("");
  const [birthDateLocal, setBirthDateLocal] = useState<Date | null>(null);
  const [heightPickerValue, setHeightPickerValue] = useState<number | undefined>(undefined);
  // Only show the numeric custom input when user explicitly selects "Custom"
  const [allowCustomHeight, setAllowCustomHeight] = useState<boolean>(false);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        birthDate: profile.birthDate,
        gender: profile.gender,
        fitnessGoals: profile.fitnessGoals,
        privacySettings: profile.privacySettings,
        // include preferences so form saves use_metric when present
        preferences: profile.preferences || undefined,
      });
      // Initialize local display state for conversion-on-save
      setBirthDateLocal(profile.birthDate ? new Date(profile.birthDate) : null);
      setHeightPickerValue(profile.heightCm ?? undefined);
      // seed custom input so users see existing value when fallback is active
      setHeightInput(
        isImperial() ? (profile.heightCm ? formatCmToFtIn(profile.heightCm) : "") : profile.heightCm?.toString() || ""
      );
      // default: don't show custom input unless user selects it
      setAllowCustomHeight(false);
    }
  }, [profile]);

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================

  const updateFormData = useCallback(
    (updates: Partial<ProfileEditData>) => {
      setFormData((prev) => ({ ...prev, ...updates }));
      setHasChanges(true);

      // Clear related errors
      const newErrors = { ...errors };
      Object.keys(updates).forEach((key) => {
        delete newErrors[key];
      });
      setErrors(newErrors);
    },
    [errors]
  );

  // ============================================================================
  // INPUT HANDLERS FOR UNIT-AWARE INPUTS
  // ============================================================================
  const {
    preferences,
    setUseMetric,
    isImperial,
    isMetric,
    reloadPreferences,
    loading: prefsLoading,
  } = useUnitPreferences();

  const { logout, loading: authLoading } = useAuth();

  const handleHeightInput = (text: string) => {
    // local display-only; conversion happens on Save
    setHeightInput(text);
  };

  const handleWeightInput = (text: string) => {
    // local display-only; conversion happens on Save
    setWeightInput(text);
  };

  const validateForm = useCallback(
    (dataToValidate?: ProfileEditData): boolean => {
      const data = dataToValidate || formData;
      const newErrors: FormErrors = {};

      if (data.displayName && data.displayName.trim().length < 2) {
        newErrors.displayName = "Display name must be at least 2 characters";
      }

      if (data.heightCm && (data.heightCm < 100 || data.heightCm > 250)) {
        newErrors.heightCm = "Height must be between 100cm and 250cm";
      }

      if (data.weightKg && (data.weightKg < 30 || data.weightKg > 300)) {
        newErrors.weightKg = "Weight must be between 30kg and 300kg";
      }

      if (data.birthDate) {
        const birthDate = new Date(data.birthDate);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();

        if (age < 13) {
          newErrors.birthDate = "You must be at least 13 years old";
        }
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [formData]
  );

  const handleSave = useCallback(async () => {
    // Build canonical payload from local display state + existing formData
    const canonical: ProfileEditData = { ...formData };

    // Height: prefer picker value if set, otherwise parse custom input
    if (typeof heightPickerValue === "number") {
      canonical.heightCm = Math.round(heightPickerValue);
    } else if (heightInput) {
      if (isImperial()) {
        const cm = parseDisplayHeightToCm(heightInput);
        canonical.heightCm = cm != null ? Math.round(cm) : undefined;
      } else {
        canonical.heightCm = heightInput ? parseInt(heightInput) : undefined;
      }
    } else {
      // leave undefined if not provided
      canonical.heightCm = undefined;
    }

    // Weight
    if (weightInput) {
      if (isImperial()) {
        const kg = parseDisplayWeightToKg(weightInput);
        canonical.weightKg = kg != null ? Number(kg.toFixed(2)) : undefined;
      } else {
        canonical.weightKg = weightInput ? parseFloat(weightInput) : undefined;
      }
    } else {
      canonical.weightKg = undefined;
    }

    // Birth date
    if (birthDateLocal) {
      canonical.birthDate = formatDate(birthDateLocal, "yyyy-MM-dd");
    } else {
      canonical.birthDate = undefined;
    }

    // Validate canonical copy
    if (!validateForm(canonical)) {
      return;
    }

    try {
      const success = await updateProfile(canonical, { optimistic: true });

      if (success) {
        // reload unit preferences so UI reflects updated preference immediately
        try {
          await reloadPreferences();
        } catch (err) {
          // non-fatal, proceed
        }
        setHasChanges(false);
        Alert.alert("Success", "Profile updated successfully");
      } else {
        Alert.alert("Error", "Failed to update profile. Please try again.");
      }
    } catch (error) {
      logger.error("Profile update error", error, "profile");
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    }
  }, [formData, updateProfile, validateForm, heightInput, weightInput, birthDateLocal, heightPickerValue, isImperial]);

  const handleCancel = useCallback(() => {
    if (hasChanges) {
      Alert.alert("Discard Changes", "You have unsaved changes. Are you sure you want to discard them?", [
        { text: "Keep Editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            if (profile) {
              setFormData({
                displayName: profile.displayName,
                heightCm: profile.heightCm,
                weightKg: profile.weightKg,
                birthDate: profile.birthDate,
                gender: profile.gender,
                fitnessGoals: profile.fitnessGoals,
                privacySettings: profile.privacySettings,
              });
            }
            setHasChanges(false);
            setErrors({});
          },
        },
      ]);
    } else {
      navigation.goBack();
    }
  }, [hasChanges, profile, navigation]);

  const handleSignOut = useCallback(async () => {
    try {
      const result = await logout();
      if (!result || !result.success) {
        Alert.alert("Error", result?.error?.message || "Failed to sign out");
      }
    } catch (err) {
      Alert.alert("Error", "Failed to sign out");
    }
  }, [logout]);

  // ============================================================================
  // GOAL MANAGEMENT
  // ============================================================================

  const toggleGoal = useCallback(
    (goalId: string) => {
      const currentGoals = formData.fitnessGoals || [];
      const newGoals = currentGoals.includes(goalId)
        ? currentGoals.filter((id) => id !== goalId)
        : [...currentGoals, goalId];

      updateFormData({ fitnessGoals: newGoals });
    },
    [formData.fitnessGoals, updateFormData]
  );

  // ============================================================================
  // PRIVACY SETTINGS
  // ============================================================================

  const updatePrivacySetting = useCallback(
    (key: keyof PrivacySettings, value: boolean) => {
      // Update both privacySettings object and normalized boolean fields on formData
      const currentSettings = formData.privacySettings || profile?.privacySettings || {};
      const newSettings = { ...currentSettings, [key]: value };
      const normalized: Partial<ProfileEditData> = {};
      if (key === "dataSharing") normalized.privacyDataSharing = value;
      if (key === "analytics") normalized.privacyAnalytics = value;
      if (key === "aiCoaching") normalized.privacyAiCoaching = value;
      if (key === "workoutSharing") normalized.privacyWorkoutSharing = value;
      if (key === "progressSharing") normalized.privacyProgressSharing = value;

      updateFormData({ privacySettings: newSettings, ...normalized } as any);
    },
    [formData.privacySettings, profile?.privacySettings, updateFormData]
  );

  // ============================================================================
  // RENDER SECTIONS
  // ============================================================================

  const renderBasicInfoSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Basic Information</Text>

      {/* Display Name Field */}
      <View style={FIELD_STYLES.container}>
        <Text style={styles.labelBase}>Display Name</Text>
        <TextInput
          style={getInputStyle(colors, undefined, getInputState(focusedField === "displayName", !!errors.displayName))}
          value={formData.displayName || ""}
          onChangeText={(text: string) => updateFormData({ displayName: text })}
          onFocus={() => setFocusedField("displayName")}
          onBlur={() => setFocusedField(null)}
          placeholder='Enter your name'
          autoCapitalize='words'
          autoCorrect={false}
          spellCheck={false}
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.primary}
        />
        {errors.displayName && <Text style={[ERROR_STYLES.text, { color: colors.error }]}>{errors.displayName}</Text>}
      </View>

      {/* Height Field */}
      <View style={FIELD_STYLES.container}>
        <Text style={styles.labelBase}>{isImperial() ? "Height (ft/in)" : "Height (cm)"}</Text>

        <HeightPicker
          valueCm={typeof heightPickerValue === "number" ? heightPickerValue : formData.heightCm}
          onChange={(cm) => {
            // cm === undefined => user selected "Custom"
            setHeightPickerValue(cm);
            setHasChanges(true);
            // show numeric input only when user explicitly selects Custom
            setAllowCustomHeight(typeof cm === "undefined");
            // seed the input when user picks a standard height
            if (typeof cm === "number") {
              setHeightInput(isImperial() ? formatCmToFtIn(cm) : String(cm));
            }
          }}
          unitIsMetric={isMetric()}
          testID='profile-height-picker'
        />

        {/* Custom height input fallback (only after user selected Custom) */}
        {allowCustomHeight && (
          <TextInput
            style={getInputStyle(colors, undefined, getInputState(focusedField === "heightCm", !!errors.heightCm))}
            value={heightInput}
            onChangeText={(text: string) => {
              setHeightInput(text);
            }}
            onFocus={() => {
              setFocusedField("heightCm");
              setHeightInput(
                isImperial()
                  ? formData.heightCm
                    ? formatCmToFtIn(formData.heightCm)
                    : ""
                  : formData.heightCm?.toString() || ""
              );
            }}
            onBlur={() => {
              setFocusedField(null);
            }}
            {...getInputProps(isImperial() ? undefined : "number")}
            placeholder={isImperial() ? "5'10\"" : "170"}
          />
        )}

        {errors.heightCm && <Text style={[ERROR_STYLES.text, { color: colors.error }]}>{errors.heightCm}</Text>}
      </View>

      {/* Weight Field */}
      <View style={FIELD_STYLES.container}>
        <Text style={styles.labelBase}>{isImperial() ? "Weight (lbs)" : "Weight (kg)"}</Text>
        <TextInput
          style={getInputStyle(colors, undefined, getInputState(focusedField === "weightKg", !!errors.weightKg))}
          value={
            focusedField === "weightKg"
              ? weightInput
              : isImperial()
              ? formData.weightKg
                ? formatKgToLbsDisplay(formData.weightKg).replace(" lbs", "")
                : ""
              : formData.weightKg?.toString() || ""
          }
          onChangeText={(text: string) => {
            setWeightInput(text);
          }}
          onFocus={() => {
            setFocusedField("weightKg");
            setWeightInput(
              isImperial()
                ? formData.weightKg
                  ? formatKgToLbsDisplay(formData.weightKg).replace(" lbs", "")
                  : ""
                : formData.weightKg?.toString() || ""
            );
          }}
          onBlur={() => {
            // only clear focus; conversion to canonical happens on Save
            setFocusedField(null);
            setWeightInput("");
          }}
          {...getInputProps(isImperial() ? undefined : "number")}
          placeholder={isImperial() ? "180" : "70"}
        />
        {errors.weightKg && <Text style={[ERROR_STYLES.text, { color: colors.error }]}>{errors.weightKg}</Text>}
      </View>

      {/* Birth Date Field */}
      <View style={FIELD_STYLES.container}>
        <Text style={styles.labelBase}>Birth Date</Text>
        <DateInput
          value={birthDateLocal}
          onChange={(d) => {
            setBirthDateLocal(d);
            setHasChanges(true);
            // clear birthDate error if any
            setErrors((prev) => {
              const copy = { ...prev };
              delete copy.birthDate;
              return copy;
            });
          }}
          maximumDate={new Date()}
          testID='profile-birthdate-input'
        />
        {errors.birthDate && <Text style={[ERROR_STYLES.text, { color: colors.error }]}>{errors.birthDate}</Text>}
      </View>

      {/* Gender Selection */}
      <View style={FIELD_STYLES.container}>
        <Text style={styles.labelBase}>Gender</Text>
        <View style={styles.genderContainer}>
          {["male", "female", "other", "prefer_not_to_say"].map((gender) => (
            <TouchableOpacity
              key={gender}
              onPress={() => updateFormData({ gender: gender as any })}
              style={[styles.genderButton, formData.gender === gender && styles.genderButtonSelected]}>
              <Text style={[styles.genderButtonText, formData.gender === gender && styles.genderButtonTextSelected]}>
                {gender.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={{ marginTop: 16 }}>
        <LoadingButton
          loading={Boolean(authLoading?.logout)}
          onPress={handleSignOut}
          style={styles.signOutButton}
          testID='profile-signout-button'>
          Sign Out
        </LoadingButton>
      </View>
    </View>
  );

  const renderFitnessGoalsSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Fitness Goals</Text>
      <Text style={styles.sectionDescription}>Select all goals that apply to you</Text>

      <View style={styles.goalsContainer}>
        {DEFAULT_FITNESS_GOALS.map((goal) => {
          const isSelected = formData.fitnessGoals?.includes(goal.id) || false;

          return (
            <TouchableOpacity
              key={goal.id}
              onPress={() => toggleGoal(goal.id)}
              style={[styles.goalCard, isSelected && styles.goalCardSelected]}>
              <View style={styles.goalContent}>
                <View style={styles.goalHeader}>
                  <Text style={[styles.goalName, isSelected && styles.goalNameSelected]}>{goal.name}</Text>
                  {goal.popular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>Popular</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.goalDescription, isSelected && styles.goalDescriptionSelected]}>
                  {goal.description}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderPreferencesSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Preferences</Text>

      <View style={FIELD_STYLES.container}>
        <Text style={styles.labelBase}>Units</Text>

        <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={styles.labelBase}>Use Metric Units</Text>
          <Switch
            value={Boolean(formData.preferences?.useMetric ?? preferences?.useMetric)}
            onValueChange={(val) => {
              // Update form state immediately so UI reflects change.
              updateFormData({
                preferences: {
                  ...(formData.preferences || preferences),
                  useMetric: val,
                } as any,
              });
              // Also persist locally via the hook (no await) so local storage/redux are updated.
              void setUseMetric(val);
            }}
            accessibilityLabel='Toggle metric units'
            trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
            thumbColor={colors.surface}
          />
        </View>
      </View>
    </View>
  );

  const renderPrivacySection = () => {
    const privacySettings = formData.privacySettings || profile?.privacySettings || {};

    // Determine normalized values falling back to profile row values
    const normalized = {
      dataSharing:
        typeof formData.privacyDataSharing !== "undefined"
          ? formData.privacyDataSharing
          : profile?.privacySettings?.dataSharing || DEFAULT_PRIVACY_SETTINGS.dataSharing,
      analytics:
        typeof formData.privacyAnalytics !== "undefined"
          ? formData.privacyAnalytics
          : profile?.privacySettings?.analytics || DEFAULT_PRIVACY_SETTINGS.analytics,
      aiCoaching:
        typeof formData.privacyAiCoaching !== "undefined"
          ? formData.privacyAiCoaching
          : profile?.privacySettings?.aiCoaching || DEFAULT_PRIVACY_SETTINGS.aiCoaching,
      workoutSharing:
        typeof formData.privacyWorkoutSharing !== "undefined"
          ? formData.privacyWorkoutSharing
          : profile?.privacySettings?.workoutSharing || DEFAULT_PRIVACY_SETTINGS.workoutSharing,
      progressSharing:
        typeof formData.privacyProgressSharing !== "undefined"
          ? formData.privacyProgressSharing
          : profile?.privacySettings?.progressSharing || DEFAULT_PRIVACY_SETTINGS.progressSharing,
    };

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy Settings</Text>
        <Text style={styles.sectionDescription}>Control how your data is used and shared</Text>

        <View style={styles.privacyContainer}>
          <View style={styles.privacyItem}>
            <View style={styles.privacyItemContent}>
              <Text style={styles.privacyItemTitle}>Data Sharing</Text>
              <Text style={styles.privacyItemDescription}>
                Allow anonymous data sharing for research and app improvement
              </Text>
            </View>
            <Switch
              value={normalized.dataSharing}
              onValueChange={(value) => updatePrivacySetting("dataSharing", value)}
              trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={styles.privacyItem}>
            <View style={styles.privacyItemContent}>
              <Text style={styles.privacyItemTitle}>Analytics</Text>
              <Text style={styles.privacyItemDescription}>Help us improve the app by sharing usage analytics</Text>
            </View>
            <Switch
              value={normalized.analytics}
              onValueChange={(value) => updatePrivacySetting("analytics", value)}
              trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={styles.privacyItem}>
            <View style={styles.privacyItemContent}>
              <Text style={styles.privacyItemTitle}>AI Coaching</Text>
              <Text style={styles.privacyItemDescription}>Allow AI coaching features to access your workout data</Text>
            </View>
            <Switch
              value={normalized.aiCoaching}
              onValueChange={(value) => updatePrivacySetting("aiCoaching", value)}
              trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={styles.privacyItem}>
            <View style={styles.privacyItemContent}>
              <Text style={styles.privacyItemTitle}>Workout Sharing</Text>
              <Text style={styles.privacyItemDescription}>Allow sharing of workout data with coaches or friends</Text>
            </View>
            <Switch
              value={normalized.workoutSharing}
              onValueChange={(value) => updatePrivacySetting("workoutSharing", value)}
              trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={styles.privacyItem}>
            <View style={styles.privacyItemContent}>
              <Text style={styles.privacyItemTitle}>Progress Sharing</Text>
              <Text style={styles.privacyItemDescription}>Allow sharing of progress data and achievements</Text>
            </View>
            <Switch
              value={normalized.progressSharing}
              onValueChange={(value) => updatePrivacySetting("progressSharing", value)}
              trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
        </View>
      </View>
    );
  };

  // ============================================================================
  // RENDER MAIN
  // ============================================================================

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!hasChanges || updating}
            style={[styles.headerButton, (!hasChanges || updating) && styles.headerButtonDisabled]}>
            <Text style={[styles.headerButtonText, styles.headerButtonTextPrimary]}>
              {updating ? "Saving..." : "Save"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
          style={styles.tabsScroll}>
          {[
            { id: "basic", title: "Basic" },
            { id: "goals", title: "Goals" },
            { id: "privacy", title: "Privacy" },
            { id: "preferences", title: "Preferences" },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveSection(tab.id)}
              style={[styles.tabButtonScrollable, activeSection === tab.id && styles.tabButtonActiveScrollable]}>
              <Text
                style={[
                  styles.tabButtonTextScrollable,
                  activeSection === tab.id && styles.tabButtonTextActiveScrollable,
                ]}>
                {tab.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps='handled'>
          {activeSection === "basic" && renderBasicInfoSection()}
          {activeSection === "goals" && renderFitnessGoalsSection()}
          {activeSection === "privacy" && renderPrivacySection()}
          {activeSection === "preferences" && renderPreferencesSection()}
        </ScrollView>

        {/* Global Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    loadingText: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerButton: {
      minWidth: 80,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    headerButtonDisabled: {
      opacity: 0.5,
    },
    headerButtonText: {
      fontSize: 16,
      fontWeight: "500",
      color: colors.primary,
      textAlign: "center",
    },
    headerButtonTextPrimary: {
      color: colors.primary,
      fontWeight: "600",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
    },
    tabsContainer: {
      flexDirection: "row",
      paddingHorizontal: 20,
      paddingVertical: 6,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: "center",
    },
    tabButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceElevated || colors.surface,
    },
    tabButtonText: {
      fontSize: 15,
      fontWeight: "500",
      color: colors.subtext,
    },
    tabButtonTextActive: {
      color: colors.primary,
      fontWeight: "600",
    },
    // Scrollable tabs container (wraps horizontal ScrollView)
    tabsScroll: {
      maxHeight: 44,
      paddingVertical: 0,
    },
    // Scrollable tabs content container style
    tabsScrollContent: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      alignItems: "center",
    },
    // Scrollable tab button styles
    tabButtonScrollable: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.background,
      marginRight: 8,
      alignItems: "center",
    },
    tabButtonActiveScrollable: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceElevated || colors.surface,
    },
    tabButtonTextScrollable: {
      fontSize: 15,
      fontWeight: "500",
      color: colors.subtext,
    },
    tabButtonTextActiveScrollable: {
      color: colors.primary,
      fontWeight: "600",
    },
    scrollView: {
      flex: 1,
    },
    scrollViewContent: {
      padding: 12,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 22,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
    },
    labelBase: {
      fontSize: 16,
      fontWeight: "500",
      color: colors.text,
      marginBottom: 8,
    },
    labelSmall: {
      fontSize: 14,
      fontWeight: "400",
      color: colors.subtext,
      marginBottom: 6,
    },
    sectionDescription: {
      fontSize: 15,
      color: colors.subtext,
      marginBottom: 24,
      lineHeight: 20,
    },
    genderContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 8,
    },
    genderButton: {
      flex: 1,
      minWidth: "45%",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: "center",
    },
    genderButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceElevated || colors.surface,
    },
    genderButtonText: {
      fontSize: 15,
      fontWeight: "500",
      color: colors.text,
    },
    genderButtonTextSelected: {
      color: colors.primary,
      fontWeight: "600",
    },
    goalsContainer: {
      gap: 12,
    },
    goalCard: {
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    goalCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceElevated || colors.surface,
    },
    goalContent: {
      padding: 16,
    },
    goalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    goalName: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.text,
      flex: 1,
    },
    goalNameSelected: {
      color: colors.primary,
    },
    popularBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    popularBadgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.buttonTextOnPrimary || colors.buttonText || "#FFFFFF",
    },
    goalDescription: {
      fontSize: 15,
      color: colors.subtext,
      lineHeight: 20,
    },
    goalDescriptionSelected: {
      color: colors.text,
    },
    privacyContainer: {
      gap: 20,
    },
    privacyItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
    },
    privacyItemContent: {
      flex: 1,
      marginRight: 16,
    },
    privacyItemTitle: {
      fontSize: 17,
      fontWeight: "500",
      color: colors.text,
      marginBottom: 4,
    },
    privacyItemDescription: {
      fontSize: 13,
      color: colors.subtext,
      lineHeight: 18,
    },
    signOutButton: {
      marginTop: 16,
      backgroundColor: colors.error,
      borderColor: colors.error,
    },
    errorContainer: {
      backgroundColor: colors.error,
      paddingHorizontal: 20,
      paddingVertical: 12,
      margin: 20,
      borderRadius: 8,
    },
    errorText: {
      color: colors.buttonTextOnPrimary || colors.buttonText || "#FFFFFF",
      fontSize: 15,
      fontWeight: "500",
      textAlign: "center",
    },
  });

export default ProfileEditScreen;
