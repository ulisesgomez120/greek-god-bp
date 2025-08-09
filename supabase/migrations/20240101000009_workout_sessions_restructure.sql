-- ============================================================================
-- WORKOUT PLAN SESSIONS RESTRUCTURE - PHASE-BASED APPROACH
-- ============================================================================
-- This migration restructures workout_plan_sessions to use phases instead of weeks
-- and populates all three workout programs (Full Body, Upper/Lower, Body Part Split)
-- Version: 20240101000009
-- Description: Clean up and repopulate workout sessions with phase-based structure

-- ============================================================================
-- CLEAN UP EXISTING DATA
-- ============================================================================

-- Delete all existing planned exercises and workout plan sessions
-- This cascades from sessions to exercises due to foreign key constraints
DELETE FROM planned_exercises;
DELETE FROM workout_plan_sessions;

-- ============================================================================
-- ADD PHASE SUPPORT TO WORKOUT PLAN SESSIONS
-- ============================================================================

-- Add phase_number column to replace week-based approach
ALTER TABLE workout_plan_sessions ADD COLUMN IF NOT EXISTS phase_number INTEGER DEFAULT 1 CHECK (phase_number > 0);

-- Update the week_number column to be nullable since we're moving to phase-based
ALTER TABLE workout_plan_sessions ALTER COLUMN week_number DROP NOT NULL;

-- ============================================================================
-- POPULATE ALL WORKOUT PROGRAMS WITH PHASE-BASED SESSIONS
-- ============================================================================

DO $$
DECLARE
  full_body_id UUID;
  upper_lower_id UUID;
  body_part_split_id UUID;
  session_id UUID;
  
  -- Exercise IDs - will be populated from the exercises table
  back_squat_id UUID;
  barbell_bench_press_id UUID;
  lat_pulldown_id UUID;
  romanian_deadlift_id UUID;
  assisted_dip_id UUID;
  standing_calf_raise_id UUID;
  dumbbell_supinated_curl_id UUID;
  deadlift_id UUID;
  overhead_press_id UUID;
  chest_supported_tbar_row_id UUID;
  leg_extension_id UUID;
  cable_flye_id UUID;
  crunch_id UUID;
  dumbbell_skull_crusher_id UUID;
  dumbbell_walking_lunge_id UUID;
  dumbbell_incline_press_id UUID;
  reverse_grip_lat_pulldown_id UUID;
  barbell_hip_thrust_id UUID;
  seated_face_pull_id UUID;
  dumbbell_lateral_raise_id UUID;
  lying_leg_curl_id UUID;
  dumbbell_seated_shoulder_press_id UUID;
  single_arm_pulldown_id UUID;
  pec_deck_id UUID;
  reverse_pec_deck_id UUID;
  cable_lateral_raise_id UUID;
  close_grip_bench_press_id UUID;
  dumbbell_row_id UUID;
  bicycle_crunch_id UUID;
  single_arm_cable_curl_id UUID;
  neutral_grip_pulldown_id UUID;
  single_arm_rope_tricep_extension_id UUID;
  goblet_squat_id UUID;
  dumbbell_single_leg_hip_thrust_id UUID;
  leg_press_id UUID;
  ez_bar_curl_id UUID;
  seated_leg_curl_id UUID;
  hanging_leg_raise_id UUID;
  machine_seated_hip_abduction_id UUID;
  barbell_bent_over_row_id UUID;
  cable_seated_row_id UUID;
  hammer_curl_id UUID;
  single_leg_leg_extension_id UUID;
  single_leg_lying_leg_curl_id UUID;
  plank_id UUID;
  machine_incline_chest_press_id UUID;
  cable_tricep_kickback_id UUID;
  cable_reverse_flye_id UUID;
  bent_over_reverse_dumbbell_flye_id UUID;
  dumbbell_floor_press_id UUID;
  
BEGIN
  -- Get workout plan IDs
  SELECT id INTO full_body_id FROM workout_plans WHERE name = 'Full Body Program';
  SELECT id INTO upper_lower_id FROM workout_plans WHERE name = 'Upper/Lower Program';
  SELECT id INTO body_part_split_id FROM workout_plans WHERE name = 'Body Part Split Program';
  
  -- Get exercise IDs
  SELECT id INTO back_squat_id FROM exercises WHERE name = 'Back Squat';
  SELECT id INTO barbell_bench_press_id FROM exercises WHERE name = 'Barbell Bench Press';
  SELECT id INTO lat_pulldown_id FROM exercises WHERE name = 'Lat Pulldown';
  SELECT id INTO romanian_deadlift_id FROM exercises WHERE name = 'Romanian Deadlift';
  SELECT id INTO assisted_dip_id FROM exercises WHERE name = 'Assisted Dip';
  SELECT id INTO standing_calf_raise_id FROM exercises WHERE name = 'Standing Calf Raise';
  SELECT id INTO dumbbell_supinated_curl_id FROM exercises WHERE name = 'Dumbbell Supinated Curl';
  SELECT id INTO deadlift_id FROM exercises WHERE name = 'Deadlift';
  SELECT id INTO overhead_press_id FROM exercises WHERE name = 'Overhead Press';
  SELECT id INTO chest_supported_tbar_row_id FROM exercises WHERE name = 'Chest-Supported T-Bar Row';
  SELECT id INTO leg_extension_id FROM exercises WHERE name = 'Leg Extension';
  SELECT id INTO cable_flye_id FROM exercises WHERE name = 'Cable Flye';
  SELECT id INTO crunch_id FROM exercises WHERE name = 'Crunch';
  SELECT id INTO dumbbell_skull_crusher_id FROM exercises WHERE name = 'Dumbbell Skull Crusher';
  SELECT id INTO dumbbell_walking_lunge_id FROM exercises WHERE name = 'Dumbbell Walking Lunge';
  SELECT id INTO dumbbell_incline_press_id FROM exercises WHERE name = 'Dumbbell Incline Press';
  SELECT id INTO reverse_grip_lat_pulldown_id FROM exercises WHERE name = 'Reverse-Grip Lat Pulldown';
  SELECT id INTO barbell_hip_thrust_id FROM exercises WHERE name = 'Barbell Hip Thrust';
  SELECT id INTO seated_face_pull_id FROM exercises WHERE name = 'Seated Face Pull';
  SELECT id INTO dumbbell_lateral_raise_id FROM exercises WHERE name = 'Dumbbell Lateral Raise';
  SELECT id INTO lying_leg_curl_id FROM exercises WHERE name = 'Lying Leg Curl';
  SELECT id INTO dumbbell_seated_shoulder_press_id FROM exercises WHERE name = 'Dumbbell Seated Shoulder Press';
  SELECT id INTO single_arm_pulldown_id FROM exercises WHERE name = 'Single-Arm Pulldown';
  SELECT id INTO pec_deck_id FROM exercises WHERE name = 'Pec Deck';
  SELECT id INTO reverse_pec_deck_id FROM exercises WHERE name = 'Reverse Pec Deck';
  SELECT id INTO cable_lateral_raise_id FROM exercises WHERE name = 'Cable Lateral Raise';
  SELECT id INTO close_grip_bench_press_id FROM exercises WHERE name = 'Close-Grip Bench Press';
  SELECT id INTO dumbbell_row_id FROM exercises WHERE name = 'Dumbbell Row';
  SELECT id INTO bicycle_crunch_id FROM exercises WHERE name = 'Bicycle Crunch';
  SELECT id INTO single_arm_cable_curl_id FROM exercises WHERE name = 'Single-Arm Cable Curl';
  SELECT id INTO neutral_grip_pulldown_id FROM exercises WHERE name = 'Neutral-Grip Pulldown';
  SELECT id INTO single_arm_rope_tricep_extension_id FROM exercises WHERE name = 'Single-Arm Rope Tricep Extension';
  SELECT id INTO goblet_squat_id FROM exercises WHERE name = 'Goblet Squat';
  SELECT id INTO dumbbell_single_leg_hip_thrust_id FROM exercises WHERE name = 'Dumbbell Single-Leg Hip Thrust';
  SELECT id INTO leg_press_id FROM exercises WHERE name = 'Leg Press';
  SELECT id INTO ez_bar_curl_id FROM exercises WHERE name = 'EZ Bar Curl';
  SELECT id INTO seated_leg_curl_id FROM exercises WHERE name = 'Seated Leg Curl';
  SELECT id INTO hanging_leg_raise_id FROM exercises WHERE name = 'Hanging Leg Raise';
  SELECT id INTO machine_seated_hip_abduction_id FROM exercises WHERE name = 'Machine Seated Hip Abduction';
  SELECT id INTO barbell_bent_over_row_id FROM exercises WHERE name = 'Barbell Bent Over Row';
  SELECT id INTO cable_seated_row_id FROM exercises WHERE name = 'Cable Seated Row';
  SELECT id INTO hammer_curl_id FROM exercises WHERE name = 'Hammer Curl';
  SELECT id INTO single_leg_leg_extension_id FROM exercises WHERE name = 'Single-Leg Leg Extension';
  SELECT id INTO single_leg_lying_leg_curl_id FROM exercises WHERE name = 'Single-Leg Lying Leg Curl';
  SELECT id INTO plank_id FROM exercises WHERE name = 'Plank';
  SELECT id INTO machine_incline_chest_press_id FROM exercises WHERE name = 'Machine Incline Chest Press';
  SELECT id INTO cable_tricep_kickback_id FROM exercises WHERE name = 'Cable Tricep Kickback';
  SELECT id INTO cable_reverse_flye_id FROM exercises WHERE name = 'Cable Reverse Flye';
  SELECT id INTO bent_over_reverse_dumbbell_flye_id FROM exercises WHERE name = 'Bent Over Reverse Dumbbell Flye';
  SELECT id INTO dumbbell_floor_press_id FROM exercises WHERE name = 'Dumbbell Floor Press';

  -- ============================================================================
  -- FULL BODY PROGRAM
  -- ============================================================================
  
  -- PHASE 1 (4 Week Strength Base)
  
  -- Full Body #1 - Phase 1
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (full_body_id, 'Full Body #1 - Phase 1', 1, 1, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, back_squat_id, 1, 3, 6, 6, 7, 180, 'SIT BACK AND DOWN, 15° TOE FLARE, DRIVE YOUR KNEES OUT LATERALLY'),
    (session_id, barbell_bench_press_id, 2, 3, 8, 8, 7, 180, 'TUCK ELBOWS AT A 45° ANGLE, SQUEEZE YOUR SHOULDER BLADES AND STAY FIRM ON THE BENCH'),
    (session_id, lat_pulldown_id, 3, 3, 10, 10, 8, 120, 'PULL YOUR ELBOWS DOWN AND IN, USE A 1.5X SHOULDER WIDTH GRIP'),
    (session_id, romanian_deadlift_id, 4, 3, 10, 10, 7, 120, 'MAINTAIN A NEUTRAL LOWER BACK, SET YOUR HIPS BACK, DON''T ALLOW YOUR SPINE TO ROUND'),
    (session_id, assisted_dip_id, 5, 3, 8, 8, 7, 60, 'TUCK ELBOWS AT A 45° ANGLE, LEAN YOUR TORSO FORWARD 15°'),
    (session_id, standing_calf_raise_id, 6, 3, 10, 10, 8, 60, 'PRESS ALL THE WAY UP TO YOUR TOES, STRETCH YOUR CALVES AT THE BOTTOM, DON''T BOUNCE'),
    (session_id, dumbbell_supinated_curl_id, 7, 3, 10, 10, 8, 60, 'DRIVE YOUR PINKY INTO THE HANDLE HARDER THAN YOUR POINTER FINGER');

  -- Full Body #2 - Phase 1
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (full_body_id, 'Full Body #2 - Phase 1', 2, 1, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, deadlift_id, 1, 3, 5, 5, 7, 180, 'BRACE YOUR LATS, CHEST TALL, HIPS HIGH, PULL THE SLACK OUT OF THE BAR PRIOR TO MOVING IT OFF THE GROUND'),
    (session_id, overhead_press_id, 2, 3, 8, 8, 8, 180, 'SQUEEZE YOUR GLUTES TO KEEP YOUR TORSO UPRIGHT, CLEAR YOUR HEAD OUT OF THE WAY, PRESS UP AND SLIGHTLY BACK'),
    (session_id, chest_supported_tbar_row_id, 3, 3, 12, 12, 8, 120, 'FOCUS ON SQUEEZING YOUR SHOULDER BLADES TOGETHER AS YOU PULL THE WEIGHT TOWARDS YOU. KEEP YOUR SHOULDERS DOWN (AVOID SHRUGGING).'),
    (session_id, leg_extension_id, 4, 3, 12, 12, 8, 60, 'FOCUS ON SQUEEZING YOUR QUADS TO MAKE THE WEIGHT MOVE'),
    (session_id, cable_flye_id, 5, 3, 12, 12, 8, 60, 'KEEP YOUR ELBOWS SLIGHTLY BENT AT A CONSTANT ANGLE WHILE SQUEEZING YOUR PECS TO MOVE THE WEIGHT'),
    (session_id, crunch_id, 6, 3, 12, 12, 7, 60, 'FOCUS ON FLEXING YOUR SPINE (ROUNDING YOUR BACK), DON''T YANK YOUR HEAD WITH YOUR ARMS'),
    (session_id, dumbbell_skull_crusher_id, 7, 3, 12, 12, 8, 60, 'KEEP YOUR ELBOWS IN LINE WITH THE TOP OF YOUR HEAD, DON''T LET YOUR UPPER ARM MOVE');

  -- Full Body #3 - Phase 1
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (full_body_id, 'Full Body #3 - Phase 1', 3, 1, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, dumbbell_walking_lunge_id, 1, 3, 10, 10, 8, 120, '10 STEPS EACH LEG. TAKE MEDIUM STRIDES, LET YOUR TORSO LEAN FORWARD'),
    (session_id, dumbbell_incline_press_id, 2, 3, 8, 8, 7, 120, 'USE ~45° INCLINE. MIND MUSCLE CONNECTION WITH UPPER PECS.'),
    (session_id, reverse_grip_lat_pulldown_id, 3, 3, 10, 10, 8, 120, 'PULL YOUR ELBOWS DOWN AGAINST YOUR SIDES, USE SHOULDER WIDTH GRIP'),
    (session_id, barbell_hip_thrust_id, 4, 3, 12, 12, 8, 120, 'TUCK YOUR CHIN AND RIB CAGE DOWN, ONLY MOVE YOUR HIPS. USE A PAD'),
    (session_id, seated_face_pull_id, 5, 3, 12, 12, 8, 60, 'PULL YOUR ARMS BACK AND OUT'),
    (session_id, dumbbell_lateral_raise_id, 6, 3, 10, 10, 8, 60, 'RAISE THE DUMBBELL "OUT" NOT "UP", MIND MUSCLE CONNECTION WITH MIDDLE FIBERS'),
    (session_id, lying_leg_curl_id, 7, 3, 10, 10, 8, 60, 'FOCUS ON SQUEEZING YOUR HAMSTRINGS TO MAKE THE WEIGHT MOVE');

  -- PHASE 2 (4 Week Modified Strength Base)
  
  -- Full Body #1 - Phase 2
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (full_body_id, 'Full Body #1 - Phase 2', 1, 2, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, back_squat_id, 1, 3, 8, 8, 8, 180, 'SIT BACK AND DOWN, 15° TOE FLARE, DRIVE YOUR KNEES OUT LATERALLY'),
    (session_id, dumbbell_seated_shoulder_press_id, 2, 3, 10, 10, 8, 180, 'BRING THE DUMBBELL ALL THE WAY DOWN TO YOUR SHOULDERS, KEEP YOUR TORSO UPRIGHT'),
    (session_id, single_arm_pulldown_id, 3, 3, 12, 12, 9, 120, 'START WITH YOUR NON-DOMINANT ARM, MATCH REPS WITH DOMINANT ARM'),
    (session_id, barbell_hip_thrust_id, 4, 3, 8, 8, 9, 120, 'TUCK YOUR CHIN AND RIB CAGE DOWN, ONLY MOVE YOUR HIPS. USE A PAD'),
    (session_id, pec_deck_id, 5, 3, 15, 15, 9, 60, 'NICE STRETCH ON THE PECS AT THE BOTTOM AND FULL SQUEEZE AT THE TOP. CONTROL!'),
    (session_id, reverse_pec_deck_id, 6, 3, 15, 15, 9, 60, 'SWEEP THE WEIGHT OUT AND BACK, MIND MUSCLE CONNECTION WITH REAR DELTS'),
    (session_id, cable_lateral_raise_id, 7, 3, 12, 12, 9, 60, 'LEAN AWAY FROM THE MACHINE, ARMS STRAIGHT OUT TO YOUR SIDE');

  -- Full Body #2 - Phase 2
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (full_body_id, 'Full Body #2 - Phase 2', 2, 2, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, deadlift_id, 1, 3, 3, 3, 8, 180, 'BRACE YOUR LATS, CHEST TALL, HIPS HIGH, PULL THE SLACK OUT OF THE BAR PRIOR TO MOVING IT OFF THE GROUND'),
    (session_id, close_grip_bench_press_id, 2, 3, 5, 5, 7, 180, 'SHOULDER WIDTH GRIP, TUCK YOUR ELBOWS AGAINST YOUR SIDES'),
    (session_id, dumbbell_row_id, 3, 3, 12, 12, 8, 120, 'BRACE ONTO A BENCH FOR SUPPORT, PULL YOUR ELBOW AGAINST YOUR SIDES'),
    (session_id, dumbbell_walking_lunge_id, 4, 3, 12, 12, 8, 60, '12 STEPS EACH LEG. TAKE MEDIUM STRIDES, LET YOUR TORSO LEAN FORWARD'),
    (session_id, assisted_dip_id, 5, 3, 12, 12, 8, 60, 'TUCK ELBOWS AT A 45° ANGLE, LEAN YOUR TORSO FORWARD 15°'),
    (session_id, bicycle_crunch_id, 6, 3, 10, 10, 7, 60, 'FOCUS ON SQUEEZING YOUR ABS AS YOU BRING YOUR LEFT ELBOW TO RIGHT KNEE, RIGHT ELBOW TO LEFT KNEE'),
    (session_id, single_arm_cable_curl_id, 7, 3, 12, 12, 8, 60, 'FACE AWAY FROM THE CABLE YOU ARE USING, KEEP YOUR ARM BEHIND YOUR TORSO');

  -- Full Body #3 - Phase 2
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (full_body_id, 'Full Body #3 - Phase 2', 3, 2, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, back_squat_id, 1, 3, 5, 5, 8, 120, 'SIT BACK AND DOWN, 15° TOE FLARE, DRIVE YOUR KNEES OUT LATERALLY'),
    (session_id, barbell_bench_press_id, 2, 3, 10, 10, 8, 120, 'TUCK ELBOWS AT A 45° ANGLE, SQUEEZE YOUR SHOULDER BLADES AND STAY FIRM ON THE BENCH'),
    (session_id, neutral_grip_pulldown_id, 3, 3, 15, 15, 8, 120, 'PALMS FACING EACH OTHER. PULL YOUR ELBOWS AGAINST YOUR SIDES'),
    (session_id, lying_leg_curl_id, 4, 3, 12, 12, 8, 120, 'FOCUS ON SQUEEZING YOUR HAMSTRINGS TO MAKE THE WEIGHT MOVE'),
    (session_id, seated_face_pull_id, 5, 3, 15, 15, 8, 60, 'PULL YOUR ARMS BACK AND OUT'),
    (session_id, single_arm_rope_tricep_extension_id, 6, 3, 12, 12, 8, 60, 'PULL YOUR ARM BEHIND YOUR TORSO, DON''T MOVE YOUR UPPER ARM'),
    (session_id, standing_calf_raise_id, 7, 3, 10, 10, 8, 60, 'PRESS ALL THE WAY UP TO YOUR TOES, STRETCH YOUR CALVES AT THE BOTTOM, DON''T BOUNCE');

  -- ============================================================================
  -- UPPER/LOWER PROGRAM
  -- ============================================================================
  
  -- PHASE 1 (4 Week Strength Base)
  
  -- Lower Body #1 - Phase 1
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (upper_lower_id, 'Lower Body #1 - Phase 1', 1, 1, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, back_squat_id, 1, 3, 6, 6, 7, 180, 'SIT BACK AND DOWN, 15° TOE FLARE, DRIVE YOUR KNEES OUT LATERALLY'),
    (session_id, romanian_deadlift_id, 2, 3, 10, 10, 7, 120, 'MAINTAIN A NEUTRAL LOWER BACK, SET YOUR HIPS BACK, DON''T ALLOW YOUR SPINE TO ROUND'),
    (session_id, barbell_hip_thrust_id, 3, 3, 12, 12, 8, 120, 'TUCK YOUR CHIN AND RIB CAGE DOWN, ONLY MOVE YOUR HIPS. USE A PAD'),
    (session_id, leg_extension_id, 4, 3, 12, 12, 9, 60, 'FOCUS ON SQUEEZING YOUR QUADS TO MAKE THE WEIGHT MOVE'),
    (session_id, lying_leg_curl_id, 5, 3, 12, 12, 9, 60, 'FOCUS ON SQUEEZING YOUR HAMSTRINGS TO MAKE THE WEIGHT MOVE'),
    (session_id, machine_seated_hip_abduction_id, 6, 3, 6, 6, 7, 60, 'KEEP YOUR BUTT IN THE SEAT, FOCUS ON SQUEEZING YOUR GLUTES TO MAKE THE WEIGHT MOVE'),
    (session_id, crunch_id, 7, 3, 12, 12, 7, 60, 'FOCUS ON FLEXING YOUR SPINE, DON''T YANK YOUR HEAD WITH YOUR ARMS');

  -- Upper Body #1 - Phase 1
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (upper_lower_id, 'Upper Body #1 - Phase 1', 2, 1, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, barbell_bench_press_id, 1, 3, 5, 5, 7, 180, 'TUCK ELBOWS AT A 45° ANGLE, SQUEEZE YOUR SHOULDER BLADES AND STAY FIRM ON THE BENCH'),
    (session_id, lat_pulldown_id, 2, 3, 10, 10, 8, 120, 'PULL YOUR ELBOWS DOWN AND IN, USE A 1.5X SHOULDER WIDTH GRIP'),
    (session_id, overhead_press_id, 3, 3, 10, 10, 7, 180, 'SQUEEZE YOUR GLUTES TO KEEP YOUR TORSO UPRIGHT, CLEAR YOUR HEAD OUT OF THE WAY, PRESS UP AND SLIGHTLY BACK'),
    (session_id, chest_supported_tbar_row_id, 4, 3, 12, 12, 8, 120, 'FOCUS ON SQUEEZING YOUR SHOULDER BLADES TOGETHER AS YOU PULL THE WEIGHT TOWARDS YOU. KEEP YOUR SHOULDERS DOWN (AVOID SHRUGGING).'),
    (session_id, cable_flye_id, 5, 3, 12, 12, 8, 60, 'KEEP YOUR ELBOWS SLIGHTLY BENT AT A CONSTANT ANGLE WHILE SQUEEZING YOUR PECS TO MOVE THE WEIGHT'),
    (session_id, dumbbell_supinated_curl_id, 6, 3, 10, 10, 8, 60, 'DRIVE YOUR PINKY INTO THE HANDLE HARDER THAN YOUR POINTER FINGER'),
    (session_id, single_arm_rope_tricep_extension_id, 7, 3, 12, 12, 8, 60, 'PULL YOUR ARM BEHIND YOUR TORSO, DON''T MOVE YOUR UPPER ARM');

  -- Lower Body #2 - Phase 1
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (upper_lower_id, 'Lower Body #2 - Phase 1', 3, 1, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, deadlift_id, 1, 3, 8, 8, 7, 180, 'BRACE YOUR LATS, CHEST TALL, HIPS HIGH, PULL THE SLACK OUT OF THE BAR PRIOR TO MOVING IT OFF THE GROUND'),
    (session_id, dumbbell_walking_lunge_id, 2, 3, 10, 10, 8, 120, '10 STEPS EACH LEG. TAKE MEDIUM STRIDES, LET YOUR TORSO LEAN FORWARD'),
    (session_id, single_leg_leg_extension_id, 3, 3, 15, 15, 8, 60, 'FOCUS ON SQUEEZING YOUR QUADS TO MAKE THE WEIGHT MOVE'),
    (session_id, single_leg_lying_leg_curl_id, 4, 3, 15, 15, 8, 60, 'FOCUS ON SQUEEZING YOUR HAMSTRINGS TO MAKE THE WEIGHT MOVE'),
    (session_id, machine_seated_hip_abduction_id, 5, 3, 15, 15, 9, 60, 'KEEP YOUR BUTT IN THE SEAT, FOCUS ON SQUEEZING YOUR GLUTES TO MAKE THE WEIGHT MOVE'),
    (session_id, standing_calf_raise_id, 6, 3, 12, 12, 8, 60, 'PRESS ALL THE WAY UP TO YOUR TOES, STRETCH YOUR CALVES AT THE BOTTOM, DON''T BOUNCE'),
    (session_id, plank_id, 7, 3, 20, 20, 8, 60, 'SQUEEZE YOUR GLUTES, KEEP YOUR HIPS LOW');

  -- Upper Body #2 - Phase 1
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (upper_lower_id, 'Upper Body #2 - Phase 1', 4, 1, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, dumbbell_incline_press_id, 1, 3, 8, 8, 8, 120, 'USE ~45° INCLINE. MIND MUSCLE CONNECTION WITH UPPER PECS.'),
    (session_id, reverse_grip_lat_pulldown_id, 2, 3, 8, 8, 8, 120, 'PULL YOUR ELBOWS DOWN AGAINST YOUR SIDES, USE SHOULDER WIDTH GRIP'),
    (session_id, assisted_dip_id, 3, 3, 10, 10, 7, 120, 'TUCK ELBOWS AT A 45° ANGLE, LEAN YOUR TORSO FORWARD 15°'),
    (session_id, barbell_bent_over_row_id, 4, 3, 12, 12, 7, 120, 'LEAN YOUR TORSO OVER AT A 45° ANGLE, KEEP YOUR LOWER BACK NEUTRAL, DOUBLE OVERHAND GRIP'),
    (session_id, dumbbell_lateral_raise_id, 5, 3, 15, 15, 8, 60, 'RAISE THE DUMBBELL "OUT" NOT "UP", MIND MUSCLE CONNECTION WITH MIDDLE FIBERS'),
    (session_id, seated_face_pull_id, 6, 3, 15, 15, 8, 60, 'PULL YOUR ARMS BACK AND OUT'),
    (session_id, hammer_curl_id, 7, 3, 8, 8, 9, 60, 'NEUTRAL GRIP, PREVENT YOUR UPPER ARM FROM MOVING');

  -- PHASE 2 (4 Week Modified Strength Base)
  
  -- Lower Body #1 - Phase 2
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (upper_lower_id, 'Lower Body #1 - Phase 2', 1, 2, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, deadlift_id, 1, 3, 5, 5, 8, 180, 'BRACE YOUR LATS, CHEST TALL, HIPS HIGH, PULL THE SLACK OUT OF THE BAR PRIOR TO MOVING IT OFF THE GROUND'),
    (session_id, goblet_squat_id, 2, 3, 12, 12, 8, 120, 'HOLD A DUMBBELL DIRECTLY UNDERNEATH YOUR CHIN, SIT BACK AND DOWN, PUSH YOUR KNEES OUT LATERALLY'),
    (session_id, dumbbell_single_leg_hip_thrust_id, 3, 3, 10, 10, 9, 120, 'PLACE THE DUMBBELL ON YOUR WORKING THIGH, TUCK YOUR CHIN AND RIB CAGE, ONLY MOVE YOUR HIPS'),
    (session_id, leg_press_id, 4, 3, 12, 12, 8, 60, 'MEDIUM WIDTH FEET PLACEMENT ON THE PLATFORM, DON''T ALLOW YOUR LOWER BACK TO ROUND'),
    (session_id, lying_leg_curl_id, 5, 3, 15, 15, 9, 60, 'FOCUS ON SQUEEZING YOUR HAMSTRINGS TO MAKE THE WEIGHT MOVE'),
    (session_id, standing_calf_raise_id, 6, 3, 8, 8, 8, 60, 'PRESS ALL THE WAY UP TO YOUR TOES, STRETCH YOUR CALVES AT THE BOTTOM, DON''T BOUNCE'),
    (session_id, bicycle_crunch_id, 7, 3, 12, 12, 8, 60, 'FOCUS ON SQUEEZING YOUR ABS AS YOU BRING YOUR LEFT ELBOW TO RIGHT KNEE, RIGHT ELBOW TO LEFT KNEE');

  -- Upper Body #1 - Phase 2
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (upper_lower_id, 'Upper Body #1 - Phase 2', 2, 2, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, barbell_bench_press_id, 1, 3, 8, 8, 8, 180, 'TUCK ELBOWS AT A 45° ANGLE, SQUEEZE YOUR SHOULDER BLADES AND STAY FIRM ON THE BENCH'),
    (session_id, single_arm_pulldown_id, 2, 3, 8, 8, 8, 120, 'START WITH YOUR NON-DOMINANT ARM, MATCH REPS WITH DOMINANT ARM'),
    (session_id, dumbbell_seated_shoulder_press_id, 3, 3, 12, 12, 7, 120, 'BRING THE DUMBBELL ALL THE WAY DOWN TO YOUR SHOULDERS, KEEP YOUR TORSO UPRIGHT'),
    (session_id, dumbbell_row_id, 4, 3, 12, 12, 8, 120, 'BRACE ONTO A BENCH FOR SUPPORT, PULL YOUR ELBOW AGAINST YOUR SIDES'),
    (session_id, assisted_dip_id, 5, 3, 6, 6, 8, 60, 'TUCK ELBOWS AT A 45° ANGLE, LEAN YOUR TORSO FORWARD 15°'),
    (session_id, seated_face_pull_id, 6, 3, 15, 15, 9, 60, 'PULL YOUR ARMS BACK AND OUT'),
    (session_id, ez_bar_curl_id, 7, 3, 12, 12, 9, 60, 'PRESS YOUR PINKY INTO THE BAR HARDER THAN YOUR POINTER FINGER');

  -- Lower Body #2 - Phase 2
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (upper_lower_id, 'Lower Body #2 - Phase 2', 3, 2, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, back_squat_id, 1, 3, 8, 8, 8, 180, 'SIT BACK AND DOWN, 15° TOE FLARE, DRIVE YOUR KNEES OUT LATERALLY'),
    (session_id, barbell_hip_thrust_id, 2, 3, 8, 8, 8, 120, 'TUCK YOUR CHIN AND RIB CAGE DOWN, ONLY MOVE YOUR HIPS. USE A PAD'),
    (session_id, romanian_deadlift_id, 3, 3, 12, 12, 8, 120, 'MAINTAIN A NEUTRAL LOWER BACK, SET YOUR HIPS BACK, DON''T ALLOW YOUR SPINE TO ROUND'),
    (session_id, seated_leg_curl_id, 4, 3, 8, 8, 9, 60, 'FOCUS ON SQUEEZING YOUR HAMSTRINGS TO MAKE THE WEIGHT MOVE'),
    (session_id, standing_calf_raise_id, 5, 3, 6, 6, 9, 60, 'PRESS ALL THE WAY UP TO YOUR TOES, STRETCH YOUR CALVES AT THE BOTTOM, DON''T BOUNCE'),
    (session_id, hanging_leg_raise_id, 6, 3, 6, 6, 8, 60, 'FOCUS ON FLEXING YOUR LOWER BACK, PERFORM OFF OF CAPTAIN''S CHAIR'),
    (session_id, machine_seated_hip_abduction_id, 7, 3, 20, 20, 9, 60, 'KEEP YOUR BUTT IN THE SEAT, FOCUS ON SQUEEZING YOUR GLUTES TO MAKE THE WEIGHT MOVE');

  -- Upper Body #2 - Phase 2
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (upper_lower_id, 'Upper Body #2 - Phase 2', 4, 2, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, overhead_press_id, 1, 3, 6, 6, 8, 180, 'SQUEEZE YOUR GLUTES TO KEEP YOUR TORSO UPRIGHT, CLEAR YOUR HEAD OUT OF THE WAY, PRESS UP AND SLIGHTLY BACK'),
    (session_id, neutral_grip_pulldown_id, 2, 3, 6, 6, 8, 180, 'PALMS FACING EACH OTHER. PULL YOUR ELBOWS AGAINST YOUR SIDES'),
    (session_id, dumbbell_incline_press_id, 3, 3, 8, 8, 8, 120, 'USE ~45° INCLINE. MIND MUSCLE CONNECTION WITH UPPER PECS.'),
    (session_id, cable_seated_row_id, 4, 3, 8, 8, 9, 120, 'USE A CLOSE GRIP, DRIVE ELBOWS DOWN AND BACK'),
    (session_id, cable_lateral_raise_id, 5, 3, 12, 12, 8, 60, 'LEAN AWAY FROM THE MACHINE, ARMS STRAIGHT OUT TO YOUR SIDE'),
    (session_id, reverse_pec_deck_id, 6, 3, 12, 12, 8, 60, 'SWEEP THE WEIGHT OUT AND BACK, MIND MUSCLE CONNECTION WITH REAR DELTS'),
    (session_id, single_arm_cable_curl_id, 7, 3, 15, 15, 9, 60, 'FACE AWAY FROM THE CABLE YOU ARE USING, KEEP YOUR ARM BEHIND YOUR TORSO');

  -- ============================================================================
  -- BODY PART SPLIT PROGRAM
  -- ============================================================================
  
  -- PHASE 1 (4 Week Strength Base)
  
  -- Chest & Triceps - Phase 1
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (body_part_split_id, 'Chest & Triceps - Phase 1', 1, 1, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, barbell_bench_press_id, 1, 3, 6, 6, 7, 180, 'TUCK ELBOWS AT A 45° ANGLE, SQUEEZE YOUR SHOULDER BLADES AND STAY FIRM ON THE BENCH'),
    (session_id, dumbbell_incline_press_id, 2, 3, 8, 8, 8, 120, 'USE ~45° INCLINE. MIND MUSCLE CONNECTION WITH UPPER PECS.'),
    (session_id, cable_flye_id, 3, 3, 12, 12, 8, 60, 'KEEP YOUR ELBOWS SLIGHTLY BENT AT A CONSTANT ANGLE WHILE SQUEEZING YOUR PECS TO MOVE THE WEIGHT'),
    (session_id, assisted_dip_id, 4, 3, 10, 10, 7, 60, 'TUCK ELBOWS AT A 45° ANGLE, LEAN YOUR TORSO FORWARD 15°'),
    (session_id, dumbbell_skull_crusher_id, 5, 3, 12, 12, 8, 60, 'KEEP YOUR ELBOWS INLINE WITH THE TOP OF YOUR HEAD, DON''T LET YOUR UPPER ARM MOVE');

  -- Legs & Abs - Phase 1 (Day 1)
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (body_part_split_id, 'Legs & Abs - Phase 1 (Day 1)', 2, 1, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, back_squat_id, 1, 3, 6, 6, 7, 180, 'SIT BACK AND DOWN, 15° TOE FLARE, DRIVE YOUR KNEES OUT LATERALLY'),
    (session_id, romanian_deadlift_id, 2, 3, 8, 8, 7, 120, 'MAINTAIN A NEUTRAL LOWER BACK, SET YOUR HIPS BACK, DON''T ALLOW YOUR SPINE TO ROUND'),
    (session_id, barbell_hip_thrust_id, 3, 3, 12, 12, 8, 120, 'TUCK YOUR CHIN AND RIB CAGE DOWN, ONLY MOVE YOUR HIPS. USE A PAD'),
    (session_id, leg_extension_id, 4, 3, 12, 12, 8, 60, 'FOCUS ON SQUEEZING YOUR QUADS TO MAKE THE WEIGHT MOVE'),
    (session_id, lying_leg_curl_id, 5, 3, 12, 12, 8, 60, 'FOCUS ON SQUEEZING YOUR HAMSTRINGS TO MAKE THE WEIGHT MOVE'),
    (session_id, standing_calf_raise_id, 6, 2, 8, 8, 7, 60, 'PRESS ALL THE WAY UP TO YOUR TOES, STRETCH YOUR CALVES AT THE BOTTOM, DON''T BOUNCE'),
    (session_id, crunch_id, 7, 2, 12, 12, 7, 60, 'FOCUS ON FLEXING YOUR SPINE, DON''T YANK YOUR HEAD WITH YOUR ARMS');

  -- Back & Biceps - Phase 1
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (body_part_split_id, 'Back & Biceps - Phase 1', 3, 1, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, reverse_grip_lat_pulldown_id, 1, 3, 8, 8, 8, 120, 'PULL YOUR ELBOWS DOWN AGAINST YOUR SIDES, USE SHOULDER WIDTH GRIP'),
    (session_id, cable_seated_row_id, 2, 3, 10, 10, 8, 120, 'USE A CLOSE GRIP, DRIVE ELBOWS DOWN AND BACK'),
    (session_id, chest_supported_tbar_row_id, 3, 3, 12, 12, 8, 120, 'FOCUS ON SQUEEZING YOUR SHOULDER BLADES TOGETHER AS YOU PULL THE WEIGHT TOWARDS YOU. KEEP YOUR SHOULDERS DOWN (AVOID SHRUGGING).'),
    (session_id, seated_face_pull_id, 4, 3, 15, 15, 8, 60, 'PULL YOUR ARMS BACK AND OUT'),
    (session_id, dumbbell_supinated_curl_id, 5, 3, 12, 12, 8, 60, 'DRIVE YOUR PINKY INTO THE HANDLE HARDER THAN YOUR POINTER FINGER');

  -- Legs & Abs - Phase 1 (Day 2)
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (body_part_split_id, 'Legs & Abs - Phase 1 (Day 2)', 4, 1, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, deadlift_id, 1, 3, 5, 5, 7, 180, 'BRACE YOUR LATS, CHEST TALL, HIPS HIGH, PULL THE SLACK OUT OF THE BAR PRIOR TO MOVING IT OFF THE GROUND'),
    (session_id, dumbbell_walking_lunge_id, 2, 3, 10, 10, 8, 120, '10 STEPS EACH LEG. TAKE MEDIUM STRIDES, LET YOUR TORSO LEAN FORWARD'),
    (session_id, single_leg_leg_extension_id, 3, 2, 15, 15, 8, 60, 'FOCUS ON SQUEEZING YOUR QUADS TO MAKE THE WEIGHT MOVE'),
    (session_id, single_leg_lying_leg_curl_id, 4, 2, 15, 15, 8, 60, 'FOCUS ON SQUEEZING YOUR HAMSTRINGS TO MAKE THE WEIGHT MOVE'),
    (session_id, machine_seated_hip_abduction_id, 5, 3, 15, 15, 7, 60, 'KEEP YOUR BUTT IN THE SEAT, FOCUS ON SQUEEZING YOUR GLUTES TO MAKE THE WEIGHT MOVE'),
    (session_id, standing_calf_raise_id, 6, 2, 12, 12, 8, 60, 'PRESS ALL THE WAY UP TO YOUR TOES, STRETCH YOUR CALVES AT THE BOTTOM, DON''T BOUNCE'),
    (session_id, plank_id, 7, 3, 20, 20, 8, 60, 'SQUEEZE YOUR GLUTES, KEEP YOUR HIPS LOW');

  -- Shoulders & Arms - Phase 1
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (body_part_split_id, 'Shoulders & Arms - Phase 1', 5, 1, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, overhead_press_id, 1, 3, 6, 6, 7, 180, 'SQUEEZE YOUR GLUTES TO KEEP YOUR TORSO UPRIGHT, CLEAR YOUR HEAD OUT OF THE WAY, PRESS UP AND SLIGHTLY BACK'),
    (session_id, dumbbell_lateral_raise_id, 2, 3, 12, 12, 8, 60, 'RAISE THE DUMBBELL "OUT" NOT "UP", MIND MUSCLE CONNECTION WITH MIDDLE FIBERS'),
    (session_id, cable_reverse_flye_id, 3, 3, 15, 15, 8, 60, 'SWEEP THE WEIGHT OUT AND BACK, MIND MUSCLE CONNECTION WITH REAR DELTS'),
    (session_id, single_arm_rope_tricep_extension_id, 4, 2, 12, 12, 8, 60, 'PULL YOUR ARM BEHIND YOUR TORSO, DON''T MOVE YOUR UPPER ARM'),
    (session_id, single_arm_cable_curl_id, 5, 2, 12, 12, 8, 60, 'FACE AWAY FROM THE CABLE YOU ARE USING, KEEP YOUR ARM BEHIND YOUR TORSO');

  -- PHASE 2 (4 Week Modified Strength Base)
  
  -- Chest & Triceps - Phase 2
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (body_part_split_id, 'Chest & Triceps - Phase 2', 1, 2, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, barbell_bench_press_id, 1, 3, 8, 8, 8, 180, 'TUCK ELBOWS AT A 45° ANGLE, SQUEEZE YOUR SHOULDER BLADES AND STAY FIRM ON THE BENCH'),
    (session_id, machine_incline_chest_press_id, 2, 3, 12, 12, 8, 120, 'USE ~45° INCLINE. MIND MUSCLE CONNECTION WITH UPPER PECS.'),
    (session_id, pec_deck_id, 3, 3, 12, 12, 8, 60, 'NICE STRETCH ON THE PECS AT THE BOTTOM AND FULL SQUEEZE AT THE TOP. CONTROL!'),
    (session_id, assisted_dip_id, 4, 3, 6, 6, 8, 60, 'TUCK ELBOWS AT A 45° ANGLE, LEAN YOUR TORSO FORWARD 15°'),
    (session_id, cable_tricep_kickback_id, 5, 3, 15, 15, 8, 60, 'KEEP YOUR ELBOWS BEHIND YOUR TORSO, DON''T LET YOUR UPPER ARM MOVE');

  -- Legs & Abs - Phase 2 (Day 1)
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (body_part_split_id, 'Legs & Abs - Phase 2 (Day 1)', 2, 2, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, deadlift_id, 1, 3, 5, 5, 8, 180, 'BRACE YOUR LATS, CHEST TALL, HIPS HIGH, PULL THE SLACK OUT OF THE BAR PRIOR TO MOVING IT OFF THE GROUND'),
    (session_id, goblet_squat_id, 2, 3, 12, 12, 8, 120, 'HOLD A DUMBBELL DIRECTLY UNDERNEATH YOUR CHIN, SIT BACK AND DOWN, PUSH YOUR KNEES OUT LATERALLY'),
    (session_id, dumbbell_single_leg_hip_thrust_id, 3, 3, 10, 10, 9, 120, 'PLACE THE DUMBBELL ON YOUR WORKING THIGH, TUCK YOUR CHIN AND RIB CAGE, ONLY MOVE YOUR HIPS'),
    (session_id, leg_press_id, 4, 3, 12, 12, 8, 60, 'MEDIUM WIDTH FEET PLACEMENT ON THE PLATFORM, DON''T ALLOW YOUR LOWER BACK TO ROUND'),
    (session_id, lying_leg_curl_id, 5, 3, 15, 15, 9, 60, 'FOCUS ON SQUEEZING YOUR HAMSTRINGS TO MAKE THE WEIGHT MOVE'),
    (session_id, standing_calf_raise_id, 6, 3, 8, 8, 8, 60, 'PRESS ALL THE WAY UP TO YOUR TOES, STRETCH YOUR CALVES AT THE BOTTOM, DON''T BOUNCE'),
    (session_id, bicycle_crunch_id, 7, 3, 12, 12, 8, 60, 'FOCUS ON SQUEEZING YOUR ABS AS YOU BRING YOUR LEFT ELBOW TO RIGHT KNEE, RIGHT ELBOW TO LEFT KNEE');

  -- Back & Biceps - Phase 2
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (body_part_split_id, 'Back & Biceps - Phase 2', 3, 2, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, lat_pulldown_id, 1, 3, 6, 6, 8, 120, 'PULL YOUR ELBOWS DOWN AND IN, USE A 1.5X SHOULDER WIDTH GRIP'),
    (session_id, dumbbell_row_id, 2, 3, 12, 12, 8, 120, 'BRACE ONTO A BENCH FOR SUPPORT, PULL YOUR ELBOW AGAINST YOUR SIDES'),
    (session_id, barbell_bent_over_row_id, 3, 3, 12, 12, 8, 120, 'LEAN YOUR TORSO OVER AT A 45° ANGLE, KEEP YOUR LOWER BACK NEUTRAL, DOUBLE OVERHAND GRIP'),
    (session_id, reverse_pec_deck_id, 4, 3, 15, 15, 8, 60, 'SWEEP THE WEIGHT OUT AND BACK, MIND MUSCLE CONNECTION WITH REAR DELTS'),
    (session_id, ez_bar_curl_id, 5, 3, 15, 15, 8, 60, 'DRIVE YOUR PINKY INTO THE HANDLE HARDER THAN YOUR POINTER FINGER');

  -- Legs & Abs - Phase 2 (Day 2)
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (body_part_split_id, 'Legs & Abs - Phase 2 (Day 2)', 4, 2, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, back_squat_id, 1, 3, 8, 8, 8, 180, 'SIT BACK AND DOWN, 15° TOE FLARE, DRIVE YOUR KNEES OUT LATERALLY'),
    (session_id, barbell_hip_thrust_id, 2, 3, 8, 8, 8, 120, 'TUCK YOUR CHIN AND RIB CAGE DOWN, ONLY MOVE YOUR HIPS. USE A PAD'),
    (session_id, romanian_deadlift_id, 3, 3, 12, 12, 8, 120, 'MAINTAIN A NEUTRAL LOWER BACK, SET YOUR HIPS BACK, DON''T ALLOW YOUR SPINE TO ROUND'),
    (session_id, seated_leg_curl_id, 4, 3, 8, 8, 9, 60, 'FOCUS ON SQUEEZING YOUR HAMSTRINGS TO MAKE THE WEIGHT MOVE'),
    (session_id, standing_calf_raise_id, 5, 3, 6, 6, 9, 60, 'PRESS ALL THE WAY UP TO YOUR TOES, STRETCH YOUR CALVES AT THE BOTTOM, DON''T BOUNCE'),
    (session_id, hanging_leg_raise_id, 6, 3, 6, 6, 8, 60, 'FOCUS ON FLEXING YOUR LOWER BACK, PERFORM OFF OF CAPTAIN''S CHAIR'),
    (session_id, machine_seated_hip_abduction_id, 7, 3, 20, 20, 9, 60, 'KEEP YOUR BUTT IN THE SEAT, FOCUS ON SQUEEZING YOUR GLUTES TO MAKE THE WEIGHT MOVE');

  -- Shoulders & Arms - Phase 2
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, phase_number, estimated_duration_minutes)
  VALUES (body_part_split_id, 'Shoulders & Arms - Phase 2', 5, 2, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, dumbbell_seated_shoulder_press_id, 1, 3, 10, 10, 8, 180, 'BRING THE DUMBBELL ALL THE WAY DOWN TO YOUR SHOULDERS, KEEP YOUR TORSO UPRIGHT'),
    (session_id, cable_lateral_raise_id, 2, 3, 10, 10, 8, 60, 'LEAN AWAY FROM THE MACHINE, ARMS STRAIGHT OUT TO YOUR SIDE'),
    (session_id, bent_over_reverse_dumbbell_flye_id, 3, 3, 12, 12, 8, 60, 'LEAN OVER SUCH THAT YOUR TORSO IS PARALLEL WITH THE GROUND, RAISE YOUR ARMS DIRECTLY OUT TO YOUR SIDES'),
    (session_id, dumbbell_floor_press_id, 4, 2, 15, 15, 8, 60, 'TUCK YOUR ELBOWS AGAINST YOUR SIDES'),
    (session_id, hammer_curl_id, 5, 2, 8, 8, 8, 60, 'NEUTRAL GRIP, PREVENT YOUR UPPER ARM FROM MOVING');

END $$;

-- ============================================================================
-- CREATE INDEXES FOR PHASE-BASED QUERIES
-- ============================================================================

-- Index for querying sessions by phase
CREATE INDEX idx_workout_plan_sessions_phase ON workout_plan_sessions(plan_id, phase_number, day_number);

-- Index for querying sessions by plan and phase
CREATE INDEX idx_workout_plan_sessions_plan_phase ON workout_plan_sessions(plan_id, phase_number);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN workout_plan_sessions.phase_number IS 'Phase number within the program (1 for weeks 1-4, 2 for weeks 5-8, etc.)';
COMMENT ON COLUMN workout_plan_sessions.week_number IS 'Legacy week number - now nullable as we use phase-based approach';

-- ============================================================================
-- MIGRATION SUMMARY
-- ============================================================================

-- This migration successfully:
-- 1. Cleaned up all existing workout_plan_sessions and planned_exercises data
-- 2. Added phase_number column for phase-based workout organization
-- 3. Populated all three workout programs with complete exercise data:
--    - Full Body Program: 6 sessions (3 days × 2 phases)
--    - Upper/Lower Program: 8 sessions (4 days × 2 phases)  
--    - Body Part Split Program: 10 sessions (5 days × 2 phases)
-- 4. Eliminated week-based duplication by using phase-based sessions
-- 5. Added proper indexes for efficient phase-based queries
-- 6. Maintained all exercise programming details (sets, reps, RPE, rest, notes)
