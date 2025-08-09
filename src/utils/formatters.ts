// ============================================================================
// FORMATTERS
// ============================================================================
// Utility functions for formatting display names and data

/**
 * Format program ID for display
 */
export function formatProgramName(programId: string): string {
  const formatMap: Record<string, string> = {
    full_body: "Full Body Program",
    upper_lower: "Upper/Lower Program",
    body_part_split: "Body Part Split Program",
  };

  return formatMap[programId] || programId.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Format phase ID for display
 */
export function formatPhaseName(phaseId: string): string {
  const formatMap: Record<string, string> = {
    phase1: "Phase 1",
    phase2: "Phase 2",
  };

  return formatMap[phaseId] || phaseId.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/**
 * Format program and phase combination
 */
export function formatProgramPhase(programId: string, phaseId: string): string {
  return `${formatProgramName(programId)} - ${formatPhaseName(phaseId)}`;
}
