# Implementation Plan

[Overview]
Fix and harden PWA (web) notifications for the CompactRestTimer by integrating expo-notifications for web scheduling (with native fallbacks), registering and extending the service worker to present notifications while the PWA is backgrounded/locked, and adding an upfront permission flow and cancellation support so the PWA behaves as close as possible to native timers.

This change addresses a failing PWA notification path discovered in `src/components/workout/CompactRestTimer.tsx` where the app attempted direct use of the Web Notification API and relied on ad-hoc setTimeout scheduling. The new approach centralizes notification logic in a single service (`src/services/notification.service.ts`) that uses `expo-notifications` on platforms that support it and falls back to a service-worker-aware or in-page timeout scheduling on web. The plan also adds notification click/close/push handlers to the service worker (`public/service-worker.js`), requests permission up-front during app initialization (`App.tsx`), and wires scheduling/cancellation calls into the CompactRestTimer component. This ensures scheduled notifications can surface when the PWA is backgrounded or the phone is locked (best-effort within web platform constraints), and provides a maintainable, testable API for other features.

[Types]  
Define a small set of types to standardize scheduling and permission flows.

Detailed type definitions:

- NotificationScheduleResult
  - Type (TS): `export interface NotificationScheduleResult { id?: string; error?: any }`
  - Description: Returned from schedule functions; `id` is the scheduled identifier (expo ID or encoded web-timeout id). `error` is populated on failure.
- NotificationServiceConfig
  - Type (TS): `interface NotificationServiceConfig { requestPermissionOnInit?: boolean }`
  - Description: Options for initializing the notification service.
- PermissionStatus (platform-specific)
  - Type (TS): `type PermissionStatus = 'granted' | 'denied' | 'default'`
  - Validation: `PermissionStatus === 'granted'` is the only success state on web. On native, use expo permission objects.
- ScheduledNotification (documentation-level spec)
  - Fields:
    - id: string (required for cancel)
    - scheduledTime: number (epoch ms)
    - title: string
    - body?: string
    - platformHint?: 'expo' | 'web-timeout' | 'push'
    - cancelFn?: () => void (optional in-memory cancel handle)
  - Use: Documentation for devs; scheduling implementation returns `NotificationScheduleResult` instead.

[Files]  
Describe files to create, modify, or remove and explicit changes.

- New files to create (path + purpose)

  - `src/services/notification.service.ts` — Central notification service that:
    - Registers service worker on web (best-effort)
    - Exposes `initNotificationService(options)`, `requestPermission()`, `scheduleNotificationAfterSeconds(seconds, title, body)`, `cancelScheduledNotification(id)`, `presentImmediateNotification(title, body)`
    - Uses `expo-notifications` on native and web where available; falls back to `ServiceWorkerRegistration.showNotification` or `Notification` constructor and an in-page setTimeout wrapper for web.
  - `src/hooks/useNotificationPermissions.ts` (recommended, not strictly required) — a hook to manage permission state for UI, returns `{ status, askForPermission }` and caches state with localStorage or redux if needed.
  - `src/utils/notificationUtils.ts` (optional) — helper utilities for formatting, tag generation (e.g., `rest-timer-{id}`), and converting times.

- Existing files to modify (file path + exact change)

  - `App.tsx`
    - Import `initNotificationService` from `src/services/notification.service`
    - Add an effect on App mount to call `initNotificationService({ requestPermissionOnInit: true })` so permissions are requested up-front.
  - `public/service-worker.js`
    - Add `notificationclick` handler to focus or open the app URL
    - Add `notificationclose` handler for analytics/cleanup
    - Add `push` handler for incoming Push API messages (VAPID) should it be enabled later
    - Keep the existing cache and fetch logic intact (we only append notification handlers).
  - `src/components/workout/CompactRestTimer.tsx`
    - Replace ad-hoc `scheduleWebNotification` with calls to `scheduleNotificationAfterSeconds(seconds, title, body)` from `src/services/notification.service`
    - Store returned id and call `cancelScheduledNotification(id)` on cancellation/unmount
    - Preserve existing native timer logic for iOS/Android (unchanged), only modify the Platform.OS === 'web' path
  - `public/index.html`
    - (Optional but recommended) Add a small inline registration snippet for the SW for non-module registration contexts, e.g. a small script that attempts `navigator.serviceWorker.register('/service-worker.js')` on load for production builds. The primary registration will also be attempted by the notification service during app init.
  - `app.config.ts`
    - Review expo plugins and ensure `expo-notifications`/web support is configured; no runtime code changes required in most setups, but document any EAS or build-time steps required.

- Files to be deleted or moved

  - None required. Existing ad-hoc `scheduleWebNotification` function will be removed from `CompactRestTimer` (refactored into service).

- Configuration file updates
  - `app.config.ts` — ensure `web.output = "single"` (already set) and that any required `expo-notifications` web config is compatible with the chosen build pipeline.
  - Optional: Add VAPID keys / Push server config if server-side Push support will be added later; this is out-of-scope for the initial fix but documented.

[Functions]  
Describe function-level changes: new, modified, removed.

Single sentence: Centralize scheduling/cancellation/presentation in `src/services/notification.service.ts` and update component code to use the service.

Detailed breakdown:

- New functions (file path, signature, purpose)

  - `initNotificationService(options: { requestPermissionOnInit?: boolean }): Promise<void>` — `src/services/notification.service.ts` — registers SW on web, optionally requests permission.
  - `requestPermission(): Promise<boolean>` — `src/services/notification.service.ts` — request and normalize permission across platforms.
  - `presentImmediateNotification(title: string, body?: string): Promise<void>` — `src/services/notification.service.ts` — present a notification immediately (SW if available, fallback to Notification constructor or expo).
  - `scheduleNotificationAfterSeconds(seconds: number, title: string, body?: string): Promise<NotificationScheduleResult>` — `src/services/notification.service.ts` — schedule via expo-notifications where available, otherwise fallback to SW showNotification or page timeout.
  - `cancelScheduledNotification(id?: string): Promise<void>` — `src/services/notification.service.ts` — cancel scheduled notification for both expo and web-timeout wrapper ids.

- Modified functions (exact name, file, required changes)

  - `handleNativeLaunch()` — `src/components/workout/CompactRestTimer.tsx`
    - Replace web scheduling block to call `scheduleNotificationAfterSeconds(...)` and capture returned `id`. Use `cancelScheduledNotification(id)` in cleanup/unmount.
    - Ensure `webCancelRef` stores a cancel function that invokes `cancelScheduledNotification(id)` (async-safe).
  - App initialization effect — `App.tsx`
    - Add `initNotificationService({ requestPermissionOnInit: true })` on mount.
  - Remove or inline function `scheduleWebNotification` (the ad-hoc implementation) from `CompactRestTimer.tsx` and replace with service usage.

- Removed functions
  - `scheduleWebNotification` (component-local) — removed in favour of centralized service. Migration: move logic into `notification.service.ts` or rely on expo-notifications fallback; callers updated to call service.

[Classes]  
Single sentence: No new classes are required; we add modular service functions and service worker handlers.

Detailed breakdown:

- New classes
  - None
- Modified classes
  - None
- Removed classes
  - None

[Dependencies]  
Single sentence: Use existing `expo-notifications` for native and web (already present); no new packages required for the initial implementation.

Details:

- Existing package: `expo-notifications` (project dependency, see package.json)
  - Version used in this project: `~0.31.4` (validate against `package.json` at implementation time)
  - On native, `expo-notifications` will manage scheduling and presenting notifications.
  - On web, `expo-notifications` exposes web helpers but support may vary by web build and expo version; the service will attempt `Notifications.scheduleNotificationAsync` (expo) first and fall back to SW or Notification constructor + setTimeout.
- Integration requirements:
  - Ensure web production build exposes `/service-worker.js` at root (Expo web `expo export --platform web && node scripts/post-build-web.js` or EAS build process).
  - If push notifications or server-driven push are later desired, VAPID keys and a push server will need to be added — out-of-scope now.

[Testing]  
Single sentence: Add unit and integration tests covering permission flow, scheduling/cancellation, SW handlers, and end-to-end behavior in a production web build.

Test file requirements and validation strategies:

- Unit tests (Jest)
  - `src/services/__tests__/notification.service.test.ts`
    - Test `requestPermission()` behavior by mocking `Notification.requestPermission()` (web) and `expo-notifications` on native.
    - Test scheduling fallback: mock `Notifications.scheduleNotificationAsync` to throw and assert the fallback to in-page timeout is used (mock `setTimeout` timers).
    - Test `cancelScheduledNotification()` clears in-page timeouts and forwards to `Notifications.cancelScheduledNotificationAsync` for expo ids.
  - `src/components/workout/__tests__/CompactRestTimer.test.tsx`
    - Test that when Platform.OS === 'web' the component calls `scheduleNotificationAfterSeconds` and stores cancel handler; simulate unmount and verify cancel called.
- Integration / Manual QA
  - Build and serve production web output (important: service worker only acts in production build for most setups).
    - Commands:
      - `expo export --platform web`
      - `node scripts/post-build-web.js` (project already includes this)
      - Host the output on a simple static server (e.g., `npx serve web-build` or Netlify)
    - Verify:
      - On first load, app requests notification permission (upfront).
      - Start a rest timer; background the PWA and lock the phone; verify a notification appears after the scheduled time.
      - Verify notification click focuses/opens the app and navigates to expected URL.
      - Verify cancellation: start timer then cancel or unmount component; ensure no notification shows.
  - Browser compatibility testing: Chrome on Android, Safari on iOS (Safari's web notifications are limited), tested PWA on Android home screen and Chrome standalone mode.

[Implementation Order]  
Single sentence: Implement the service, SW handlers, permission flow, component integration, then run production builds and validate in a staged environment.

Numbered steps:

1. Create `src/services/notification.service.ts` (centralize scheduling/cancel/present/init). Include sw registration attempt and fallbacks. (Already implemented in codebase.)
2. Extend `public/service-worker.js` to add `notificationclick`, `notificationclose`, and `push` handlers. Ensure handlers call `clients.openWindow` or `client.focus()` with the provided `data.url`. (Already implemented.)
3. Add upfront permission request during app bootstrap by calling `initNotificationService({ requestPermissionOnInit: true })` in `App.tsx` (App-level effect). (Already implemented.)
4. Replace `scheduleWebNotification` ad-hoc logic in `src/components/workout/CompactRestTimer.tsx` with calls to `scheduleNotificationAfterSeconds(...)` and store returned id/unsubscribe behavior. Use `cancelScheduledNotification(id)` on unmount/cancel. (Already implemented.)
5. (Recommended) Add `src/hooks/useNotificationPermissions.ts` to provide a UI-friendly hook for permission state and retries. Update any relevant UI to display permission state if permission is blocked.
6. Write unit tests for the notification service and CompactRestTimer scheduling/cancellation behavior.
7. Produce a production web build and deploy to a static host or Netlify to validate service worker activation and real notification delivery. Use a physical Android device and Chrome PWA install to validate notifications while the phone is locked. Safari/iOS has limitations (no background notifications for standard PWAs) — document behavior differences.
8. If server-side push is desired later, create a push backend using VAPID keys and wire Push subscription handling into the service worker `push` handler.

Notes and edge cases:

- Web platform limitations: PWAs cannot always show notifications when fully closed depending on browser/OS — Android/Chrome PWA installed from Chrome supports notification display while backgrounded or when the device is locked, but Safari/iOS lacks full support for background notifications for PWAs. Document these platform limitations in the repo's README or a developer doc.
- Permission UX: requesting permission up-front improves success rates for timed notifications but can be declined. Provide an in-app explanation and a settings path to re-enable permissions via browser settings if denied.
- Race conditions: ensure notification service registration and permission requests are awaited before scheduling. Protect scheduling calls with try/catch to fall back gracefully.
- Service worker scope: service worker file must be served from the root (i.e., `/service-worker.js`) for scope to cover the whole site. Confirm your web build pipeline emits it at root (the `post-build-web.js` script often handles this).

Implementation artifacts and where to read them:

- Read Overview section:
  sed -n '/[Overview]/,/[Types]/p' implementation_plan.md | head -n 1 | cat

- Read Types section:
  sed -n '/[Types]/,/[Files]/p' implementation_plan.md | head -n 1 | cat

- Read Files section:
  sed -n '/[Files]/,/[Functions]/p' implementation_plan.md | head -n 1 | cat

- Read Functions section:
  sed -n '/[Functions]/,/[Classes]/p' implementation_plan.md | head -n 1 | cat

- Read Classes section:
  sed -n '/[Classes]/,/[Dependencies]/p' implementation_plan.md | head -n 1 | cat

- Read Dependencies section:
  sed -n '/[Dependencies]/,/[Testing]/p' implementation_plan.md | head -n 1 | cat

- Read Testing section:
  sed -n '/[Testing]/,/[Implementation Order]/p' implementation_plan.md | head -n 1 | cat

- Read Implementation Order section:
  sed -n '/[Implementation Order]/,$p' implementation_plan.md | cat
