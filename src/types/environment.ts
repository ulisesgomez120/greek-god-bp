// Environment configuration types used by src/config/constants.ts

export interface EnvironmentConfig {
  supabaseUrl: string; // EXPO_PUBLIC_SUPABASE_URL — must be a valid HTTPS URL
  supabaseAnonKey: string; // EXPO_PUBLIC_SUPABASE_ANON_KEY — public anon key only
  openaiApiKey?: string; // OPENAI_API_KEY — NOT for client use; optional
  apiUrl: string; // EXPO_PUBLIC_API_URL
  environment: "development" | "staging" | "production";
  enableAnalytics?: boolean;
  enableFlipper?: boolean;
  sentryDsn?: string;
}
