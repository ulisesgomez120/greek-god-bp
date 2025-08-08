// ============================================================================
// SETTINGS SCREEN
// ============================================================================
// Screen for app settings and preferences

import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";

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
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text variant='h1' color='primary' style={styles.title}>
          Settings
        </Text>
        <Text variant='body' color='secondary' style={styles.placeholder}>
          App settings and preferences will be displayed here.
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
