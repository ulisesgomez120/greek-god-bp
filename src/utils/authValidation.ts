// Functional authentication validation utilities
// - Keeps Redux auth state and Supabase client session in sync
// - Uses existing TokenManager class (no new classes)
// - Exposes lightweight, composable helpers for middleware/components to call

import type { Store } from "redux";
import supabase from "@/lib/supabase";
import { tokenManager } from "@/utils/tokenManager";
import { logger } from "@/utils/logger";
import { initializeAuth, forceLogout } from "@/store/auth/authSlice";

/**
 * Validate the application authentication state by comparing:
 *  - tokens stored on device (TokenManager)
 *  - Supabase client session
 *  - Redux auth state
 *
 * If inconsistencies are found and cannot be repaired (expired tokens,
 * failed refresh), the function will dispatch forceLogout() to ensure
 * the app does not stay in a desynchronized, "authenticated" state.
 *
 * Returns true when a valid session is available (and Redux should be consistent),
 * false when no valid session exists (and Redux was logged out).
 */
export async function validateAuthState(store: Store<any>): Promise<boolean> {
  try {
    const state = (store.getState && store.getState()) || {};
    const authState = state.auth || {};

    // 1) Read stored tokens
    const tokens = await tokenManager.getTokens();

    if (!tokens) {
      logger.info("authValidation: No stored tokens found");

      // If Redux still thinks we're authenticated, force logout to sync state
      if (authState.isAuthenticated) {
        logger.warn("authValidation: Redux shows authenticated but no tokens exist - forcing logout");
        store.dispatch(forceLogout());
      }

      return false;
    }

    // 2) Ensure Supabase client has a rehydrated session matching stored tokens.
    //    If the client has no session or mismatched session, attempt to setSession
    try {
      // Rehydrate the client session unconditionally to keep client state consistent.
      // If tokens are invalid, setSession will return an error which we handle below.
      await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      logger.debug("authValidation: Supabase client rehydrated from stored tokens");
    } catch (rehydErr) {
      logger.warn("authValidation: Failed to rehydrate Supabase client from stored tokens", rehydErr);
      // proceed to validation/refresh below
    }

    // 3) Verify token validity via TokenManager
    const validation = await tokenManager.validateTokens();

    if (!validation.isValid) {
      logger.info("authValidation: Tokens are invalid or expired", {
        isExpired: validation.isExpired,
        needsRefresh: validation.needsRefresh,
      });

      // Try refreshing tokens if network available; TokenManager handles retries/backoff
      const refreshed = await tokenManager.refreshTokensIfOnline();

      if (!refreshed) {
        logger.warn("authValidation: Token refresh failed or skipped - forcing logout");
        store.dispatch(forceLogout());
        return false;
      }

      // If refresh succeeded, re-dispatch initializeAuth to let the auth slice rehydrate state
      logger.info("authValidation: Token refresh succeeded, dispatching initializeAuth to sync Redux state");
      await store.dispatch(initializeAuth() as any);
      return true;
    }

    // 4) Check Supabase server-side user validity (getUser)
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser(tokens.accessToken);

      if (userError || !userData?.user) {
        logger.warn("authValidation: supabase.auth.getUser failed or returned no user", {
          error: userError,
        });

        // Attempt a refresh as a last resort
        const refreshed = await tokenManager.refreshTokensIfOnline();

        if (!refreshed) {
          logger.warn("authValidation: Refresh after getUser failure failed - forcing logout");
          store.dispatch(forceLogout());
          return false;
        }

        // Refresh succeeded - initialize auth so Redux is correct
        logger.info("authValidation: Refresh succeeded after getUser failure, dispatching initializeAuth");
        await store.dispatch(initializeAuth() as any);
        return true;
      }

      // If we reach here, tokens are valid and user exists server-side.
      // If Redux is not marked authenticated, dispatch initializeAuth to populate it.
      if (!authState.isAuthenticated || !authState.session) {
        logger.info("authValidation: Redux is not authenticated but valid session exists - initializing auth");
        await store.dispatch(initializeAuth() as any);
      }

      logger.debug("authValidation: Authentication state validated successfully");
      return true;
    } catch (err) {
      logger.error("authValidation: Unexpected error while validating server-side user", err);
      // Be conservative: try refreshing once, otherwise force logout
      const refreshed = await tokenManager.refreshTokensIfOnline();
      if (!refreshed) {
        store.dispatch(forceLogout());
        return false;
      }
      await store.dispatch(initializeAuth() as any);
      return true;
    }
  } catch (error) {
    logger.error("authValidation: Unexpected validation error", error);
    // Best effort: force logout to avoid leaving app in a broken authenticated state
    try {
      store.dispatch(forceLogout());
    } catch (dispatchErr) {
      logger.error("authValidation: Failed to dispatch forceLogout", dispatchErr);
    }
    return false;
  }
}

/**
 * Lightweight convenience wrapper to ensure Redux + Supabase session sync.
 * Use this during app initialization (Splash) or before protected navigation.
 *
 * Example usage:
 *   await syncAuthState(store);
 */
export async function syncAuthState(store: Store<any>): Promise<void> {
  const ok = await validateAuthState(store);
  if (!ok) {
    logger.info("authValidation: syncAuthState resulted in no valid session; user will be logged out");
    return;
  }
  logger.info("authValidation: syncAuthState completed; session is valid");
}

/**
 * Quick check that returns whether a valid session appears available locally
 * without performing any network requests. This can be used to gate expensive
 * operations during render.
 */
export async function hasLocalValidSession(): Promise<boolean> {
  try {
    const validation = await tokenManager.validateTokens();
    return validation.isValid && !validation.isExpired;
  } catch (err) {
    logger.warn("authValidation: hasLocalValidSession check failed", err);
    return false;
  }
}

export default {
  validateAuthState,
  syncAuthState,
  hasLocalValidSession,
};
