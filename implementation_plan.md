# Implementation Plan

[Overview]
Update the app configuration and EAS settings to produce a minimal, production-ready iOS build that removes unnecessary runtime permissions and background modes, and implements a simple deep-linking scheme to start an in-app countdown timer.

This plan scopes the change to configuration and build setup only — no feature-code rewrites are required. The goal is to remove camera/microphone/photo/motion/HealthKit/background permissions from iOS and Android configuration, ensure deep linking (scheme) is present to allow starting an in-app timer, and provide the EAS/Apple account setup steps required to successfully build and submit to the Apple App Store. The approach: (1) minimal edits to `app.config.ts` to remove permission/usage strings and background modes, (2) keep and confirm the URL scheme required for deep linking, (3) tidy Android permissions (or remove them if Android builds are not required), (4) adjust `eas.json` for a clean production profile, and (5) document exact setup steps the developer must complete in Apple Developer / App Store Connect and EAS before building.

[Types]
No runtime type-system changes to application TypeScript types are required for configuration-level changes.

If you want optional compile-time safety for configuration, add a small type for the trimmed extra.eas object:

- Types to add (optional):
  - File: `src/types/environment.ts` (already exists; if not, update to include)
    - Interface: EasExtra { projectId?: string; }
    - Validation: Use existing env validation flow (no further changes required)

[Files]
Single sentence describing file modifications.

Detailed breakdown:

- New files to be created
  - None strictly required. (Optional helper: `scripts/validate-app-config.js` to fail CI if dev accidentally reintroduces sensitive permissions.)
- Existing files to be modified
  1. `app.config.ts` (path: project root)
     - Remove all iOS Info.plist automated usage descriptions that request sensitive permissions we do not need:
       - Remove keys: `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSMicrophoneUsageDescription`, `NSMotionUsageDescription`, `NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription`.
     - Remove the `UIBackgroundModes` array (unless you explicitly need background fetch/processing).
     - Remove or comment out `associatedDomains` if you are not using Universal Links. (Currently: ["applinks:trainsmart.app"]. Remove if unnecessary.)
     - Keep `bundleIdentifier` as `com.trainsmart.app`.
     - Keep `scheme` property (e.g., `"trainsmart"`) to support in-app deep-links like `trainsmart://timer?duration=60`.
     - Keep `config.plugins` (e.g., `expo-secure-store`, `expo-font`, `expo-splash-screen`) — they are safe.
     - Remove Android `permissions` array entirely or reduce to the absolute minimum. Since target store is Apple only, either:
       - Option A (recommended while producing no Android build): Remove the `permissions` key so Android defaults apply.
       - Option B (if you will later produce Android builds): Reduce to `VIBRATE`, `WAKE_LOCK` only if needed.
     - Keep `intentFilters` only if you plan to support https-based app links on Android (not needed for iOS-only launch).
     - Maintain `extra.eas.projectId` placeholder; ensure you replace it with your EAS Project ID (or set EAS_PROJECT_ID in .env).
     - Update `updates.url` to use your EAS project url if/when ready (no required change now).
     - Add a short comment block at the top describing why permissions were removed (helps reviewers).
  2. `eas.json` (project root)
     - Ensure the `production` profile is explicit about iOS:
       - Add `"ios": { "image": "latest", "buildType": "release" }` to ensure reproducible builds.
       - Keep `"autoIncrement": true` but optionally set `"autoIncrement": "buildNumber"` or set a policy you prefer.
     - Add a `submit` profile if you plan to automate App Store submission via `eas submit` (optional).
     - Add note to `eas.json` (or README) reminding to configure App Store Connect API key and set `EAS_PROJECT_ID` in `.env`.
  3. `.env` / environment
     - Ensure `.env` (not checked in) contains a valid `EAS_PROJECT_ID` and `EXPO_TOKEN` or that you are logged into expo/eas on CI.
     - No code changes — document required values in `README` or `implementation_plan.md`.
- Files to be deleted or moved
  - None required.
- Configuration file updates
  - `app.config.ts`: edit as above.
  - `eas.json`: add explicit ios build details and optional submission profile.
  - Add documentation in repo root `README` or `CONTRIBUTING.md` (optional) describing Apple/EAS setup steps.

[Functions]
Single sentence describing function modifications.

Detailed breakdown:

- New functions
  - None required. (Optional: small validation script to ensure `app.config.ts` produced the intended minimal permissions; not mandatory.)
- Modified functions
  - None in application code required. The existing deep linking code in `src/navigation/AppNavigator.tsx` already uses `expo-linking` and defines a `trainsmart://` scheme; ensure it continues to work after `app.config.ts` update.
- Removed functions
  - None.

[Classes]
Single sentence describing class modifications.

Detailed breakdown:

- New classes
  - None.
- Modified classes
  - None.
- Removed classes
  - None.

[Dependencies]
Single sentence describing dependency modifications.

Details of new packages, version changes, and integration requirements.

- No new runtime dependencies are required.
- Optional dev dependency:
  - A tiny script validator can be added as dev dependency (`node` script) to check that the `app.config.ts` does not include unexpected permission keys.
- Keep existing packages (expo, expo-linking). Ensure `expo` SDK version is consistent with EAS build images (verify `expo --version` and EAS images; we recommend using the latest supported SDK when building for App Store).

[Testing]
Single sentence describing testing approach.

Test file requirements, existing test modifications, and validation strategies.

- Manual tests required:
  - Verify the app runs locally in Expo/Simulator and deep-linking triggers the in-app timer.
  - Test iOS simulator or device by opening a deep link (see CLI commands below).
- Unit tests:
  - No changes needed to existing tests.
- QA checklist:
  - Launch app in simulator and verify app launches normally.
  - Test link: `xcrun simctl openurl booted "trainsmart://timer?duration=90"` — verify the app handles the parameters and starts a countdown for 90 seconds.
  - Confirm no permission prompts show on first app launch (camera/microphone/health etc are not requested).

[Implementation Order]
Single sentence describing the implementation sequence.

Numbered steps showing the logical order of changes to minimize conflicts and ensure successful integration.

1. Edit `app.config.ts` to remove unnecessary iOS Info.plist keys and Android permissions; preserve `scheme` exactly as `trainsmart`.
2. Update `eas.json` production profile: add explicit iOS `image` and `buildType` settings and optional `submit` profile.
3. Update repository docs and `.env.example` with the EAS project ID and required Apple/EAS setup instructions.
4. Run local builds and deep-link tests in the iOS simulator:
   - Start the app in simulator (via `expo start` or `eas build --local`).
   - Test deep links via `xcrun simctl openurl booted "trainsmart://timer?duration=60"`.
5. Configure App Store Connect and EAS credentials (create App ID, register bundle identifier, generate App Store Connect API key for EAS).
6. Run `eas build --platform ios --profile production` (or `eas submit` if automating) and verify binary in App Store Connect.
7. Iterate: if Apple rejects due to missing entitlements, adjust config and re-build (documented in Implementation Steps below).

Implementation Steps & Exact Changes (line-level guidance)

- app.config.ts (modify in place)
  - Replace the ios.infoPlist block with the minimal variant below (maintain other ios properties). Example replacement (exact snippet to insert):
    infoPlist: {
    // Removed camera, photo, microphone, motion, and HealthKit usage descriptions intentionally:
    // NSCameraUsageDescription: undefined,
    // NSPhotoLibraryUsageDescription: undefined,
    // NSMicrophoneUsageDescription: undefined,
    // NSMotionUsageDescription: undefined,
    // NSHealthShareUsageDescription: undefined,
    // NSHealthUpdateUsageDescription: undefined,
    // Background modes removed - not required for timer-only functionality
    },
  - Remove `UIBackgroundModes` entirely from infoPlist.
  - Remove `associatedDomains` unless you plan to use Universal Links; otherwise keep if you already own and configured trainsmart.app.
  - Remove or clear `android.permissions` array, i.e. either delete the `permissions` key or set it to `[]`.
  - Ensure `scheme: "trainsmart",` remains unchanged so deep-linking works.
  - Keep `linking` usage inside the app navigation (no code changes required in navigation).
- eas.json (modify in place)
  - Add an explicit ios object for production:
    "production": {
    "autoIncrement": true,
    "ios": {
    "image": "latest",
    "buildType": "release"
    }
    }
  - (Optional) Add a `submit` profile or ensure `submit.production` exists if you will call `eas submit`.
- Documentation updates (this file does that work)
  - Add the following Setup Steps below so you can complete the App Store deployment.

Setup Steps the developer must perform (ordered)

1. Apple Developer / App Store Connect
   - Log into Apple Developer account and App Store Connect.
   - Create an App ID for bundle identifier `com.trainsmart.app` (or the bundle id in `app.config.ts`).
   - Under App ID, do NOT enable any capabilities you do not need (no HealthKit, no Camera, no Background Modes). Enable only 'Sign In with Apple' if you use it (not required).
   - In App Store Connect, create a new App record (My Apps) with the same bundle identifier.
2. EAS / Expo
   - Sign in to expo (locally): `expo login` or `eas login`.
   - Create an EAS project on expo.dev if not already created. Get the `EAS_PROJECT_ID` from the project settings.
   - Set your project env var:
     - Locally: create `.env` (copy `.env.example`) and set `EAS_PROJECT_ID=...` and `EXPO_TOKEN` or authenticate via `eas login`.
   - Configure App Store Connect API Key for EAS (so EAS can upload/submit):
     - Generate an API key in App Store Connect (Users and Access -> Keys).
     - Save the key file and configure EAS credentials with `eas credentials` or let EAS prompt during `eas build`.
3. Local verification
   - Start the app: `expo start` or run in iOS simulator via `expo run:ios` if you want a local build.
   - Test deep link on the simulator:
     - Boot simulator and run:
       xcrun simctl openurl booted "trainsmart://timer?duration=60"
     - Confirm the app responds and starts an in-app 60-second timer (this is app logic; if missing, implement a simple handler in navigation).
4. Build & Submit
   - Build with EAS:
     - `eas build --platform ios --profile production`
   - Once build completes, either download IPA and manually upload to App Store Connect or use `eas submit --platform ios --profile production`.
   - Fill App Store Connect metadata and submit for review.

Deep link format & expected app behavior

- Desired deep link format:
  - trainsmart://timer?duration=60
  - Example: `trainsmart://timer?duration=90` (starts 90-second countdown)
- Implementation check:
  - `AppNavigator` already includes a `trainsmart` scheme via expo-linking. Confirm your navigation or a linking listener parses `route` params and starts the timer. If you need, implement a handler in a top-level screen that reads `route.params.duration` and navigates to the timer component.
  - For simulator testing use: `xcrun simctl openurl booted "trainsmart://timer?duration=60"`

Notes and rationale

- Removing Info.plist usage keys and Android permissions prevents the OS from prompting for access the app does not use — this reduces friction and privacy surface area for App Store review.
- Keep the `scheme` to enable in-app deep linking; the app can handle timer requests internally without launching the device's Clock app.
- If at any point you decide to integrate HealthKit, Camera, or Microphone, add only the specific Info.plist entries required, and implement the runtime permission request flows in code with user education and justification strings.

Appendix: Useful CLI commands (copy/paste)

- Validate app config (basic run):
  - expo prebuild --platform ios
  - expo config --type public # prints the resolved config (helpful to confirm infoPlist contents)
- Test deep link on iOS simulator:
  - xcrun simctl openurl booted "trainsmart://timer?duration=60"
- EAS build commands:
  - eas login
  - eas build --platform ios --profile production
  - eas submit --platform ios --profile production
