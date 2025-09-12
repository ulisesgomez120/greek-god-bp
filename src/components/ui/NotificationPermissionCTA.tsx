/**
 * NotificationPermissionCTA.tsx
 *
 * Removed detailed PWA notification permission CTA. CompactRestTimer no longer
 * relies on this component for web behavior and instead shows an alert on PWA.
 *
 * Keeping a small stub export to avoid accidental import runtime errors elsewhere.
 */

import React from "react";
import { View } from "react-native";

export default function NotificationPermissionCTA(): React.ReactElement | null {
  // Stub: intentionally returns null. Permission flow for web PWAs has been removed.
  // Native apps still use the underlying notification service/haptic flows.
  return null;
}
