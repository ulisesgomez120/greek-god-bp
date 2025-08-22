// ============================================================================
// SETTINGS SCREEN
// ============================================================================
// Screen for app settings and preferences

import React from "react";
import { View, ScrollView, StyleSheet, Switch } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import useUnitPreferences from "../../hooks/useUnitPreferences";

// Components
import Text from "../../components/ui/Text";

// Types
import { ProfileStackParamList } from "../../types/navigation";

// ============================================================================
// TYPES
// ============================================================================

type SettingsScreenNavigationProp = StackNavigationProp<ProfileStackParamList, "Settings">;
type SettingsScreenRouteProp = RouteProp<ProfileStackParamList, "Settings">;

interface SettingsScreenProps {
  navigation: SettingsScreenNavigationProp;
  route: SettingsScreenRouteProp;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { preferences, setUnits, loading } = useUnitPreferences();

  const onToggleWeight = async (useLbs: boolean) => {
    await setUnits({ ...preferences.units, weight: useLbs ? "lbs" : "kg" });
  };

  const onToggleHeight = async (useFtIn: boolean) => {
    await setUnits({ ...preferences.units, height: useFtIn ? "ft_in" : "cm" });
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text variant='h1' color='primary' style={styles.title}>
          Settings
        </Text>

        <View style={{ marginTop: 8 }}>
          <Text variant='body' color='primary' style={{ marginBottom: 8 }}>
            Units
          </Text>

          <View style={{ marginBottom: 16, paddingVertical: 8 }}>
            <Text variant='body' color='secondary' style={{ marginBottom: 6 }}>
              Weight
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text variant='bodySmall' color='secondary'>
                kg
              </Text>
              <Switch
                value={preferences?.units?.weight === "lbs"}
                onValueChange={(val) => onToggleWeight(val)}
                accessibilityLabel='Toggle weight units'
              />
              <Text variant='bodySmall' color='secondary'>
                lbs
              </Text>
            </View>
          </View>

          <View style={{ marginBottom: 16, paddingVertical: 8 }}>
            <Text variant='body' color='secondary' style={{ marginBottom: 6 }}>
              Height
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text variant='bodySmall' color='secondary'>
                cm
              </Text>
              <Switch
                value={preferences?.units?.height === "ft_in"}
                onValueChange={(val) => onToggleHeight(val)}
                accessibilityLabel='Toggle height units'
              />
              <Text variant='bodySmall' color='secondary'>
                ft/in
              </Text>
            </View>
          </View>
        </View>

        <Text variant='body' color='secondary' style={styles.placeholder}>
          Additional settings and preferences will be available here.
        </Text>
      </ScrollView>
    </View>
  );
};

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
  scrollContent: {
    padding: 20,
  },
  title: {
    marginBottom: 16,
  },
  placeholder: {
    marginTop: 32,
    fontStyle: "italic",
  },
});

export default SettingsScreen;
