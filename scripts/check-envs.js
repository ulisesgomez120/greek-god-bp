// scripts/check-envs.js
// Simple environment validator for CI/local usage.
// Exits with code 0 if all required env vars are present and (optionally) Supabase URL reachable.
// Usage: node scripts/check-envs.js

const https = require("https");

const required = ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "NODE_ENV"];

let ok = true;
required.forEach((k) => {
  if (!process.env[k]) {
    console.error(`Missing env: ${k}`);
    ok = false;
  }
});

if (!ok) {
  console.error("One or more required environment variables are missing.");
  process.exit(1);
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

function checkUrl(url, timeout = 5000) {
  return new Promise((resolve) => {
    try {
      const req = https.request(url, { method: "HEAD", timeout }, (res) => {
        resolve({ ok: true, statusCode: res.statusCode });
      });
      req.on("error", (err) => resolve({ ok: false, error: err.message }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false, error: "timeout" });
      });
      req.end();
    } catch (err) {
      resolve({ ok: false, error: err.message });
    }
  });
}

(async () => {
  console.log("All required env vars present. Verifying Supabase URL reachability...");
  try {
    const url = new URL(supabaseUrl);
    // make a HEAD request to the root of the Supabase URL
    const result = await checkUrl(url.origin);
    if (!result.ok) {
      console.error("Supabase URL check failed:", result.error || result);
      process.exit(1);
    }
    console.log("Supabase URL reachable (status code: " + (result.statusCode || "unknown") + ").");
    console.log("Environment check passed.");
    process.exit(0);
  } catch (err) {
    console.error("Invalid EXPO_PUBLIC_SUPABASE_URL:", err.message);
    process.exit(1);
  }
})();
