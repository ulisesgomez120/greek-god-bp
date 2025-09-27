# Implementation Plan

[Overview]
Change the development build display name for iOS and Android so it appends " (Dev)" while leaving production builds unchanged.

This change ensures developers and testers can quickly distinguish development/internal builds from production installs on devices and emulators. The project uses an Expo-managed config exported from `app.config.ts`; Expo's config-plugins map the Expo `name` to iOS CFBundleDisplayName / PRODUCT_NAME and to Android app name resources. The chosen approach is to compute the `name` value in `app.config.ts` at config-time using environment variables (NODE_ENV, EAS build profile envs, and optional explicit overrides). This minimizes manual native edits and works with EAS build profiles and local development clients. The plan also adds optional EAS env settings and a short verification/test checklist.

[Types]  
No TypeScript type system changes are required for app runtime; only a small typed helper will be added to `app.config.ts`.

- Add a typed helper function in `app.config.ts`:
  - Name: `computeAppName`
  - Signature: `(baseName: string, env: NodeJS.ProcessEnv) => string`
  - Behavior: returns `baseName + " (Dev)"` if env indicates a development build, otherwise `baseName`.
  - Validation rules: The function will treat the build as "development" if any of:
    - env.NODE_ENV === "development"
    - env.EAS_BUILD_PROFILE === "development"
    - env.EAS_BUILD_TYPE === "development"
    - env.EXPO_DISPLAY_NAME_SUFFIX === defined (if suffix is exactly " (Dev)" or custom)
    - env.APP_VARIANT === "dev" (optional)
  - Edge cases:
    - If env.EXPO_DISPLAY_NAME_OVERRIDE is provided, return that exact string (highest precedence).
    - If baseName is empty or falsy, return a safe fallback "App".

[Files]  
Modify `app.config.ts` to compute the display name dynamically.

- New files to be created:
  - None strictly required. (Optional: a short README snippet or docs/context/example env files such as `.env.local.example` may be added under the repo root for dev instructions.)
- Existing files to be modified:
  - `app.config.ts` (modify)
    - Replace the static `"name": "GreekGod BP"` with a computed `name` value using `computeAppName`.
    - Add comments and a short helper function near the top to document env precedence.
    - Add support to read an explicit `EXPO_DISPLAY_NAME_OVERRIDE` or `EXPO_DISPLAY_NAME_SUFFIX` from env.
  - `eas.json` (modify)
    - Under the `build.development.env` and `build.preview.env` profiles, add:
      - `"EXPO_DISPLAY_NAME_SUFFIX": " (Dev)"`
      - Optionally `"EXPO_DISPLAY_NAME_OVERRIDE": "GreekGod BP (Dev)"` if you want to be explicit.
    - Rationale: ensures EAS-hosted builds for the development profile will include the suffix automatically.
  - `package.json` (modify - optional but recommended):
    - Add scripts for local verification and local builds:
      - `"prebuild:dev": "NODE_ENV=development expo prebuild --no-install"`
      - `"show-config:dev": "NODE_ENV=development node -e \"console.log(require('./app.config').default({config:{}}))\""` (explain caveat: compiled TS usage)
    - Note: The `node -e` approach may require compiling or running via ts-node; include fallback instructions in the README or docs.
  - `.env.local.example` (new, optional)
    - Document variables: EXPO_DISPLAY_NAME_SUFFIX, EXPO_DISPLAY_NAME_OVERRIDE
- Files to be deleted or moved:
  - None.
- Configuration file updates:
  - Update `eas.json` build profiles as described.
  - Document the env variables in repo README or `context/` docs (optional).

[Functions]  
Add a small helper and update the exported config function in `app.config.ts`.

- New functions:
  - `computeAppName(baseName: string, env: NodeJS.ProcessEnv): string` — file: `app.config.ts` — purpose: centralize the logic that decides whether to append " (Dev)" and implement env precedence rules (override > explicit suffix > detection via NODE_ENV/EAS vars).
- Modified functions:
  - The default exported function in `app.config.ts`:
    - Current signature: `export default ({ config }: ConfigContext): ExpoConfig => ({ ... })`
    - Required changes:
      - Compute `const name = computeAppName("GreekGod BP", process.env)` at the top of the function body.
      - Use `name` for the Expo `name` field and keep other references (PRODUCT_NAME mapping, CFBundleDisplayName) consistent — keep rest of config unchanged.
      - Ensure `extra.environment` remains set correctly (no change).
- Removed functions:
  - None.

[Classes]  
No classes will be added, modified, or removed.

- New classes: none.
- Modified classes: none.
- Removed classes: none.

[Dependencies]  
No new npm packages are required; rely on existing dependencies.

- No package additions.
- Changes to integration requirements:
  - Ensure EAS environments are set for development build profile (edit `eas.json` as described).
  - No runtime library changes required.
- Version constraints: none.

[Testing]  
Verify the change locally and in an EAS development build by inspecting generated native resources and the installed app's display name.

- Single-sentence approach:
  - Use config prebuild and EAS build/profile checks to validate that development builds have " (Dev)" appended and production builds do not.
- Test file requirements and steps:
  - Manual verification steps:
    1. Local verification (managed project, quick check):
       - Run: NODE_ENV=development expo prebuild --platform ios --no-install
       - Inspect generated iOS Info.plist in `ios/<projectName>/Info.plist` for CFBundleDisplayName == "GreekGod BP (Dev)"
       - Run: NODE_ENV=development expo prebuild --platform android --no-install
       - Inspect generated Android `android/app/src/main/res/values/strings.xml` and confirm `<string name="app_name">GreekGod BP (Dev)</string>`
    2. Expo config inspection:
       - Run: NODE_ENV=development expo config --type public
       - Confirm `name` field in the printed config contains " (Dev)" when NODE_ENV=development.
    3. EAS build verification (recommended):
       - Run: `eas build --profile development --platform ios` (or `--platform android`) and install the resulting build on a test device; confirm the installed app name shows "GreekGod BP (Dev)".
    4. Production sanity check:
       - Run: `eas build --profile production` or set NODE_ENV=production and verify the app name remains "GreekGod BP".
  - Automated tests:
    - None needed for runtime behavior; this is a configuration-time change. Optional: add a unit test for `computeAppName` helper which runs in Node (Jest) to validate precedence rules, e.g. provide fake env objects and assert expected outputs.
- Validation strategies:
  - Confirm both Info.plist and Android strings.xml are updated by prebuild or EAS build outputs.
  - Validate that pushing OTA updates is unaffected because runtime bundle name doesn't change.

[Implementation Order]  
Apply a small, low-risk change to `app.config.ts` first, then update `eas.json` and verify locally before running EAS dev builds.

1. Add `computeAppName` helper and update `app.config.ts` to use it (edit file: `app.config.ts`).
2. Add optional `EXPO_DISPLAY_NAME_SUFFIX` to `eas.json` development and preview profiles.
3. Add optional npm scripts in `package.json` for local verification (document the caveat about TypeScript).
4. Perform local verification: run `expo config --type public` and/or `expo prebuild` with NODE_ENV=development and inspect generated iOS/Android files.
5. Run an EAS development build (`eas build --profile development`) and install to verify device display name.
6. Add a Jest unit test for `computeAppName` (optional), and run `npm test`.
7. Commit changes and open a PR with a description, testing steps, and screenshots confirming the updated display name in both iOS and Android builds.
