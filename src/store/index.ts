// ============================================================================
// ROOT REDUX STORE CONFIGURATION
// ============================================================================
// Complete Redux Toolkit store with RTK Query, Redux Persist, and middleware
// for authentication, logging, and error handling

import { configureStore, combineReducers, Middleware } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from "redux-persist";
import AsyncStorage from "@react-native-async-storage/async-storage";

// API and Slices
import { baseApi } from "./api/baseApi";
import authSlice from "./auth/authSlice";
import workoutSlice from "./workout/workoutSlice";
import progressSlice from "./progress/progressSlice";
import subscriptionSlice from "./subscription/subscriptionSlice";
import uiSlice from "./ui/uiSlice";
import offlineSlice from "./offline/offlineSlice";

// Middleware
import { authMiddleware } from "../middleware/authMiddleware";
import { offlineMiddleware } from "../middleware/offlineMiddleware";
import { reduxLoggerMiddleware } from "../middleware/reduxLoggerMiddleware";

// Utils
import { logger } from "../utils/logger";
import { DEV_CONSTANTS } from "../config/constants";

// ============================================================================
// PERSISTENCE CONFIGURATION
// ============================================================================

// Define what to persist and what to exclude
const persistConfig = {
  key: "root",
  version: 1,
  storage: AsyncStorage,
  // Only persist essential data for offline functionality
  whitelist: ["auth", "workout", "ui", "offline"],
  // Exclude API cache and temporary states
  blacklist: ["api"],
};

// Auth slice persistence - secure tokens handled separately
const authPersistConfig = {
  key: "auth",
  storage: AsyncStorage,
  // Exclude sensitive data (tokens stored in SecureStore)
  blacklist: ["session", "tokens"],
};

// Workout slice persistence - include offline queue
const workoutPersistConfig = {
  key: "workout",
  storage: AsyncStorage,
  // Persist offline data and current workout state
  whitelist: ["offline", "currentWorkout", "exercises", "plans"],
};

// UI slice persistence - user preferences
const uiPersistConfig = {
  key: "ui",
  storage: AsyncStorage,
  // Persist theme and user preferences
  whitelist: ["theme", "preferences", "onboardingComplete"],
};

// ============================================================================
// ROOT REDUCER CONFIGURATION
// ============================================================================

const rootReducer = combineReducers({
  // RTK Query API slice
  [baseApi.reducerPath]: baseApi.reducer,

  // Feature slices with persistence
  auth: persistReducer(authPersistConfig, authSlice),
  workout: persistReducer(workoutPersistConfig, workoutSlice),
  progress: progressSlice,
  subscription: subscriptionSlice,
  ui: persistReducer(uiPersistConfig, uiSlice),
  offline: offlineSlice,
});

// Apply root persistence
const persistedReducer = persistReducer(persistConfig, rootReducer);

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

const getDefaultMiddleware = (getDefaultMiddleware: any) => {
  const middleware = getDefaultMiddleware({
    serializableCheck: {
      // Ignore redux-persist actions
      ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      // Ignore non-serializable values in specific paths
      ignoredPaths: ["auth.session", "ui.modals"],
    },
    // Enable immutability checks in development
    immutableCheck: DEV_CONSTANTS.enableDebugMode,
  })
    // Add RTK Query middleware
    .concat(baseApi.middleware)
    // Add custom middleware
    .concat(authMiddleware)
    .concat(offlineMiddleware);

  // Add development middleware
  if (DEV_CONSTANTS.enableDebugMode) {
    // Custom Redux logger middleware using our existing logger
    middleware.concat(reduxLoggerMiddleware);
  }

  return middleware;
};

// ============================================================================
// STORE CONFIGURATION
// ============================================================================

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware,
  devTools: DEV_CONSTANTS.enableDebugMode && {
    name: "TrainSmart",
    trace: true,
    traceLimit: 25,
    actionSanitizer: (action: any) => ({
      ...action,
      // Sanitize sensitive data in Redux DevTools
      payload:
        action.type.includes("auth") && action.payload?.password
          ? { ...action.payload, password: "[REDACTED]" }
          : action.payload,
    }),
    stateSanitizer: (state: any) => ({
      ...state,
      // Sanitize sensitive data in state
      auth: {
        ...state.auth,
        session: state.auth.session ? "[REDACTED]" : null,
      },
    }),
  },
  enhancers: (getDefaultEnhancers) => {
    const enhancers = getDefaultEnhancers();

    // Add Flipper Redux debugger in development
    if (DEV_CONSTANTS.enableFlipper && __DEV__) {
      try {
        const { createFlipperReduxDebugger } = require("redux-flipper");
        enhancers.push(createFlipperReduxDebugger());
      } catch (error) {
        logger.warn("Flipper Redux debugger not available:", error);
      }
    }

    return enhancers;
  },
});

// ============================================================================
// PERSISTOR CONFIGURATION
// ============================================================================

export const persistor = persistStore(store, null, () => {
  logger.info("Store rehydration complete");

  // Dispatch rehydration complete action
  store.dispatch({ type: "REHYDRATION_COMPLETE" });
});

// ============================================================================
// STORE SETUP AND LISTENERS
// ============================================================================

// Setup RTK Query listeners for refetchOnFocus/refetchOnReconnect
setupListeners(store.dispatch);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks for use throughout the app
export type AppThunk<ReturnType = void> = (dispatch: AppDispatch, getState: () => RootState) => ReturnType;

// ============================================================================
// STORE UTILITIES
// ============================================================================

/**
 * Reset the entire store state (useful for logout)
 */
export const resetStore = () => {
  persistor.purge();
  store.dispatch({ type: "RESET_STORE" });
};

/**
 * Get current store state (useful for debugging)
 */
export const getStoreState = () => store.getState();

/**
 * Check if store is rehydrated
 */
export const isStoreRehydrated = () => {
  const state = store.getState();
  return (state as any)._persist?.rehydrated === true;
};

/**
 * Wait for store rehydration
 */
export const waitForRehydration = (): Promise<void> => {
  return new Promise((resolve) => {
    if (isStoreRehydrated()) {
      resolve();
      return;
    }

    const unsubscribe = store.subscribe(() => {
      if (isStoreRehydrated()) {
        unsubscribe();
        resolve();
      }
    });
  });
};

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Global error handler for unhandled store errors
store.subscribe(() => {
  const state = store.getState();

  // Check for critical errors that need immediate attention
  if (state.auth.error && state.auth.error.includes("CRITICAL")) {
    logger.error("Critical auth error detected:", state.auth.error);
    // Could trigger app-wide error boundary or force logout
  }

  if (state.workout.offline.syncStatus === "error") {
    logger.warn("Workout sync error detected, will retry automatically");
  }
});

// ============================================================================
// DEVELOPMENT HELPERS
// ============================================================================

if (DEV_CONSTANTS.enableDebugMode) {
  // Expose store to global scope for debugging
  (global as any).__TRAINSMART_STORE__ = store;
  (global as any).__TRAINSMART_PERSISTOR__ = persistor;

  // Log store initialization
  logger.info("Redux store initialized with middleware:", [
    "RTK Query",
    "Redux Persist",
    "Auth Middleware",
    "Offline Middleware",
    ...(DEV_CONSTANTS.enableDebugMode ? ["Redux Logger"] : []),
    ...(DEV_CONSTANTS.enableFlipper ? ["Flipper Debugger"] : []),
  ]);
}

export default store;
