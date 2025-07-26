// ============================================================================
// USE NETWORK STATUS HOOK
// ============================================================================
// Custom hook for monitoring network connectivity and connection quality

import { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "./redux";
import { setNetworkStatus } from "../store/ui/uiSlice";
import { logger } from "../utils/logger";

// Mock NetInfo for now - in a real app you'd install @react-native-community/netinfo
const NetInfo = {
  fetch: async () => ({
    isConnected: true,
    type: "wifi" as const,
    isInternetReachable: true,
    details: null,
  }),
  addEventListener: (callback: any) => {
    // Mock implementation - call callback with initial state
    setTimeout(() => {
      callback({
        isConnected: true,
        type: "wifi",
        isInternetReachable: true,
        details: null,
      });
    }, 100);

    return () => {}; // Unsubscribe function
  },
};

type NetInfoStateType = "wifi" | "cellular" | "ethernet" | "bluetooth" | "wimax" | "vpn" | "other" | "unknown" | "none";
type NetInfoState = {
  isConnected: boolean | null;
  type: NetInfoStateType;
  isInternetReachable: boolean | null;
  details: any;
};

// ============================================================================
// TYPES
// ============================================================================

export interface NetworkStatus {
  isConnected: boolean;
  connectionType: NetInfoStateType | null;
  isSlowConnection: boolean;
  isInternetReachable: boolean | null;
  details: NetInfoState | null;
}

export interface UseNetworkStatusReturn extends NetworkStatus {
  refreshNetworkStatus: () => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Connection types considered slow
const SLOW_CONNECTION_TYPES: NetInfoStateType[] = ["cellular", "other"];

// Minimum connection speed threshold (in Mbps) to consider fast
const FAST_CONNECTION_THRESHOLD = 1;

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useNetworkStatus(): UseNetworkStatusReturn {
  const dispatch = useAppDispatch();
  const networkStatus = useAppSelector((state) => state.ui.networkStatus);

  const [localStatus, setLocalStatus] = useState<NetworkStatus>({
    isConnected: true,
    connectionType: null,
    isSlowConnection: false,
    isInternetReachable: null,
    details: null,
  });

  // ============================================================================
  // NETWORK STATUS EVALUATION
  // ============================================================================

  const evaluateConnectionSpeed = (netInfoState: NetInfoState): boolean => {
    // Check if connection type is inherently slow
    if (netInfoState.type && SLOW_CONNECTION_TYPES.includes(netInfoState.type)) {
      return true;
    }

    // Check cellular connection details
    if (netInfoState.type === "cellular" && netInfoState.details) {
      const cellularDetails = netInfoState.details as any;

      // Consider 2G and slow 3G as slow connections
      if (cellularDetails.cellularGeneration === "2g") {
        return true;
      }

      if (
        cellularDetails.cellularGeneration === "3g" &&
        cellularDetails.carrier &&
        cellularDetails.carrier.toLowerCase().includes("edge")
      ) {
        return true;
      }
    }

    // Check WiFi connection details
    if (netInfoState.type === "wifi" && netInfoState.details) {
      const wifiDetails = netInfoState.details as any;

      // If we have speed information, use it
      if (wifiDetails.linkSpeed && wifiDetails.linkSpeed < FAST_CONNECTION_THRESHOLD) {
        return true;
      }

      // Check signal strength (if available)
      if (wifiDetails.strength && wifiDetails.strength < 30) {
        return true;
      }
    }

    return false;
  };

  const processNetworkState = (netInfoState: NetInfoState): NetworkStatus => {
    const isConnected = netInfoState.isConnected ?? false;
    const isInternetReachable = netInfoState.isInternetReachable;
    const connectionType = netInfoState.type;
    const isSlowConnection = isConnected ? evaluateConnectionSpeed(netInfoState) : false;

    return {
      isConnected,
      connectionType,
      isSlowConnection,
      isInternetReachable,
      details: netInfoState,
    };
  };

  // ============================================================================
  // NETWORK STATUS REFRESH
  // ============================================================================

  const refreshNetworkStatus = async (): Promise<void> => {
    try {
      const netInfoState = await NetInfo.fetch();
      const status = processNetworkState(netInfoState);

      setLocalStatus(status);
      // Dispatch simple online/offline status to Redux
      dispatch(setNetworkStatus(status.isConnected ? "online" : "offline"));

      logger.info("Network status refreshed:", {
        isConnected: status.isConnected,
        connectionType: status.connectionType,
        isSlowConnection: status.isSlowConnection,
        isInternetReachable: status.isInternetReachable,
      });
    } catch (error) {
      logger.error("Failed to refresh network status:", error);
    }
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    // Initial network status check
    refreshNetworkStatus();

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((netInfoState: NetInfoState) => {
      const status = processNetworkState(netInfoState);

      setLocalStatus(status);
      // Dispatch simple online/offline status to Redux
      dispatch(setNetworkStatus(status.isConnected ? "online" : "offline"));

      // Log significant network changes
      if (status.isConnected !== localStatus.isConnected) {
        logger.info(`Network status changed: ${status.isConnected ? "Connected" : "Disconnected"}`, {
          connectionType: status.connectionType,
          isSlowConnection: status.isSlowConnection,
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [dispatch, localStatus.isConnected]);

  // ============================================================================
  // RETURN HOOK INTERFACE
  // ============================================================================

  // Return local status with additional methods
  return {
    isConnected: localStatus.isConnected,
    connectionType: localStatus.connectionType,
    isSlowConnection: localStatus.isSlowConnection,
    isInternetReachable: localStatus.isInternetReachable,
    details: localStatus.details,
    refreshNetworkStatus,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get human-readable connection type description
 */
export function getConnectionTypeDescription(connectionType: NetInfoStateType | null): string {
  switch (connectionType) {
    case "wifi":
      return "Wi-Fi";
    case "cellular":
      return "Cellular";
    case "ethernet":
      return "Ethernet";
    case "bluetooth":
      return "Bluetooth";
    case "wimax":
      return "WiMAX";
    case "vpn":
      return "VPN";
    case "other":
      return "Other";
    case "unknown":
      return "Unknown";
    case "none":
      return "No Connection";
    default:
      return "Unknown";
  }
}

/**
 * Get connection quality description
 */
export function getConnectionQualityDescription(
  isConnected: boolean,
  isSlowConnection: boolean,
  isInternetReachable: boolean | null
): string {
  if (!isConnected) {
    return "No connection";
  }

  if (isInternetReachable === false) {
    return "Connected but no internet";
  }

  if (isSlowConnection) {
    return "Slow connection";
  }

  return "Good connection";
}

/**
 * Check if network operations should be limited
 */
export function shouldLimitNetworkOperations(networkStatus: NetworkStatus): boolean {
  return !networkStatus.isConnected || networkStatus.isSlowConnection || networkStatus.isInternetReachable === false;
}

// ============================================================================
// EXPORT
// ============================================================================

export default useNetworkStatus;
