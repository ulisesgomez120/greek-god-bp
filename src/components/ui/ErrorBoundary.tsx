// ============================================================================
// ERROR BOUNDARY COMPONENT
// ============================================================================
// App-level error boundary with branded error screen and recovery options

import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import Text from "./Text";
import Button from "./Button";
import { logger } from "../../utils/logger";

// ============================================================================
// TYPES
// ============================================================================

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

// ============================================================================
// ERROR BOUNDARY COMPONENT
// ============================================================================

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to our logging service
    logger.error("Error Boundary caught an error:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleReload = () => {
    // In a real app, you might want to restart the app or navigate to a safe screen
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.content}>
            {/* Error Icon */}
            <View style={styles.iconContainer}>
              <Text variant='h1' style={styles.errorIcon}>
                ⚠️
              </Text>
            </View>

            {/* Error Title */}
            <Text variant='h2' color='primary' align='center' style={styles.title}>
              Something went wrong
            </Text>

            {/* Error Message */}
            <Text variant='body' color='secondary' align='center' style={styles.message}>
              We're sorry, but something unexpected happened. The error has been logged and we'll work to fix it.
            </Text>

            {/* Error Details (Development Only) */}
            {__DEV__ && this.state.error && (
              <View style={styles.errorDetails}>
                <Text variant='bodySmall' color='error' style={styles.errorText}>
                  {this.state.error.message}
                </Text>
                {this.state.error.stack && (
                  <Text variant='caption' color='secondary' style={styles.stackTrace}>
                    {this.state.error.stack.substring(0, 500)}...
                  </Text>
                )}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actions}>
              <Button variant='primary' size='large' onPress={this.handleRetry} style={styles.retryButton}>
                Try Again
              </Button>

              <Button variant='secondary' size='medium' onPress={this.handleReload} style={styles.reloadButton}>
                Restart App
              </Button>
            </View>

            {/* Support Message */}
            <Text variant='bodySmall' color='secondary' align='center' style={styles.supportMessage}>
              If this problem persists, please contact support with the error details above.
            </Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  content: {
    alignItems: "center",
    maxWidth: 400,
    width: "100%",
  },
  iconContainer: {
    marginBottom: 24,
  },
  errorIcon: {
    fontSize: 64,
  },
  title: {
    marginBottom: 16,
  },
  message: {
    marginBottom: 32,
    textAlign: "center",
    lineHeight: 22,
  },
  errorDetails: {
    backgroundColor: "#FFF5F5",
    borderRadius: 8,
    padding: 16,
    marginBottom: 32,
    width: "100%",
    borderLeftWidth: 4,
    borderLeftColor: "#FF3B30",
  },
  errorText: {
    marginBottom: 8,
    fontFamily: "monospace",
  },
  stackTrace: {
    fontFamily: "monospace",
    lineHeight: 14,
  },
  actions: {
    width: "100%",
    alignItems: "center",
    marginBottom: 24,
  },
  retryButton: {
    width: "100%",
    marginBottom: 12,
  },
  reloadButton: {
    width: "100%",
  },
  supportMessage: {
    textAlign: "center",
    lineHeight: 18,
    opacity: 0.8,
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default ErrorBoundary;
