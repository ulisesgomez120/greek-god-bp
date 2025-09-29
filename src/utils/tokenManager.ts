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
import type { TokenData, TokenValidationResult, TokenRefreshResult, QueuedRefreshAttempt } from "@/types/auth";
import { shouldAttemptRefreshOnFocus, recordSessionMetrics, getSessionMetrics } from "@/utils/sessionPersistence";
import { readSecureItemWithRetry } from "@/lib/storageHelpers";
import { enqueueRefresh, dequeueAndProcess } from "@/utils/refreshQueue";

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
      // Use read-with-retry for secure reads to mitigate transient SecureStore failures
      const [accessToken, refreshToken, expiresAt] = await Promise.all([
        readSecureItemWithRetry(STORAGE_KEYS.secure.accessToken),
        readSecureItemWithRetry(STORAGE_KEYS.secure.refreshToken),
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
          try {
            // Dispatch a plain action to avoid importing auth slice (breaks require cycles).
            this.reduxDispatch({ type: "auth/forceLogout" });
            logger.debug("TokenManager: Dispatched forceLogout via registered reduxDispatch");
          } catch (dispatchErr) {
            logger.warn("TokenManager: Failed to dispatch forceLogout via registered reduxDispatch", dispatchErr);
          }
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
    // Wrap performTokenRefresh which returns a TokenRefreshResult and map to TokenData|null
    this.refreshPromise = (async () => {
      const result = await this.performTokenRefresh();
      if (!result) return null;

      if (result.success && result.newTokens) {
        return result.newTokens;
      }

      // Permanent failure -> clear tokens and record metric
      if (result.permanentFailure) {
        try {
          await recordSessionMetrics("refresh_failed_permanent", {
            message: result.message ?? result.errorCode,
          });
        } catch {}
        await this.clearTokens();
        return null;
      }

      // Temporary failure -> enqueue a queued refresh attempt for later processing
      try {
        await recordSessionMetrics("refresh_failed_temporary", { message: result.message ?? result.errorCode });
      } catch {}
      try {
        await enqueueRefresh("startup");
      } catch (err) {
        logger.warn("TokenManager: Failed to enqueue refresh after temporary failure", err, "auth");
      }

      // Schedule a fallback retry with exponential backoff (best-effort)
      try {
        const retryDelay =
          (RETRY_DELAY_BASE ?? 1000) * Math.pow(2, SESSION_PERSISTENCE_CONFIG.maxRetryAttempts ?? MAX_RETRY_ATTEMPTS);
        logger.info(
          `TokenManager: Scheduling fallback retry in ${Math.round(retryDelay / 1000)}s after temporary failure`,
          undefined,
          "auth"
        );

        if (this.refreshTimer) {
          clearTimeout(this.refreshTimer);
        }

        this.refreshTimer = setTimeout(async () => {
          logger.info("TokenManager: Fallback retry triggered after temporary refresh failure", undefined, "auth");
          await this.refreshTokensIfOnline();
        }, retryDelay);
      } catch (err) {
        logger.warn("TokenManager: Failed to schedule fallback retry", err, "auth");
      }

      return null;
    })();

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
  /**
   * Perform the actual token refresh and return a structured result.
   * This function will attempt refresh with retries and return a TokenRefreshResult
   * describing whether the refresh succeeded, failed temporarily, or failed permanently.
   */
  private async performTokenRefresh(): Promise<import("@/types/auth").TokenRefreshResult | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        logger.info(`TokenManager: Refresh attempt ${attempt}/${MAX_RETRY_ATTEMPTS}`, undefined, "auth");

        const currentTokens = await this.getTokens();
        if (!currentTokens?.refreshToken) {
          logger.warn("TokenManager: No refresh token available", undefined, "auth");
          return {
            success: false,
            permanentFailure: true,
            errorCode: "NO_REFRESH_TOKEN",
            message: "No refresh token available",
          };
        }

        // Attempt refresh with Supabase
        const { data, error } = await this.supabaseClient.auth.refreshSession({
          refresh_token: currentTokens.refreshToken,
        });

        if (error) {
          throw new Error(`Supabase refresh failed: ${error.message}`);
        }

        if (!data?.session) {
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
        return {
          success: true,
          newTokens,
        };
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
        return {
          success: false,
          permanentFailure: true,
          errorCode: "INVALID_REFRESH",
          message: (lastError as any)?.message ?? String(lastError),
        };
      } else {
        return {
          success: false,
          permanentFailure: false,
          errorCode: "NETWORK",
          message: (lastError as any)?.message ?? String(lastError),
        };
      }
    } catch (err) {
      logger.warn("TokenManager: Error while classifying refresh outcome", err, "auth");
      return {
        success: false,
        permanentFailure: false,
        errorCode: "UNKNOWN",
        message: (lastError as any)?.message ?? String(lastError),
      };
    }
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

        // Rehydrate or attempt refresh-first strategy:
        try {
          await recordSessionMetrics("refresh_attempt", { trigger: "initial_rehydrate" });
        } catch {}

        const validation = await this.validateTokens();
        if (validation.isValid) {
          // Access token still valid — safe to call setSession
          try {
            await supabase.auth.setSession({
              access_token: tokens.accessToken,
              refresh_token: tokens.refreshToken,
            });
            logger.info("TokenManager: Supabase session rehydrated during initialization", undefined, "auth");
            await recordSessionMetrics("session_rehydrated");
          } catch (rehydErr) {
            logger.warn("TokenManager: Failed to rehydrate Supabase session during initialization", rehydErr, "auth");
            try {
              await recordSessionMetrics("refresh_failed_temporary", {
                context: "rehydration",
                message: (rehydErr as any)?.message ?? String(rehydErr),
              });
            } catch {}
          }
        } else {
          // Token expired or needs refresh — attempt refresh first. If offline, enqueue a refresh attempt.
          try {
            const refreshed = await this.refreshTokensIfOnline();
            if (refreshed) {
              logger.info("TokenManager: Token refresh succeeded during initialization", undefined, "auth");
              try {
                await recordSessionMetrics("session_rehydrated");
              } catch {}
            } else {
              logger.warn(
                "TokenManager: Token refresh unavailable during initialization; enqueuing retry",
                undefined,
                "auth"
              );
              try {
                await enqueueRefresh("startup");
                await recordSessionMetrics("queued_attempt_enqueued", { trigger: "initial_rehydrate" });
              } catch (err) {
                logger.warn("TokenManager: Failed to enqueue refresh attempt during initialization", err, "auth");
              }
            }
          } catch (err) {
            logger.warn("TokenManager: Error during initialization refresh attempt", err, "auth");
          }
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

    if (!expiresAt) {
      logger.warn(
        "TokenManager: scheduleTokenRefresh called with empty expiresAt; skipping scheduling",
        undefined,
        "auth"
      );
      return;
    }

    const expirationTime = new Date(expiresAt).getTime();
    if (!isFinite(expirationTime) || isNaN(expirationTime)) {
      logger.warn("TokenManager: Invalid expiresAt value, cannot schedule refresh", { expiresAt }, "auth");
      return;
    }

    try {
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
    // this check was causing issues with cold starts and would cause unnecessary signouts!
    // const isOnline = await this.isNetworkAvailable();
    // if (!isOnline) {
    //   logger.warn("TokenManager: Network unavailable, skipping refresh", undefined, "auth");
    //   await recordSessionMetrics("refresh_failed_temporary", { reason: "offline" });
    //   return null;
    // }

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

  /**
   * Validate tokens on app startup and attempt refresh if needed.
   *
   * Returns `true` if a valid session has been established (either tokens were valid
   * or a refresh succeeded). Returns `false` when no stored tokens exist or refresh
   * failed. This method is intended to be called during app bootstrap so the app can
   * reliably rehydrate the Supabase client before UI flows depend on authentication.
   */
  async validateAndRefreshOnStartup(): Promise<boolean> {
    try {
      const tokens = await this.getTokens();
      if (!tokens) {
        logger.debug("TokenManager: No stored tokens found during startup validation", undefined, "auth");
        return false;
      }

      const validation = await this.validateTokens();
      if (!validation.isValid || validation.needsRefresh) {
        logger.info("TokenManager: Tokens need refresh on startup, attempting refresh", undefined, "auth");
        try {
          await recordSessionMetrics("refresh_attempt", { trigger: "startup" });
        } catch {}

        // Attempt refresh; if offline or temporary failure, enqueue and *do not* clear tokens.
        try {
          const refreshed = await this.refreshTokensIfOnline();
          if (refreshed) {
            logger.info("TokenManager: Token refresh succeeded on startup", undefined, "auth");
            try {
              await recordSessionMetrics("session_rehydrated");
            } catch {}
            return true;
          } else {
            logger.warn("TokenManager: Token refresh unavailable on startup; enqueuing retry", undefined, "auth");
            try {
              await enqueueRefresh("startup");
              await recordSessionMetrics("queued_attempt_enqueued", { trigger: "startup" });
            } catch (err) {
              logger.warn("TokenManager: Failed to enqueue refresh attempt on startup", err, "auth");
            }
            // Keep existing stored tokens in place and allow app to continue; UI/auth layer
            // should treat session as potentially valid until a permanent failure is detected.
            return true;
          }
        } catch (err) {
          logger.warn("TokenManager: Error during startup refresh attempt", err, "auth");
          // Conservative: do not clear tokens on unexpected errors; enqueue and continue.
          try {
            await enqueueRefresh("startup");
            await recordSessionMetrics("queued_attempt_enqueued", { trigger: "startup", error: (err as any)?.message });
          } catch {}
          return true;
        }
      }

      // Tokens are valid; rehydrate supabase client session using stored tokens.
      try {
        await this.supabaseClient.auth.setSession({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
        });
        logger.info("TokenManager: Supabase session rehydrated on startup", undefined, "auth");
        try {
          await recordSessionMetrics("session_rehydrated");
        } catch {}
        return true;
      } catch (rehydErr) {
        logger.warn("TokenManager: Failed to rehydrate Supabase session on startup", rehydErr, "auth");
        // Don't clear tokens on transient rehydration failures; enqueue refresh and let foreground processing handle it.
        try {
          await enqueueRefresh("startup");
          await recordSessionMetrics("queued_attempt_enqueued", {
            context: "rehydration",
            message: (rehydErr as any)?.message ?? String(rehydErr),
          });
        } catch {}
        return true;
      }
    } catch (err) {
      logger.warn("TokenManager: validateAndRefreshOnStartup failed", err, "auth");
      return false;
    }
  }

  /**
   * Process persisted queued refresh attempts.
   *
   * This method will process a bounded batch of queued attempts (see SESSION_PERSISTENCE_CONFIG.processQueueBatchSize).
   * For each queued attempt it:
   *  - ensures network is available
   *  - attempts a refresh via performTokenRefresh()
   *  - on success rehydrates supabase with the new tokens
   *  - on temporary failure throws to let the queue helper increment attempts
   *  - on permanent failure clears tokens and records a metric
   */
  async processQueuedRefreshs(): Promise<void> {
    try {
      await dequeueAndProcess(async (attempt: QueuedRefreshAttempt) => {
        // Ensure network
        const online = await this.isNetworkAvailable();
        if (!online) {
          const err: any = new Error("offline");
          err.code = "NETWORK";
          throw err;
        }

        const result = await this.performTokenRefresh();
        if (!result) {
          const err: any = new Error("refresh_failed_unknown");
          err.code = "UNKNOWN";
          throw err;
        }

        if (result.success) {
          if (result.newTokens) {
            try {
              await supabase.auth.setSession({
                access_token: result.newTokens.accessToken,
                refresh_token: result.newTokens.refreshToken,
              });
              await recordSessionMetrics("queued_attempt_processed", { id: attempt.id, reason: attempt.reason });
            } catch (err) {
              const e: any = err instanceof Error ? err : new Error(String(err));
              e.code = e.code ?? "SETSESSION_FAILED";
              throw e;
            }
          }
          return;
        }

        if (result.permanentFailure) {
          try {
            await recordSessionMetrics("refresh_failed_permanent", { message: result.message });
          } catch {}
          await this.clearTokens();
          // Do not re-enqueue; treat as terminal.
          return;
        }

        // Temporary failure -> throw so the queue helper increments attempts and persists the error
        const terr: any = new Error(result.message ?? "temporary_refresh_failure");
        terr.code = result.errorCode ?? "NETWORK";
        throw terr;
      });
    } catch (err) {
      logger.warn("TokenManager: processQueuedRefreshs failed", err, "auth");
    }
  }

  /**
   * Force refresh and rehydrate supabase session in one call.
   * Returns the TokenRefreshResult describing the outcome.
   */
  async forceRefreshAndRehydrate(): Promise<TokenRefreshResult> {
    try {
      const result = await this.performTokenRefresh();
      if (!result) {
        return {
          success: false,
          permanentFailure: false,
          errorCode: "UNKNOWN",
          message: "Unknown refresh failure",
        };
      }

      if (result.success && result.newTokens) {
        try {
          await supabase.auth.setSession({
            access_token: result.newTokens.accessToken,
            refresh_token: result.newTokens.refreshToken,
          });
          await recordSessionMetrics("session_rehydrated");
        } catch (err) {
          return {
            success: false,
            permanentFailure: false,
            errorCode: "SETSESSION_FAILED",
            message: (err as any)?.message ?? String(err),
          };
        }
      }

      if (result.permanentFailure) {
        // clear tokens when refresh is permanently invalid
        await this.clearTokens();
      }

      return result;
    } catch (err) {
      logger.warn("TokenManager: forceRefreshAndRehydrate failed", err, "auth");
      return {
        success: false,
        permanentFailure: false,
        errorCode: "UNKNOWN",
        message: (err as any)?.message ?? String(err),
      };
    }
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
