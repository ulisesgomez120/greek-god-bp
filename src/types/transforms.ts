// ============================================================================
// TYPE TRANSFORMATIONS
// ============================================================================
// Transforms between database types (snake_case) and application types (camelCase)

import type {
  UserProfile as DbUserProfile,
  WorkoutSession as DbWorkoutSession,
  ExerciseSet as DbExerciseSet,
  Exercise as DbExercise,
  WorkoutPlan as DbWorkoutPlan,
  WorkoutPlanSession as DbWorkoutPlanSession,
  PlannedExercise as DbPlannedExercise,
  Subscription as DbSubscription,
  SubscriptionPlan as DbSubscriptionPlan,
  AIUsageTracking as DbAIUsageTracking,
  MonthlyReview as DbMonthlyReview,
  ExperienceLevel as DbExperienceLevel,
  MuscleGroup as DbMuscleGroup,
  Equipment as DbEquipment,
} from "./database";

import type {
  UserProfile,
  WorkoutSession,
  ExerciseSet,
  Exercise,
  WorkoutPlan,
  Subscription,
  SubscriptionPlan,
  ExperienceLevel,
  TutorialVideo,
} from "./index";

// ============================================================================
// TRANSFORMATION FUNCTIONS
// ============================================================================

export function transformUserProfile(dbProfile: DbUserProfile): UserProfile {
  return {
    id: dbProfile.id,
    email: dbProfile.email,
    displayName: dbProfile.display_name,
    experienceLevel: dbProfile.experience_level as ExperienceLevel,
    createdAt: dbProfile.created_at,
    updatedAt: dbProfile.updated_at,
  };
}

export function transformUserProfileToDb(profile: Partial<UserProfile>): Partial<DbUserProfile> {
  const dbProfile: Partial<DbUserProfile> = {};

  // Basic / identity fields
  if (profile.id) dbProfile.id = profile.id;
  if (profile.email) dbProfile.email = profile.email;
  if (profile.displayName) dbProfile.display_name = profile.displayName;
  if (profile.experienceLevel) dbProfile.experience_level = profile.experienceLevel;
  if (profile.createdAt) dbProfile.created_at = profile.createdAt;
  if (profile.updatedAt) dbProfile.updated_at = profile.updatedAt;

  // Profile fields used by ProfileEditScreen
  if ((profile as any).heightCm !== undefined) (dbProfile as any).height_cm = (profile as any).heightCm;
  if ((profile as any).weightKg !== undefined) (dbProfile as any).weight_kg = (profile as any).weightKg;
  if ((profile as any).birthDate !== undefined) (dbProfile as any).birth_date = (profile as any).birthDate;
  if ((profile as any).gender !== undefined) (dbProfile as any).gender = (profile as any).gender;
  if ((profile as any).fitnessGoals !== undefined) (dbProfile as any).fitness_goals = (profile as any).fitnessGoals;
  if ((profile as any).onboardingCompleted !== undefined)
    (dbProfile as any).onboarding_completed = (profile as any).onboardingCompleted;

  // Preferences (map canonical preference fields)
  if ((profile as any).preferences !== undefined) {
    const prefs = (profile as any).preferences;
    if (prefs && typeof prefs.useMetric !== "undefined") {
      (dbProfile as any).use_metric = Boolean(prefs.useMetric);
    }
  }

  // Privacy settings - map nested privacySettings object to normalized DB columns
  if ((profile as any).privacySettings !== undefined) {
    const ps = (profile as any).privacySettings;
    if (ps && typeof ps.dataSharing !== "undefined") (dbProfile as any).privacy_data_sharing = Boolean(ps.dataSharing);
    if (ps && typeof ps.analytics !== "undefined") (dbProfile as any).privacy_analytics = Boolean(ps.analytics);
    if (ps && typeof ps.aiCoaching !== "undefined") (dbProfile as any).privacy_ai_coaching = Boolean(ps.aiCoaching);
    if (ps && typeof ps.workoutSharing !== "undefined")
      (dbProfile as any).privacy_workout_sharing = Boolean(ps.workoutSharing);
    if (ps && typeof ps.progressSharing !== "undefined")
      (dbProfile as any).privacy_progress_sharing = Boolean(ps.progressSharing);
  }

  return dbProfile;
}

export function transformWorkoutSession(dbSession: DbWorkoutSession): WorkoutSession {
  return {
    id: dbSession.id,
    userId: dbSession.user_id,
    planId: dbSession.plan_id || undefined,
    sessionId: dbSession.session_id || undefined,
    name: dbSession.name,
    startedAt: dbSession.started_at,
    completedAt: dbSession.completed_at || undefined,
    durationMinutes: dbSession.duration_minutes || undefined,
    notes: dbSession.notes || undefined,
    totalVolumeKg: dbSession.total_volume_kg || undefined,
    averageRpe: dbSession.average_rpe || undefined,
    createdAt: dbSession.created_at,
    updatedAt: dbSession.updated_at,
  };
}

export function transformWorkoutSessionToDb(session: Partial<WorkoutSession>): Partial<DbWorkoutSession> {
  const dbSession: Partial<DbWorkoutSession> = {};

  if (session.id) dbSession.id = session.id;
  if (session.userId) dbSession.user_id = session.userId;
  if (session.planId) dbSession.plan_id = session.planId;
  if (session.sessionId) dbSession.session_id = session.sessionId;
  if (session.name) dbSession.name = session.name;
  if (session.startedAt) dbSession.started_at = session.startedAt;
  if (session.completedAt) dbSession.completed_at = session.completedAt;
  if (session.durationMinutes) dbSession.duration_minutes = session.durationMinutes;
  if (session.notes) dbSession.notes = session.notes;
  if (session.totalVolumeKg) dbSession.total_volume_kg = session.totalVolumeKg;
  if (session.averageRpe) dbSession.average_rpe = session.averageRpe;
  if (session.createdAt) dbSession.created_at = session.createdAt;
  if (session.updatedAt) dbSession.updated_at = session.updatedAt;

  return dbSession;
}

export function transformExerciseSet(dbSet: DbExerciseSet): ExerciseSet {
  return {
    id: dbSet.id,
    sessionId: dbSet.session_id,
    exerciseId: dbSet.exercise_id,
    plannedExerciseId: dbSet.planned_exercise_id || undefined,
    setNumber: dbSet.set_number,
    weightKg: dbSet.weight_kg || undefined,
    reps: dbSet.reps || 0,
    rpe: dbSet.rpe || undefined,
    isWarmup: dbSet.is_warmup || false,
    isFailure: dbSet.is_failure || false,
    restSeconds: dbSet.rest_seconds || undefined,
    notes: dbSet.notes || undefined,
    createdAt: dbSet.created_at,
  };
}

/**
 * Strict transform used by history/analytics queries where a planned_exercise_id
 * MUST be present. This will throw if the DB row is missing planned_exercise_id,
 * surfacing data integrity issues early and preventing accidental fallback to
 * exercise_id-only filtering.
 */
export function transformExerciseSetStrict(dbSet: DbExerciseSet): ExerciseSet {
  if (!dbSet.planned_exercise_id) {
    throw new Error(`transformExerciseSetStrict: missing planned_exercise_id on exercise_set id=${dbSet.id}`);
  }

  return {
    id: dbSet.id,
    sessionId: dbSet.session_id,
    exerciseId: dbSet.exercise_id,
    plannedExerciseId: dbSet.planned_exercise_id,
    setNumber: dbSet.set_number,
    weightKg: dbSet.weight_kg || undefined,
    reps: dbSet.reps || 0,
    rpe: dbSet.rpe || undefined,
    isWarmup: dbSet.is_warmup || false,
    isFailure: dbSet.is_failure || false,
    restSeconds: dbSet.rest_seconds || undefined,
    notes: dbSet.notes || undefined,
    createdAt: dbSet.created_at,
  };
}

export function transformExerciseSetToDb(set: Partial<ExerciseSet>): Partial<DbExerciseSet> {
  const dbSet: Partial<DbExerciseSet> = {};

  if (set.id) dbSet.id = set.id;
  if (set.sessionId) dbSet.session_id = set.sessionId;
  if (set.exerciseId) dbSet.exercise_id = set.exerciseId;
  if (set.plannedExerciseId) dbSet.planned_exercise_id = set.plannedExerciseId;
  if (set.setNumber) dbSet.set_number = set.setNumber;
  if (set.weightKg) dbSet.weight_kg = set.weightKg;
  if (set.reps !== undefined) dbSet.reps = set.reps;
  if (set.rpe) dbSet.rpe = set.rpe;
  if (set.isWarmup !== undefined) dbSet.is_warmup = set.isWarmup;
  if (set.isFailure !== undefined) dbSet.is_failure = set.isFailure;
  if (set.restSeconds) dbSet.rest_seconds = set.restSeconds;
  if (set.notes) dbSet.notes = set.notes;
  if (set.createdAt) dbSet.created_at = set.createdAt;

  return dbSet;
}

export function transformExercise(dbExercise: DbExercise): Exercise {
  return {
    id: dbExercise.id,
    name: dbExercise.name,
    category: dbExercise.primary_muscle, // Map primary muscle to category
    muscleGroups: dbExercise.muscle_groups,
    equipment: dbExercise.equipment,
    instructions: Array.isArray(dbExercise.instructions)
      ? (dbExercise.instructions as string[])
      : dbExercise.instructions
      ? [String(dbExercise.instructions)]
      : [],
    tips: dbExercise.form_cues || [],
    videoUrl: dbExercise.demo_video_url || undefined,
    imageUrl: undefined, // Not in current schema
    isCompound: dbExercise.is_compound || false,
    difficulty: mapDifficultyToString(dbExercise.difficulty || 2),
    createdAt: dbExercise.created_at,
  };
}

export function transformWorkoutPlan(dbPlan: DbWorkoutPlan): WorkoutPlan {
  return {
    id: dbPlan.id,
    name: dbPlan.name,
    description: dbPlan.description || "",
    experienceLevel: dbPlan.target_experience[0] as ExperienceLevel, // Take first target experience
    durationWeeks: dbPlan.duration_weeks || 0,
    sessionsPerWeek: dbPlan.frequency_per_week || 0,
    exercises: [], // Would need to be populated from related data
    isActive: dbPlan.is_public || false,
    createdAt: dbPlan.created_at,
    updatedAt: dbPlan.updated_at,
  };
}

export function normalizePlanSummary(plan: any): any {
  const id = plan.id;
  const name = plan.name;
  const description = plan.description || "";

  const type = (plan.type || plan.plan_type || plan.typeName || "full_body") as
    | "full_body"
    | "upper_lower"
    | "body_part_split";

  const frequencyPerWeek = Number(plan.frequency_per_week || plan.sessionsPerWeek || plan.frequencyPerWeek || 0);
  const durationWeeks = Number(plan.duration_weeks || plan.durationWeeks || 0);

  const difficulty = Number(plan.difficulty || (plan.level ? Number(plan.level) : 1));

  let targetExperience: string[] = [];
  if (Array.isArray(plan.target_experience) && plan.target_experience.length) {
    targetExperience = plan.target_experience;
  } else if (Array.isArray(plan.targetExperience) && plan.targetExperience.length) {
    targetExperience = plan.targetExperience;
  } else if (typeof plan.targetExperience === "string" && plan.targetExperience) {
    targetExperience = [plan.targetExperience];
  } else if (plan.experienceLevel) {
    targetExperience = [plan.experienceLevel];
  }

  return {
    id,
    name,
    description,
    type,
    frequencyPerWeek,
    durationWeeks,
    difficulty,
    targetExperience,
  };
}

export function transformSubscription(dbSubscription: DbSubscription): Subscription {
  return {
    id: dbSubscription.id,
    userId: dbSubscription.user_id,
    planId: dbSubscription.plan_id,
    status: dbSubscription.status,
    currentPeriodStart: dbSubscription.current_period_start,
    currentPeriodEnd: dbSubscription.current_period_end,
    cancelAtPeriodEnd: dbSubscription.cancel_at_period_end || false,
    canceledAt: dbSubscription.canceled_at || undefined,
    trialStart: dbSubscription.trial_start || undefined,
    trialEnd: dbSubscription.trial_end || undefined,
    createdAt: dbSubscription.created_at,
    updatedAt: dbSubscription.updated_at,
  };
}

export function transformSubscriptionPlan(dbPlan: DbSubscriptionPlan): SubscriptionPlan {
  return {
    id: dbPlan.id,
    name: dbPlan.name,
    description: dbPlan.description || "",
    priceCents: dbPlan.price_cents,
    interval: dbPlan.interval,
    features: Array.isArray(dbPlan.features) ? (dbPlan.features as string[]) : [],
    maxAiQueries: dbPlan.max_ai_queries || 0,
    maxCustomWorkouts: dbPlan.max_custom_workouts || 0,
    maxClients: dbPlan.max_clients || 0,
    isActive: dbPlan.is_active || false,
    sortOrder: dbPlan.sort_order || 0,
    createdAt: dbPlan.created_at,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function mapDifficultyToString(difficulty: number): "beginner" | "intermediate" | "advanced" {
  if (difficulty <= 2) return "beginner";
  if (difficulty <= 4) return "intermediate";
  return "advanced";
}

function mapDifficultyToNumber(difficulty: "beginner" | "intermediate" | "advanced"): number {
  switch (difficulty) {
    case "beginner":
      return 2;
    case "intermediate":
      return 3;
    case "advanced":
      return 5;
    default:
      return 2;
  }
}

export function normalizePlannedExercises(planned?: (DbPlannedExercise & { exercises?: DbExercise })[]): any[] {
  if (!planned) return [];
  return planned.map((pe) => {
    return {
      // `id` represents the base exercise id used by UI lists.
      id: pe.exercise_id ?? pe.exercises?.id ?? (pe as any).id,
      // Expose the planned_exercises row id separately so callers can reference the specific planned exercise instance.
      plannedExerciseId: pe.id,
      name: pe.exercises?.name ?? (pe as any).name ?? "Unknown Exercise",
      targetSets: (pe as any).target_sets ?? (pe as any).targetSets ?? 0,
      targetRepsMin: (pe as any).target_reps_min ?? (pe as any).targetRepsMin ?? 0,
      targetRepsMax: (pe as any).target_reps_max ?? (pe as any).targetRepsMax ?? 0,
      targetRpe: (pe as any).target_rpe ?? (pe as any).targetRpe ?? undefined,
      restSeconds: (pe as any).rest_seconds ?? (pe as any).restSeconds ?? undefined,
      notes: (pe as any).notes ?? undefined,
    };
  });
}

// ============================================================================
// BATCH TRANSFORMATION FUNCTIONS
// ============================================================================

export function transformWorkoutSessionWithSets(
  dbSession: DbWorkoutSession & { exercise_sets?: DbExerciseSet[] }
): WorkoutSession & { sets?: ExerciseSet[] } {
  const session = transformWorkoutSession(dbSession);

  if (dbSession.exercise_sets) {
    return {
      ...session,
      sets: dbSession.exercise_sets.map(transformExerciseSet),
    };
  }

  return session;
}

export function transformWorkoutPlanWithSessions(
  dbPlan: DbWorkoutPlan & {
    workout_plan_sessions?: (DbWorkoutPlanSession & {
      planned_exercises?: (DbPlannedExercise & { exercises?: DbExercise })[];
    })[];
  }
): WorkoutPlan & { sessions?: any[] } {
  const plan = transformWorkoutPlan(dbPlan);

  if (dbPlan.workout_plan_sessions) {
    const exercises = new Set<string>();

    // Extract all exercise IDs from planned exercises
    dbPlan.workout_plan_sessions.forEach((session) => {
      session.planned_exercises?.forEach((plannedExercise) => {
        exercises.add(plannedExercise.exercise_id);
      });
    });

    return {
      ...plan,
      exercises: Array.from(exercises),
      sessions: dbPlan.workout_plan_sessions,
    };
  }

  return plan;
}

export type DbExerciseTutorialVideo = {
  id: string;
  exercise_id: string;
  title: string;
  url: string;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export function transformExerciseTutorialVideo(dbRow: DbExerciseTutorialVideo): TutorialVideo {
  return {
    id: dbRow.id,
    exerciseId: dbRow.exercise_id,
    title: dbRow.title,
    url: dbRow.url,
    createdBy: dbRow.created_by ?? undefined,
    createdAt: dbRow.created_at,
    updatedAt: dbRow.updated_at ?? undefined,
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isDbUserProfile(obj: any): obj is DbUserProfile {
  return obj && typeof obj.display_name === "string" && typeof obj.experience_level === "string";
}

export function isDbWorkoutSession(obj: any): obj is DbWorkoutSession {
  return obj && typeof obj.user_id === "string" && typeof obj.started_at === "string";
}

export function isDbExerciseSet(obj: any): obj is DbExerciseSet {
  return obj && typeof obj.session_id === "string" && typeof obj.exercise_id === "string";
}
