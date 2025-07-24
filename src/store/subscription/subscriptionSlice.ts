// ============================================================================
// SUBSCRIPTION SLICE
// ============================================================================
// Subscription and billing state management with Stripe integration,
// plan management, and payment processing

import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { logger } from "../../utils/logger";
import type {
  SubscriptionState,
  Subscription,
  SubscriptionPlan,
  PaymentHistory,
  SubscriptionStatus,
} from "../../types";

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: SubscriptionState = {
  currentSubscription: null,
  availablePlans: [],
  paymentHistory: [],
  loading: false,
  error: undefined,
};

// ============================================================================
// ASYNC THUNKS
// ============================================================================

/**
 * Load available subscription plans
 */
export const loadSubscriptionPlans = createAsyncThunk("subscription/loadPlans", async (_, { rejectWithValue }) => {
  try {
    logger.info("Loading subscription plans", undefined, "subscription");

    // This would typically fetch from API
    // For now, return mock data based on the app specification
    const plans: SubscriptionPlan[] = [
      {
        id: "free",
        name: "Free",
        description: "Basic workout tracking with limited AI coaching",
        priceCents: 0,
        interval: "month",
        stripePriceId: "",
        features: [
          "Unlimited workout logging",
          "Basic progression tracking",
          "One pre-built program",
          "2 AI coaching conversations per month",
          "Basic progress charts",
          "Exercise form notes",
        ],
        maxAiQueries: 2,
        maxCustomWorkouts: 0,
        maxClients: 0,
        isActive: true,
        sortOrder: 1,
        createdAt: new Date().toISOString(),
      },
      {
        id: "premium_monthly",
        name: "Premium",
        description: "Full access to all features with unlimited AI coaching",
        priceCents: 999, // $9.99
        interval: "month",
        stripePriceId: "price_premium_monthly",
        features: [
          "All free features",
          "All pre-built programs",
          "Unlimited AI coaching conversations",
          "Automated monthly AI progress reviews",
          "Advanced analytics and strength tracking",
          "Custom program builder",
          "Data export and backup",
          "Priority customer support",
        ],
        maxAiQueries: -1, // Unlimited
        maxCustomWorkouts: -1, // Unlimited
        maxClients: 0,
        isActive: true,
        sortOrder: 2,
        createdAt: new Date().toISOString(),
      },
      {
        id: "premium_yearly",
        name: "Premium (Yearly)",
        description: "Full access with 2 months free when billed annually",
        priceCents: 7999, // $79.99 (2 months free)
        interval: "year",
        stripePriceId: "price_premium_yearly",
        features: ["All Premium features", "2 months free (save 17%)", "Priority feature requests"],
        maxAiQueries: -1, // Unlimited
        maxCustomWorkouts: -1, // Unlimited
        maxClients: 0,
        isActive: true,
        sortOrder: 3,
        createdAt: new Date().toISOString(),
      },
      {
        id: "coach",
        name: "Coach",
        description: "For fitness professionals managing multiple clients",
        priceCents: 2999, // $29.99
        interval: "month",
        stripePriceId: "price_coach_monthly",
        features: [
          "All Premium features",
          "Manage up to 50 clients",
          "Client progress dashboard",
          "Custom program templates",
          "Bulk program assignment",
          "Client communication tools",
          "Revenue analytics",
          "White-label options",
        ],
        maxAiQueries: -1, // Unlimited
        maxCustomWorkouts: -1, // Unlimited
        maxClients: 50,
        isActive: true,
        sortOrder: 4,
        createdAt: new Date().toISOString(),
      },
    ];

    logger.info("Subscription plans loaded", { count: plans.length }, "subscription");
    return plans;
  } catch (error) {
    logger.error("Failed to load subscription plans", error, "subscription");
    return rejectWithValue("Failed to load subscription plans");
  }
});

/**
 * Load current user subscription
 */
export const loadCurrentSubscription = createAsyncThunk(
  "subscription/loadCurrent",
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as any;
      const userId = state.auth.user?.id;

      if (!userId) {
        return rejectWithValue("User not authenticated");
      }

      logger.info("Loading current subscription", undefined, "subscription", userId);

      // This would typically fetch from API/Supabase
      // For now, return null (free tier)
      const subscription: Subscription | null = null;

      logger.info("Current subscription loaded", { hasSubscription: !!subscription }, "subscription", userId);
      return subscription;
    } catch (error) {
      logger.error("Failed to load current subscription", error, "subscription");
      return rejectWithValue("Failed to load current subscription");
    }
  }
);

/**
 * Create new subscription
 */
export const createSubscription = createAsyncThunk(
  "subscription/create",
  async (
    data: {
      planId: string;
      paymentMethodId?: string;
    },
    { rejectWithValue, getState }
  ) => {
    try {
      const { planId, paymentMethodId } = data;
      const state = getState() as any;
      const userId = state.auth.user?.id;

      if (!userId) {
        return rejectWithValue("User not authenticated");
      }

      logger.info("Creating subscription", { planId }, "subscription", userId);

      // This would typically call Stripe API via Edge Function
      // For now, simulate subscription creation
      const newSubscription: Subscription = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        planId,
        stripeSubscriptionId: `stripe_sub_${Date.now()}`,
        stripeCustomerId: `stripe_cus_${Date.now()}`,
        status: "active",
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        cancelAtPeriodEnd: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      logger.info("Subscription created successfully", { subscriptionId: newSubscription.id }, "subscription", userId);
      return newSubscription;
    } catch (error) {
      logger.error("Failed to create subscription", error, "subscription");
      return rejectWithValue("Failed to create subscription");
    }
  }
);

/**
 * Update subscription (change plan, cancel, etc.)
 */
export const updateSubscription = createAsyncThunk(
  "subscription/update",
  async (
    data: {
      subscriptionId: string;
      updates: {
        planId?: string;
        cancelAtPeriodEnd?: boolean;
      };
    },
    { rejectWithValue, getState }
  ) => {
    try {
      const { subscriptionId, updates } = data;
      const state = getState() as any;
      const userId = state.auth.user?.id;
      const currentSubscription = state.subscription.currentSubscription;

      if (!userId) {
        return rejectWithValue("User not authenticated");
      }

      if (!currentSubscription || currentSubscription.id !== subscriptionId) {
        return rejectWithValue("Subscription not found");
      }

      logger.info("Updating subscription", { subscriptionId, updates }, "subscription", userId);

      // This would typically call Stripe API via Edge Function
      const updatedSubscription: Subscription = {
        ...currentSubscription,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      logger.info("Subscription updated successfully", { subscriptionId }, "subscription", userId);
      return updatedSubscription;
    } catch (error) {
      logger.error("Failed to update subscription", error, "subscription");
      return rejectWithValue("Failed to update subscription");
    }
  }
);

/**
 * Cancel subscription
 */
export const cancelSubscription = createAsyncThunk(
  "subscription/cancel",
  async (
    data: {
      subscriptionId: string;
      cancelImmediately?: boolean;
    },
    { rejectWithValue, getState }
  ) => {
    try {
      const { subscriptionId, cancelImmediately = false } = data;
      const state = getState() as any;
      const userId = state.auth.user?.id;
      const currentSubscription = state.subscription.currentSubscription;

      if (!userId) {
        return rejectWithValue("User not authenticated");
      }

      if (!currentSubscription || currentSubscription.id !== subscriptionId) {
        return rejectWithValue("Subscription not found");
      }

      logger.info("Canceling subscription", { subscriptionId, cancelImmediately }, "subscription", userId);

      // This would typically call Stripe API via Edge Function
      const canceledSubscription: Subscription = {
        ...currentSubscription,
        status: cancelImmediately ? "canceled" : "active",
        cancelAtPeriodEnd: !cancelImmediately,
        canceledAt: cancelImmediately ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString(),
      };

      logger.info(
        "Subscription canceled successfully",
        { subscriptionId, immediate: cancelImmediately },
        "subscription",
        userId
      );
      return canceledSubscription;
    } catch (error) {
      logger.error("Failed to cancel subscription", error, "subscription");
      return rejectWithValue("Failed to cancel subscription");
    }
  }
);

/**
 * Load payment history
 */
export const loadPaymentHistory = createAsyncThunk(
  "subscription/loadPaymentHistory",
  async (
    data: {
      limit?: number;
      offset?: number;
    } = {},
    { rejectWithValue, getState }
  ) => {
    try {
      const { limit = 10, offset = 0 } = data;
      const state = getState() as any;
      const userId = state.auth.user?.id;

      if (!userId) {
        return rejectWithValue("User not authenticated");
      }

      logger.info("Loading payment history", { limit, offset }, "subscription", userId);

      // This would typically fetch from API/Supabase
      // For now, return empty array
      const paymentHistory: PaymentHistory[] = [];

      logger.info("Payment history loaded", { count: paymentHistory.length }, "subscription", userId);
      return paymentHistory;
    } catch (error) {
      logger.error("Failed to load payment history", error, "subscription");
      return rejectWithValue("Failed to load payment history");
    }
  }
);

/**
 * Retry failed payment
 */
export const retryFailedPayment = createAsyncThunk(
  "subscription/retryPayment",
  async (
    data: {
      paymentIntentId: string;
      paymentMethodId?: string;
    },
    { rejectWithValue, getState }
  ) => {
    try {
      const { paymentIntentId, paymentMethodId } = data;
      const state = getState() as any;
      const userId = state.auth.user?.id;

      if (!userId) {
        return rejectWithValue("User not authenticated");
      }

      logger.info("Retrying failed payment", { paymentIntentId }, "subscription", userId);

      // This would typically call Stripe API via Edge Function
      // For now, simulate successful retry
      const result = {
        success: true,
        paymentIntentId,
        status: "succeeded",
      };

      logger.info("Payment retry successful", { paymentIntentId }, "subscription", userId);
      return result;
    } catch (error) {
      logger.error("Failed to retry payment", error, "subscription");
      return rejectWithValue("Failed to retry payment");
    }
  }
);

// ============================================================================
// SUBSCRIPTION SLICE
// ============================================================================

const subscriptionSlice = createSlice({
  name: "subscription",
  initialState,
  reducers: {
    // Clear subscription data (for logout)
    clearSubscriptionData: (state) => {
      state.currentSubscription = null;
      state.paymentHistory = [];
      state.loading = false;
      state.error = undefined;
      logger.info("Subscription data cleared", undefined, "subscription");
    },

    // Set loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    // Clear error
    clearError: (state) => {
      state.error = undefined;
    },

    // Update subscription status (from webhooks)
    updateSubscriptionStatus: (
      state,
      action: PayloadAction<{
        subscriptionId: string;
        status: SubscriptionStatus;
        currentPeriodEnd?: string;
      }>
    ) => {
      const { subscriptionId, status, currentPeriodEnd } = action.payload;

      if (state.currentSubscription && state.currentSubscription.stripeSubscriptionId === subscriptionId) {
        state.currentSubscription.status = status;
        if (currentPeriodEnd) {
          state.currentSubscription.currentPeriodEnd = currentPeriodEnd;
        }
        state.currentSubscription.updatedAt = new Date().toISOString();

        logger.info("Subscription status updated", { subscriptionId, status }, "subscription");
      }
    },

    // Add payment to history
    addPaymentToHistory: (state, action: PayloadAction<PaymentHistory>) => {
      state.paymentHistory.unshift(action.payload);

      // Keep only last 50 payments in memory
      if (state.paymentHistory.length > 50) {
        state.paymentHistory = state.paymentHistory.slice(0, 50);
      }

      logger.info("Payment added to history", { paymentId: action.payload.id }, "subscription");
    },
  },
  extraReducers: (builder) => {
    // Load Subscription Plans
    builder
      .addCase(loadSubscriptionPlans.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(loadSubscriptionPlans.fulfilled, (state, action) => {
        state.loading = false;
        state.availablePlans = action.payload;
      })
      .addCase(loadSubscriptionPlans.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Load Current Subscription
    builder
      .addCase(loadCurrentSubscription.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(loadCurrentSubscription.fulfilled, (state, action) => {
        state.loading = false;
        state.currentSubscription = action.payload;
      })
      .addCase(loadCurrentSubscription.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Create Subscription
    builder
      .addCase(createSubscription.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(createSubscription.fulfilled, (state, action) => {
        state.loading = false;
        state.currentSubscription = action.payload;
      })
      .addCase(createSubscription.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Update Subscription
    builder
      .addCase(updateSubscription.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(updateSubscription.fulfilled, (state, action) => {
        state.loading = false;
        state.currentSubscription = action.payload;
      })
      .addCase(updateSubscription.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Cancel Subscription
    builder
      .addCase(cancelSubscription.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(cancelSubscription.fulfilled, (state, action) => {
        state.loading = false;
        state.currentSubscription = action.payload;
      })
      .addCase(cancelSubscription.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Load Payment History
    builder
      .addCase(loadPaymentHistory.pending, (state) => {
        // Don't set loading for payment history to avoid UI flicker
      })
      .addCase(loadPaymentHistory.fulfilled, (state, action) => {
        state.paymentHistory = action.payload;
      })
      .addCase(loadPaymentHistory.rejected, (state, action) => {
        logger.error("Load payment history failed", action.payload, "subscription");
      });

    // Retry Failed Payment
    builder
      .addCase(retryFailedPayment.pending, (state) => {
        state.loading = true;
        state.error = undefined;
      })
      .addCase(retryFailedPayment.fulfilled, (state, action) => {
        state.loading = false;
        // Payment retry successful - subscription status will be updated via webhook
      })
      .addCase(retryFailedPayment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

// ============================================================================
// ACTIONS AND SELECTORS
// ============================================================================

export const { clearSubscriptionData, setLoading, clearError, updateSubscriptionStatus, addPaymentToHistory } =
  subscriptionSlice.actions;

// Selectors
export const selectSubscription = (state: { subscription: SubscriptionState }) => state.subscription;
export const selectCurrentSubscription = (state: { subscription: SubscriptionState }) =>
  state.subscription.currentSubscription;
export const selectAvailablePlans = (state: { subscription: SubscriptionState }) => state.subscription.availablePlans;
export const selectPaymentHistory = (state: { subscription: SubscriptionState }) => state.subscription.paymentHistory;
export const selectSubscriptionLoading = (state: { subscription: SubscriptionState }) => state.subscription.loading;
export const selectSubscriptionError = (state: { subscription: SubscriptionState }) => state.subscription.error;

// Computed selectors
export const selectIsSubscribed = (state: { subscription: SubscriptionState }) => {
  const subscription = state.subscription.currentSubscription;
  return subscription && subscription.status === "active" && !subscription.cancelAtPeriodEnd;
};

export const selectIsPremium = (state: { subscription: SubscriptionState }) => {
  const subscription = state.subscription.currentSubscription;
  if (!subscription || subscription.status !== "active") return false;

  const plan = state.subscription.availablePlans.find((p) => p.id === subscription.planId);
  return plan && plan.id !== "free";
};

export const selectIsCoach = (state: { subscription: SubscriptionState }) => {
  const subscription = state.subscription.currentSubscription;
  if (!subscription || subscription.status !== "active") return false;

  const plan = state.subscription.availablePlans.find((p) => p.id === subscription.planId);
  return plan && plan.id === "coach";
};

export const selectCurrentPlan = (state: { subscription: SubscriptionState }) => {
  const subscription = state.subscription.currentSubscription;
  if (!subscription) {
    // Return free plan as default
    return state.subscription.availablePlans.find((p) => p.id === "free") || null;
  }

  return state.subscription.availablePlans.find((p) => p.id === subscription.planId) || null;
};

export const selectSubscriptionFeatures = (state: { subscription: SubscriptionState }) => {
  const currentPlan = selectCurrentPlan(state);
  return currentPlan?.features || [];
};

export const selectAiQueryLimit = (state: { subscription: SubscriptionState }) => {
  const currentPlan = selectCurrentPlan(state);
  return currentPlan?.maxAiQueries || 0;
};

export const selectHasUnlimitedAi = (state: { subscription: SubscriptionState }) => {
  const currentPlan = selectCurrentPlan(state);
  return currentPlan?.maxAiQueries === -1;
};

export const selectDaysUntilRenewal = (state: { subscription: SubscriptionState }) => {
  const subscription = state.subscription.currentSubscription;
  if (!subscription || subscription.status !== "active") return null;

  const endDate = new Date(subscription.currentPeriodEnd);
  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
};

export const selectIsTrialing = (state: { subscription: SubscriptionState }) => {
  const subscription = state.subscription.currentSubscription;
  return subscription?.status === "trialing";
};

export const selectIsCanceled = (state: { subscription: SubscriptionState }) => {
  const subscription = state.subscription.currentSubscription;
  return subscription?.status === "canceled" || subscription?.cancelAtPeriodEnd;
};

export const selectHasPaymentIssues = (state: { subscription: SubscriptionState }) => {
  const subscription = state.subscription.currentSubscription;
  return subscription?.status === "past_due" || subscription?.status === "unpaid";
};

export const selectPlanById = (planId: string) => (state: { subscription: SubscriptionState }) =>
  state.subscription.availablePlans.find((plan) => plan.id === planId);

export const selectRecentPayments =
  (limit: number = 5) =>
  (state: { subscription: SubscriptionState }) =>
    state.subscription.paymentHistory.slice(0, limit);

export const selectFailedPayments = (state: { subscription: SubscriptionState }) =>
  state.subscription.paymentHistory.filter(
    (payment) => payment.status === "failed" || payment.status === "requires_payment_method"
  );

export default subscriptionSlice.reducer;
