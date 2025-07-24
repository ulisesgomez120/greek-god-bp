// ============================================================================
// SUPABASE CLIENT CONFIGURATION
// ============================================================================
// Main Supabase client with authentication and real-time configuration

import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { ENV_CONFIG } from "@/config/constants";
import type { Database } from "@/types/database";

// Custom storage adapter for Supabase Auth
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
  },
};

// Create Supabase client with proper configuration
export const supabase = createClient<Database>(ENV_CONFIG.supabaseUrl, ENV_CONFIG.supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      "X-Client-Info": "trainsmart-mobile",
    },
  },
});

// ============================================================================
// AUTHENTICATION HELPERS
// ============================================================================

export interface AuthResponse {
  user: any;
  session: any;
  error?: string;
}

export interface SignUpData {
  email: string;
  password: string;
  profile: {
    displayName: string;
    experienceLevel: "untrained" | "beginner" | "early_intermediate";
    fitnessGoals?: string[];
    heightCm?: number;
    weightKg?: number;
  };
}

// Sign up with profile creation
export async function signUpWithProfile(data: SignUpData): Promise<AuthResponse> {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          display_name: data.profile.displayName,
          experience_level: data.profile.experienceLevel,
        },
      },
    });

    if (authError) {
      return { user: null, session: null, error: authError.message };
    }

    // Create user profile if signup successful
    if (authData.user) {
      const { error: profileError } = await supabase.from("user_profiles").insert({
        id: authData.user.id,
        email: data.email,
        display_name: data.profile.displayName,
        experience_level: data.profile.experienceLevel,
        fitness_goals: data.profile.fitnessGoals || [],
        height_cm: data.profile.heightCm,
        weight_kg: data.profile.weightKg,
      });

      if (profileError) {
        console.error("Profile creation error:", profileError);
        // Don't fail the signup if profile creation fails
      }
    }

    return {
      user: authData.user,
      session: authData.session,
    };
  } catch (error) {
    return {
      user: null,
      session: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Sign in
export async function signIn(email: string, password: string): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { user: null, session: null, error: error.message };
    }

    return {
      user: data.user,
      session: data.session,
    };
  } catch (error) {
    return {
      user: null,
      session: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Sign out
export async function signOut(): Promise<{ error?: string }> {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { error: error.message };
    }

    // Clear any cached data
    await AsyncStorage.multiRemove(["@offline_workouts", "@workout_cache", "@last_sync_time"]);

    return {};
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Get current session
export async function getCurrentSession() {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("Session error:", error);
      return null;
    }

    return session;
  } catch (error) {
    console.error("Get session error:", error);
    return null;
  }
}

// Get current user
export async function getCurrentUser() {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("User error:", error);
      return null;
    }

    return user;
  } catch (error) {
    console.error("Get user error:", error);
    return null;
  }
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

export interface RealtimeSubscription {
  unsubscribe: () => void;
}

// Subscribe to workout session updates
export function subscribeToWorkoutSessions(userId: string, callback: (payload: any) => void): RealtimeSubscription {
  const subscription = supabase
    .channel(`workout_sessions:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "workout_sessions",
        filter: `user_id=eq.${userId}`,
      },
      callback
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(subscription);
    },
  };
}

// Subscribe to AI conversations
export function subscribeToAIConversations(userId: string, callback: (payload: any) => void): RealtimeSubscription {
  const subscription = supabase
    .channel(`ai_conversations:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "ai_conversations",
        filter: `user_id=eq.${userId}`,
      },
      callback
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(subscription);
    },
  };
}

// Subscribe to subscription status changes
export function subscribeToSubscriptionUpdates(userId: string, callback: (payload: any) => void): RealtimeSubscription {
  const subscription = supabase
    .channel(`subscriptions:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "subscriptions",
        filter: `user_id=eq.${userId}`,
      },
      callback
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(subscription);
    },
  };
}

// ============================================================================
// CONNECTION STATUS MONITORING
// ============================================================================

export interface ConnectionStatus {
  isConnected: boolean;
  lastConnected?: Date;
  reconnectAttempts: number;
}

let connectionStatus: ConnectionStatus = {
  isConnected: false,
  reconnectAttempts: 0,
};

let connectionStatusCallbacks: ((status: ConnectionStatus) => void)[] = [];

// Monitor connection status
export function monitorConnectionStatus() {
  // Listen to auth state changes as a proxy for connection
  supabase.auth.onAuthStateChange((event, session) => {
    const wasConnected = connectionStatus.isConnected;
    connectionStatus.isConnected = !!session;

    if (!wasConnected && connectionStatus.isConnected) {
      connectionStatus.lastConnected = new Date();
      connectionStatus.reconnectAttempts = 0;
    }

    // Notify callbacks
    connectionStatusCallbacks.forEach((callback) => {
      callback(connectionStatus);
    });
  });

  // Test connection periodically
  setInterval(async () => {
    try {
      const { data, error } = await supabase.from("user_profiles").select("id").limit(1);

      const isConnected = !error;

      if (connectionStatus.isConnected !== isConnected) {
        connectionStatus.isConnected = isConnected;

        if (isConnected) {
          connectionStatus.lastConnected = new Date();
          connectionStatus.reconnectAttempts = 0;
        } else {
          connectionStatus.reconnectAttempts++;
        }

        // Notify callbacks
        connectionStatusCallbacks.forEach((callback) => {
          callback(connectionStatus);
        });
      }
    } catch (error) {
      if (connectionStatus.isConnected) {
        connectionStatus.isConnected = false;
        connectionStatus.reconnectAttempts++;

        connectionStatusCallbacks.forEach((callback) => {
          callback(connectionStatus);
        });
      }
    }
  }, 30000); // Check every 30 seconds
}

// Subscribe to connection status changes
export function onConnectionStatusChange(callback: (status: ConnectionStatus) => void): () => void {
  connectionStatusCallbacks.push(callback);

  // Return unsubscribe function
  return () => {
    connectionStatusCallbacks = connectionStatusCallbacks.filter((cb) => cb !== callback);
  };
}

// Get current connection status
export function getConnectionStatus(): ConnectionStatus {
  return { ...connectionStatus };
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export function handleSupabaseError(error: any): SupabaseError {
  if (error?.message) {
    return {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    };
  }

  return {
    message: "An unknown error occurred",
    code: "UNKNOWN_ERROR",
  };
}

// Check if error is network related
export function isNetworkError(error: any): boolean {
  const networkErrorCodes = ["NETWORK_ERROR", "TIMEOUT", "CONNECTION_ERROR", "FETCH_ERROR"];

  return networkErrorCodes.some(
    (code) => error?.code === code || error?.message?.toLowerCase().includes(code.toLowerCase())
  );
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize connection monitoring
monitorConnectionStatus();

export default supabase;
