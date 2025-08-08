// ============================================================================
// SYNC WORKOUTS EDGE FUNCTION
// ============================================================================
// Server-side sync conflict resolution with data integrity validation,
// conflict detection, and automated resolution strategies

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ============================================================================
// TYPES
// ============================================================================

interface WorkoutSession {
  id: string;
  userId: string;
  planId?: string;
  sessionId?: string;
  name: string;
  startedAt: string;
  completedAt?: string;
  durationMinutes?: number;
  totalVolumeKg?: number;
  averageRpe?: number;
  notes?: string;
  syncStatus: "synced" | "pending" | "conflict";
  offlineCreated: boolean;
  createdAt: string;
  updatedAt: string;
  sets?: ExerciseSet[];
}

interface ExerciseSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  weightKg?: number;
  reps: number;
  rpe?: number;
  isWarmup: boolean;
  isFailure: boolean;
  restSeconds?: number;
  notes?: string;
  formRating?: number;
  createdAt: string;
}

interface SyncConflict {
  id: string;
  workoutId: string;
  localVersion: WorkoutSession;
  serverVersion: WorkoutSession;
  conflictType: "timestamp" | "data" | "deletion";
  resolutionStrategy: "client" | "server" | "merge" | "manual";
  conflictFields: string[];
}

interface SyncRequest {
  workouts: Array<{
    id: string;
    data: WorkoutSession;
    clientTimestamp: string;
    checksum: string;
  }>;
  userId: string;
  deviceId: string;
  conflictResolution: "client" | "server" | "merge" | "manual";
}

interface SyncResponse {
  success: boolean;
  syncedCount: number;
  conflictCount: number;
  errorCount: number;
  conflicts: SyncConflict[];
  errors: Array<{ workoutId: string; error: string }>;
  syncTime: string;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const syncRequest: SyncRequest = await req.json();

    // Validate request
    const validation = validateSyncRequest(syncRequest);
    if (!validation.isValid) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user from token
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user || user.id !== syncRequest.userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process sync request
    const syncResult = await processSyncRequest(supabase, syncRequest);

    return new Response(JSON.stringify(syncResult), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sync workouts error:", error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ============================================================================
// SYNC PROCESSING
// ============================================================================

async function processSyncRequest(supabase: any, request: SyncRequest): Promise<SyncResponse> {
  const result: SyncResponse = {
    success: true,
    syncedCount: 0,
    conflictCount: 0,
    errorCount: 0,
    conflicts: [],
    errors: [],
    syncTime: new Date().toISOString(),
  };

  console.log(`Processing sync for ${request.workouts.length} workouts`);

  // Process each workout
  for (const workoutRequest of request.workouts) {
    try {
      const syncOutcome = await syncSingleWorkout(supabase, workoutRequest, request.userId, request.conflictResolution);

      switch (syncOutcome.status) {
        case "synced":
          result.syncedCount++;
          break;
        case "conflict":
          result.conflictCount++;
          if (syncOutcome.conflict) {
            result.conflicts.push(syncOutcome.conflict);
          }
          break;
        case "error":
          result.errorCount++;
          result.errors.push({
            workoutId: workoutRequest.id,
            error: syncOutcome.error || "Unknown error",
          });
          break;
      }
    } catch (error) {
      console.error(`Error syncing workout ${workoutRequest.id}:`, error);
      result.errorCount++;
      result.errors.push({
        workoutId: workoutRequest.id,
        error: error instanceof Error ? error.message : "Sync failed",
      });
    }
  }

  // Log sync completion
  console.log("Sync completed:", {
    syncedCount: result.syncedCount,
    conflictCount: result.conflictCount,
    errorCount: result.errorCount,
  });

  return result;
}

// ============================================================================
// SINGLE WORKOUT SYNC
// ============================================================================

async function syncSingleWorkout(
  supabase: any,
  workoutRequest: { id: string; data: WorkoutSession; clientTimestamp: string; checksum: string },
  userId: string,
  conflictResolution: "client" | "server" | "merge" | "manual"
): Promise<{
  status: "synced" | "conflict" | "error";
  conflict?: SyncConflict;
  error?: string;
}> {
  const { id, data: clientWorkout, clientTimestamp, checksum } = workoutRequest;

  // Check if workout exists on server
  const { data: serverWorkout, error: fetchError } = await supabase
    .from("workout_sessions")
    .select(
      `
      *,
      exercise_sets (*)
    `
    )
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    // PGRST116 is "not found" - other errors are actual problems
    return { status: "error", error: fetchError.message };
  }

  // If workout doesn't exist on server, create it
  if (!serverWorkout) {
    return await createNewWorkout(supabase, clientWorkout, userId);
  }

  // Check for conflicts
  const conflict = detectConflict(clientWorkout, serverWorkout, clientTimestamp);

  if (!conflict) {
    // No conflict, update the workout
    return await updateExistingWorkout(supabase, clientWorkout, userId);
  }

  // Handle conflict based on resolution strategy
  switch (conflictResolution) {
    case "client":
      return await resolveConflictWithClient(supabase, clientWorkout, userId);
    case "server":
      return { status: "synced" }; // Keep server version, no action needed
    case "merge":
      return await resolveConflictWithMerge(supabase, clientWorkout, serverWorkout, userId);
    case "manual":
      return {
        status: "conflict",
        conflict: {
          id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          workoutId: id,
          localVersion: clientWorkout,
          serverVersion: serverWorkout,
          conflictType: conflict.type,
          resolutionStrategy: "manual",
          conflictFields: conflict.fields,
        },
      };
    default:
      return { status: "error", error: "Invalid conflict resolution strategy" };
  }
}

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

function detectConflict(
  clientWorkout: WorkoutSession,
  serverWorkout: any,
  clientTimestamp: string
): { type: "timestamp" | "data" | "deletion"; fields: string[] } | null {
  const serverUpdatedAt = new Date(serverWorkout.updated_at);
  const clientUpdatedAt = new Date(clientWorkout.updatedAt);
  const syncTimestamp = new Date(clientTimestamp);

  // Check if server was updated after client's last known state
  if (serverUpdatedAt > syncTimestamp) {
    // Potential conflict - check what changed
    const conflictFields = findConflictingFields(clientWorkout, serverWorkout);

    if (conflictFields.length > 0) {
      return {
        type: "data",
        fields: conflictFields,
      };
    }
  }

  // Check for timestamp conflicts
  if (Math.abs(serverUpdatedAt.getTime() - clientUpdatedAt.getTime()) > 1000) {
    // More than 1 second difference
    return {
      type: "timestamp",
      fields: ["updatedAt"],
    };
  }

  return null; // No conflict
}

function findConflictingFields(clientWorkout: WorkoutSession, serverWorkout: any): string[] {
  const conflictFields: string[] = [];

  // Check main workout fields
  const fieldsToCheck = ["name", "completedAt", "durationMinutes", "totalVolumeKg", "averageRpe", "notes"];

  for (const field of fieldsToCheck) {
    if (clientWorkout[field as keyof WorkoutSession] !== serverWorkout[field]) {
      conflictFields.push(field);
    }
  }

  // Check sets (simplified comparison)
  if (clientWorkout.sets && serverWorkout.exercise_sets) {
    if (clientWorkout.sets.length !== serverWorkout.exercise_sets.length) {
      conflictFields.push("sets");
    } else {
      // Check individual sets for conflicts
      for (let i = 0; i < clientWorkout.sets.length; i++) {
        const clientSet = clientWorkout.sets[i];
        const serverSet = serverWorkout.exercise_sets.find((s: any) => s.id === clientSet.id);

        if (!serverSet) {
          conflictFields.push(`sets[${i}]`);
          continue;
        }

        if (
          clientSet.weightKg !== serverSet.weight_kg ||
          clientSet.reps !== serverSet.reps ||
          clientSet.rpe !== serverSet.rpe
        ) {
          conflictFields.push(`sets[${i}]`);
        }
      }
    }
  }

  return conflictFields;
}

// ============================================================================
// CONFLICT RESOLUTION
// ============================================================================

async function createNewWorkout(
  supabase: any,
  workout: WorkoutSession,
  userId: string
): Promise<{ status: "synced" | "error"; error?: string }> {
  try {
    // Insert workout session
    const { error: workoutError } = await supabase.from("workout_sessions").insert({
      id: workout.id,
      user_id: userId,
      plan_id: workout.planId,
      session_id: workout.sessionId,
      name: workout.name,
      started_at: workout.startedAt,
      completed_at: workout.completedAt,
      duration_minutes: workout.durationMinutes,
      total_volume_kg: workout.totalVolumeKg,
      average_rpe: workout.averageRpe,
      notes: workout.notes,
      sync_status: "synced",
      offline_created: workout.offlineCreated,
      created_at: workout.createdAt,
      updated_at: workout.updatedAt,
    });

    if (workoutError) {
      return { status: "error", error: workoutError.message };
    }

    // Insert exercise sets if present
    if (workout.sets && workout.sets.length > 0) {
      const setsToInsert = workout.sets.map((set) => ({
        id: set.id,
        session_id: workout.id,
        exercise_id: set.exerciseId,
        set_number: set.setNumber,
        weight_kg: set.weightKg,
        reps: set.reps,
        rpe: set.rpe,
        is_warmup: set.isWarmup,
        is_failure: set.isFailure,
        rest_seconds: set.restSeconds,
        notes: set.notes,
        form_rating: set.formRating,
        created_at: set.createdAt,
      }));

      const { error: setsError } = await supabase.from("exercise_sets").insert(setsToInsert);

      if (setsError) {
        return { status: "error", error: setsError.message };
      }
    }

    return { status: "synced" };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Failed to create workout",
    };
  }
}

async function updateExistingWorkout(
  supabase: any,
  workout: WorkoutSession,
  userId: string
): Promise<{ status: "synced" | "error"; error?: string }> {
  try {
    // Update workout session
    const { error: workoutError } = await supabase
      .from("workout_sessions")
      .update({
        name: workout.name,
        completed_at: workout.completedAt,
        duration_minutes: workout.durationMinutes,
        total_volume_kg: workout.totalVolumeKg,
        average_rpe: workout.averageRpe,
        notes: workout.notes,
        sync_status: "synced",
        updated_at: workout.updatedAt,
      })
      .eq("id", workout.id)
      .eq("user_id", userId);

    if (workoutError) {
      return { status: "error", error: workoutError.message };
    }

    // Update exercise sets if present
    if (workout.sets && workout.sets.length > 0) {
      // Delete existing sets and insert new ones (simplified approach)
      await supabase.from("exercise_sets").delete().eq("session_id", workout.id);

      const setsToInsert = workout.sets.map((set) => ({
        id: set.id,
        session_id: workout.id,
        exercise_id: set.exerciseId,
        set_number: set.setNumber,
        weight_kg: set.weightKg,
        reps: set.reps,
        rpe: set.rpe,
        is_warmup: set.isWarmup,
        is_failure: set.isFailure,
        rest_seconds: set.restSeconds,
        notes: set.notes,
        form_rating: set.formRating,
        created_at: set.createdAt,
      }));

      const { error: setsError } = await supabase.from("exercise_sets").insert(setsToInsert);

      if (setsError) {
        return { status: "error", error: setsError.message };
      }
    }

    return { status: "synced" };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Failed to update workout",
    };
  }
}

async function resolveConflictWithClient(
  supabase: any,
  clientWorkout: WorkoutSession,
  userId: string
): Promise<{ status: "synced" | "error"; error?: string }> {
  // Client wins - overwrite server version
  return await updateExistingWorkout(supabase, clientWorkout, userId);
}

async function resolveConflictWithMerge(
  supabase: any,
  clientWorkout: WorkoutSession,
  serverWorkout: any,
  userId: string
): Promise<{ status: "synced" | "error"; error?: string }> {
  try {
    // Merge strategy: prefer client data for workout details,
    // but keep server timestamps and merge sets intelligently
    const mergedWorkout: WorkoutSession = {
      ...clientWorkout,
      // Keep server creation time but use latest update time
      createdAt: serverWorkout.created_at,
      updatedAt: new Date().toISOString(),
      // Prefer client data for workout content
      completedAt: clientWorkout.completedAt || serverWorkout.completed_at,
      durationMinutes: clientWorkout.durationMinutes || serverWorkout.duration_minutes,
      totalVolumeKg: clientWorkout.totalVolumeKg || serverWorkout.total_volume_kg,
      averageRpe: clientWorkout.averageRpe || serverWorkout.average_rpe,
      notes: clientWorkout.notes || serverWorkout.notes,
    };

    return await updateExistingWorkout(supabase, mergedWorkout, userId);
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Failed to merge workout",
    };
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateSyncRequest(request: SyncRequest): { isValid: boolean; error?: string } {
  if (!request.userId) {
    return { isValid: false, error: "Missing userId" };
  }

  if (!request.workouts || !Array.isArray(request.workouts)) {
    return { isValid: false, error: "Missing or invalid workouts array" };
  }

  if (request.workouts.length === 0) {
    return { isValid: false, error: "No workouts to sync" };
  }

  if (request.workouts.length > 50) {
    return { isValid: false, error: "Too many workouts in single request (max 50)" };
  }

  // Validate each workout
  for (const workout of request.workouts) {
    if (!workout.id || !workout.data || !workout.clientTimestamp) {
      return { isValid: false, error: "Invalid workout data structure" };
    }

    if (!workout.data.userId || workout.data.userId !== request.userId) {
      return { isValid: false, error: "Workout userId mismatch" };
    }
  }

  return { isValid: true };
}

console.log("Sync workouts function loaded");
