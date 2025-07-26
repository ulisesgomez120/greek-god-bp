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
import AuthNavigator from "./src/navigation/AuthNavigator";
import SplashScreen from "./src/components/ui/SplashScreen";
import ErrorBoundary from "./src/components/ui/ErrorBoundary";
import ConnectionStatusIndicator from "./src/components/ui/ConnectionStatusIndicator";

// Hooks
import { useAuth } from "./src/hooks/useAuth";
import { useNetworkStatus } from "./src/hooks/useNetworkStatus";

// Utils
import { logger } from "./src/utils/logger";

// ============================================================================
// APP CONTENT COMPONENT
// ============================================================================

const AppContent: React.FC = () => {
  const { isAuthenticated, loading, user, isInitialized } = useAuth();
  const { isConnected } = useNetworkStatus();
  const [isRehydrated, setIsRehydrated] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Wait for store rehydration
        await waitForRehydration();
        setIsRehydrated(true);

        logger.info("App initialized successfully", {
          isAuthenticated,
          userId: user?.id,
          isConnected,
        });
      } catch (error) {
        logger.error("App initialization failed:", error);
        setIsRehydrated(true); // Continue anyway
      }
    };

    initializeApp();
  }, [isAuthenticated, user?.id, isConnected]);

  // Show splash screen during initialization
  if (!isRehydrated || !isInitialized || loading.initialization) {
    return <SplashScreen />;
  }

  return (
    <View style={styles.container}>
      {/* Connection Status Indicator */}
      <ConnectionStatusIndicator />

      {/* Main Navigation */}
      <AuthNavigator />

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
