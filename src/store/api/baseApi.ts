// ============================================================================
// RTK QUERY BASE API CONFIGURATION
// ============================================================================
// Base API configuration with Supabase integration, authentication,
// error handling, and offline queue management

import { createApi, fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ENV_CONFIG, API_CONFIG } from "../../config/constants";
import { getTokens, storeTokens, clearTokens, areTokensExpired } from "../../utils/storage";
import { logger } from "../../utils/logger";
import type { RootState } from "../index";

// ============================================================================
// SUPABASE CLIENT CONFIGURATION
// ============================================================================

let supabaseClient: SupabaseClient | null = null;

const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseClient) {
    supabaseClient = createClient(ENV_CONFIG.supabaseUrl, ENV_CONFIG.supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false, // We handle persistence manually
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return supabaseClient;
};

// ============================================================================
// CUSTOM BASE QUERY WITH AUTHENTICATION
// ============================================================================

interface CustomBaseQueryArgs extends FetchArgs {
  requiresAuth?: boolean;
  retryOnAuthFailure?: boolean;
}

const baseQueryWithAuth: BaseQueryFn<CustomBaseQueryArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  const { requiresAuth = true, retryOnAuthFailure = true, ...fetchArgs } = args;

  // Get current state for user context
  const state = api.getState() as RootState;
  const userId = (state as any).auth?.user?.id;

  // Create base query with Supabase configuration
  const baseQuery = fetchBaseQuery({
    baseUrl: API_CONFIG.baseUrl,
    timeout: API_CONFIG.timeout,
    prepareHeaders: async (headers, { getState }) => {
      const state = getState() as RootState;

      // Set content type
      headers.set("Content-Type", "application/json");

      // Add authentication headers if required
      if (requiresAuth) {
        try {
          const tokens = await getTokens();

          if (tokens) {
            // Check if tokens are expired
            const expired = await areTokensExpired();

            if (expired) {
              logger.warn("Access token expired, attempting refresh", undefined, "api", userId);

              // Attempt to refresh token using Supabase
              const supabase = getSupabaseClient();
              const { data, error } = await supabase.auth.refreshSession({
                refresh_token: tokens.refreshToken,
              });

              if (error || !data.session) {
                logger.error("Token refresh failed", error, "api", userId);
                await clearTokens();
                // Dispatch logout action
                api.dispatch({ type: "auth/logout" });
                throw new Error("Authentication failed");
              }

              // Store new tokens
              await storeTokens({
                accessToken: data.session.access_token,
                refreshToken: data.session.refresh_token,
                expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
              });

              headers.set("Authorization", `Bearer ${data.session.access_token}`);
              logger.info("Token refreshed successfully", undefined, "api", userId);
            } else {
              headers.set("Authorization", `Bearer ${tokens.accessToken}`);
            }
          } else if (requiresAuth) {
            logger.warn("No authentication tokens found", undefined, "api", userId);
            throw new Error("No authentication tokens");
          }
        } catch (error) {
          logger.error("Authentication header preparation failed", error, "api", userId);
          if (requiresAuth) {
            throw error;
          }
        }
      }

      // Add user context headers
      if (userId) {
        headers.set("X-User-ID", userId);
      }

      // Add request ID for tracing
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      headers.set("X-Request-ID", requestId);

      return headers;
    },
  });

  // Execute the query
  const startTime = Date.now();
  let result = await baseQuery(fetchArgs, api, extraOptions);
  const duration = Date.now() - startTime;

  // Log the request
  const url = typeof fetchArgs.url === "string" ? fetchArgs.url : String(fetchArgs.url);
  const requestId =
    typeof fetchArgs.headers === "object" && fetchArgs.headers && "X-Request-ID" in fetchArgs.headers
      ? (fetchArgs.headers as any)["X-Request-ID"]
      : undefined;

  logger.networkRequest(
    fetchArgs.method || "GET",
    url,
    result.error ? (result.error as any).status : 200,
    duration,
    {
      requiresAuth,
      userId,
      requestId,
    },
    userId
  );

  // Handle authentication errors
  if (result.error && (result.error as any).status === 401 && retryOnAuthFailure && requiresAuth) {
    logger.warn("Received 401, attempting token refresh and retry", undefined, "api", userId);

    try {
      // Clear potentially invalid tokens
      await clearTokens();

      // Dispatch logout to clear auth state
      api.dispatch({ type: "auth/logout" });

      logger.info("User logged out due to authentication failure", undefined, "api", userId);
    } catch (error) {
      logger.error("Error during authentication failure cleanup", error, "api", userId);
    }
  }

  // Handle network errors for offline queue
  if (result.error && !navigator.onLine) {
    logger.warn("Network request failed while offline", result.error, "api", userId);

    // Add to offline queue if it's a mutation
    if (fetchArgs.method && ["POST", "PUT", "PATCH", "DELETE"].includes(fetchArgs.method)) {
      api.dispatch({
        type: "offline/addToQueue",
        payload: {
          id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          request: fetchArgs,
          timestamp: Date.now(),
          retryCount: 0,
        },
      });
    }
  }

  return result;
};

// ============================================================================
// RTK QUERY API DEFINITION
// ============================================================================

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithAuth,
  tagTypes: [
    // Authentication
    "User",
    "Session",

    // Workouts
    "WorkoutPlan",
    "WorkoutSession",
    "Exercise",
    "ExerciseSet",

    // Progress
    "ProgressMetrics",
    "PersonalRecord",
    "StrengthData",

    // AI Coaching
    "AIConversation",
    "MonthlyReview",
    "AIUsage",

    // Subscriptions
    "Subscription",
    "SubscriptionPlan",
    "PaymentHistory",

    // User Data
    "UserProfile",
    "UserPreferences",
  ],
  endpoints: (builder) => ({
    // ========================================================================
    // AUTHENTICATION ENDPOINTS
    // ========================================================================

    login: builder.mutation<{ user: any; session: any }, { email: string; password: string }>({
      query: (credentials) => ({
        url: API_CONFIG.endpoints.auth.login,
        method: "POST",
        body: credentials,
        requiresAuth: false,
      }),
      invalidatesTags: ["User", "Session"],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;

          // Store tokens securely
          await storeTokens({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: new Date(data.session.expires_at * 1000).toISOString(),
          });

          logger.info("User logged in successfully", { userId: data.user.id }, "auth", data.user.id);
        } catch (error) {
          logger.error("Login failed", error, "auth");
        }
      },
    }),

    signup: builder.mutation<{ user: any; session: any }, { email: string; password: string; profile: any }>({
      query: (signupData) => ({
        url: API_CONFIG.endpoints.auth.signup,
        method: "POST",
        body: signupData,
        requiresAuth: false,
      }),
      invalidatesTags: ["User", "Session"],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;

          // Store tokens securely
          await storeTokens({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: new Date(data.session.expires_at * 1000).toISOString(),
          });

          logger.info("User signed up successfully", { userId: data.user.id }, "auth", data.user.id);
        } catch (error) {
          logger.error("Signup failed", error, "auth");
        }
      },
    }),

    logout: builder.mutation<void, void>({
      query: () => ({
        url: API_CONFIG.endpoints.auth.logout,
        method: "POST",
      }),
      invalidatesTags: ["User", "Session"],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          await clearTokens();
          logger.info("User logged out successfully", undefined, "auth");
        } catch (error) {
          // Clear tokens even if logout request fails
          await clearTokens();
          logger.warn("Logout request failed, but tokens cleared", error, "auth");
        }
      },
    }),

    refreshToken: builder.mutation<{ session: any }, { refreshToken: string }>({
      query: (tokenData) => ({
        url: API_CONFIG.endpoints.auth.refresh,
        method: "POST",
        body: tokenData,
        requiresAuth: false,
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;

          await storeTokens({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: new Date(data.session.expires_at * 1000).toISOString(),
          });

          logger.info("Token refreshed successfully", undefined, "auth");
        } catch (error) {
          logger.error("Token refresh failed", error, "auth");
          await clearTokens();
        }
      },
    }),

    // ========================================================================
    // USER PROFILE ENDPOINTS
    // ========================================================================

    getUserProfile: builder.query<any, string>({
      query: (userId) => ({
        url: `${API_CONFIG.endpoints.user.profile}/${userId}`,
        method: "GET",
      }),
      providesTags: ["UserProfile"],
    }),

    updateUserProfile: builder.mutation<any, { userId: string; updates: any }>({
      query: ({ userId, updates }) => ({
        url: `${API_CONFIG.endpoints.user.profile}/${userId}`,
        method: "PUT",
        body: updates,
      }),
      invalidatesTags: ["UserProfile"],
    }),

    // ========================================================================
    // WORKOUT ENDPOINTS
    // ========================================================================

    getWorkoutPlans: builder.query<any[], void>({
      query: () => ({
        url: API_CONFIG.endpoints.workouts.plans,
        method: "GET",
      }),
      providesTags: ["WorkoutPlan"],
    }),

    getWorkoutSessions: builder.query<any[], { startDate?: string; endDate?: string; limit?: number }>({
      query: (params) => ({
        url: API_CONFIG.endpoints.workouts.sessions,
        method: "GET",
        params,
      }),
      providesTags: ["WorkoutSession"],
    }),

    createWorkoutSession: builder.mutation<any, any>({
      query: (sessionData) => ({
        url: API_CONFIG.endpoints.workouts.sessions,
        method: "POST",
        body: sessionData,
      }),
      invalidatesTags: ["WorkoutSession", "ProgressMetrics"],
    }),

    updateWorkoutSession: builder.mutation<any, { sessionId: string; updates: any }>({
      query: ({ sessionId, updates }) => ({
        url: `${API_CONFIG.endpoints.workouts.sessions}/${sessionId}`,
        method: "PUT",
        body: updates,
      }),
      invalidatesTags: ["WorkoutSession", "ProgressMetrics"],
    }),

    syncWorkoutSessions: builder.mutation<any, { sessions: any[] }>({
      query: (syncData) => ({
        url: API_CONFIG.endpoints.workouts.sync,
        method: "POST",
        body: syncData,
      }),
      invalidatesTags: ["WorkoutSession", "ProgressMetrics"],
    }),

    // ========================================================================
    // AI COACHING ENDPOINTS
    // ========================================================================

    sendAIQuery: builder.mutation<any, { query: string; context?: any }>({
      query: (queryData) => ({
        url: API_CONFIG.endpoints.ai.query,
        method: "POST",
        body: queryData,
      }),
      invalidatesTags: ["AIConversation", "AIUsage"],
    }),

    getAIConversations: builder.query<any[], { limit?: number; offset?: number }>({
      query: (params) => ({
        url: API_CONFIG.endpoints.ai.conversations,
        method: "GET",
        params,
      }),
      providesTags: ["AIConversation"],
    }),

    getMonthlyReview: builder.query<any, { month: string }>({
      query: ({ month }) => ({
        url: `${API_CONFIG.endpoints.ai.monthlyReview}/${month}`,
        method: "GET",
      }),
      providesTags: ["MonthlyReview"],
    }),

    getAIUsage: builder.query<any, void>({
      query: () => ({
        url: API_CONFIG.endpoints.ai.usage,
        method: "GET",
      }),
      providesTags: ["AIUsage"],
    }),

    // ========================================================================
    // SUBSCRIPTION ENDPOINTS
    // ========================================================================

    getSubscriptionPlans: builder.query<any[], void>({
      query: () => ({
        url: API_CONFIG.endpoints.subscriptions.plans,
        method: "GET",
        requiresAuth: false,
      }),
      providesTags: ["SubscriptionPlan"],
    }),

    createSubscription: builder.mutation<any, { planId: string; paymentMethodId?: string }>({
      query: (subscriptionData) => ({
        url: API_CONFIG.endpoints.subscriptions.subscribe,
        method: "POST",
        body: subscriptionData,
      }),
      invalidatesTags: ["Subscription"],
    }),

    cancelSubscription: builder.mutation<any, { subscriptionId: string }>({
      query: ({ subscriptionId }) => ({
        url: `${API_CONFIG.endpoints.subscriptions.cancel}/${subscriptionId}`,
        method: "POST",
      }),
      invalidatesTags: ["Subscription"],
    }),
  }),
});

// ============================================================================
// EXPORT HOOKS
// ============================================================================

// Authentication hooks
export const { useLoginMutation, useSignupMutation, useLogoutMutation, useRefreshTokenMutation } = baseApi;

// User profile hooks
export const { useGetUserProfileQuery, useUpdateUserProfileMutation } = baseApi;

// Workout hooks
export const {
  useGetWorkoutPlansQuery,
  useGetWorkoutSessionsQuery,
  useCreateWorkoutSessionMutation,
  useUpdateWorkoutSessionMutation,
  useSyncWorkoutSessionsMutation,
} = baseApi;

// AI coaching hooks
export const { useSendAIQueryMutation, useGetAIConversationsQuery, useGetMonthlyReviewQuery, useGetAIUsageQuery } =
  baseApi;

// Subscription hooks
export const { useGetSubscriptionPlansQuery, useCreateSubscriptionMutation, useCancelSubscriptionMutation } = baseApi;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Reset API cache (useful for logout)
 */
export const resetApiCache = () => {
  return baseApi.util.resetApiState();
};

/**
 * Prefetch data for better UX
 */
export const prefetchWorkoutData = (dispatch: any, userId: string) => {
  dispatch(baseApi.util.prefetch("getWorkoutPlans", undefined, { force: false }));
  dispatch(baseApi.util.prefetch("getWorkoutSessions", { limit: 10 }, { force: false }));
  dispatch(baseApi.util.prefetch("getUserProfile", userId, { force: false }));
};

/**
 * Invalidate specific tags
 */
export const invalidateWorkoutData = (dispatch: any) => {
  dispatch(baseApi.util.invalidateTags(["WorkoutSession", "ProgressMetrics"]));
};

export default baseApi;
