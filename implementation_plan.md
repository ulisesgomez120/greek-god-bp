# Implementation Plan

[Overview]
Enable deploying the Expo web build as a Progressive Web App (PWA) to Netlify from the GitHub repository (branch: deploy/pwa) and link/setup the existing Supabase project so the deployed web app uses the remote database and auth. The plan instructs how to configure Netlify, map environment variables into Expo's `extra` values used by the app, add minimal repository configuration for consistent builds, and safely apply the repository Supabase migrations/seeds to the remote Supabase project.

This implementation is needed so the app can be installed on phones as a PWA, served from Netlify with correct routing and caching for service workers/manifest, and connected to your existing Supabase backend. The approach minimizes code changes (mostly config files and small type + helper scripts), preserves security by keeping service role keys out of client environment variables, and provides safe, recommended migration steps including a backup and manual fallback via the Supabase dashboard.

[Types]  
Single sentence describing the type system changes.  
Add an explicit environment types file documenting the Expo `extra` environment variables used at runtime.

Detailed type definitions, interfaces, enums, or data structures with complete specifications:

- File: src/types/environment.ts
  - Purpose: Define the exact shape of the environment config referenced by `src/config/constants.ts` and provide compile-time safety.
  - Content (TypeScript):
    - export interface EnvironmentConfig {
      supabaseUrl: string; // EXPO_PUBLIC_SUPABASE_URL — must be a valid HTTPS URL
      supabaseAnonKey: string; // EXPO_PUBLIC_SUPABASE_ANON_KEY — public anon key only
      openaiApiKey?: string; // OPENAI_API_KEY — NOT for client use; optional
      stripePublishableKey?: string; // EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY — publishable key only
      apiUrl: string; // EXPO_PUBLIC_API_URL
      environment: "development" | "staging" | "production";
      enableAnalytics?: boolean;
      enableFlipper?: boolean;
      sentryDsn?: string;
      }
  - Validation rules:
    - supabaseUrl: required; must be non-empty; recommend HTTPS.
    - supabaseAnonKey: required; must be non-empty. Warn to never place service role keys here.
    - openaiApiKey: optional; prefer server-side storage; do not use EXPO*PUBLIC* prefix if you want it server-only.
  - Relationships:
    - This type must match the `EnvironmentConfig` referenced by `src/config/constants.ts`. If an existing type is present, ensure fields and names match exactly.

[Files]  
Single sentence describing file modifications.  
Add Netlify and typing configuration and optional helper scripts; minimal edits to existing files are recommended (no core app changes).

Detailed breakdown:

- New files to be created:
  - implementation_plan.md (root) — this document (already created).
  - netlify.toml (root) — Purpose: instruct Netlify how to build and deploy the Expo web output and add routing/headers for PWA behavior.
    - Example content (to be written into the file):
      - [build]
        command = "npm run build:web"
        publish = "web-build"
        environment = { NODE_ENV = "production" }
      - [[redirects]]
        from = "/\*"
        to = "/index.html"
        status = 200
      - [[headers]]
        for = "/service-worker.js"
        [headers.values]
        Cache-Control = "no-cache"
      - [[headers]]
        for = "/manifest.json"
        [headers.values]
        Cache-Control = "no-cache"
      - [[headers]]
        for = "/\*"
        [headers.values]
        Cache-Control = "public, max-age=0, must-revalidate"
  - src/types/environment.ts — Type definitions listed above.
  - scripts/check-envs.js (or .ts) — small node script to verify required env vars are present and optionally test connecting to Supabase URL using the anon key; prints success/failure for CI or local checks.
  - .github/README-or-deploy-notes.md (optional) — short instructions for maintainers (how to set envs and redeploy).
  - README-deploy-netlify.md (optional) — one-page developer guide for local build & Netlify deployment.
- Existing files to be modified:
  - app.config.ts
    - Action: No code change required unless you'd prefer to change variable names. Confirm mapping in Netlify envs so that EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set to the Supabase project's URL and anon key.
    - Recommendation: Keep as-is. If you prefer to use plain SUPABASE_URL in Netlify, map it to EXPO_PUBLIC_SUPABASE_URL in Netlify envs.
  - src/config/constants.ts
    - Action: No modification required. Optionally add a runtime guard/log that warns if `ENV_CONFIG.supabaseUrl` or `supabaseAnonKey` are empty to make misconfiguration obvious.
  - supabase/ (directory)
    - Action: Do not modify migration files. They will be applied to remote DB using the Supabase CLI or via Dashboard. Confirm chronological order of migrations is correct (files already timestamped).
- Files to be deleted or moved:
  - None.
- Configuration file updates:
  - Netlify site environment variables (set via Netlify UI):
    - EXPO_PUBLIC_SUPABASE_URL = <your supabase URL>
    - EXPO_PUBLIC_SUPABASE_ANON_KEY = <your anon key>
    - EXPO_PUBLIC_API_URL = https://api.trainsmart.app (or your API)
    - EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = <optional>
    - EXPO_PUBLIC_ENABLE_ANALYTICS = "true" or "false"
    - NODE_ENV = production (Netlify usually sets this automatically)
  - Add netlify.toml in repo root to ensure consistent build settings across environments.

[Functions]  
Single sentence describing function modifications.  
No application-level function changes required; add small helper scripts and an optional runtime guard in the Supabase client to fail fast if envs are missing.

Detailed breakdown:

- New functions:
  - scripts/check-envs.js
    - Signature: node scripts/check-envs.js
    - Purpose: Validate required env variables and optionally make a test request to the Supabase URL to verify reachability.
    - Behavior:
      - Reads process.env.EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
      - Prints errors and exits with non-zero status when missing
      - Optionally performs a simple fetch to `${EXPO_PUBLIC_SUPABASE_URL}/rest/v1/?` or uses a HEAD request to the root if REST not desired.
  - scripts/preview.sh (optional)
    - Signature: bash scripts/preview.sh
    - Purpose: Build and serve the production web build locally for smoke tests.
    - Commands:
      - npm run build:web
      - npx serve web-build -l 5000
- Modified functions:
  - Optional guard in src/lib/supabase.ts
    - Function: initialization code that creates supabase client
    - Change: add an early runtime check (if ENV_CONFIG.supabaseUrl === "" || ENV_CONFIG.supabaseAnonKey === "") console.error a clear message and (optionally) throw an error in development to prevent silent misconfiguration.
- Removed functions:
  - None.

[Classes]  
Single sentence describing class modifications.  
No class-level changes required.

Detailed breakdown:

- New classes:
  - None.
- Modified classes:
  - None.
- Removed classes:
  - None.

[Dependencies]  
Single sentence describing dependency modifications.  
No new production dependencies required; optionally add lightweight dev dependencies for local testing and Netlify CLI.

Details of new packages, version changes, and integration requirements:

- Optional dev dependencies:
  - netlify-cli (npm i -D netlify-cli) — for local Netlify dev server and manual CLI deploys.
  - serve (npm i -D serve) — to serve the web-build folder locally for smoke tests.
- No changes required to @supabase/supabase-js or other runtime packages.
- Integration requirements:
  - Netlify must have GitHub connected (you confirmed it is).
  - The branch to deploy will be `deploy/pwa` (you requested that name). Configure Netlify to deploy that branch or create a site that auto-deploys from it.
  - Supabase CLI must be logged in and linked using `supabase link --project-ref <PROJECT_REF>` before running CLI migration commands.

[Testing]  
Single sentence describing testing approach.  
Manual smoke tests plus optional CI checks to ensure the web build completes and Supabase connectivity works.

Test file requirements, existing test modifications, and validation strategies:

- Manual smoke tests (post-deploy):
  1. Visit Netlify URL on a mobile browser. Confirm PWA prompt / Add to Home Screen works and the manifest/service worker exist.
  2. Sign up and sign in using a test account. Confirm `user_profiles` receives a new row (verify in Supabase dashboard).
  3. Perform a simple read query to confirm DB reads (e.g., fetch user profile).
  4. If realtime is used, perform an action that triggers a `postgres_changes` and confirm the client receives it.
- Local tests (before pushing):
  1. npm run build:web
  2. npx serve web-build
  3. Verify `web-build/manifest.json` exists and contains correct `start_url` and `scope`.
  4. Run node scripts/check-envs.js to ensure Netlify/CI envs are set correctly.
- CI suggestions:
  - Add a pipeline job that runs `npm run build:web` and `node scripts/check-envs.js` to prevent broken deploys due to missing envs.

[Implementation Order]  
Single sentence describing the implementation sequence.  
Make configuration changes and type additions first, create a feature branch, commit and push, set Netlify environment variables, perform a safe migration to Supabase, then verify the deployed PWA through smoke tests.

Numbered steps showing the logical order of changes:

1. Create local branch `deploy/pwa`.
2. Add files: `netlify.toml`, `src/types/environment.ts`, `scripts/check-envs.js`, optional README-deploy-netlify.md and .github/README-or-deploy-notes.md.
3. Commit and push the branch `deploy/pwa` to GitHub.
4. In the Netlify site settings:
   - Point or create a site to deploy branch `deploy/pwa` (or change the branch to deploy).
   - Set environment variables:
     - EXPO_PUBLIC_SUPABASE_URL = <your supabase URL>
     - EXPO_PUBLIC_SUPABASE_ANON_KEY = <your anon key>
     - EXPO_PUBLIC_API_URL = https://api.trainsmart.app (or your value)
     - EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = <optional>
     - EXPO_PUBLIC_ENABLE_ANALYTICS = "true" or "false"
   - Configure build settings:
     - Build command: npm run build:web
     - Publish directory: web-build
5. Locally verify build and assets:
   - npm run build:web
   - npx serve web-build
   - Inspect `web-build/manifest.json` and `web-build/service-worker.js`
6. Link Supabase CLI to remote project (run locally; recommended):
   - supabase login
   - supabase link --project-ref <PROJECT_REF>
   - supabase status
7. Backup remote DB via Supabase Dashboard (recommended).
8. Apply migrations/seeds:
   - Preferred safe approach (manual/visible):
     - Use Supabase Dashboard SQL editor to run the SQL from `supabase/migrations/*.sql` in timestamp order, then run `supabase/seed.sql`.
   - CLI approach (if you prefer automated):
     - supabase db push --project-ref <PROJECT_REF>
     - supabase db seed --file supabase/seed.sql --project-ref <PROJECT_REF> (if supported)
     - Note: CLI commands can modify remote DB. Always backup first.
9. Once Netlify builds the pushed branch, visit the deployed URL and run the manual smoke tests.
10. If you need an automated redeploy or Netlify CLI deploy script, add `scripts/deploy-netlify.sh` that uses `netlify-cli` for authenticated deploys.

Appendix: Quick Supabase CLI commands (exact lines to run locally — replace placeholders)

- supabase login
- supabase link --project-ref <PROJECT_REF>
- supabase status --project-ref <PROJECT_REF>
- (Optional, backup via Dashboard)
- supabase db push --project-ref <PROJECT_REF>
- supabase db seed --file supabase/seed.sql --project-ref <PROJECT_REF>

Appendix: Example `netlify.toml` (to be added to repo)

```
[build]
  command = "npm run build:web"
  publish = "web-build"
  environment = { NODE_ENV = "production" }

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/service-worker.js"
  [headers.values]
  Cache-Control = "no-cache"

[[headers]]
  for = "/manifest.json"
  [headers.values]
  Cache-Control = "no-cache"

[[headers]]
  for = "/*"
  [headers.values]
  Cache-Control = "public, max-age=0, must-revalidate"
```

Appendix: Example `scripts/check-envs.js`

```js
// scripts/check-envs.js
const required = ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "NODE_ENV"];
let ok = true;
required.forEach((k) => {
  if (!process.env[k]) {
    console.error(`Missing env: ${k}`);
    ok = false;
  }
});
if (!ok) process.exit(1);
console.log("All required envs present.");
```

Notes and security reminders:

- Never place `SUPABASE_SERVICE_ROLE_KEY` or other privileged keys into EXPO*PUBLIC*\* envs. If you need server-side operations that require privileged keys, use Supabase Edge Functions or a secure server side (Netlify serverless functions) and set those keys in server-only environment variables.
- If you decide to expose the Supabase anon key via Netlify, it's expected (it's the public anon key). Ensure all operations requiring elevated privileges happen server-side.
- If you want, I will:
  - create the branch `deploy/pwa`,
  - add the files listed (netlify.toml, src/types/environment.ts, scripts/check-envs.js),
  - commit & push the branch,
  - then provide the exact supabase CLI commands for you to run locally with your project ref.
  - After you run the Supabase CLI commands (link/migrate), you can notify me and I will help verify.

Refer to this file for the exact step-by-step commands when running locally and for the task created by the implementation agent.
