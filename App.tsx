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
import useSplashScreen from "@/hooks/useSplashScreen";

// Store and persistence
import { store, persistor, waitForRehydration } from "./src/store";

// Components
import AppNavigator from "./src/navigation/AppNavigator";
import SplashScreen from "./src/components/ui/SplashScreen";
import ErrorBoundary from "./src/components/ui/ErrorBoundary";

// Utils
import { logger } from "./src/utils/logger";
import { registerAuthDispatch } from "@/utils/tokenManager";
import notificationService from "@/services/notification.service";

// ============================================================================
// APP CONTENT COMPONENT
// ============================================================================

const AppContent: React.FC = () => {
  const [isRehydrated, setIsRehydrated] = useState(false);
  const { theme, statusBarStyle } = useTheme();
  const {
    state: splashState,
    show: showSplash,
    hide: hideSplash,
  } = useSplashScreen({
    minimumDisplayTimeMs: 2500,
  });

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // show splash immediately
        showSplash();

        // Register TokenManager with Redux dispatch early so it can keep auth state in sync.
        try {
          registerAuthDispatch(store.dispatch);
        } catch (err) {
          logger.warn("Failed to register TokenManager dispatch during app bootstrap", err);
        }

        // Initialize notification service (register handler) but do NOT prompt for permissions on init.
        try {
          void notificationService.initNotificationService({ requestPermissionOnInit: false });
        } catch (err) {
          logger.warn("Failed to initialize notification service during app bootstrap", err);
        }

        // Wait for store rehydration
        await waitForRehydration();
        setIsRehydrated(true);

        logger.info("App initialized successfully");
      } catch (error) {
        logger.error("App initialization failed:", error);
        setIsRehydrated(true); // Continue anyway
      } finally {
        // hide splash (will respect minimum display time)
        hideSplash();
      }
    };

    initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While splash is active (loading or ready-to-hide), render SplashScreen so PWA shows it
  if (splashState !== "hidden") {
    return <SplashScreen minimumDisplayTimeMs={2000} />;
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
