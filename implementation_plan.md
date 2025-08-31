# Implementation Plan

[Overview]
Extend session persistence to reliably use Supabase's 30-day refresh token window by centralizing and hardening token refresh logic, adding lifecycle-triggered refreshes, improving error handling to avoid premature token clearing, and ensuring secure storage and Redux auth state remain fully synchronized.

This change is necessary because users are being forced to re-authenticate more frequently than expected even though Supabase issues long-lived refresh tokens by default. The scope covers client-side improvements only (no Supabase project configuration changes). The approach is to make TokenManager the single source of truth for token lifecycle, remove conflicting refresh scheduling, add robust retry and network-aware behavior, refresh on app foreground, and tighten coordination with Redux auth slice and auth middleware so stored tokens, Supabase session, and Redux state are always consistent.

[Types]
Single sentence describing the type system changes: Add configuration and diagnostics types to model refresh behavior and session health, and formally type any new helper payloads used by TokenManager and auth thunks.

Detailed type definitions, interfaces, enums, or data structures with complete specifications. Include field names, types, validation rules, and relationships.

- src/types/auth.ts additions (TypeScript)

```ts
// TokenData: canonical representation of stored tokens (used across TokenManager and auth slice)
export interface TokenData {
  accessToken: string; // non-empty, JWT string
  refreshToken: string; // non-empty, opaque refresh token string
  expiresAt: string; // ISO timestamp of access token expiry (UTC). Required.
}

// TokenRefreshConfig: runtime configuration for refresh behavior
export interface TokenRefreshConfig {
  bufferTimeMs: number; // milliseconds before expiresAt to attempt refresh (>= 0)
  maxRetryAttempts: number; // >= 1
  retryDelayBaseMs: number; // base delay for exponential backoff (ms)
  networkTimeoutMs: number; // timeout for network checks (ms)
  enableAppFocusRefresh: boolean; // enable refresh on foreground
  enablePeriodicRefresh: boolean; // enable periodic refresh safeguard
  periodicRefreshIntervalMs?: number; // if enabled, interval frequency in ms
}

// TokenRefreshResult: result object returned by refresh operations
export interface TokenRefreshResult {
  success: boolean;
  tokens?: TokenData;
  error?: {
    code?: string;
    message: string;
    temporary?: boolean; // recommended: true for network/timeouts, false for invalid token
  };
}

// SessionPersistenceMetrics: diagnostic counters for health checks
export interface SessionPersistenceMetrics {
  lastRefreshAttempt?: string; // ISO timestamp
  lastRefreshSuccess?: string; // ISO timestamp
  consecutiveFailures: number; // increments on failure, reset to 0 on success
  totalRefreshes: number; // cumulative
  sessionStartTime?: string; // ISO timestamp when session first set
}
```

Validation rules:

- `bufferTimeMs` should be <= refresh window and preferably >= 0; recommended default: 60 _ 60 _ 1000 (1 hour).
- `maxRetryAttempts` >= 1 and <= 10; recommended default: 3.
- `retryDelayBaseMs` >= 250ms; recommended default: 1000ms.
- `networkTimeoutMs` >= 2000ms; recommended default: 5000ms.

[Files]
Single sentence describing file modifications: Create a session persistence helper file; update TokenManager, constants, auth service, hooks, middleware, and auth slice to centralize refresh scheduling, add lifecycle triggers, improve error semantics, and keep storage + Redux sync.

Detailed breakdown:

- New files to be created:
  - `src/utils/sessionPersistence.ts` — Purpose: lightweight helpers for app-lifecycle hooks, small diagnostics, and exported function(s) used by TokenManager and useAuth; contains helpers: `shouldAttemptRefreshOnFocus()`, `recordSessionMetrics()`, and `getSessionMetrics()`.
  - `src/__tests__/tokenManager.spec.ts` — Unit tests for TokenManager refresh behaviors (mock StorageAdapter, supabase).
  - `src/__tests__/authIntegration.spec.ts` — Integration-style tests validating Redux + TokenManager interactions (mock timers/network).
- Existing files to be modified (explicit changes):
  - `src/utils/tokenManager.ts`
    - Make TokenManager the canonical scheduler (remove/avoid duplicate scheduling in middleware).
    - Add new configurable `TokenRefreshConfig` (injectable or constants-driven).
    - Add methods: `handleAppStateChange`, `getSessionHealth`, `shouldClearTokensOnError`, `recordRefreshMetrics`.
    - Change `REFRESH_BUFFER_TIME` to use configuration (recommended default 1 hour).
    - Make `performTokenRefresh()` classify errors as temporary vs permanent and avoid unconditional `clearTokens()` on temporary failures.
    - Ensure `storeTokens()` always rehydrates supabase via `supabase.auth.setSession(...)`.
    - Ensure `registerDispatch()` is used by app bootstrap to register Redux dispatch and keep store in sync.
  - `src/config/constants.ts`
    - Add a `SESSION_PERSISTENCE_CONFIG` export with defaults for the above `TokenRefreshConfig`.
  - `src/services/auth.service.ts`
    - Ensure `handleSuccessfulAuth()` calls `storeTokens()` (already does) and additionally call TokenManager APIs (if needed) to reset metrics/sessionStartTime.
    - Possibly avoid calling `supabase.auth.setSession` directly anywhere else — centralize to TokenManager.
  - `src/hooks/useAuth.ts`
    - Add app lifecycle listeners (AppState or equivalent) to call TokenManager.handleAppStateChange() on foreground.
    - Expose `forceRefresh()` hook method that calls TokenManager.forceRefresh() and returns status.
  - `src/App.tsx`
    - Register TokenManager.registerDispatch(store.dispatch) during bootstrap (exact insertion point: after store is created and before rendering).
    - Optionally register app-level lifecycle listeners in root if not present in useAuth.
  - `src/middleware/authMiddleware.ts`
    - Remove/disable token refresh scheduling responsibilities (scheduleTokenRefresh) or make them call TokenManager.scheduleTokenRefresh() so there is no duplicate timer.
    - Update validateSession() to use TokenManager.refreshTokensIfOnline() or dispatch refreshTokens while preventing double-refresh races.
  - `src/store/auth/authSlice.ts`
    - Modify refreshTokens thunk behavior to rely on TokenManager.performTokenRefresh() where possible, or ensure it merges metadata instead of unconditionally clearing tokens on failures.
    - Add selectors for session health metrics (getSessionHealth).
- Files to be deleted or moved:
  - None
- Configuration file updates:
  - `src/config/constants.ts` add `SESSION_PERSISTENCE_CONFIG` block; no changes to environment variables.

[Functions]
Single sentence describing function modifications: Add lifecycle and diagnostics helper functions and make refresh functions resilient with classified errors and centralized scheduling.

Detailed breakdown:

- New functions:
  - `shouldAttemptRefreshOnFocus(): boolean`
    - File: `src/utils/sessionPersistence.ts`
    - Purpose: Decide if a refresh should be attempted when app moves to foreground (e.g., if token will expire within configured window or last refresh was long ago).
    - Signature: `export function shouldAttemptRefreshOnFocus(tokens: TokenData | null, metrics?: SessionPersistenceMetrics, config?: TokenRefreshConfig): boolean`
  - `recordSessionMetrics(action: 'refreshAttempt' | 'refreshSuccess' | 'refreshFailure'): void`
    - File: `src/utils/sessionPersistence.ts`
    - Purpose: Update stats used for debugging and telemetry.
  - `getSessionHealth(): SessionPersistenceMetrics`
    - File: `src/utils/tokenManager.ts`
    - Purpose: Return current session persistence metrics for diagnostics and selectors.
  - `shouldClearTokensOnError(error: Error | object): { clear: boolean; temporary: boolean }`
    - File: `src/utils/tokenManager.ts`
    - Purpose: Classify refresh errors so temporary network failures don't trigger clearing tokens immediately.
  - `schedulePeriodicRefresh(): void`
    - File: `src/utils/tokenManager.ts`
    - Purpose: A fallback periodic refresh to attempt refresh while app is active, configurable.
- Modified functions:
  - `TokenManager.performTokenRefresh(): Promise<TokenData | null>`
    - File: `src/utils/tokenManager.ts`
    - Changes:
      - Classify errors as temporary/permanent; retry only on temporary.
      - On permanent failures (invalid refresh token, revoked), clear tokens and dispatch `forceLogout()`.
      - On temporary failures (network), schedule a retry using exponential backoff but do not clear tokens immediately; persist failure counters.
  - `TokenManager.scheduleTokenRefresh(expiresAt: string): void`
    - File: `src/utils/tokenManager.ts`
    - Changes:
      - Use configured `bufferTimeMs` (default 1 hour).
      - Cancel any middleware timers if present (coordinate with authMiddleware).
  - `storeTokens(tokens: TokenData): Promise<void>`
    - File: `src/utils/tokenManager.ts`
    - Changes:
      - Ensure supabase.session rehydration call is awaited and errors are logged (no silent failures).
      - Reset session metrics (sessionStartTime if new session).
  - `refreshTokensIfOnline(): Promise<TokenData | null>`
    - File: `src/utils/tokenManager.ts`
    - Changes:
      - Use `isNetworkAvailable()` with configurable timeout.
      - Return `null` on network unavailability without clearing tokens.
  - `initializeAuth()` (auth.service)
    - File: `src/services/auth.service.ts`
    - Changes:
      - Do not call `clearTokens()` on intermittent errors — only on classified permanent failures.
      - After rehydration, call TokenManager.recordRefreshMetrics('refreshSuccess').

[Classes]
Single sentence describing class modifications: The TokenManager class will be extended with lifecycle handlers, metrics, and intelligent error classification while remaining the single place that schedules refreshes.

Detailed breakdown:

- Modified classes:
  - `TokenManager` (file: `src/utils/tokenManager.ts`)
    - New private fields:
      - `config: TokenRefreshConfig` — read from `src/config/constants.ts` or injected during init
      - `metrics: SessionPersistenceMetrics`
      - `periodicRefreshTimer?: ReturnType<typeof setInterval>`
      - `appFocusListenerRegistered: boolean`
    - New public methods:
      - `handleAppStateChange(state: 'active' | 'background' | 'inactive'): Promise<void>`
        - Called from useAuth/App to trigger refresh on foreground.
      - `getSessionHealth(): SessionPersistenceMetrics`
        - Return current metrics.
      - `forceRefresh(): Promise<TokenData | null>` (already exists but ensure exported and wired)
      - `registerDispatch(dispatch?: (action: any) => void): void` (already exists) — ensure used during app bootstrap.
    - Modified behavior:
      - Existing `refreshTokens()` and `performTokenRefresh()` will implement temporary/permanent error classification, exponential backoff, and will not clear tokens on temporary failures.
      - TokenManager will be the canonical scheduler — authMiddleware's scheduling will defer to TokenManager to avoid dual timers.
- Removed classes:
  - None

[Dependencies]
Single sentence describing dependency modifications: No new npm/third-party dependencies required — use existing platform APIs and Supabase client.

Details:

- No additional packages required. Use built-in `AppState` from React Native (or `visibilitychange` on web) and existing `fetch`/AbortController for network checks.
- If project wants more sophisticated retry/backoff, we can add a small utility (e.g., p-retry) later, but it's not necessary.

[Testing]
Single sentence describing testing approach: Unit tests for TokenManager and sessionPersistence helpers, integration tests for Redux + TokenManager coordination, and manual QA steps to validate real-world behavior across network transitions and app lifecycle.

Test file requirements, existing test modifications, and validation strategies:

- Unit tests (mocking StorageAdapter, supabase auth):
  - `src/__tests__/tokenManager.spec.ts`
    - Test cases:
      - Successful refresh path stores tokens and schedules next refresh correctly.
      - Temporary network failure: does not clear tokens, increments failure counter, retries with backoff.
      - Permanent failure (invalid refresh token): clears tokens and dispatches `forceLogout`.
      - scheduleTokenRefresh uses bufferTimeMs correctly (1 hour default).
  - `src/__tests__/sessionPersistence.spec.ts`
    - Test cases:
      - shouldAttemptRefreshOnFocus returns true/false correctly for various expiry windows and metrics.
- Integration tests (mock Redux store & timers):
  - `src/__tests__/authIntegration.spec.ts`
    - Test cases:
      - App bootstrap: TokenManager.registerDispatch called and tokens rehydrated; Redux initializeAuth resolves to authenticated state when tokens valid.
      - App background -> foreground: TokenManager triggers refresh when needed.
      - Auth middleware no longer schedules duplicate timers; TokenManager is canonical.
- Manual QA checklist:
  - Login and keep app idle for >24 hours, then open app — confirm user still authenticated and token refreshed.
  - Simulate network offline during scheduled refresh; confirm tokens are retained and refresh retried on next online event or app focus.
  - Revoke refresh token from Supabase (admin) and verify client logs out and clears tokens.
  - Verify Redux state remains consistent with secure storage after login, refresh, app restart.

[Implementation Order]
Single sentence describing the implementation sequence: Implement incremental, low-risk changes starting with configuration and TokenManager core improvements, then add lifecycle hooks, update middleware/auth slice to coordinate, and finish with tests and manual validation.

Numbered steps:

1. Update configuration constants
   - Add `SESSION_PERSISTENCE_CONFIG` to `src/config/constants.ts` with defaults:
     - bufferTimeMs = 60 _ 60 _ 1000 (1 hour)
     - maxRetryAttempts = 3
     - retryDelayBaseMs = 1000
     - networkTimeoutMs = 5000
     - enableAppFocusRefresh = true
     - enablePeriodicRefresh = false (disabled by default)
2. Implement sessionPersistence helpers
   - Create `src/utils/sessionPersistence.ts` with `shouldAttemptRefreshOnFocus`, `recordSessionMetrics`, and `getSessionMetrics` stubs.
3. Harden TokenManager
   - Update `src/utils/tokenManager.ts`:
     - Wire in the new config (read from constants).
     - Replace `REFRESH_BUFFER_TIME` usage with `config.bufferTimeMs`.
     - Implement error classification and metrics recording in `performTokenRefresh`.
     - Add `handleAppStateChange`, `getSessionHealth`, `schedulePeriodicRefresh` and ensure `storeTokens` rehydrates supabase reliably.
     - Export `forceRefresh()` and ensure `registerDispatch()` is used early during app bootstrap.
4. Update app bootstrap
   - In `src/App.tsx` or wherever the store is created and provider mounted, call `tokenManager.registerDispatch(store.dispatch)` and initialize TokenManager (ensuring initializeAutoRefresh is awaited if necessary).
5. Add lifecycle hooks
   - Modify `src/hooks/useAuth.ts` to add AppState listeners that call `tokenManager.handleAppStateChange('active')` on foreground.
   - For web, add `visibilitychange` listener.
6. Reduce duplication in middleware and auth slice
   - Update `src/middleware/authMiddleware.ts` to stop scheduling refresh timers directly; call into TokenManager for schedule/clear operations instead of maintaining its own `tokenRefreshTimeout`.
   - Update `src/store/auth/authSlice.ts` refreshTokens thunk to avoid unconditional `clearTokens()` on temporary errors — instead rely on TokenManager classification.
7. Wire diagnostics and selectors
   - Add selector `selectSessionHealth` to `src/store/auth/authSlice.ts` or a small util that reads `tokenManager.getSessionHealth()` and make it accessible for debug screens.
8. Tests and validation
   - Add unit and integration tests described above.
   - Run manual QA checklist.
9. Deployment notes
   - No Supabase configuration changes required. Inform ops/QA that refresh behavior changed and to test token revocation scenarios.
