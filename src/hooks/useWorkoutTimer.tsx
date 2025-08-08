// ============================================================================
// WORKOUT TIMER HOOK
// ============================================================================
// Workout timing and rest management with background timer persistence

import { useState, useEffect, useRef, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "../utils/logger";

// ============================================================================
// TYPES
// ============================================================================

export interface WorkoutTimerState {
  workoutDuration: number; // in seconds
  isRunning: boolean;
  startTime: number | null;
  pausedDuration: number;
}

export interface UseWorkoutTimerReturn {
  workoutDuration: number;
  isRunning: boolean;
  startTimer: () => void;
  stopTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  getFormattedTime: () => string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TIMER_STORAGE_KEY = "@workout_timer_state";
const TIMER_INTERVAL = 1000; // Update every second

// ============================================================================
// HOOK
// ============================================================================

export const useWorkoutTimer = (): UseWorkoutTimerReturn => {
  // ============================================================================
  // STATE
  // ============================================================================

  const [workoutDuration, setWorkoutDuration] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [pausedDuration, setPausedDuration] = useState(0);

  // ============================================================================
  // REFS
  // ============================================================================

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef(AppState.currentState);
  const backgroundTime = useRef<number | null>(null);

  // ============================================================================
  // TIMER LOGIC
  // ============================================================================

  const updateTimer = useCallback(() => {
    if (!startTime || !isRunning) return;

    const now = Date.now();
    const elapsed = Math.floor((now - startTime - pausedDuration) / 1000);
    setWorkoutDuration(Math.max(0, elapsed));
  }, [startTime, isRunning, pausedDuration]);

  const startInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(updateTimer, TIMER_INTERVAL);
  }, [updateTimer]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ============================================================================
  // PERSISTENCE
  // ============================================================================

  const saveTimerState = useCallback(async (state: WorkoutTimerState) => {
    try {
      await AsyncStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
      logger.debug("Timer state saved", state, "timer");
    } catch (error) {
      logger.error("Failed to save timer state", error, "timer");
    }
  }, []);

  const loadTimerState = useCallback(async (): Promise<WorkoutTimerState | null> => {
    try {
      const savedState = await AsyncStorage.getItem(TIMER_STORAGE_KEY);
      if (savedState) {
        const state = JSON.parse(savedState) as WorkoutTimerState;
        logger.debug("Timer state loaded", state, "timer");
        return state;
      }
    } catch (error) {
      logger.error("Failed to load timer state", error, "timer");
    }
    return null;
  }, []);

  const clearTimerState = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(TIMER_STORAGE_KEY);
      logger.debug("Timer state cleared", undefined, "timer");
    } catch (error) {
      logger.error("Failed to clear timer state", error, "timer");
    }
  }, []);

  // ============================================================================
  // APP STATE HANDLING
  // ============================================================================

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === "active") {
        // App came to foreground
        if (isRunning && backgroundTime.current) {
          const backgroundDuration = Date.now() - backgroundTime.current;
          logger.info("App returned to foreground", { backgroundDuration }, "timer");

          // Update timer immediately when returning from background
          updateTimer();
        }
        backgroundTime.current = null;
      } else if (appState.current === "active" && nextAppState.match(/inactive|background/)) {
        // App went to background
        if (isRunning) {
          backgroundTime.current = Date.now();
          logger.info("App went to background during workout", undefined, "timer");

          // Save current state before backgrounding
          saveTimerState({
            workoutDuration,
            isRunning,
            startTime,
            pausedDuration,
          });
        }
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription?.remove();
  }, [isRunning, workoutDuration, startTime, pausedDuration, updateTimer, saveTimerState]);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    const initializeTimer = async () => {
      const savedState = await loadTimerState();

      if (savedState && savedState.isRunning && savedState.startTime) {
        // Restore timer state
        const now = Date.now();
        const totalElapsed = Math.floor((now - savedState.startTime - savedState.pausedDuration) / 1000);

        setWorkoutDuration(Math.max(0, totalElapsed));
        setIsRunning(true);
        setStartTime(savedState.startTime);
        setPausedDuration(savedState.pausedDuration);

        logger.info(
          "Timer restored from background",
          {
            duration: totalElapsed,
            startTime: savedState.startTime,
          },
          "timer"
        );
      }
    };

    initializeTimer();
  }, [loadTimerState]);

  // ============================================================================
  // TIMER EFFECTS
  // ============================================================================

  useEffect(() => {
    if (isRunning) {
      startInterval();
    } else {
      stopInterval();
    }

    return () => stopInterval();
  }, [isRunning, startInterval, stopInterval]);

  // Save state whenever it changes
  useEffect(() => {
    if (startTime) {
      saveTimerState({
        workoutDuration,
        isRunning,
        startTime,
        pausedDuration,
      });
    }
  }, [workoutDuration, isRunning, startTime, pausedDuration, saveTimerState]);

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  const startTimer = useCallback(() => {
    const now = Date.now();

    if (!startTime) {
      // First time starting
      setStartTime(now);
      setPausedDuration(0);
      setWorkoutDuration(0);
    }

    setIsRunning(true);
    logger.info("Workout timer started", { startTime: now }, "timer");
  }, [startTime]);

  const stopTimer = useCallback(() => {
    setIsRunning(false);
    stopInterval();
    logger.info("Workout timer stopped", { duration: workoutDuration }, "timer");
  }, [workoutDuration, stopInterval]);

  const pauseTimer = useCallback(() => {
    if (isRunning && startTime) {
      const now = Date.now();
      const currentElapsed = Math.floor((now - startTime - pausedDuration) / 1000);

      setIsRunning(false);
      setWorkoutDuration(currentElapsed);

      logger.info("Workout timer paused", { duration: currentElapsed }, "timer");
    }
  }, [isRunning, startTime, pausedDuration]);

  const resumeTimer = useCallback(() => {
    if (!isRunning && startTime) {
      const now = Date.now();
      const pauseStart = startTime + workoutDuration * 1000 + pausedDuration;
      const additionalPausedTime = now - pauseStart;

      setPausedDuration((prev) => prev + additionalPausedTime);
      setIsRunning(true);

      logger.info(
        "Workout timer resumed",
        {
          duration: workoutDuration,
          additionalPausedTime,
        },
        "timer"
      );
    }
  }, [isRunning, startTime, workoutDuration]);

  const resetTimer = useCallback(() => {
    setWorkoutDuration(0);
    setIsRunning(false);
    setStartTime(null);
    setPausedDuration(0);
    stopInterval();
    clearTimerState();

    logger.info("Workout timer reset", undefined, "timer");
  }, [stopInterval, clearTimerState]);

  const getFormattedTime = useCallback((): string => {
    const hours = Math.floor(workoutDuration / 3600);
    const minutes = Math.floor((workoutDuration % 3600) / 60);
    const seconds = workoutDuration % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }
  }, [workoutDuration]);

  // ============================================================================
  // CLEANUP
  // ============================================================================

  useEffect(() => {
    return () => {
      stopInterval();
    };
  }, [stopInterval]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    workoutDuration,
    isRunning,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    getFormattedTime,
  };
};

export default useWorkoutTimer;
