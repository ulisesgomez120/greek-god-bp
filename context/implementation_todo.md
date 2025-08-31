# Session Persistence Implementation TODO

This file contains the actionable checklist for extending session persistence to reliably use Supabase's refresh-token window (30 days) by hardening client refresh logic, adding lifecycle-triggered refreshes, improving error handling to avoid premature token clearing, and ensuring secure storage and Redux auth state stay synchronized.

Overview

- TokenManager will be the canonical scheduler and source-of-truth for persisted tokens.
- Middleware and auth slice will delegate scheduling/refresh ops to TokenManager.
- App bootstrap and hooks will register TokenManager.dispatch and lifecycle handlers.
- Tests will cover TokenManager behavior (refresh success, temporary failures, permanent failures, scheduling, metrics).

Primary checklist (verbatim as requested)

- [x] Step 1: Update configuration constants for extended session persistence (add SESSION_PERSISTENCE_CONFIG)
- [x] Step 2: Implement sessionPersistence helpers (src/utils/sessionPersistence.ts)
- [x] Step 3: Harden TokenManager with config, error classification, and lifecycle handlers (in progress — PAUSED)
- [x] Step 4: Wire TokenManager.registerDispatch in app bootstrap (src/App.tsx)
- [ ] Step 5: Add AppState / visibility hooks in useAuth to trigger refresh on foreground
- [ ] Step 6: Update middleware and auth slice to coordinate with TokenManager (remove duplicate timers)
- [ ] Step 7: Add diagnostics selector/getSessionHealth and expose in debug tooling
- [ ] Step 8: Add unit and integration tests and run manual QA checklist
- [ ] Step 9: Final review and merge

Status: PAUSED

- Work is paused while TokenManager finalization, middleware/slice integration, and tests are prepared.
- Current checkpoint: TokenManager has been wired to use SESSION_PERSISTENCE_CONFIG, sessionPersistence metrics recorded, lifecycle handlers added, and middleware updated to delegate scheduling to TokenManager. Remaining tasks require tests and a short review before continuing.

Resume instructions:

- Unpause by updating this file (remove PAUSED) or confirm "resume" in chat.
- Recommended next steps when resuming:
  1. Finish TokenManager getSessionHealth/details and ensure all exports are type-correct.
  2. Add AppState/visibility hooks in src/hooks/useAuth.ts to call tokenManager.handleAppStateChange('active').
  3. Update auth slice to delegate refresh behavior and avoid duplicate clearing on temporary failures.
  4. Add unit/integration tests listed below and run typecheck + tests.
  5. Run manual QA checklist and prepare PR.

Detailed implementation checklist (expanded)

- [ ] Analyze requirements and verify implementation_plan.md for exact function/class signatures and types.
- [x] Add SESSION_PERSISTENCE_CONFIG to `src/config/constants.ts`:
  - bufferTimeMs (default: 60 _ 60 _ 1000 = 1 hour)
  - periodicRefreshIntervalMs (optional; e.g., 12 hours)
  - maxRetryAttempts and backoff policy
  - enableRefreshOnForeground (boolean)
  - metricsEnabled (boolean)
- [x] Create `src/utils/sessionPersistence.ts` with:
  - shouldAttemptRefreshOnFocus(lastRefreshTimestamp, sessionStartTime, config)
  - recordSessionMetrics(event: 'refresh'|'refresh_failed'|'refresh_success'|'session_cleared', details)
  - getSessionMetrics()
  - Types and simple in-memory or StorageAdapter.secure backed metrics storage (mockable in tests)
- [ ] Harden `src/utils/tokenManager.ts`:
  - [x] Read SESSION_PERSISTENCE_CONFIG (wired into TokenManager)
  - [x] Expose registerDispatch(dispatch), initialize(), shutdown() (registerDispatch exists; initialize triggered in constructor)
  - [x] Keep a single timer for scheduled refresh; ensure idempotent scheduling (scheduleTokenRefresh adjusted)
  - [x] Implement performTokenRefresh(): uses supabase.auth.setSession / refresh flow (refresh logic implemented with retries)
  - [x] Classify errors:
    - temporary (network errors, 5xx, rate limit) -> schedule exponential backoff retry, do NOT clear tokens (implemented)
    - permanent (invalid_grant, refresh token revoked/expired per supabase error) -> clearTokens and dispatch logout (implemented)
  - [x] Avoid unconditional clearTokens() on temporary errors (implemented)
  - [x] Implement handleAppStateChange(state: 'active'|'background'|'inactive') to trigger refresh-on-foreground when needed (implemented)
  - [x] Implement schedulePeriodicRefresh() for long-running foreground sessions (configurable)
  - [x] record metrics and sessionStartTime reset logic on rehydrate/storeTokens (recordSessionMetrics used on rehydrate and failures)
  - [x] Ensure storeTokens awaits supabase.auth.setSession where appropriate and persists tokens using StorageAdapter.secure
  - [ ] Expose getSessionHealth() / selectSessionHealth() for diagnostics (TODO)
  - [x] Ensure concurrency guards to avoid parallel refresh attempts (mutex or in-flight flag) (isRefreshing + refreshPromise)

* - Notes: TokenManager was updated to integrate sessionPersistence metrics, use SESSION_PERSISTENCE_CONFIG values, and avoid clearing tokens on temporary errors. Remaining tasks: finalize getSessionHealth, add middleware/slice delegation, add unit/integration tests, and add diagnostics selector.

- [ ] Update `src/services/auth.service.ts`:
  - Consolidate calls to TokenManager.storeTokens / TokenManager.notifySessionRestored
  - Remove duplicate direct calls to storage where appropriate
- [ ] Update Redux:
  - `src/store/auth/authSlice.ts`
    - Make token storage/clearing delegate to TokenManager where possible
    - Update refreshTokens thunk to call TokenManager.performTokenRefresh() and interpret returned result without clearing on temporary errors
  - `src/middleware/authMiddleware.ts`
    - Remove its own standalone timers; call TokenManager.scheduleIfNeeded() or rely on TokenManager events
    - Use TokenManager for periodic checks and only read session state (do not mutate persisted tokens)
- [ ] App bootstrap (`src/App.tsx`):
  - Early on initialize TokenManager.initialize()
  - Call TokenManager.registerDispatch(store.dispatch)
  - Ensure TokenManager rehydrates tokens before main navigation renders if feasible (show splash until rehydration completes)
- [ ] Hooks (`src/hooks/useAuth.ts`):
  - Add AppState / visibilitychange listeners to call TokenManager.handleAppStateChange('active') on foreground
  - Debounce / throttle calls to avoid spammy refresh attempts
- [ ] Diagnostics and selectors:
  - Add selector `selectSessionHealth` in auth slice or expose `tokenManager.getSessionHealth()`
  - Optional debug screen to surface metrics from `sessionPersistence.getSessionMetrics()`
- [ ] Tests:
  - Unit tests for TokenManager:
    - scheduling logic, buffer time calculations
    - temporary failure classification (simulate network errors) -> tokens remain persisted and retries scheduled
    - permanent failure classification -> tokens cleared and logout dispatched
    - concurrency: multiple simultaneous refresh triggers -> only one network call executed
  - Integration tests:
    - authIntegration.spec.ts: mock supabase client and StorageAdapter to simulate complete flows
    - lifecycle: simulate AppState changes triggering refresh-on-foreground
  - Add test files:
    - `src/__tests__/tokenManager.spec.ts`
    - `src/__tests__/authIntegration.spec.ts`
- [ ] Manual QA checklist:
  - [ ] Fresh login sets tokens and schedules next refresh correctly
  - [ ] On returning to foreground after > bufferTime, perform refresh automatically
  - [ ] Network outage during refresh does NOT log user out; retry scheduled
  - [ ] Permanent refresh failure (revoked refresh token) logs user out and clears persisted tokens
  - [ ] Redux auth state stays in sync with TokenManager and storage after refresh/re-hydration
  - [ ] Metrics recorded and retrievable via diagnostic selector
- [ ] Documentation:
  - Update README or developer docs describing how TokenManager works and how to test it locally
- [ ] Final review and merge:
  - Create PR with description referencing implementation_plan.md
  - Ensure tests pass in CI

Notes

- Keep changes TypeScript-typed and mock StorageAdapter in tests.
- TokenManager remains the single canonical scheduler for refresh timers.
- Do not change Supabase server settings; rely on default 30-day refresh token window.
- Preserve secure storage (StorageAdapter.secure) for persisted tokens.
