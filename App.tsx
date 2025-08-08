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

// Store and persistence
import { store, persistor, waitForRehydration } from "./src/store";

// Components
import AppNavigator from "./src/navigation/AppNavigator";
import SplashScreen from "./src/components/ui/SplashScreen";
import ErrorBoundary from "./src/components/ui/ErrorBoundary";
import ConnectionStatusIndicator from "./src/components/ui/ConnectionStatusIndicator";

// Hooks
import { useNetworkStatus } from "./src/hooks/useNetworkStatus";

// Utils
import { logger } from "./src/utils/logger";

// ============================================================================
// APP CONTENT COMPONENT
// ============================================================================

const AppContent: React.FC = () => {
  const { isConnected } = useNetworkStatus();
  const [isRehydrated, setIsRehydrated] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Wait for store rehydration
        await waitForRehydration();
        setIsRehydrated(true);

        logger.info("App initialized successfully", {
          isConnected,
        });
      } catch (error) {
        logger.error("App initialization failed:", error);
        setIsRehydrated(true); // Continue anyway
      }
    };

    initializeApp();
  }, [isConnected]);

  // Show splash screen during store rehydration
  if (!isRehydrated) {
    return <SplashScreen />;
  }

  return (
    <View style={styles.container}>
      {/* Connection Status Indicator */}
      <ConnectionStatusIndicator />

      {/* Main Navigation */}
      <AppNavigator />

      {/* Status Bar */}
      <StatusBar style='auto' />
    </View>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export default function App() {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <PersistGate loading={<SplashScreen />} persistor={persistor}>
          <SafeAreaProvider>
            <AppContent />
          </SafeAreaProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
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
});
