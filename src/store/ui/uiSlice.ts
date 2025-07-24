// ============================================================================
// UI SLICE
// ============================================================================
// UI state management for modals, loading states, theme, network status,
// and global UI interactions

import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { logger } from "../../utils/logger";
import type { UIState, Notification, NotificationAction } from "../../types";

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: UIState = {
  theme: "light",
  networkStatus: "online",
  loading: {
    global: false,
    workout: false,
    progress: false,
    subscription: false,
  },
  modals: {
    isWorkoutModalOpen: false,
    isProgressModalOpen: false,
    isSettingsModalOpen: false,
  },
  error: undefined,
  notifications: [],
};

// ============================================================================
// UI SLICE
// ============================================================================

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    // Theme management
    setTheme: (state, action: PayloadAction<"light" | "dark">) => {
      state.theme = action.payload;
      logger.info("Theme changed", { theme: action.payload }, "ui");
    },

    toggleTheme: (state) => {
      state.theme = state.theme === "light" ? "dark" : "light";
      logger.info("Theme toggled", { newTheme: state.theme }, "ui");
    },

    // Network status management
    setNetworkStatus: (state, action: PayloadAction<"online" | "offline">) => {
      const previousStatus = state.networkStatus;
      state.networkStatus = action.payload;

      if (previousStatus !== action.payload) {
        logger.info(
          "Network status changed",
          {
            from: previousStatus,
            to: action.payload,
          },
          "ui"
        );

        // Add notification for network status changes
        if (action.payload === "offline") {
          state.notifications.push({
            id: `network_${Date.now()}`,
            type: "warning",
            title: "You're Offline",
            message: "Your workouts are saved locally and will sync when you're back online.",
            duration: 5000,
            createdAt: new Date().toISOString(),
          });
        } else if (action.payload === "online" && previousStatus === "offline") {
          state.notifications.push({
            id: `network_${Date.now()}`,
            type: "success",
            title: "Back Online",
            message: "Connection restored. Syncing your data...",
            duration: 3000,
            createdAt: new Date().toISOString(),
          });
        }
      }
    },

    // Global loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.global = action.payload;
    },

    // Global error state
    setError: (state, action: PayloadAction<string | undefined>) => {
      state.error = action.payload;

      if (action.payload) {
        logger.error("Global error set", action.payload, "ui");

        // Add error notification
        state.notifications.push({
          id: `error_${Date.now()}`,
          type: "error",
          title: "Something went wrong",
          message: action.payload,
          duration: 8000,
          createdAt: new Date().toISOString(),
        });
      }
    },

    clearError: (state) => {
      state.error = undefined;
    },

    // Notification management
    addNotification: (state, action: PayloadAction<Omit<Notification, "id" | "createdAt">>) => {
      const notification: Notification = {
        ...action.payload,
        id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
      };

      state.notifications.push(notification);

      logger.info(
        "Notification added",
        {
          type: notification.type,
          title: notification.title,
        },
        "ui"
      );

      // Auto-remove notification after duration
      if (notification.duration && notification.duration > 0) {
        // This would typically be handled by the UI component
        // The slice just manages the state
      }
    },

    removeNotification: (state, action: PayloadAction<string>) => {
      const notificationId = action.payload;
      state.notifications = state.notifications.filter((n) => n.id !== notificationId);

      logger.info("Notification removed", { notificationId }, "ui");
    },

    clearAllNotifications: (state) => {
      const count = state.notifications.length;
      state.notifications = [];

      if (count > 0) {
        logger.info("All notifications cleared", { count }, "ui");
      }
    },

    // Success notification helper
    showSuccessNotification: (state, action: PayloadAction<{ title: string; message: string; duration?: number }>) => {
      const { title, message, duration = 4000 } = action.payload;

      const notification: Notification = {
        id: `success_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: "success",
        title,
        message,
        duration,
        createdAt: new Date().toISOString(),
      };

      state.notifications.push(notification);
      logger.info("Success notification shown", { title }, "ui");
    },

    // Error notification helper
    showErrorNotification: (state, action: PayloadAction<{ title: string; message: string; duration?: number }>) => {
      const { title, message, duration = 6000 } = action.payload;

      const notification: Notification = {
        id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: "error",
        title,
        message,
        duration,
        createdAt: new Date().toISOString(),
      };

      state.notifications.push(notification);
      logger.error("Error notification shown", { title, message }, "ui");
    },

    // Warning notification helper
    showWarningNotification: (state, action: PayloadAction<{ title: string; message: string; duration?: number }>) => {
      const { title, message, duration = 5000 } = action.payload;

      const notification: Notification = {
        id: `warning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: "warning",
        title,
        message,
        duration,
        createdAt: new Date().toISOString(),
      };

      state.notifications.push(notification);
      logger.warn("Warning notification shown", { title, message }, "ui");
    },

    // Info notification helper
    showInfoNotification: (state, action: PayloadAction<{ title: string; message: string; duration?: number }>) => {
      const { title, message, duration = 4000 } = action.payload;

      const notification: Notification = {
        id: `info_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: "info",
        title,
        message,
        duration,
        createdAt: new Date().toISOString(),
      };

      state.notifications.push(notification);
      logger.info("Info notification shown", { title }, "ui");
    },

    // Workout-specific notifications
    showWorkoutStartedNotification: (state, action: PayloadAction<{ workoutName: string }>) => {
      const { workoutName } = action.payload;

      const notification: Notification = {
        id: `workout_started_${Date.now()}`,
        type: "success",
        title: "Workout Started",
        message: `${workoutName} is now in progress. Good luck!`,
        duration: 3000,
        createdAt: new Date().toISOString(),
      };

      state.notifications.push(notification);
      logger.info("Workout started notification shown", { workoutName }, "ui");
    },

    showWorkoutCompletedNotification: (
      state,
      action: PayloadAction<{
        workoutName: string;
        duration: number;
        volume?: number;
      }>
    ) => {
      const { workoutName, duration, volume } = action.payload;

      let message = `Great job! You completed ${workoutName} in ${duration} minutes.`;
      if (volume) {
        message += ` Total volume: ${volume}kg.`;
      }

      const notification: Notification = {
        id: `workout_completed_${Date.now()}`,
        type: "success",
        title: "Workout Complete! 🎉",
        message,
        duration: 6000,
        createdAt: new Date().toISOString(),
      };

      state.notifications.push(notification);
      logger.info("Workout completed notification shown", { workoutName, duration }, "ui");
    },

    showPersonalRecordNotification: (
      state,
      action: PayloadAction<{
        exerciseName: string;
        recordType: string;
        value: number;
      }>
    ) => {
      const { exerciseName, recordType, value } = action.payload;

      const notification: Notification = {
        id: `pr_${Date.now()}`,
        type: "success",
        title: "New Personal Record! 🏆",
        message: `${exerciseName}: ${recordType} - ${value}${recordType === "1rm" ? "kg" : ""}`,
        duration: 8000,
        createdAt: new Date().toISOString(),
      };

      state.notifications.push(notification);
      logger.info("Personal record notification shown", { exerciseName, recordType, value }, "ui");
    },

    // Progression notifications
    showProgressionRecommendationNotification: (
      state,
      action: PayloadAction<{
        exerciseName: string;
        shouldProgress: boolean;
        reason: string;
      }>
    ) => {
      const { exerciseName, shouldProgress, reason } = action.payload;

      const notification: Notification = {
        id: `progression_${Date.now()}`,
        type: shouldProgress ? "success" : "info",
        title: shouldProgress ? "Ready to Progress! 📈" : "Keep Current Weight",
        message: `${exerciseName}: ${reason}`,
        duration: 6000,
        createdAt: new Date().toISOString(),
      };

      state.notifications.push(notification);
      logger.info(
        "Progression recommendation notification shown",
        {
          exerciseName,
          shouldProgress,
        },
        "ui"
      );
    },

    // Sync notifications
    showSyncStartedNotification: (state) => {
      const notification: Notification = {
        id: `sync_started_${Date.now()}`,
        type: "info",
        title: "Syncing Data",
        message: "Uploading your workouts to the cloud...",
        duration: 0, // Persistent until sync completes
        createdAt: new Date().toISOString(),
      };

      state.notifications.push(notification);
      logger.info("Sync started notification shown", undefined, "ui");
    },

    showSyncCompletedNotification: (state, action: PayloadAction<{ syncedCount: number }>) => {
      const { syncedCount } = action.payload;

      // Remove any existing sync notifications
      state.notifications = state.notifications.filter((n) => !n.id.startsWith("sync_"));

      const notification: Notification = {
        id: `sync_completed_${Date.now()}`,
        type: "success",
        title: "Sync Complete",
        message: `${syncedCount} workout${syncedCount !== 1 ? "s" : ""} synced successfully.`,
        duration: 3000,
        createdAt: new Date().toISOString(),
      };

      state.notifications.push(notification);
      logger.info("Sync completed notification shown", { syncedCount }, "ui");
    },

    showSyncFailedNotification: (state, action: PayloadAction<{ error: string }>) => {
      const { error } = action.payload;

      // Remove any existing sync notifications
      state.notifications = state.notifications.filter((n) => !n.id.startsWith("sync_"));

      const notification: Notification = {
        id: `sync_failed_${Date.now()}`,
        type: "error",
        title: "Sync Failed",
        message: `Unable to sync workouts: ${error}`,
        duration: 8000,
        actions: [
          {
            label: "Retry",
            action: () => {
              // This would be handled by the component
              logger.info("Sync retry requested from notification", undefined, "ui");
            },
          },
        ],
        createdAt: new Date().toISOString(),
      };

      state.notifications.push(notification);
      logger.error("Sync failed notification shown", { error }, "ui");
    },

    // Subscription notifications
    showSubscriptionExpiredNotification: (state, action: PayloadAction<{ planName: string }>) => {
      const { planName } = action.payload;

      const notification: Notification = {
        id: `subscription_expired_${Date.now()}`,
        type: "warning",
        title: "Subscription Expired",
        message: `Your ${planName} subscription has expired. Renew to continue using premium features.`,
        duration: 0, // Persistent
        actions: [
          {
            label: "Renew",
            action: () => {
              logger.info("Subscription renewal requested from notification", undefined, "ui");
            },
          },
        ],
        createdAt: new Date().toISOString(),
      };

      state.notifications.push(notification);
      logger.warn("Subscription expired notification shown", { planName }, "ui");
    },

    showPaymentFailedNotification: (state) => {
      const notification: Notification = {
        id: `payment_failed_${Date.now()}`,
        type: "error",
        title: "Payment Failed",
        message: "We couldn't process your payment. Please update your payment method.",
        duration: 0, // Persistent
        actions: [
          {
            label: "Update Payment",
            action: () => {
              logger.info("Payment update requested from notification", undefined, "ui");
            },
          },
        ],
        createdAt: new Date().toISOString(),
      };

      state.notifications.push(notification);
      logger.error("Payment failed notification shown", undefined, "ui");
    },

    // Clear all UI data (for logout)
    clearUIData: (state) => {
      state.notifications = [];
      state.loading = {
        global: false,
        workout: false,
        progress: false,
        subscription: false,
      };
      state.error = undefined;
      // Keep theme and network status
      logger.info("UI data cleared", undefined, "ui");
    },
  },
});

// ============================================================================
// ACTIONS AND SELECTORS
// ============================================================================

export const {
  setTheme,
  toggleTheme,
  setNetworkStatus,
  setLoading,
  setError,
  clearError,
  addNotification,
  removeNotification,
  clearAllNotifications,
  showSuccessNotification,
  showErrorNotification,
  showWarningNotification,
  showInfoNotification,
  showWorkoutStartedNotification,
  showWorkoutCompletedNotification,
  showPersonalRecordNotification,
  showProgressionRecommendationNotification,
  showSyncStartedNotification,
  showSyncCompletedNotification,
  showSyncFailedNotification,
  showSubscriptionExpiredNotification,
  showPaymentFailedNotification,
  clearUIData,
} = uiSlice.actions;

// Selectors
export const selectUI = (state: { ui: UIState }) => state.ui;
export const selectTheme = (state: { ui: UIState }) => state.ui.theme;
export const selectNetworkStatus = (state: { ui: UIState }) => state.ui.networkStatus;
export const selectIsOnline = (state: { ui: UIState }) => state.ui.networkStatus === "online";
export const selectIsOffline = (state: { ui: UIState }) => state.ui.networkStatus === "offline";
export const selectGlobalLoading = (state: { ui: UIState }) => state.ui.loading;
export const selectGlobalError = (state: { ui: UIState }) => state.ui.error;
export const selectNotifications = (state: { ui: UIState }) => state.ui.notifications;

// Computed selectors
export const selectActiveNotifications = (state: { ui: UIState }) =>
  state.ui.notifications.filter((notification) => {
    if (!notification.duration || notification.duration === 0) {
      return true; // Persistent notifications
    }

    const createdTime = new Date(notification.createdAt).getTime();
    const now = Date.now();
    return now - createdTime < notification.duration;
  });

export const selectNotificationsByType = (type: Notification["type"]) => (state: { ui: UIState }) =>
  state.ui.notifications.filter((notification) => notification.type === type);

export const selectHasUnreadNotifications = (state: { ui: UIState }) => state.ui.notifications.length > 0;

export const selectRecentNotifications =
  (limit: number = 5) =>
  (state: { ui: UIState }) =>
    state.ui.notifications
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

export const selectIsDarkMode = (state: { ui: UIState }) => state.ui.theme === "dark";

export const selectHasError = (state: { ui: UIState }) => !!state.ui.error;

export const selectSyncNotifications = (state: { ui: UIState }) =>
  state.ui.notifications.filter((n) => n.id.startsWith("sync_"));

export const selectWorkoutNotifications = (state: { ui: UIState }) =>
  state.ui.notifications.filter(
    (n) => n.id.startsWith("workout_") || n.id.startsWith("pr_") || n.id.startsWith("progression_")
  );

export const selectSubscriptionNotifications = (state: { ui: UIState }) =>
  state.ui.notifications.filter((n) => n.id.startsWith("subscription_") || n.id.startsWith("payment_"));

export default uiSlice.reducer;
