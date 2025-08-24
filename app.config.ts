import { ExpoConfig, ConfigContext } from "expo/config";
import { config } from "dotenv";

// Load environment-specific file
const envFile = process.env.NODE_ENV === "development" ? ".env.local" : ".env";
config({ path: envFile });

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "TrainSmart",
  slug: "trainsmart",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.svg",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#B5CFF8",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.trainsmart.app",
    buildNumber: "1",
    infoPlist: {
      NSCameraUsageDescription: "This app uses the camera to capture workout progress photos.",
      NSPhotoLibraryUsageDescription: "This app accesses your photo library to save and view workout progress photos.",
      NSMicrophoneUsageDescription: "This app uses the microphone for voice commands during workouts.",
      NSMotionUsageDescription: "This app uses motion sensors to track workout movements and rest periods.",
      NSHealthShareUsageDescription: "This app integrates with HealthKit to sync your workout data.",
      NSHealthUpdateUsageDescription: "This app updates HealthKit with your workout progress.",
      UIBackgroundModes: ["background-processing", "background-fetch"],
    },
    associatedDomains: ["applinks:trainsmart.app"],
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
    permissions: [
      "CAMERA",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE",
      "RECORD_AUDIO",
      "VIBRATE",
      "WAKE_LOCK",
      "RECEIVE_BOOT_COMPLETED",
      "SYSTEM_ALERT_WINDOW",
    ],
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
    bundler: "webpack",
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
    stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
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
