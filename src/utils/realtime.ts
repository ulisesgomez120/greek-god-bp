// ============================================================================
// REAL-TIME SUBSCRIPTION MANAGEMENT UTILITIES
// ============================================================================
// Provides centralized real-time subscription management with automatic cleanup

import { supabase } from "@/lib/supabase";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { WorkoutSession, ExerciseSet, AIConversation, Subscription, UserProfile } from "@/types/database";

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface RealtimeSubscription {
  id: string;
  channel: RealtimeChannel;
  unsubscribe: () => void;
  isActive: boolean;
}

export interface RealtimeManager {
  subscriptions: Map<string, RealtimeSubscription>;
  subscribe: <T extends Record<string, any>>(config: SubscriptionConfig<T>) => RealtimeSubscription;
  unsubscribe: (subscriptionId: string) => void;
  unsubscribeAll: () => void;
  getActiveSubscriptions: () => string[];
  isSubscribed: (id: string) => boolean;
}

export interface SubscriptionConfig<T extends Record<string, any> = Record<string, any>> {
  id: string;
  table: string;
  filter?: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  callback: (payload: RealtimePostgresChangesPayload<T>) => void;
  onError?: (error: any) => void;
  onSubscribed?: () => void;
  onUnsubscribed?: () => void;
}

export interface WorkoutRealtimeCallbacks {
  onWorkoutSessionChange?: (payload: RealtimePostgresChangesPayload<WorkoutSession>) => void;
  onExerciseSetChange?: (payload: RealtimePostgresChangesPayload<ExerciseSet>) => void;
  onError?: (error: any) => void;
}

export interface AIRealtimeCallbacks {
  onConversationChange?: (payload: RealtimePostgresChangesPayload<AIConversation>) => void;
  onUsageUpdate?: (payload: any) => void;
  onError?: (error: any) => void;
}

export interface SubscriptionRealtimeCallbacks {
  onSubscriptionChange?: (payload: RealtimePostgresChangesPayload<Subscription>) => void;
  onError?: (error: any) => void;
}

// ============================================================================
// REALTIME MANAGER CLASS
// ============================================================================

class RealtimeManagerImpl implements RealtimeManager {
  public subscriptions: Map<string, RealtimeSubscription> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (this.isInitialized) return;

    // Listen for auth state changes to manage subscriptions
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        this.unsubscribeAll();
      }
    });

    // Cleanup on app backgrounding (React Native)
    if (typeof window !== "undefined" && "addEventListener" in window) {
      window.addEventListener("beforeunload", () => {
        this.unsubscribeAll();
      });
    }

    this.isInitialized = true;
  }

  public subscribe<T extends Record<string, any>>(config: SubscriptionConfig<T>): RealtimeSubscription {
    // Unsubscribe existing subscription with same ID
    if (this.subscriptions.has(config.id)) {
      this.unsubscribe(config.id);
    }

    // Create channel
    const channel = supabase.channel(config.id);

    // Configure postgres changes listener
    const postgresConfig: any = {
      event: config.event || "*",
      schema: "public",
      table: config.table,
    };

    if (config.filter) {
      postgresConfig.filter = config.filter;
    }

    channel.on("postgres_changes", postgresConfig, (payload) => {
      try {
        config.callback(payload as RealtimePostgresChangesPayload<T>);
      } catch (error) {
        console.error(`Error in realtime callback for ${config.id}:`, error);
        config.onError?.(error);
      }
    });

    // Handle subscription events
    channel.on("system", {}, (payload) => {
      if (payload.extension === "postgres_changes") {
        switch (payload.status) {
          case "ok":
            config.onSubscribed?.();
            break;
          case "error":
            console.error(`Subscription error for ${config.id}:`, payload);
            config.onError?.(payload);
            break;
        }
      }
    });

    // Subscribe to channel
    const channelSubscription = channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") {
        console.log(`Successfully subscribed to ${config.id}`);
      } else if (status === "CHANNEL_ERROR") {
        console.error(`Channel error for ${config.id}:`, error);
        config.onError?.(error);
      } else if (status === "TIMED_OUT") {
        console.warn(`Subscription timeout for ${config.id}`);
        config.onError?.(new Error("Subscription timeout"));
      } else if (status === "CLOSED") {
        console.log(`Channel closed for ${config.id}`);
        config.onUnsubscribed?.();
      }
    });

    // Create subscription object
    const subscription: RealtimeSubscription = {
      id: config.id,
      channel,
      isActive: true,
      unsubscribe: () => {
        this.unsubscribe(config.id);
      },
    };

    // Store subscription
    this.subscriptions.set(config.id, subscription);

    return subscription;
  }

  public unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      console.warn(`No subscription found with ID: ${subscriptionId}`);
      return;
    }

    try {
      // Unsubscribe from channel
      supabase.removeChannel(subscription.channel);
      subscription.isActive = false;

      // Remove from map
      this.subscriptions.delete(subscriptionId);

      console.log(`Unsubscribed from ${subscriptionId}`);
    } catch (error) {
      console.error(`Error unsubscribing from ${subscriptionId}:`, error);
    }
  }

  public unsubscribeAll(): void {
    console.log(`Unsubscribing from ${this.subscriptions.size} active subscriptions`);

    for (const [id, subscription] of this.subscriptions) {
      try {
        supabase.removeChannel(subscription.channel);
        subscription.isActive = false;
      } catch (error) {
        console.error(`Error unsubscribing from ${id}:`, error);
      }
    }

    this.subscriptions.clear();
  }

  public getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys()).filter((id) => this.subscriptions.get(id)?.isActive);
  }

  public getSubscription(id: string): RealtimeSubscription | undefined {
    return this.subscriptions.get(id);
  }

  public isSubscribed(id: string): boolean {
    const subscription = this.subscriptions.get(id);
    return subscription?.isActive || false;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const realtimeManager: RealtimeManager = new RealtimeManagerImpl();

// ============================================================================
// CONVENIENCE FUNCTIONS FOR COMMON SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to workout session changes for a specific user
 */
export function subscribeToWorkoutSessions(userId: string, callbacks: WorkoutRealtimeCallbacks): RealtimeSubscription {
  return realtimeManager.subscribe<WorkoutSession>({
    id: `workout_sessions_${userId}`,
    table: "workout_sessions",
    filter: `user_id=eq.${userId}`,
    callback: (payload) => {
      callbacks.onWorkoutSessionChange?.(payload);
    },
    onError: callbacks.onError,
    onSubscribed: () => {
      console.log(`Subscribed to workout sessions for user ${userId}`);
    },
  });
}

/**
 * Subscribe to exercise set changes for a specific workout session
 */
export function subscribeToExerciseSets(sessionId: string, callbacks: WorkoutRealtimeCallbacks): RealtimeSubscription {
  return realtimeManager.subscribe<ExerciseSet>({
    id: `exercise_sets_${sessionId}`,
    table: "exercise_sets",
    filter: `session_id=eq.${sessionId}`,
    callback: (payload) => {
      callbacks.onExerciseSetChange?.(payload);
    },
    onError: callbacks.onError,
    onSubscribed: () => {
      console.log(`Subscribed to exercise sets for session ${sessionId}`);
    },
  });
}

/**
 * Subscribe to AI conversation changes for a specific user
 */
export function subscribeToAIConversations(userId: string, callbacks: AIRealtimeCallbacks): RealtimeSubscription {
  return realtimeManager.subscribe<AIConversation>({
    id: `ai_conversations_${userId}`,
    table: "ai_conversations",
    filter: `user_id=eq.${userId}`,
    callback: (payload) => {
      callbacks.onConversationChange?.(payload);
    },
    onError: callbacks.onError,
    onSubscribed: () => {
      console.log(`Subscribed to AI conversations for user ${userId}`);
    },
  });
}

/**
 * Subscribe to subscription status changes for a specific user
 */
export function subscribeToSubscriptionUpdates(
  userId: string,
  callbacks: SubscriptionRealtimeCallbacks
): RealtimeSubscription {
  return realtimeManager.subscribe<Subscription>({
    id: `subscriptions_${userId}`,
    table: "subscriptions",
    filter: `user_id=eq.${userId}`,
    callback: (payload) => {
      callbacks.onSubscriptionChange?.(payload);
    },
    onError: callbacks.onError,
    onSubscribed: () => {
      console.log(`Subscribed to subscription updates for user ${userId}`);
    },
  });
}

/**
 * Subscribe to user profile changes
 */
export function subscribeToUserProfile(
  userId: string,
  callback: (payload: RealtimePostgresChangesPayload<UserProfile>) => void,
  onError?: (error: any) => void
): RealtimeSubscription {
  return realtimeManager.subscribe<UserProfile>({
    id: `user_profile_${userId}`,
    table: "user_profiles",
    filter: `id=eq.${userId}`,
    callback,
    onError,
    onSubscribed: () => {
      console.log(`Subscribed to user profile for user ${userId}`);
    },
  });
}

// ============================================================================
// WORKOUT-SPECIFIC REALTIME UTILITIES
// ============================================================================

/**
 * Subscribe to all workout-related changes for a user during an active session
 */
export function subscribeToActiveWorkout(
  userId: string,
  sessionId: string,
  callbacks: WorkoutRealtimeCallbacks
): {
  sessionSubscription: RealtimeSubscription;
  setsSubscription: RealtimeSubscription;
  unsubscribeAll: () => void;
} {
  const sessionSubscription = subscribeToWorkoutSessions(userId, {
    onWorkoutSessionChange: callbacks.onWorkoutSessionChange,
    onError: callbacks.onError,
  });

  const setsSubscription = subscribeToExerciseSets(sessionId, {
    onExerciseSetChange: callbacks.onExerciseSetChange,
    onError: callbacks.onError,
  });

  return {
    sessionSubscription,
    setsSubscription,
    unsubscribeAll: () => {
      sessionSubscription.unsubscribe();
      setsSubscription.unsubscribe();
    },
  };
}

// ============================================================================
// CONNECTION STATUS MONITORING
// ============================================================================

export interface ConnectionStatusCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onReconnecting?: () => void;
  onError?: (error: any) => void;
}

/**
 * Monitor real-time connection status
 */
export function monitorConnectionStatus(callbacks: ConnectionStatusCallbacks): RealtimeSubscription {
  return realtimeManager.subscribe({
    id: "connection_monitor",
    table: "user_profiles", // Use any table for connection testing
    filter: "id=eq.00000000-0000-0000-0000-000000000000", // Non-existent ID
    callback: () => {
      // This callback won't be called, but the subscription status will indicate connection
    },
    onSubscribed: () => {
      callbacks.onConnected?.();
    },
    onError: (error) => {
      callbacks.onDisconnected?.();
      callbacks.onError?.(error);
    },
    onUnsubscribed: () => {
      callbacks.onDisconnected?.();
    },
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if real-time is currently connected
 */
export function isRealtimeConnected(): boolean {
  // Check if we have any active subscriptions
  const activeSubscriptions = realtimeManager.getActiveSubscriptions();
  return activeSubscriptions.length > 0;
}

/**
 * Get real-time connection statistics
 */
export function getRealtimeStats(): {
  activeSubscriptions: number;
  subscriptionIds: string[];
  isConnected: boolean;
} {
  const subscriptionIds = realtimeManager.getActiveSubscriptions();
  return {
    activeSubscriptions: subscriptionIds.length,
    subscriptionIds,
    isConnected: subscriptionIds.length > 0,
  };
}

/**
 * Reconnect all subscriptions (useful after network recovery)
 */
export function reconnectAllSubscriptions(): void {
  console.log("Reconnecting all real-time subscriptions...");

  // Get current subscription configs (this would need to be stored if we want to reconnect)
  // For now, we'll just log that reconnection was attempted
  const stats = getRealtimeStats();
  console.log(`Attempted to reconnect ${stats.activeSubscriptions} subscriptions`);
}

/**
 * Create a subscription with automatic retry logic
 */
export function createRetryableSubscription<T extends Record<string, any>>(
  config: SubscriptionConfig<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
): RealtimeSubscription {
  let retryCount = 0;

  const originalOnError = config.onError;
  const retryableConfig: SubscriptionConfig<T> = {
    ...config,
    onError: (error) => {
      console.error(`Subscription error for ${config.id}:`, error);

      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`Retrying subscription ${config.id} (attempt ${retryCount}/${maxRetries})`);

        setTimeout(() => {
          // Unsubscribe current and retry
          realtimeManager.unsubscribe(config.id);
          realtimeManager.subscribe(retryableConfig);
        }, retryDelay * retryCount);
      } else {
        console.error(`Max retries reached for subscription ${config.id}`);
        originalOnError?.(error);
      }
    },
  };

  return realtimeManager.subscribe(retryableConfig);
}

// ============================================================================
// REACT HOOKS (if using React)
// ============================================================================

/**
 * React hook for managing real-time subscriptions with automatic cleanup
 * Note: This would typically be in a separate hooks file, but included here for completeness
 */
export function useRealtimeSubscription<T extends Record<string, any>>(
  config: SubscriptionConfig<T> | null,
  deps: any[] = []
): {
  subscription: RealtimeSubscription | null;
  isConnected: boolean;
  error: any;
} {
  // This is a placeholder for React hook implementation
  // In a real React app, you would use useEffect and useState here

  return {
    subscription: config ? realtimeManager.subscribe(config) : null,
    isConnected: config ? realtimeManager.isSubscribed(config.id) : false,
    error: null,
  };
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default realtimeManager;
