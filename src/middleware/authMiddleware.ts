// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================
// Authentication middleware for automatic token refresh, session management,
// and authentication state synchronization

import { Middleware, AnyAction } from "@reduxjs/toolkit";
import { logger } from "../utils/logger";
import { refreshTokens, forceLogout } from "../store/auth/authSlice";
import { areTokensExpired } from "../utils/storage";

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Authentication middleware that handles:
 * - Automatic token refresh when tokens are about to expire
 * - Session validation for protected actions
 * - Automatic logout on authentication failures
 */
export const authMiddleware: Middleware = (store) => (next) => (action: any) => {
  const state = store.getState() as any;
  const { auth } = state;

  // List of actions that require authentication
  const protectedActions = [
    "workout/startWorkout",
    "workout/completeWorkout",
    "workout/addExerciseSet",
    "workout/syncPendingWorkouts",
    "progress/calculateMetrics",
    "progress/updatePersonalRecords",
    "subscription/create",
    "subscription/update",
    "subscription/cancel",
  ];

  // Check if this action requires authentication
  const requiresAuth = protectedActions.some(
    (pattern) =>
      action.type && action.type.includes(pattern.split("/")[0]) && action.type.includes(pattern.split("/")[1])
  );

  if (requiresAuth) {
    // Check if user is authenticated
    if (!auth.isAuthenticated || !auth.session) {
      logger.warn(
        "Protected action attempted without authentication",
        {
          actionType: action.type,
        },
        "auth"
      );

      // Dispatch force logout to clear any stale state
      store.dispatch(forceLogout());

      // Reject the action by returning an error action
      return next({
        type: action.type,
        error: true,
        payload: "Authentication required",
      });
    }

    // For async token refresh, we'll handle it in a simpler way
    // The actual token refresh will be handled by the auth slice
  }

  // Handle authentication-related actions
  if (action.type && action.type.startsWith("auth/")) {
    const result = next(action);

    // Handle successful login/signup
    if (action.type === "auth/loginUser/fulfilled" || action.type === "auth/signupUser/fulfilled") {
      logger.info(
        "User authenticated successfully",
        {
          actionType: action.type,
          userId: action.payload?.user?.id,
        },
        "auth",
        action.payload?.user?.id
      );

      // Schedule automatic token refresh
      scheduleTokenRefresh(store, action.payload?.session?.expiresAt);
    }

    // Handle logout
    if (action.type === "auth/logoutUser/fulfilled" || action.type === "auth/forceLogout") {
      logger.info("User logged out", { actionType: action.type }, "auth");

      // Clear any scheduled token refresh
      clearTokenRefreshSchedule();

      // Clear other store data
      store.dispatch({ type: "workout/clearOfflineData" });
      store.dispatch({ type: "progress/clearProgressData" });
      store.dispatch({ type: "subscription/clearSubscriptionData" });
      store.dispatch({ type: "ui/clearUIData" });
    }

    // Handle token refresh
    if (action.type === "auth/refreshTokens/fulfilled") {
      logger.info("Tokens refreshed via middleware", undefined, "auth", action.payload?.user?.id);

      // Reschedule token refresh with new expiration
      scheduleTokenRefresh(store, action.payload?.session?.expiresAt);
    }

    // Handle authentication failures
    if (action.type.endsWith("/rejected") && action.type.startsWith("auth/")) {
      logger.error(
        "Authentication action failed",
        {
          actionType: action.type,
          error: action.payload,
        },
        "auth"
      );

      // Force logout on critical auth failures
      if (action.type === "auth/refreshTokens/rejected") {
        logger.warn("Token refresh failed, forcing logout", undefined, "auth");
        store.dispatch(forceLogout());
      }
    }

    return result;
  }

  // Continue with the action
  return next(action);
};

// ============================================================================
// TOKEN REFRESH SCHEDULING
// ============================================================================

let tokenRefreshTimeout: NodeJS.Timeout | null = null;

/**
 * Schedule automatic token refresh before expiration
 */
function scheduleTokenRefresh(store: any, expiresAt?: string): void {
  // Clear any existing timeout
  clearTokenRefreshSchedule();

  if (!expiresAt) {
    logger.warn("No expiration time provided for token refresh scheduling", undefined, "auth");
    return;
  }

  const expirationTime = new Date(expiresAt).getTime();
  const currentTime = Date.now();
  const refreshBuffer = 5 * 60 * 1000; // 5 minutes before expiry
  const refreshTime = expirationTime - refreshBuffer;
  const delay = Math.max(0, refreshTime - currentTime);

  if (delay <= 0) {
    // Tokens are already expired or about to expire, refresh immediately
    logger.info("Tokens expired or expiring soon, refreshing immediately", undefined, "auth");
    store.dispatch(refreshTokens());
    return;
  }

  logger.info(
    "Scheduling token refresh",
    {
      expiresAt,
      refreshInMs: delay,
      refreshInMinutes: Math.round(delay / (1000 * 60)),
    },
    "auth"
  );

  tokenRefreshTimeout = setTimeout(() => {
    logger.info("Executing scheduled token refresh", undefined, "auth");
    store.dispatch(refreshTokens());
  }, delay);
}

/**
 * Clear scheduled token refresh
 */
function clearTokenRefreshSchedule(): void {
  if (tokenRefreshTimeout) {
    clearTimeout(tokenRefreshTimeout);
    tokenRefreshTimeout = null;
    logger.info("Token refresh schedule cleared", undefined, "auth");
  }
}

// ============================================================================
// SESSION VALIDATION
// ============================================================================

/**
 * Validate current session and refresh if needed
 */
export async function validateSession(store: any): Promise<boolean> {
  const state = store.getState() as any;
  const { auth } = state;

  if (!auth.isAuthenticated || !auth.session) {
    logger.info("No active session to validate", undefined, "auth");
    return false;
  }

  try {
    const tokensExpired = await areTokensExpired();

    if (tokensExpired) {
      logger.info("Session expired, attempting refresh", undefined, "auth", auth.user?.id);

      const refreshResult = await store.dispatch(refreshTokens());

      if (refreshTokens.fulfilled.match(refreshResult)) {
        logger.info("Session validated and refreshed", undefined, "auth", auth.user?.id);
        return true;
      } else {
        logger.error("Session validation failed", refreshResult.payload, "auth");
        store.dispatch(forceLogout());
        return false;
      }
    }

    logger.info("Session is valid", undefined, "auth", auth.user?.id);
    return true;
  } catch (error) {
    logger.error("Error validating session", error, "auth");
    return false;
  }
}

// ============================================================================
// AUTHENTICATION HELPERS
// ============================================================================

/**
 * Check if user has required permissions for an action
 */
export function hasPermission(store: any, requiredRole: string): boolean {
  const state = store.getState() as any;
  const { auth, subscription } = state;

  if (!auth.isAuthenticated) {
    return false;
  }

  // Get user role from subscription or user metadata
  const userRole = subscription.currentSubscription?.planId || "free";

  // Define role hierarchy
  const roleHierarchy = {
    free: 0,
    premium_monthly: 1,
    premium_yearly: 1,
    coach: 2,
    admin: 3,
  };

  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
  const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;

  const hasAccess = userLevel >= requiredLevel;

  logger.info(
    "Permission check",
    {
      userRole,
      requiredRole,
      hasAccess,
    },
    "auth",
    auth.user?.id
  );

  return hasAccess;
}

/**
 * Get authentication headers for API requests
 */
export function getAuthHeaders(store: any): Record<string, string> {
  const state = store.getState() as any;
  const { auth } = state;

  if (!auth.isAuthenticated || !auth.session?.accessToken) {
    return {};
  }

  return {
    Authorization: `Bearer ${auth.session.accessToken}`,
  };
}

/**
 * Initialize authentication middleware
 */
export function initializeAuthMiddleware(store: any): void {
  logger.info("Initializing authentication middleware", undefined, "auth");

  // Set up periodic session validation (every 30 minutes)
  setInterval(() => {
    validateSession(store);
  }, 30 * 60 * 1000);

  // Set up network status listener for sync when back online
  // This would typically be handled by a network detection service
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("online", () => {
      logger.info("Network back online, validating session", undefined, "auth");
      validateSession(store);
    });

    window.addEventListener("offline", () => {
      logger.info("Network offline, clearing token refresh schedule", undefined, "auth");
      clearTokenRefreshSchedule();
    });
  }

  logger.info("Authentication middleware initialized", undefined, "auth");
}

export default authMiddleware;
