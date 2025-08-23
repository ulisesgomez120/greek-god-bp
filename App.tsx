// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
// Root application component with Redux Provider, authentication routing,
// and theme management for TrainSmart

import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import useTheme from "@/hooks/useTheme";

// Store and persistence
import { store, persistor, waitForRehydration } from "./src/store";

// Components
import AppNavigator from "./src/navigation/AppNavigator";
import SplashScreen from "./src/components/ui/SplashScreen";
import ErrorBoundary from "./src/components/ui/ErrorBoundary";

// Utils
import { logger } from "./src/utils/logger";

// ============================================================================
// APP CONTENT COMPONENT
// ============================================================================

const AppContent: React.FC = () => {
  const [isRehydrated, setIsRehydrated] = useState(false);
  const { theme, statusBarStyle } = useTheme();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Wait for store rehydration
        await waitForRehydration();
        setIsRehydrated(true);

        logger.info("App initialized successfully");
      } catch (error) {
        logger.error("App initialization failed:", error);
        setIsRehydrated(true); // Continue anyway
      }
    };

    initializeApp();
  }, []);

  // Show splash screen during store rehydration
  if (!isRehydrated) {
    return <SplashScreen />;
  }

  const expoStatusBarStyle =
    statusBarStyle === "dark-content" ? "dark" : statusBarStyle === "light-content" ? "light" : "auto";

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Main Navigation */}
      <AppNavigator />

      {/* Status Bar */}
      <StatusBar style={expoStatusBarStyle} />
    </View>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <Provider store={store}>
          <PersistGate loading={<SplashScreen />} persistor={persistor}>
            <SafeAreaProvider>
              <AppContent />
            </SafeAreaProvider>
          </PersistGate>
        </Provider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
