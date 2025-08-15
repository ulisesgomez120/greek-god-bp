// ============================================================================
// WORKOUT SYNC EDGE FUNCTION
// ============================================================================
// Handles offline workout synchronization with conflict resolution

/// <reference path="../deno.d.ts" />

import { handleCors, createErrorResponse, createSuccessResponse } from "../_shared/cors.ts";
import { getAuthenticatedUser, createSupabaseClient } from "../_shared/supabase.ts";

interface WorkoutSyncRequest {
  workouts: WorkoutSession[];
  lastSyncTime?: string;
}

interface WorkoutSession {
  id: string;
  name: string;
  started_at: string;
  completed_at?: string;
  duration_minutes?: number;
  total_volume_kg?: number;
  average_rpe?: number;
  notes?: string;
  sets: ExerciseSet[];
  updated_at: string;
  offline_created?: boolean;
}

interface ExerciseSet {
  id: string;
  exercise_id: string;
  set_number: number;
  weight_kg?: number;
  reps: number;
  rpe?: number;
  is_warmup?: boolean;
  rest_seconds?: number;
  notes?: string;
}

interface SyncResult {
  id: string;
  status: "synced" | "conflict" | "error";
  error?: string;
  server_version?: any;
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return createErrorResponse("Method not allowed", 405);
    }

    // Authenticate user
    const { user, supabase: userSupabase } = await getAuthenticatedUser(req);
    const supabase = createSupabaseClient();

    // Parse request body
    const { workouts, lastSyncTime }: WorkoutSyncRequest = await req.json();

    if (!workouts || !Array.isArray(workouts)) {
      return createErrorResponse("Invalid request: workouts array required");
    }

    const results: SyncResult[] = [];

    // Process each workout
    for (const workout of workouts) {
      try {
        const result = await syncWorkout(workout, user.id, supabase);
        results.push(result);
      } catch (error) {
        results.push({
          id: workout.id,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Get updated sync time
    const newSyncTime = new Date().toISOString();

    return createSuccessResponse({
      results,
      sync_time: newSyncTime,
      synced_count: results.filter((r) => r.status === "synced").length,
      conflict_count: results.filter((r) => r.status === "conflict").length,
      error_count: results.filter((r) => r.status === "error").length,
    });
  } catch (error) {
    console.error("Workout sync error:", error);
    return createErrorResponse("Internal server error", 500);
  }
});

async function syncWorkout(
  workout: WorkoutSession,
  userId: string,
  supabase: ReturnType<typeof createSupabaseClient>
): Promise<SyncResult> {
  // Check if workout already exists
  const { data: existingWorkout, error: fetchError } = await supabase
    .from("workout_sessions")
    .select("id, updated_at, sync_status")
    .eq("id", workout.id)
    .eq("user_id", userId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    // PGRST116 is "not found" error, which is expected for new workouts
    throw new Error(`Failed to check existing workout: ${fetchError.message}`);
  }

  // Handle conflict detection
  if (existingWorkout) {
    const serverUpdatedAt = new Date(existingWorkout.updated_at);
    const clientUpdatedAt = new Date(workout.updated_at);

    // If server version is newer, return conflict
    if (serverUpdatedAt > clientUpdatedAt) {
      const { data: serverVersion } = await supabase
        .from("workout_sessions")
        .select(
          `
          *,
          exercise_sets (*)
        `
        )
        .eq("id", workout.id)
        .single();

      return {
        id: workout.id,
        status: "conflict",
        server_version: serverVersion,
      };
    }
  }

  // Start transaction-like operation
  try {
    // Upsert workout session
    const workoutData = {
      id: workout.id,
      user_id: userId,
      name: workout.name,
      started_at: workout.started_at,
      completed_at: workout.completed_at,
      duration_minutes: workout.duration_minutes,
      total_volume_kg: workout.total_volume_kg,
      average_rpe: workout.average_rpe,
      notes: workout.notes,
      sync_status: "synced",
      offline_created: workout.offline_created || false,
      updated_at: new Date().toISOString(),
    };

    const { error: workoutError } = await supabase.from("workout_sessions").upsert(workoutData, { onConflict: "id" });

    if (workoutError) {
      throw new Error(`Failed to sync workout: ${workoutError.message}`);
    }

    // Upsert exercise sets (safer than delete-then-insert).
    // We'll upsert incoming sets, then remove any server sets not present in the incoming payload.
    if (workout.sets && workout.sets.length > 0) {
      const setsData = workout.sets.map((set) => ({
        id: set.id,
        session_id: workout.id,
        exercise_id: set.exercise_id,
        set_number: set.set_number,
        weight_kg: set.weight_kg,
        reps: set.reps,
        rpe: set.rpe,
        is_warmup: set.is_warmup || false,
        rest_seconds: set.rest_seconds,
        notes: set.notes,
      }));

      // Upsert incoming sets (onConflict by id)
      const { error: upsertError } = await supabase.from("exercise_sets").upsert(setsData, { onConflict: "id" });
      if (upsertError) {
        throw new Error(`Failed to upsert exercise sets: ${upsertError.message}`);
      }

      // Build list of incoming IDs for cleanup
      const incomingIds = setsData.map((s) => s.id).filter(Boolean);

      // Delete server-side sets that are not present in incoming payload (cleanup)
      try {
        if (incomingIds.length > 0) {
          const { error: deleteError } = await supabase
            .from("exercise_sets")
            .delete()
            .eq("session_id", workout.id)
            .not("id", "in", `(${incomingIds.map((id) => `'${id}'`).join(",")})`);

          if (deleteError) {
            // Non-fatal: log and continue
            console.warn("Failed to delete stale sets:", deleteError);
          }
        }
      } catch (cleanupErr) {
        console.warn("Error during cleanup of stale sets:", cleanupErr);
      }
    } else {
      // No sets provided: ensure server has none (optional)
      try {
        const { error: deleteAllError } = await supabase.from("exercise_sets").delete().eq("session_id", workout.id);
        if (deleteAllError) {
          console.warn("Failed to delete all sets when none provided:", deleteAllError);
        }
      } catch (e) {
        console.warn("Error deleting sets when none provided:", e);
      }
    }

    return {
      id: workout.id,
      status: "synced",
    };
  } catch (error) {
    // If sync fails, mark workout as having sync conflict
    await supabase
      .from("workout_sessions")
      .update({ sync_status: "conflict" })
      .eq("id", workout.id)
      .eq("user_id", userId);

    throw error;
  }
}

// Helper function to calculate workout statistics
function calculateWorkoutStats(sets: ExerciseSet[]): {
  total_volume_kg: number;
  average_rpe: number;
} {
  const workingSets = sets.filter((set) => !set.is_warmup);

  const totalVolume = workingSets.reduce((sum, set) => {
    return sum + (set.weight_kg || 0) * set.reps;
  }, 0);

  const rpeValues = workingSets.filter((set) => set.rpe && set.rpe > 0).map((set) => set.rpe!);

  const averageRpe = rpeValues.length > 0 ? rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length : 0;

  return {
    total_volume_kg: Math.round(totalVolume * 100) / 100, // Round to 2 decimal places
    average_rpe: Math.round(averageRpe * 10) / 10, // Round to 1 decimal place
  };
}
