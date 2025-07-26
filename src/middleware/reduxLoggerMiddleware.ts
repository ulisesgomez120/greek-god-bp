// ============================================================================
// CUSTOM REDUX LOGGING MIDDLEWARE
// ============================================================================
// Custom Redux logging middleware using the existing logger utility
// Provides better integration than redux-logger with our logging system

import { Middleware } from "@reduxjs/toolkit";
import { logger } from "../utils/logger";
import { DEV_CONSTANTS } from "../config/constants";

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface LoggerConfig {
  predicate?: (getState: () => any, action: any) => boolean;
  collapsed?: boolean;
  duration?: boolean;
  timestamp?: boolean;
  logErrors?: boolean;
  diff?: boolean;
  actionTransformer?: (action: any) => any;
  stateTransformer?: (state: any) => any;
}

interface ActionLog {
  type: string;
  payload?: any;
  meta?: any;
  error?: boolean;
  timestamp: string;
  duration?: number;
  prevState?: any;
  nextState?: any;
  diff?: any;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Sanitize sensitive data from actions
 */
function sanitizeAction(action: any): any {
  if (!action) return action;

  const sanitized = { ...action };

  // Sanitize auth-related actions
  if (action.type?.includes("auth") && action.payload) {
    sanitized.payload = { ...action.payload };

    // Remove sensitive fields
    if (sanitized.payload.password) {
      sanitized.payload.password = "[REDACTED]";
    }
    if (sanitized.payload.token) {
      sanitized.payload.token = "[REDACTED]";
    }
    if (sanitized.payload.refreshToken) {
      sanitized.payload.refreshToken = "[REDACTED]";
    }
  }

  // Sanitize API responses that might contain sensitive data
  if (action.type?.includes("api") && action.payload?.data) {
    sanitized.payload = { ...action.payload };
    if (sanitized.payload.data.session) {
      sanitized.payload.data.session = "[REDACTED]";
    }
  }

  return sanitized;
}

/**
 * Sanitize sensitive data from state
 */
function sanitizeState(state: any): any {
  if (!state) return state;

  const sanitized = { ...state };

  // Sanitize auth state
  if (sanitized.auth) {
    sanitized.auth = { ...sanitized.auth };
    if (sanitized.auth.session) {
      sanitized.auth.session = "[REDACTED]";
    }
    if (sanitized.auth.tokens) {
      sanitized.auth.tokens = "[REDACTED]";
    }
  }

  // Sanitize any other sensitive data
  if (sanitized.subscription?.paymentMethod) {
    sanitized.subscription.paymentMethod = "[REDACTED]";
  }

  return sanitized;
}

/**
 * Calculate simple state diff for logging
 */
function calculateStateDiff(prevState: any, nextState: any): any {
  const diff: any = {};

  try {
    // Simple diff calculation - only for top-level changes
    Object.keys(nextState).forEach((key) => {
      if (prevState[key] !== nextState[key]) {
        diff[key] = {
          prev: prevState[key],
          next: nextState[key],
        };
      }
    });
  } catch (error) {
    // If diff calculation fails, just note that state changed
    diff._error = "Could not calculate diff";
  }

  return Object.keys(diff).length > 0 ? diff : null;
}

/**
 * Format action type for better readability
 */
function formatActionType(type: string): string {
  // Convert action types like "auth/login/fulfilled" to "Auth Login Fulfilled"
  return type
    .split("/")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Get action category for logging
 */
function getActionCategory(type: string): string {
  if (type.includes("auth")) return "auth";
  if (type.includes("workout")) return "workout";
  if (type.includes("ai")) return "ai";
  if (type.includes("api")) return "api";
  if (type.includes("ui")) return "ui";
  if (type.includes("subscription")) return "subscription";
  if (type.includes("progress")) return "progress";
  return "redux";
}

// ============================================================================
// REDUX LOGGER MIDDLEWARE
// ============================================================================

/**
 * Create custom Redux logging middleware
 */
export function createReduxLoggerMiddleware(config: LoggerConfig = {}): Middleware {
  const {
    predicate = () => DEV_CONSTANTS.logLevel === "debug",
    collapsed = true,
    duration = true,
    timestamp = true,
    logErrors = true,
    diff = true,
    actionTransformer = sanitizeAction,
    stateTransformer = sanitizeState,
  } = config;

  return (store) => (next) => (action) => {
    // Check if we should log this action
    if (!predicate(store.getState, action)) {
      return next(action);
    }

    const startTime = performance.now();
    const prevState = stateTransformer(store.getState());
    const sanitizedAction = actionTransformer(action);

    // Execute the action
    const result = next(action);

    const endTime = performance.now();
    const nextState = stateTransformer(store.getState());
    const actionDuration = Math.round(endTime - startTime);

    // Create log entry
    const logEntry: ActionLog = {
      type: sanitizedAction.type,
      payload: sanitizedAction.payload,
      meta: sanitizedAction.meta,
      error: sanitizedAction.error,
      timestamp: new Date().toISOString(),
    };

    if (duration) {
      logEntry.duration = actionDuration;
    }

    if (diff) {
      logEntry.prevState = prevState;
      logEntry.nextState = nextState;
      logEntry.diff = calculateStateDiff(prevState, nextState);
    }

    // Determine log level
    const logLevel = sanitizedAction.error ? "error" : "debug";
    const category = getActionCategory(sanitizedAction.type);
    const formattedType = formatActionType(sanitizedAction.type);

    // Create log message
    let message = `Redux Action: ${formattedType}`;
    if (duration && actionDuration > 0) {
      message += ` (${actionDuration}ms)`;
    }

    // Log the action
    if (logLevel === "error") {
      logger.error(message, logEntry, category);
    } else {
      logger.debug(message, logEntry, category);
    }

    // Additional logging for specific action types
    if (sanitizedAction.type.includes("auth/login")) {
      logger.auth("info", "User login attempt", {
        success: !sanitizedAction.error,
        duration: actionDuration,
      });
    }

    if (sanitizedAction.type.includes("workout/session")) {
      logger.workout("info", "Workout session action", {
        action: sanitizedAction.type,
        duration: actionDuration,
      });
    }

    if (sanitizedAction.type.includes("ai/")) {
      logger.ai("info", "AI interaction", {
        action: sanitizedAction.type,
        duration: actionDuration,
      });
    }

    // Log performance warnings for slow actions
    if (actionDuration > 100) {
      logger.performance(`Slow Redux action: ${formattedType}`, actionDuration, { actionType: sanitizedAction.type });
    }

    // Log errors with more detail
    if (sanitizedAction.error && logErrors) {
      logger.error(
        `Redux action error: ${formattedType}`,
        {
          action: sanitizedAction,
          error: sanitizedAction.payload,
          duration: actionDuration,
        },
        category
      );
    }

    return result;
  };
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

/**
 * Development configuration - logs everything
 */
export const developmentLoggerConfig: LoggerConfig = {
  predicate: () => DEV_CONSTANTS.enableDebugMode,
  collapsed: true,
  duration: true,
  timestamp: true,
  logErrors: true,
  diff: true,
};

/**
 * Production configuration - only errors and important actions
 */
export const productionLoggerConfig: LoggerConfig = {
  predicate: (getState, action) => {
    // Only log errors and critical actions in production
    return (
      action.error ||
      action.type.includes("auth/") ||
      action.type.includes("subscription/") ||
      action.type.includes("CRITICAL")
    );
  },
  collapsed: true,
  duration: false,
  timestamp: true,
  logErrors: true,
  diff: false,
};

/**
 * Performance monitoring configuration
 */
export const performanceLoggerConfig: LoggerConfig = {
  predicate: () => true,
  collapsed: true,
  duration: true,
  timestamp: false,
  logErrors: true,
  diff: false,
  actionTransformer: (action) => ({
    type: action.type,
    // Only include payload size for performance monitoring
    payloadSize: JSON.stringify(action.payload || {}).length,
  }),
  stateTransformer: () => null, // Don't log state for performance monitoring
};

// ============================================================================
// EXPORT DEFAULT MIDDLEWARE
// ============================================================================

// Export the middleware with development configuration by default
export const reduxLoggerMiddleware = createReduxLoggerMiddleware(
  DEV_CONSTANTS.enableDebugMode ? developmentLoggerConfig : productionLoggerConfig
);

export default reduxLoggerMiddleware;
