# Implementation Plan

[Overview]
Single sentence describing the overall goal.

Refactor and simplify the "next / resume workout" progression system so that user_workout_progress is the single source of truth for the next planned workout while preserving workout_sessions for history; create progress rows on first set, use last_workout_session_id to determine resumable sessions, support multiple concurrent programs, and hide the Next/Resume UI until the first set creates progress.

This implementation reduces complexity by removing ad-hoc history scans at navigation time, clarifies semantics between planned sessions and logged sessions, and keeps analytics/history intact via workout_sessions. It fits the existing architecture by updating only the progression helpers and the places that create sessions (ExerciseDetailScreen.handleSetComplete and workoutService.completeWorkout), exposing a small set of new DB helper methods in database.service to simplify checks (getUserAllWorkoutProgress, getWorkoutSessionById). The UI changes are minimal (hide Next/Resume card when no progress; derive repetition from saved progress). Because no production users exist, we will truncate existing user_workout_progress rows during migration.

[Types]  
Single sentence describing the type system changes.

Add/clarify types for a simpler progress row and a small helper type for next/position calculation.

Detailed type definitions, interfaces, enums, or data structures with complete specifications. Include field names, types, validation rules, and relationships.

- Existing: src/types/workoutProgress.ts

  - UserWorkoutProgress (current):
    - id: string
    - userId: string
    - planId: string
    - currentPhaseNumber: number
    - currentRepetition: number
    - currentDayNumber: number
    - lastCompletedSessionId?: string | null
    - lastWorkoutSessionId?: string | null
    - completedAt?: string | null
    - updatedAt: string
    - createdAt: string

- Updated type clarifications (no code files changed here yet; types doc change for implementers):

  - Semantics:
    - currentPhaseNumber (integer > 0): Represents the phase that the user will do next (or the current phase if an in-progress session exists). Same semantics as DB column current_phase_number.
    - currentRepetition (integer > 0): The repetition cycle for the phase (1..phase_repetitions). Will be derived from existing progress during session creation if not present.
    - currentDayNumber (integer > 0): The day within the phase the user should perform next.
    - lastWorkoutSessionId (uuid | null): References workout_sessions.id for the most recent session created for this plan and user. This will be used to determine if a resume button should show (resume only if this session exists and completed_at IS NULL).
    - completedAt (timestamp | null): Non-null when the program is fully completed for the user.

- New helper types (to be added where needed in code):
  - NextPosition:
    - phase: number
    - repetition: number
    - day: number
    - isComplete: boolean

[Files]
Single sentence describing file modifications.

Modify service files that implement progression, the UI screen that creates sessions on first set, and add a migration to clear old progress; update small helper code paths in workoutPlanService to read from user_workout_progress and last_workout_session_id.

Detailed breakdown:

- New files to be created (path and purpose)

  - None required for core logic; will add functions in existing services.

- Existing files to be modified (with specific changes)

  - supabase/migrations/20251015000001_add_workout_progress_tracking.sql
    - Add an additional migration (new file) to DROP COLUMN last_completed_session_id and TRUNCATE user_workout_progress (since no users will be affected). Provide the SQL snippet to run during deployment.
    - New migration path: supabase/migrations/20251029000001_simplify_user_workout_progress.sql (example timestamp)
  - src/services/database.service.ts
    - Add/modify public methods:
      - getUserWorkoutProgress(userId: string, planId: string): Promise<any | null> (already exists; ensure semantics unchanged)
      - updateUserWorkoutProgress(userId: string, planId: string, updates: Partial<any>): Promise<any> (already exists; will be used unchanged)
      - getUserAllWorkoutProgress(userId: string): Promise<any[]> (NEW) — returns all progress rows for the user (one per plan).
      - getWorkoutSessionById(sessionId: string): Promise<any | null> (NEW) — return a workout_session row (includes completed_at).
      - Optionally add getMostRecentIncompleteSession(userId: string, planId: string): Promise<any | null> (not required because we will rely on last_workout_session_id).
    - Remove internal dependence on calculateProgressFromHistory for navigation-time decisions (do not delete the old helper in-place until code is refactored; plan to stop calling it).
  - src/services/workoutPlan.service.ts
    - Modify getNextWorkout(userId: string, planId: string): Promise<NextWorkoutInfo> to:
      - Read the progress row via databaseService.getUserWorkoutProgress()
      - If no progress, return { type: "none" } or null (UI will treat null as "no progress" and hide the card)
      - If progress.completed_at non-null -> return type "complete"
      - If progress.last_workout_session_id references a session with completed_at IS NULL then include resumeSession (derive fields: workoutSessionId, planId, phaseId = `phase${progress.currentPhaseNumber}`, sessionId = progress.last_workout_session_id's session_id / the planned session reference in workout_sessions row; workoutName from the session row)
      - nextSession comes from calling findNextSession(planId, progress.currentPhaseNumber, progress.currentRepetition, progress.currentDayNumber)
      - Ensure returned NextWorkoutInfo aligns with src/types/workoutProgress.ts
    - Remove fallback logic that calculates progress from history for navigation decisions (we still have calculateProgressFromHistory in DB service but it will not be used for navigation).
  - src/services/workout.service.ts
    - In startWorkout: unchanged (already creates a workout_sessions row via databaseService.insertWorkoutSession).
    - In addExerciseSet: unchanged.
    - In completeWorkout(notes?: string): after updating workout_sessions to set completed_at, update user_workout_progress to advance to the next position:
      - Use the existing progress row (read it), compute next position with a helper using in-memory plan metadata (via workoutPlanService.findNextSession or a small calculateNextPosition helper), update user_workout_progress with new current_phase_number/current_repetition/current_day_number, set last_workout_session_id to the completed workout_session.id and set completed_at if program is complete.
  - src/screens/workout/ExerciseDetailScreen.tsx
    - Modify handleSetComplete:
      - When !workoutService.hasActiveWorkout(), start workout via workoutService.startWorkout(...) (already happens)
      - Immediately after confirming startResult.success, call databaseService.updateUserWorkoutProgress(userId, programId, { current_phase_number: ..., current_repetition: ..., current_day_number: ..., last_workout_session_id: startResult.data.id })
      - Derive repetition from existing progress row if present (databaseService.getUserWorkoutProgress) otherwise default to 1 (Option A chosen).
      - Ensure the UI still shows "Next" / "Resume" based on the updated progress values in workoutPlanService.getNextWorkoutForUser and the NextWorkoutCard behavior which hides itself when no progress exists.
  - src/screens/workout/ProgramSelectionScreen.tsx
    - No deep changes to UI other than treating null from workoutPlanService.getNextWorkoutForUser as "no progress" and hiding the NextWorkoutCard (already handled in code — NextWorkoutCard returns null when info is null).
    - Ensure handleStartNext uses navigation to the nextSession fields without creating new sessions (progress already points to next workout).
  - src/components/workout/NextWorkoutCard.tsx
    - No code changes required beyond existing behavior, but ensure ProgramSelectionScreen hides it when getNextWorkoutForUser returns null.

- Files to be deleted or moved

  - No files deleted. A DB column (last_completed_session_id) will be dropped in migration.

- Configuration file updates
  - Add new migration SQL file supabase/migrations/20251029000001_simplify_user_workout_progress.sql with:
    - ALTER TABLE user_workout_progress DROP COLUMN IF EXISTS last_completed_session_id;
    - TRUNCATE TABLE user_workout_progress;
    - CREATE INDEX IF NOT EXISTS idx_user_workout_progress_user_plan ON public.user_workout_progress(user_id, plan_id); (if needed)
  - Update any deployment notes to indicate the migration will truncate the table and must be run only when it's acceptable to remove progress (user said safe).

[Functions]
Single sentence describing function modifications.

Add a few small DB helper functions and update existing getNextWorkout / completeWorkout / handleSetComplete call sites to use the simplified progress semantics.

Detailed breakdown:

- New functions

  - database.service.getUserAllWorkoutProgress(userId: string): Promise<any[]]
    - Purpose: return all user_workout_progress rows for the user (used by ProgramSelection to support multi-program display if desired).
    - File: src/services/database.service.ts
  - database.service.getWorkoutSessionById(sessionId: string): Promise<any | null]
    - Purpose: fetch a single workout_sessions row (used to check completed_at when evaluating resume).
    - File: src/services/database.service.ts
  - workoutPlanService.calculateNextPosition(planId: string, currentPhase: number, currentRep: number, currentDay: number): Promise<NextPosition>
    - Purpose: compute the next phase/repetition/day (returns isComplete flag). This can be implemented by calling findNextSession for the current position and interpreting the result.
    - File: src/services/workoutPlan.service.ts (private helper or exported helper)

- Modified functions

  - workoutPlanService.getNextWorkout(userId: string, planId: string)
    - Current path: src/services/workoutPlan.service.ts (function already exists)
    - Required changes:
      - If no progress row exists: return null (so UI hides Next/Resume)
      - If progress.completedAt: return { type: "complete" }
      - Determine resumeSession by reading progress.last_workout_session_id and fetching that session with databaseService.getWorkoutSessionById()
      - Build nextSession using existing findNextSession() called with progress current\_ fields
      - Remove fallback that recalculates progress by scanning history for navigation decisions
  - workoutService.completeWorkout(notes?: string)
    - Current path: src/services/workout.service.ts
    - Required changes:
      - After setting completed_at on the workout_session, call workoutPlanService.calculateNextPosition or workoutPlanService.findNextSession to determine the next progress position
      - Update user_workout_progress via databaseService.updateUserWorkoutProgress(userId, planId, { current_phase_number, current_repetition, current_day_number, last_workout_session_id: completedSessionId, completed_at: ...if program complete... })
      - Do not call databaseService.calculateProgressFromHistory for navigation-time updates (we may keep it for analytics but won't rely on it)
  - ExerciseDetailScreen.handleSetComplete
    - File: src/screens/workout/ExerciseDetailScreen.tsx
    - Required changes:
      - After workoutService.startWorkout() on first set, fetch current progress for plan (databaseService.getUserWorkoutProgress)
      - Use its currentRepetition or default to 1
      - Call databaseService.updateUserWorkoutProgress(...) with the plan/phase/day and last_workout_session_id set to the created session id

- Removed functions (name, file, reason, migration strategy)
  - None strictly removed in this step; previous calculateProgressFromHistory remains in database.service but will no longer be used for navigation decisions. A future cleanup task can remove it once code is verified.

[Classes]
Single sentence describing class modifications.

No new classes required; adjust methods in existing service classes DatabaseService, WorkoutPlanService, WorkoutService.

Detailed breakdown:

- Modified classes
  - DatabaseService (src/services/database.service.ts)
    - Add methods: getUserAllWorkoutProgress, getWorkoutSessionById
    - Keep existing getUserWorkoutProgress / updateUserWorkoutProgress semantics but ensure caching/TTL invalidation when updating progress (call clearCache("user_workout_progress")).
  - WorkoutPlanService (src/services/workoutPlan.service.ts)
    - Modify getNextWorkout to rely on user_workout_progress row and last_workout_session_id rather than scanning history.
    - Add helper calculateNextPosition/findNextSession usage to compute next planned session.
  - WorkoutService (src/services/workout.service.ts)
    - Modify completeWorkout to update user_workout_progress after a workout finishes (advance to next position).
- New classes
  - None.

[Dependencies]
Single sentence describing dependency modifications.

No new external packages required.

Details of new packages, version changes, and integration requirements.

- No npm/pip dependencies to add.
- Database migration applied to supabase (SQL only).
- Ensure supabase auth and DB client permissions allow the new query operations (no role changes expected).

[Testing]
Single sentence describing testing approach.

Add unit tests and integration tests for progression logic, and manual QA steps to verify next/resume behavior for multiple edge cases.

Test file requirements, existing test modifications, and validation strategies.

- Add or update tests (if a test framework exists). Suggested tests:
  - Unit: workoutPlanService.getNextWorkout should:
    - Return null when no progress exists
    - Return resume + next when last_workout_session_id points to an incomplete session and progress points to same day
    - Return next only when last_workout_session_id is completed or not set
    - Correctly compute next position when end of repetition/phase reached
  - Integration: workoutService.completeWorkout should:
    - Set completed_at on workout_sessions
    - Update user_workout_progress to point to next position (or completed_at when program done)
  - UI manual QA checklist:
    - Fresh user: Next/Resume card hidden before the first set
    - Creating first set creates session and progress row
    - Incomplete session shows Resume + Next
    - Completing next session correctly clears Resume and advances Next
    - Multi-program tests: starting and switching between programs shows per-plan progress rows

[Implementation Order]
Single sentence describing the implementation sequence.

Perform schema migration first (drop column + truncate), then add DB helpers, then update service methods, then update ExerciseDetailScreen UI wiring, then run tests and manual QA.

Numbered steps showing the logical order of changes to minimize conflicts and ensure successful integration.

1. Create DB migration: supabase/migrations/20251029000001_simplify_user_workout_progress.sql
   - DROP COLUMN last_completed_session_id if exists
   - TRUNCATE TABLE user_workout_progress
   - (Optional) create index if not present
   - Reason: start with clean progress rows as per user instruction and remove misleading FK.
2. Add DB helper functions to src/services/database.service.ts:
   - getUserAllWorkoutProgress(userId: string)
   - getWorkoutSessionById(sessionId: string)
   - Ensure clearCache("user_workout_progress") is called on updateUserWorkoutProgress upserts
3. Update workoutPlanService.getNextWorkout to:
   - Return null if no progress row exists
   - Use progress.last_workout_session_id and getWorkoutSessionById to decide resume visibility
   - Use existing findNextSession to compute nextSession
4. Update ExerciseDetailScreen.handleSetComplete to:
   - Call workoutService.startWorkout(...) if no active workout (already present)
   - Immediately after successful start, call databaseService.getUserWorkoutProgress and databaseService.updateUserWorkoutProgress with current phase/day and last_workout_session_id set to the created session id (repetition derived from current progress or default 1)
5. Update workoutService.completeWorkout to:
   - After marking workout*sessions.completed_at, call workoutPlanService.calculateNextPosition/findNextSession to compute next position and update user_workout_progress with new current*\* fields, last_workout_session_id (set to completed session id), plus completed_at if program complete
6. Update ProgramSelectionScreen behavior (minor):
   - Treat null from workoutPlanService.getNextWorkoutForUser as "no progress" and hide NextWorkoutCard (already handled)
   - Ensure handleStartNext navigates to session indicated by nextSession fields without creating new session rows
7. Update tests and run unit/integration tests and manual QA (see Testing section)
8. Deploy DB migration, run integration tests against staging, then deploy application code.

Notes and edge cases:

- Repetition derivation: derive from existing progress row if present; default to 1 when creating progress on first set.
- Resume semantics: only resume the session referenced by last_workout_session_id and only when that session.completed_at IS NULL.
- Multi-program support: getNextWorkoutForUser should prefer plan context from most recent session or allow listing progress per plan in ProgramSelectionScreen later.
- Migration truncates existing user_workout_progress rows; ensure backups or export if needed prior to running migration despite no production users.
