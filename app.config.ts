import { ExpoConfig, ConfigContext } from "expo/config";
import { config } from "dotenv";

// Load environment-specific file
const envFile = process.env.NODE_ENV === "development" ? ".env.local" : ".env";
config({ path: envFile });

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "TrainSmart",
  slug: "trainsmart-mju-givknvilkuvj6qjuk",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#B5CFF8",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.greekgodbp.app",
    buildNumber: "1",
    infoPlist: {
      LSApplicationQueriesSchemes: ["clock-timer", "clock"],
    },
    // Removed unused iOS usage description keys and UIBackgroundModes to avoid unnecessary permission prompts.
    // Keep minimal config required for App Store submission.
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#B5CFF8",
    },
    package: "com.trainsmart.app",
    versionCode: 1,
    // Clear Android permissions for now (iOS-only target). Reintroduce minimal permissions later if Android builds are needed.
    permissions: [],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "trainsmart.app",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    favicon: "./assets/favicon.png",
    bundler: "metro",
    output: "single",
    lang: "en",
  },
  scheme: "trainsmart",
  plugins: ["expo-secure-store", "expo-font", "expo-splash-screen"],
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    environment: process.env.NODE_ENV || "development",
    apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://api.trainsmart.app",
    sentryDsn: process.env.SENTRY_DSN,
    enableAnalytics: process.env.EXPO_PUBLIC_ENABLE_ANALYTICS === "true",
    enableFlipper: process.env.NODE_ENV === "development",
  },
  updates: {
    fallbackToCacheTimeout: 0,
    url: "https://u.expo.dev/12345678-1234-1234-1234-123456789012",
  },
  runtimeVersion: {
    policy: "sdkVersion",
  },
});
