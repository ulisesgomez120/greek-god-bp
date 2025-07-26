// ============================================================================
// MAIN APP NAVIGATOR
// ============================================================================
// Main application navigation after authentication - placeholder for now

import React from "react";
import { View, StyleSheet } from "react-native";
import Text from "../components/ui/Text";

// ============================================================================
// MAIN APP NAVIGATOR COMPONENT
// ============================================================================

const MainAppNavigator: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text variant='h1' color='primary' align='center'>
        Welcome to TrainSmart!
      </Text>
      <Text variant='body' color='secondary' align='center' style={styles.subtitle}>
        Main app navigation will be implemented here
      </Text>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: "#FFFFFF",
  },
  subtitle: {
    marginTop: 16,
  },
});

export default MainAppNavigator;
