// ============================================================================
// TOKEN MANAGER
// ============================================================================
// Secure token storage and automatic refresh logic with comprehensive
// error handling and network-aware refresh strategies

import StorageAdapter from "@/lib/storageAdapter";
import { getAsyncItem, setAsyncItem, removeAsyncItem } from "@/utils/storage";
import { ENV_CONFIG, STORAGE_KEYS, SESSION_PERSISTENCE_CONFIG } from "@/config/constants";
import supabase from "@/lib/supabase";
import { logger } from "@/utils/logger";
import { forceLogout } from "@/store/auth/authSlice";
import type { TokenData, TokenValidationResult } from "@/types/auth";
import { shouldAttemptRefreshOnFocus, recordSessionMetrics, getSessionMetrics } from "@/utils/sessionPersistence";

// ============================================================================
// CONSTANTS
// ============================================================================

const REFRESH_BUFFER_TIME = SESSION_PERSISTENCE_CONFIG.bufferTimeMs ?? 60 * 60 * 1000;
const MAX_RETRY_ATTEMPTS = SESSION_PERSISTENCE_CONFIG.maxRetryAttempts ?? 5;
const RETRY_DELAY_BASE = SESSION_PERSISTENCE_CONFIG.retryBackoffBaseMs ?? 1000;
const TOKEN_ENCRYPTION_KEY = "trainsmart_token_key";

// ============================================================================
// TOKEN MANAGER CLASS
// ============================================================================

export class TokenManager {
  private static instance: TokenManager;
  private supabaseClient: any;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private periodicTimer?: ReturnType<typeof setInterval>;
  private isRefreshing = false;
  private refreshPromise?: Promise<TokenData | null>;
  // Optional Redux dispatch registered by app initialization to keep auth state in sync.
  // Register with tokenManager.registerDispatch(dispatch) during app bootstrap.
  private reduxDispatch?: ((action: any) => void) | null;

  private constructor() {
    // Use the shared Supabase client instance so session state is consistent across the app
    this.supabaseClient = supabase;
    this.initializeAutoRefresh();
  }

  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  // ============================================================================
  // TOKEN STORAGE OPERATIONS
  // ============================================================================

  /**
   * Store tokens securely with encryption
   */
  async storeTokens(tokens: TokenData): Promise<void> {
    try {
      logger.info("TokenManager: Storing tokens securely", undefined, "auth");

      // Store access and refresh tokens using the platform-aware adapter and async metadata helpers
      await Promise.all([
        StorageAdapter.secure.setItem(STORAGE_KEYS.secure.accessToken, tokens.accessToken),
        StorageAdapter.secure.setItem(STORAGE_KEYS.secure.refreshToken, tokens.refreshToken),
        // Store expiry metadata via async storage helper
        setAsyncItem("token_expires_at", tokens.expiresAt),
        setAsyncItem("token_stored_at", new Date().toISOString()),
      ]);

      // Schedule automatic refresh
      this.scheduleTokenRefresh(tokens.expiresAt);

      // Immediately attempt to rehydrate the Supabase client session so getSession() works right away.
      try {
        await supabase.auth.setSession({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
        });
        logger.info("TokenManager: Supabase session rehydrated from stored tokens", undefined, "auth");
      } catch (rehydErr) {
        logger.warn("TokenManager: Failed to rehydrate Supabase session after storing tokens", rehydErr, "auth");
      }

      logger.info("TokenManager: Tokens stored successfully", undefined, "auth");
    } catch (error) {
      logger.error("TokenManager: Failed to store tokens", error, "auth");
      throw new Error("Failed to store authentication tokens");
    }
  }

  /**
   * Retrieve stored tokens
   */
  async getTokens(): Promise<TokenData | null> {
    try {
      const [accessToken, refreshToken, expiresAt] = await Promise.all([
        StorageAdapter.secure.getItem(STORAGE_KEYS.secure.accessToken),
        StorageAdapter.secure.getItem(STORAGE_KEYS.secure.refreshToken),
        // Read expiry metadata via async storage helper
        getAsyncItem<string>("token_expires_at"),
      ]);

      if (!accessToken || !refreshToken) {
        logger.debug("TokenManager: No tokens found in storage", undefined, "auth");
        return null;
      }

      const tokens: TokenData = {
        accessToken,
        refreshToken,
        expiresAt: expiresAt || "",
      };

      logger.debug("TokenManager: Tokens retrieved successfully", undefined, "auth");
      return tokens;
    } catch (error) {
      logger.error("TokenManager: Failed to retrieve tokens", error, "auth");
      return null;
    }
  }

  /**
   * Clear all stored tokens
   */
  async clearTokens(): Promise<void> {
    try {
      logger.info("TokenManager: Clearing stored tokens", undefined, "auth");

      // Clear refresh timer
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = undefined;
      }

      // Clear stored tokens
      await Promise.all([
        StorageAdapter.secure.removeItem(STORAGE_KEYS.secure.accessToken).catch(() => {}),
        StorageAdapter.secure.removeItem(STORAGE_KEYS.secure.refreshToken).catch(() => {}),
        // Use async storage helper removal to keep behavior consistent
        removeAsyncItem("token_expires_at").catch(() => {}),
        removeAsyncItem("token_stored_at").catch(() => {}),
      ]);

      // Ensure Supabase client session is cleared as well (best-effort)
      try {
        await supabase.auth.signOut();
        logger.debug("TokenManager: Supabase signOut called during clearTokens");
      } catch (signOutErr) {
        logger.warn("TokenManager: Supabase signOut failed during clearTokens", signOutErr);
      }

      // If a Redux dispatch was registered, notify the store to force logout so
      // app-level state does not remain authenticated after tokens are cleared.
      try {
        if (this.reduxDispatch) {
          this.reduxDispatch(forceLogout());
          logger.debug("TokenManager: Dispatched forceLogout via registered reduxDispatch");
        }
      } catch (dispatchErr) {
        logger.warn("TokenManager: Failed to dispatch forceLogout from clearTokens", dispatchErr);
      }

      // Record session cleared metric for diagnostics (best-effort)
      try {
        await recordSessionMetrics("session_cleared");
      } catch (err) {
        logger.warn("TokenManager: Failed to record session_cleared metric", err, "auth");
      }

      logger.info("TokenManager: Tokens cleared successfully", undefined, "auth");
    } catch (error) {
      logger.error("TokenManager: Failed to clear tokens", error, "auth");
      throw new Error("Failed to clear authentication tokens");
    }
  }

  // ============================================================================
  // TOKEN VALIDATION
  // ============================================================================

  /**
   * Validate current tokens
   */
  async validateTokens(): Promise<TokenValidationResult> {
    try {
      const tokens = await this.getTokens();

      if (!tokens) {
        return {
          isValid: false,
          isExpired: true,
          expiresIn: 0,
          needsRefresh: true,
        };
      }

      const expirationTime = new Date(tokens.expiresAt).getTime();
      const currentTime = Date.now();
      const expiresIn = expirationTime - currentTime;
      const isExpired = expiresIn <= 0;
      const needsRefresh = expiresIn <= REFRESH_BUFFER_TIME;

      return {
        isValid: !isExpired,
        isExpired,
        expiresIn,
        needsRefresh,
      };
    } catch (error) {
      logger.error("TokenManager: Token validation failed", error, "auth");
      return {
        isValid: false,
        isExpired: true,
        expiresIn: 0,
        needsRefresh: true,
      };
    }
  }

  /**
   * Check if tokens are expired
   */
  async areTokensExpired(): Promise<boolean> {
    const validation = await this.validateTokens();
    return validation.isExpired;
  }

  /**
   * Check if tokens need refresh
   */
  async needsRefresh(): Promise<boolean> {
    const validation = await this.validateTokens();
    return validation.needsRefresh;
  }

  // ============================================================================
  // TOKEN REFRESH
  // ============================================================================

  /**
   * Refresh tokens with retry logic
   */
  async refreshTokens(): Promise<TokenData | null> {
    // Prevent concurrent refresh attempts
    if (this.isRefreshing && this.refreshPromise) {
      logger.debug("TokenManager: Refresh already in progress, waiting...", undefined, "auth");
      return await this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = undefined;
    }
  }

  private isPermanentRefreshError(err: any): boolean {
    if (!err) return false;
    const msg = (err?.message || String(err || "")).toLowerCase();
    if (
      msg.includes("invalid_grant") ||
      (msg.includes("refresh token") && (msg.includes("revoked") || msg.includes("expired") || msg.includes("invalid")))
    ) {
      return true;
    }
    if (err?.status === 401 || err?.status === 400) return true;
    return false;
  }

  /**
   * Perform the actual token refresh with retry logic
   */
  private async performTokenRefresh(): Promise<TokenData | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        logger.info(`TokenManager: Refresh attempt ${attempt}/${MAX_RETRY_ATTEMPTS}`, undefined, "auth");

        const currentTokens = await this.getTokens();
        if (!currentTokens?.refreshToken) {
          logger.warn("TokenManager: No refresh token available", undefined, "auth");
          return null;
        }

        // Attempt refresh with Supabase
        const { data, error } = await this.supabaseClient.auth.refreshSession({
          refresh_token: currentTokens.refreshToken,
        });

        if (error) {
          throw new Error(`Supabase refresh failed: ${error.message}`);
        }

        if (!data.session) {
          throw new Error("No session returned from refresh");
        }

        // Store new tokens
        const newTokens: TokenData = {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
        };

        await this.storeTokens(newTokens);

        // Record successful refresh for diagnostics (best-effort)
        try {
          await recordSessionMetrics("refresh_success");
        } catch (err) {
          logger.warn("TokenManager: Failed to record refresh_success metric", err, "auth");
        }

        logger.info("TokenManager: Tokens refreshed successfully", undefined, "auth");
        return newTokens;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown refresh error");
        logger.warn(`TokenManager: Refresh attempt ${attempt} failed`, { error: lastError.message }, "auth");

        // Wait before retry (exponential backoff)
        if (attempt < MAX_RETRY_ATTEMPTS) {
          const delay = RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    logger.error("TokenManager: All refresh attempts failed", lastError, "auth");

    try {
      const permanent = this.isPermanentRefreshError(lastError);
      if (permanent) {
        await recordSessionMetrics("refresh_failed_permanent", {
          message: (lastError as any)?.message ?? String(lastError),
        });
        await this.clearTokens();
      } else {
        await recordSessionMetrics("refresh_failed_temporary", {
          message: (lastError as any)?.message ?? String(lastError),
        });

        const retryDelay =
          (RETRY_DELAY_BASE ?? 1000) * Math.pow(2, SESSION_PERSISTENCE_CONFIG.maxRetryAttempts ?? MAX_RETRY_ATTEMPTS);
        logger.info(
          `TokenManager: Scheduling retry in ${Math.round(retryDelay / 1000)}s after temporary failure`,
          undefined,
          "auth"
        );

        if (this.refreshTimer) {
          clearTimeout(this.refreshTimer);
        }

        this.refreshTimer = setTimeout(async () => {
          logger.info("TokenManager: Retry triggered after temporary refresh failure", undefined, "auth");
          await this.refreshTokensIfOnline();
        }, retryDelay);
      }
    } catch (err) {
      logger.warn("TokenManager: Error while handling failed refresh outcome", err, "auth");
    }

    return null;
  }

  // ============================================================================
  // AUTOMATIC REFRESH SCHEDULING
  // ============================================================================

  /**
   * Initialize automatic token refresh and perform one-time migration of legacy AsyncStorage tokens.
   */
  private async initializeAutoRefresh(): Promise<void> {
    try {
      // Initialize refresh scheduling from whatever tokens we now have
      const tokens = await this.getTokens();
      if (tokens) {
        this.scheduleTokenRefresh(tokens.expiresAt);

        // Attempt to rehydrate the shared Supabase client session using stored tokens.
        // TokenManager centralizes session rehydration so other modules (auth.service)
        // should not call supabase.auth.setSession directly.
        try {
          await supabase.auth.setSession({
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
          });
          logger.info("TokenManager: Supabase session rehydrated during initialization", undefined, "auth");
          // Record session rehydration time for heuristics and diagnostics
          await recordSessionMetrics("session_rehydrated");
        } catch (rehydErr) {
          logger.warn("TokenManager: Failed to rehydrate Supabase session during initialization", rehydErr, "auth");
          await recordSessionMetrics("refresh_failed_temporary", {
            context: "rehydration",
            message: (rehydErr as any)?.message ?? String(rehydErr),
          });
        }
      }
    } catch (error) {
      logger.error("TokenManager: Failed to initialize auto-refresh", error, "auth");
    }
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(expiresAt: string): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    try {
      const expirationTime = new Date(expiresAt).getTime();
      const buffer = SESSION_PERSISTENCE_CONFIG.bufferTimeMs ?? REFRESH_BUFFER_TIME;
      const refreshTime = expirationTime - buffer;
      const delay = Math.max(0, refreshTime - Date.now());

      this.refreshTimer = setTimeout(async () => {
        logger.info("TokenManager: Automatic refresh triggered", undefined, "auth");
        await recordSessionMetrics("refresh_attempt", { trigger: "scheduled" });
        await this.refreshTokensIfOnline();
      }, delay);

      logger.debug(`TokenManager: Refresh scheduled in ${Math.round(delay / 1000)} seconds`, undefined, "auth");
    } catch (error) {
      logger.error("TokenManager: Failed to schedule refresh", error, "auth");
    }
  }

  // ============================================================================
  // NETWORK-AWARE OPERATIONS
  // ============================================================================

  /**
   * Check network connectivity
   */
  private async isNetworkAvailable(): Promise<boolean> {
    try {
      // Fast-path for web: use navigator.onLine where available which avoids CORS issues.
      if (typeof window !== "undefined" && typeof navigator !== "undefined" && "onLine" in navigator) {
        // navigator.onLine is a coarse check but avoids cross-origin HEAD requests that are often blocked by CORS.
        if (!navigator.onLine) return false;
        // If navigator reports online, optionally attempt a lightweight fetch in no-cors mode.
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          // Use no-cors to avoid CORS failures; a resolved promise indicates the network is reachable.
          await fetch(ENV_CONFIG.supabaseUrl, { method: "HEAD", mode: "no-cors", signal: controller.signal });
          clearTimeout(timeoutId);
          return true;
        } catch {
          // If the no-cors attempt fails (timeout or network error), still fall back to navigator.onLine result.
          return true;
        }
      }

      // Fallback for native or environments without navigator.onLine: use a HEAD request with timeout.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(ENV_CONFIG.supabaseUrl, {
        method: "HEAD",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Refresh tokens only if network is available
   */
  async refreshTokensIfOnline(): Promise<TokenData | null> {
    const isOnline = await this.isNetworkAvailable();

    if (!isOnline) {
      logger.warn("TokenManager: Network unavailable, skipping refresh", undefined, "auth");
      await recordSessionMetrics("refresh_failed_temporary", { reason: "offline" });
      return null;
    }

    return await this.refreshTokens();
  }

  // ============================================================================
  // LIFECYCLE / DIAGNOSTICS
  // ============================================================================

  /**
   * Handle app lifecycle changes (foreground/background). When app becomes active,
   * decide whether to attempt a refresh using sessionPersistence heuristics.
   */
  async handleAppStateChange(state: "active" | "background" | "inactive"): Promise<void> {
    try {
      if (state !== "active") return;

      const metrics = await getSessionMetrics();
      const lastRefreshAt = metrics?.lastRefreshAt ?? null;
      const sessionStartTime = metrics?.sessionStartTime ?? null;

      const should = await shouldAttemptRefreshOnFocus(lastRefreshAt, sessionStartTime, SESSION_PERSISTENCE_CONFIG);
      if (should) {
        logger.debug("TokenManager: App became active and should attempt refresh", undefined, "auth");
        await recordSessionMetrics("refresh_attempt", { trigger: "app_foreground" });
        await this.refreshTokensIfOnline();
      }
    } catch (err) {
      logger.warn("TokenManager: handleAppStateChange failed", err, "auth");
    }
  }

  /**
   * Schedule periodic refreshes for long-running foreground sessions.
   * Uses SESSION_PERSISTENCE_CONFIG.periodicRefreshIntervalMs.
   */
  schedulePeriodicRefresh(enable = true): void {
    // Clear existing periodic timer
    if (this.periodicTimer) {
      clearTimeout(this.periodicTimer);
      this.periodicTimer = undefined;
    }

    if (!enable) return;

    const interval = SESSION_PERSISTENCE_CONFIG.periodicRefreshIntervalMs ?? 0;
    if (!interval || interval <= 0) return;

    this.periodicTimer = setInterval(async () => {
      logger.debug("TokenManager: Periodic refresh triggered", undefined, "auth");
      await recordSessionMetrics("refresh_attempt", { trigger: "periodic" });
      await this.refreshTokensIfOnline();
    }, interval);
  }

  /**
   * Return a lightweight session health summary for diagnostics.
   */
  async getSessionHealth(): Promise<{
    isRefreshing: boolean;
    expiresInMs: number;
    needsRefresh: boolean;
    lastRefreshAt?: number | null;
    sessionStartTime?: number | null;
  }> {
    try {
      const validation = await this.validateTokens();
      const metrics = await getSessionMetrics();
      return {
        isRefreshing: this.isRefreshing,
        expiresInMs: validation.expiresIn,
        needsRefresh: validation.needsRefresh,
        lastRefreshAt: metrics?.lastRefreshAt ?? null,
        sessionStartTime: metrics?.sessionStartTime ?? null,
      };
    } catch (err) {
      logger.warn("TokenManager: getSessionHealth failed", err, "auth");
      return {
        isRefreshing: this.isRefreshing,
        expiresInMs: 0,
        needsRefresh: true,
        lastRefreshAt: null,
        sessionStartTime: null,
      };
    }
  }

  // ============================================================================
  // TOKEN UTILITIES
  // ============================================================================

  /**
   * Get token expiration time
   */
  async getTokenExpirationTime(): Promise<Date | null> {
    try {
      const tokens = await this.getTokens();
      if (!tokens?.expiresAt) return null;

      return new Date(tokens.expiresAt);
    } catch (error) {
      logger.error("TokenManager: Failed to get expiration time", error, "auth");
      return null;
    }
  }

  /**
   * Get time until token expiration
   */
  async getTimeUntilExpiration(): Promise<number> {
    try {
      const expirationTime = await this.getTokenExpirationTime();
      if (!expirationTime) return 0;

      return Math.max(0, expirationTime.getTime() - Date.now());
    } catch (error) {
      logger.error("TokenManager: Failed to calculate time until expiration", error, "auth");
      return 0;
    }
  }

  /**
   * Force refresh tokens (bypass timing checks)
   */
  async forceRefresh(): Promise<TokenData | null> {
    logger.info("TokenManager: Force refresh requested", undefined, "auth");
    return await this.refreshTokens();
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Register a Redux dispatch function so TokenManager can keep Redux auth state
   * in sync when it clears tokens or performs critical session operations.
   * Passing `undefined` will unregister the dispatch.
   */
  registerDispatch(dispatch?: (action: any) => void): void {
    if (dispatch) {
      this.reduxDispatch = dispatch;
      logger.debug("TokenManager: Registered redux dispatch for auth sync");
    } else {
      this.reduxDispatch = undefined;
      logger.debug("TokenManager: Unregistered redux dispatch for auth sync");
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    this.isRefreshing = false;
    this.refreshPromise = undefined;
    this.reduxDispatch = undefined;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const tokenManager = TokenManager.getInstance();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Store tokens securely
 */
export const storeTokens = (tokens: TokenData): Promise<void> => {
  return tokenManager.storeTokens(tokens);
};

/**
 * Get stored tokens
 */
export const getTokens = (): Promise<TokenData | null> => {
  return tokenManager.getTokens();
};

/**
 * Clear stored tokens
 */
export const clearTokens = (): Promise<void> => {
  return tokenManager.clearTokens();
};

/**
 * Check if tokens are expired
 */
export const areTokensExpired = (): Promise<boolean> => {
  return tokenManager.areTokensExpired();
};

/**
 * Refresh tokens
 */
export const refreshTokens = (): Promise<TokenData | null> => {
  return tokenManager.refreshTokens();
};

/**
 * Validate tokens
 */
export const validateTokens = (): Promise<TokenValidationResult> => {
  return tokenManager.validateTokens();
};

export const getSessionHealth = (): Promise<{
  isRefreshing: boolean;
  expiresInMs: number;
  needsRefresh: boolean;
  lastRefreshAt?: number | null;
  sessionStartTime?: number | null;
}> => {
  return tokenManager.getSessionHealth();
};

/**
 * Register a Redux dispatch function so TokenManager can keep Redux auth state
 * in sync when it clears tokens or performs critical session operations.
 *
 * Usage:
 *   import { registerAuthDispatch } from '@/utils/tokenManager';
 *   registerAuthDispatch(store.dispatch);
 */
export const registerAuthDispatch = (dispatch: (action: any) => void): void => {
  tokenManager.registerDispatch(dispatch);
};

export default tokenManager;
