// ============================================================================
// USE NETWORK STATE HOOK
// ============================================================================
// Network state monitoring and management with connection quality detection
// and offline/online transition handling

import { useState, useEffect, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "./redux";
import { setNetworkStatus } from "../store/ui/uiSlice";
import { logger } from "../utils/logger";
import NetInfo, { NetInfoState, NetInfoStateType } from "@react-native-netinfo/netinfo";

// ============================================================================
// TYPES
// ============================================================================

export interface NetworkState {
  isConnected: boolean;
  isSlowConnection: boolean;
  connectionType: string;
  isInternetReachable: boolean | null;
  connectionQuality: "poor" | "fair" | "good" | "excellent";
  lastConnectedAt?: string;
  lastDisconnectedAt?: string;
}

export interface NetworkTransition {
  from: "online" | "offline";
  to: "online" | "offline";
  timestamp: string;
  connectionType?: string;
}

export interface UseNetworkStateReturn {
  // Current state
  networkState: NetworkState;
  isConnected: boolean;
  isSlowConnection: boolean;
  connectionType: string;
  connectionQuality: "poor" | "fair" | "good" | "excellent";

  // Actions
  refreshNetworkState: () => Promise<void>;

  // Event handlers
  onNetworkChange: (callback: (transition: NetworkTransition) => void) => () => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useNetworkState(): UseNetworkStateReturn {
  const dispatch = useAppDispatch();
  const uiNetworkStatus = useAppSelector((state) => state.ui.networkStatus);

  // Local network state
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true, // Assume connected initially
    isSlowConnection: false,
    connectionType: "unknown",
    isInternetReachable: null,
    connectionQuality: "good",
  });

  const [networkChangeCallbacks, setNetworkChangeCallbacks] = useState<Array<(transition: NetworkTransition) => void>>(
    []
  );

  // ============================================================================
  // NETWORK QUALITY ASSESSMENT
  // ============================================================================

  /**
   * Assess connection quality based on connection type and speed
   */
  const assessConnectionQuality = useCallback((netInfoState: NetInfoState): "poor" | "fair" | "good" | "excellent" => {
    const { type, details } = netInfoState;

    // If we have connection details with speed info
    if (details && "downlinkMax" in details && details.downlinkMax) {
      const speed = details.downlinkMax;
      if (speed >= 50) return "excellent"; // 50+ Mbps
      if (speed >= 10) return "good"; // 10-50 Mbps
      if (speed >= 2) return "fair"; // 2-10 Mbps
      return "poor"; // < 2 Mbps
    }

    // Fallback to connection type assessment
    switch (type) {
      case NetInfoStateType.wifi:
        return "excellent";
      case NetInfoStateType.ethernet:
        return "excellent";
      case NetInfoStateType.cellular:
        // Try to get cellular generation info
        if (details && "cellularGeneration" in details) {
          switch (details.cellularGeneration) {
            case "5g":
              return "excellent";
            case "4g":
              return "good";
            case "3g":
              return "fair";
            case "2g":
              return "poor";
            default:
              return "fair";
          }
        }
        return "fair"; // Default for cellular
      case NetInfoStateType.bluetooth:
        return "poor";
      case NetInfoStateType.wimax:
        return "good";
      default:
        return "poor";
    }
  }, []);

  /**
   * Determine if connection is considered slow
   */
  const isSlowConnection = useCallback(
    (netInfoState: NetInfoState): boolean => {
      const quality = assessConnectionQuality(netInfoState);
      return quality === "poor" || quality === "fair";
    },
    [assessConnectionQuality]
  );

  // ============================================================================
  // NETWORK STATE MANAGEMENT
  // ============================================================================

  /**
   * Update network state from NetInfo
   */
  const updateNetworkState = useCallback(
    (netInfoState: NetInfoState) => {
      const wasConnected = networkState.isConnected;
      const isNowConnected = netInfoState.isConnected ?? false;

      const newNetworkState: NetworkState = {
        isConnected: isNowConnected,
        isSlowConnection: isSlowConnection(netInfoState),
        connectionType: netInfoState.type,
        isInternetReachable: netInfoState.isInternetReachable,
        connectionQuality: assessConnectionQuality(netInfoState),
        lastConnectedAt: isNowConnected && !wasConnected ? new Date().toISOString() : networkState.lastConnectedAt,
        lastDisconnectedAt:
          !isNowConnected && wasConnected ? new Date().toISOString() : networkState.lastDisconnectedAt,
      };

      setNetworkState(newNetworkState);

      // Update Redux state
      dispatch(setNetworkStatus(isNowConnected ? "online" : "offline"));

      // Handle network transitions
      if (wasConnected !== isNowConnected) {
        const transition: NetworkTransition = {
          from: wasConnected ? "online" : "offline",
          to: isNowConnected ? "online" : "offline",
          timestamp: new Date().toISOString(),
          connectionType: netInfoState.type,
        };

        logger.info("Network transition", transition, "network");

        // Notify callbacks
        networkChangeCallbacks.forEach((callback) => {
          try {
            callback(transition);
          } catch (error) {
            logger.error("Network change callback error", error, "network");
          }
        });
      }

      logger.debug(
        "Network state updated",
        {
          isConnected: isNowConnected,
          connectionType: netInfoState.type,
          quality: newNetworkState.connectionQuality,
          isSlowConnection: newNetworkState.isSlowConnection,
        },
        "network"
      );
    },
    [networkState.isConnected, isSlowConnection, assessConnectionQuality, dispatch, networkChangeCallbacks]
  );

  /**
   * Refresh network state manually
   */
  const refreshNetworkState = useCallback(async (): Promise<void> => {
    try {
      const netInfoState = await NetInfo.fetch();
      updateNetworkState(netInfoState);
      logger.info("Network state refreshed manually", undefined, "network");
    } catch (error) {
      logger.error("Failed to refresh network state", error, "network");
    }
  }, [updateNetworkState]);

  /**
   * Register network change callback
   */
  const onNetworkChange = useCallback((callback: (transition: NetworkTransition) => void): (() => void) => {
    setNetworkChangeCallbacks((prev) => [...prev, callback]);

    // Return cleanup function
    return () => {
      setNetworkChangeCallbacks((prev) => prev.filter((cb) => cb !== callback));
    };
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * Set up NetInfo listener
   */
  useEffect(() => {
    // Initial network state fetch
    NetInfo.fetch().then(updateNetworkState);

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(updateNetworkState);

    logger.info("Network state monitoring started", undefined, "network");

    return () => {
      unsubscribe();
      logger.info("Network state monitoring stopped", undefined, "network");
    };
  }, [updateNetworkState]);

  /**
   * Periodic network quality check (every 30 seconds when connected)
   */
  useEffect(() => {
    if (!networkState.isConnected) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const netInfoState = await NetInfo.fetch();

        // Only update if there are significant changes
        const newQuality = assessConnectionQuality(netInfoState);
        const newIsSlowConnection = isSlowConnection(netInfoState);

        if (newQuality !== networkState.connectionQuality || newIsSlowConnection !== networkState.isSlowConnection) {
          updateNetworkState(netInfoState);
        }
      } catch (error) {
        logger.error("Periodic network check failed", error, "network");
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [
    networkState.isConnected,
    networkState.connectionQuality,
    networkState.isSlowConnection,
    assessConnectionQuality,
    isSlowConnection,
    updateNetworkState,
  ]);

  // ============================================================================
  // RETURN HOOK INTERFACE
  // ============================================================================

  return {
    // Current state
    networkState,
    isConnected: networkState.isConnected,
    isSlowConnection: networkState.isSlowConnection,
    connectionType: networkState.connectionType,
    connectionQuality: networkState.connectionQuality,

    // Actions
    refreshNetworkState,

    // Event handlers
    onNetworkChange,
  };
}

export default useNetworkState;
