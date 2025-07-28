-- ============================================================================
-- TRAINSMART SEED DATA - COMPREHENSIVE WORKOUT PROGRAMS
-- ============================================================================
-- This file contains initial seed data for TrainSmart based on default_workouts.json
-- Includes exercises, workout plans, and subscription plans

-- ============================================================================
-- SUBSCRIPTION PLANS
-- ============================================================================

-- Subscription plans are now created in migration 006, so no need to insert them here
-- This avoids conflicts with the migration-created plans

-- ============================================================================
-- COMPREHENSIVE EXERCISE DATABASE
-- ============================================================================

-- Insert all exercises from default_workouts.json with normalized names
INSERT INTO exercises (name, description, instructions, muscle_groups, primary_muscle, equipment, difficulty, is_compound, form_cues) VALUES

-- SQUAT VARIATIONS
(
  'Back Squat',
  'The king of leg exercises. Builds overall lower body mass and strength.',
  '["Position bar on upper traps", "Stand with feet shoulder-width apart", "Descend by pushing hips back", "Drive through heels to stand"]',
  ARRAY['quadriceps', 'glutes', 'hamstrings', 'core']::muscle_group_enum[],
  'quadriceps',
  ARRAY['barbell']::equipment_enum[],
  4,
  true,
  ARRAY['Sit back and down', '15° toe flare', 'Drive your knees out laterally']
),
(
  'Goblet Squat',
  'Great beginner squat variation that teaches proper form.',
  '["Hold dumbbell at chest level", "Squat down between legs", "Keep chest up and core tight", "Drive through heels to stand"]',
  ARRAY['quadriceps', 'glutes', 'core']::muscle_group_enum[],
  'quadriceps',
  ARRAY['dumbbell', 'kettlebell']::equipment_enum[],
  2,
  true,
  ARRAY['Hold a dumbbell directly underneath your chin', 'Sit back and down', 'Push your knees out laterally']
),

-- DEADLIFT VARIATIONS
(
  'Deadlift',
  'The ultimate posterior chain exercise. Builds total body strength.',
  '["Stand with feet hip-width apart", "Grip bar just outside legs", "Keep chest up and back straight", "Drive through heels to stand"]',
  ARRAY['back', 'glutes', 'hamstrings', 'core']::muscle_group_enum[],
  'back',
  ARRAY['barbell']::equipment_enum[],
  4,
  true,
  ARRAY['Brace your lats', 'Chest tall', 'Hips high', 'Pull the slack out of the bar prior to moving it off the ground']
),
(
  'Romanian Deadlift',
  'Targets hamstrings and glutes with emphasis on hip hinge pattern.',
  '["Hold bar at hip level", "Push hips back while lowering bar", "Keep slight knee bend", "Drive hips forward to return"]',
  ARRAY['hamstrings', 'glutes', 'back']::muscle_group_enum[],
  'hamstrings',
  ARRAY['barbell', 'dumbbell']::equipment_enum[],
  3,
  true,
  ARRAY['Maintain a neutral lower back', 'Set your hips back', 'Don''t allow your spine to round']
),

-- BENCH PRESS VARIATIONS
(
  'Barbell Bench Press',
  'The king of chest exercises. Builds overall chest mass and strength.',
  '["Lie flat on bench with eyes under the bar", "Grip bar slightly wider than shoulder width", "Unrack and lower bar to chest with control", "Press bar up in straight line"]',
  ARRAY['chest', 'shoulders', 'triceps']::muscle_group_enum[],
  'chest',
  ARRAY['barbell']::equipment_enum[],
  3,
  true,
  ARRAY['Tuck elbows at a 45° angle', 'Squeeze your shoulder blades and stay firm on the bench']
),
(
  'Dumbbell Incline Press',
  'Targets upper chest with greater range of motion.',
  '["Set bench to 45-degree incline", "Hold dumbbells at chest level", "Press dumbbells up and slightly inward", "Lower with control to stretch chest"]',
  ARRAY['chest', 'shoulders', 'triceps']::muscle_group_enum[],
  'chest',
  ARRAY['dumbbell']::equipment_enum[],
  2,
  true,
  ARRAY['Use ~45° incline', 'Mind muscle connection with upper pecs']
),
(
  'Close-Grip Bench Press',
  'Tricep-focused pressing movement that builds arm strength.',
  '["Lie on bench with narrow grip", "Lower bar to chest", "Press up focusing on triceps", "Keep elbows close to body"]',
  ARRAY['triceps', 'chest', 'shoulders']::muscle_group_enum[],
  'triceps',
  ARRAY['barbell']::equipment_enum[],
  3,
  true,
  ARRAY['Shoulder width grip', 'Tuck your elbows against your sides']
),
(
  'Machine Incline Chest Press',
  'Machine-based incline pressing for upper chest development.',
  '["Adjust seat height for proper alignment", "Grip handles at chest level", "Press forward and up", "Control the negative"]',
  ARRAY['chest', 'shoulders', 'triceps']::muscle_group_enum[],
  'chest',
  ARRAY['machine']::equipment_enum[],
  2,
  true,
  ARRAY['Use ~45° incline', 'Mind muscle connection with upper pecs']
),
(
  'Dumbbell Floor Press',
  'Limited range of motion pressing exercise that emphasizes triceps.',
  '["Lie on floor with dumbbells", "Lower until upper arms touch floor", "Press up to full extension", "Keep core tight"]',
  ARRAY['triceps', 'chest', 'shoulders']::muscle_group_enum[],
  'triceps',
  ARRAY['dumbbell']::equipment_enum[],
  2,
  true,
  ARRAY['Tuck your elbows against your sides']
),

-- PRESSING VARIATIONS
(
  'Overhead Press',
  'Builds shoulder strength and stability. Great for functional strength.',
  '["Stand with feet shoulder-width apart", "Grip bar at shoulder width", "Press bar straight up overhead", "Lower with control to shoulders"]',
  ARRAY['shoulders', 'triceps', 'core']::muscle_group_enum[],
  'shoulders',
  ARRAY['barbell']::equipment_enum[],
  3,
  true,
  ARRAY['Squeeze your glutes to keep your torso upright', 'Clear your head out of the way', 'Press up and slightly back']
),
(
  'Dumbbell Seated Shoulder Press',
  'Seated shoulder pressing with dumbbells for stability.',
  '["Sit with back support", "Hold dumbbells at shoulder height", "Press up and slightly inward", "Lower with control"]',
  ARRAY['shoulders', 'triceps']::muscle_group_enum[],
  'shoulders',
  ARRAY['dumbbell']::equipment_enum[],
  2,
  false,
  ARRAY['Bring the dumbbell all the way down to your shoulders', 'Keep your torso upright']
),

-- PULLING EXERCISES
(
  'Lat Pulldown',
  'Vertical pulling exercise that targets the latissimus dorsi.',
  '["Sit at lat pulldown machine", "Grip bar wider than shoulders", "Pull bar down to upper chest", "Control the return"]',
  ARRAY['back', 'biceps']::muscle_group_enum[],
  'back',
  ARRAY['cable', 'machine']::equipment_enum[],
  2,
  true,
  ARRAY['Pull your elbows down and in', 'Use a 1.5x shoulder width grip']
),
(
  'Single-Arm Pulldown',
  'Unilateral lat pulldown for balanced development.',
  '["Use single handle attachment", "Pull down to side of chest", "Focus on lat engagement", "Control both directions"]',
  ARRAY['back', 'biceps']::muscle_group_enum[],
  'back',
  ARRAY['cable', 'machine']::equipment_enum[],
  2,
  false,
  ARRAY['Start with your non-dominant arm', 'Match reps with dominant arm']
),
(
  'Reverse-Grip Lat Pulldown',
  'Underhand grip variation that emphasizes biceps and lower lats.',
  '["Use underhand grip at shoulder width", "Pull bar to upper chest", "Focus on squeezing lats", "Control the negative"]',
  ARRAY['back', 'biceps']::muscle_group_enum[],
  'back',
  ARRAY['cable', 'machine']::equipment_enum[],
  2,
  true,
  ARRAY['Pull your elbows down against your sides', 'Use shoulder width grip']
),
(
  'Neutral-Grip Pulldown',
  'Neutral grip pulldown that targets middle traps and lats.',
  '["Use neutral grip handles", "Pull down to upper chest", "Focus on squeezing shoulder blades", "Control the return"]',
  ARRAY['back', 'biceps']::muscle_group_enum[],
  'back',
  ARRAY['cable', 'machine']::equipment_enum[],
  2,
  true,
  ARRAY['Palms facing each other', 'Pull your elbows against your sides']
),

-- ROWING EXERCISES
(
  'Chest-Supported T-Bar Row',
  'Chest-supported rowing that eliminates lower back stress.',
  '["Position chest against pad", "Grip handles with neutral grip", "Pull handles to lower chest", "Squeeze shoulder blades together"]',
  ARRAY['back', 'biceps', 'shoulders']::muscle_group_enum[],
  'back',
  ARRAY['machine']::equipment_enum[],
  3,
  true,
  ARRAY['Focus on squeezing your shoulder blades together as you pull the weight towards you', 'Keep your shoulders down (avoid shrugging)']
),
(
  'Dumbbell Row',
  'Single-arm rowing exercise for unilateral back development.',
  '["Place one knee and hand on bench", "Hold dumbbell in opposite hand", "Pull dumbbell to hip", "Control the negative"]',
  ARRAY['back', 'biceps']::muscle_group_enum[],
  'back',
  ARRAY['dumbbell']::equipment_enum[],
  2,
  false,
  ARRAY['Brace onto a bench for support', 'Pull your elbow against your sides']
),
(
  'Barbell Bent Over Row',
  'Classic barbell rowing exercise for back thickness.',
  '["Hinge at hips with slight knee bend", "Grip bar with hands wider than shoulders", "Pull bar to lower chest/upper abdomen", "Lower with control"]',
  ARRAY['back', 'biceps', 'shoulders']::muscle_group_enum[],
  'back',
  ARRAY['barbell']::equipment_enum[],
  3,
  true,
  ARRAY['Lean your torso over at a 45° angle', 'Keep your lower back neutral', 'Double overhand grip']
),
(
  'Cable Seated Row',
  'Seated cable rowing for middle trap and rhomboid development.',
  '["Sit at cable row station", "Grip handle with both hands", "Pull handle to lower chest", "Squeeze shoulder blades"]',
  ARRAY['back', 'biceps']::muscle_group_enum[],
  'back',
  ARRAY['cable']::equipment_enum[],
  2,
  true,
  ARRAY['Use a close grip', 'Drive elbows down and back']
),

-- DIP VARIATIONS
(
  'Assisted Dip',
  'Machine-assisted dip for tricep and chest development.',
  '["Set appropriate assistance weight", "Grip dip handles", "Lower body with control", "Press back up to start"]',
  ARRAY['triceps', 'chest', 'shoulders']::muscle_group_enum[],
  'triceps',
  ARRAY['machine']::equipment_enum[],
  2,
  true,
  ARRAY['Tuck elbows at a 45° angle', 'Lean your torso forward 15°']
),

-- LEG EXERCISES
(
  'Dumbbell Walking Lunge',
  'Dynamic lunging exercise for unilateral leg development.',
  '["Hold dumbbells at sides", "Step forward into lunge", "Push off front foot to next step", "Alternate legs with each step"]',
  ARRAY['quadriceps', 'glutes', 'hamstrings']::muscle_group_enum[],
  'quadriceps',
  ARRAY['dumbbell']::equipment_enum[],
  3,
  true,
  ARRAY['Take medium strides', 'Let your torso lean forward']
),
(
  'Barbell Hip Thrust',
  'Hip hinge exercise that targets glutes and hamstrings.',
  '["Sit with upper back against bench", "Place barbell across hips", "Drive hips up to full extension", "Lower with control"]',
  ARRAY['glutes', 'hamstrings']::muscle_group_enum[],
  'glutes',
  ARRAY['barbell']::equipment_enum[],
  3,
  true,
  ARRAY['Tuck your chin and rib cage down', 'Only move your hips', 'Use a pad']
),
(
  'Dumbbell Single-Leg Hip Thrust',
  'Unilateral hip thrust for balanced glute development.',
  '["Sit with upper back against bench", "Place dumbbell on working thigh", "Drive hip up with one leg", "Control the descent"]',
  ARRAY['glutes', 'hamstrings']::muscle_group_enum[],
  'glutes',
  ARRAY['dumbbell']::equipment_enum[],
  3,
  false,
  ARRAY['Place the dumbbell on your working thigh', 'Tuck your chin and rib cage', 'Only move your hips']
),
(
  'Leg Extension',
  'Isolation exercise for quadriceps development.',
  '["Sit at leg extension machine", "Position pad above ankles", "Extend legs to full contraction", "Lower with control"]',
  ARRAY['quadriceps']::muscle_group_enum[],
  'quadriceps',
  ARRAY['machine']::equipment_enum[],
  1,
  false,
  ARRAY['Focus on squeezing your quads to make the weight move']
),
(
  'Single-Leg Leg Extension',
  'Unilateral quadriceps isolation exercise.',
  '["Sit at leg extension machine", "Work one leg at a time", "Extend leg to full contraction", "Control the negative"]',
  ARRAY['quadriceps']::muscle_group_enum[],
  'quadriceps',
  ARRAY['machine']::equipment_enum[],
  1,
  false,
  ARRAY['Focus on squeezing your quads to make the weight move']
),
(
  'Lying Leg Curl',
  'Isolation exercise for hamstring development.',
  '["Lie face down on leg curl machine", "Position pad behind ankles", "Curl heels toward glutes", "Lower with control"]',
  ARRAY['hamstrings']::muscle_group_enum[],
  'hamstrings',
  ARRAY['machine']::equipment_enum[],
  1,
  false,
  ARRAY['Focus on squeezing your hamstrings to make the weight move']
),
(
  'Single-Leg Lying Leg Curl',
  'Unilateral hamstring isolation exercise.',
  '["Lie face down on leg curl machine", "Work one leg at a time", "Curl heel toward glute", "Control the negative"]',
  ARRAY['hamstrings']::muscle_group_enum[],
  'hamstrings',
  ARRAY['machine']::equipment_enum[],
  1,
  false,
  ARRAY['Focus on squeezing your hamstrings to make the weight move']
),
(
  'Seated Leg Curl',
  'Seated variation of leg curl for hamstring development.',
  '["Sit at seated leg curl machine", "Position pad behind ankles", "Curl heels down and back", "Control the return"]',
  ARRAY['hamstrings']::muscle_group_enum[],
  'hamstrings',
  ARRAY['machine']::equipment_enum[],
  1,
  false,
  ARRAY['Focus on squeezing your hamstrings to make the weight move']
),
(
  'Leg Press',
  'Machine-based compound leg exercise.',
  '["Sit in leg press machine", "Place feet on platform", "Lower weight with control", "Press through heels to extend"]',
  ARRAY['quadriceps', 'glutes', 'hamstrings']::muscle_group_enum[],
  'quadriceps',
  ARRAY['machine']::equipment_enum[],
  2,
  true,
  ARRAY['Medium width feet placement on the platform', 'Don''t allow your lower back to round']
),

-- ISOLATION EXERCISES
(
  'Machine Seated Hip Abduction',
  'Isolation exercise for glute medius and hip abductors.',
  '["Sit at hip abduction machine", "Position pads against outer thighs", "Push knees apart", "Control the return"]',
  ARRAY['glutes']::muscle_group_enum[],
  'glutes',
  ARRAY['machine']::equipment_enum[],
  1,
  false,
  ARRAY['Keep your butt in the seat', 'Focus on squeezing your glutes to make the weight move']
),
(
  'Standing Calf Raise',
  'Isolation exercise for calf development.',
  '["Stand on calf raise machine", "Position balls of feet on platform", "Rise up on toes", "Lower with control for stretch"]',
  ARRAY['calves']::muscle_group_enum[],
  'calves',
  ARRAY['machine']::equipment_enum[],
  1,
  false,
  ARRAY['Press all the way up to your toes', 'Stretch your calves at the bottom', 'Don''t bounce']
),

-- CHEST ISOLATION
(
  'Cable Flye',
  'Isolation exercise for chest development using cables.',
  '["Set cables at chest height", "Grip handles with arms extended", "Bring handles together in arc motion", "Control the return"]',
  ARRAY['chest']::muscle_group_enum[],
  'chest',
  ARRAY['cable']::equipment_enum[],
  2,
  false,
  ARRAY['Keep your elbows slightly bent at a constant angle while squeezing your pecs to move the weight']
),
(
  'Pec Deck',
  'Machine-based chest isolation exercise.',
  '["Sit at pec deck machine", "Position arms against pads", "Bring arms together", "Control the return for stretch"]',
  ARRAY['chest']::muscle_group_enum[],
  'chest',
  ARRAY['machine']::equipment_enum[],
  1,
  false,
  ARRAY['Nice stretch on the pecs at the bottom and full squeeze at the top', 'Control!']
),

-- SHOULDER EXERCISES
(
  'Dumbbell Lateral Raise',
  'Isolation exercise for middle deltoid development.',
  '["Hold dumbbells at sides", "Raise arms out to sides", "Lift to shoulder height", "Lower with control"]',
  ARRAY['shoulders']::muscle_group_enum[],
  'shoulders',
  ARRAY['dumbbell']::equipment_enum[],
  2,
  false,
  ARRAY['Raise the dumbbell "out" not "up"', 'Mind muscle connection with middle fibers']
),
(
  'Cable Lateral Raise',
  'Cable variation of lateral raise for constant tension.',
  '["Stand beside cable machine", "Grip handle with far hand", "Raise arm out to side", "Control the return"]',
  ARRAY['shoulders']::muscle_group_enum[],
  'shoulders',
  ARRAY['cable']::equipment_enum[],
  2,
  false,
  ARRAY['Lean away from the machine', 'Arms straight out to your side']
),
(
  'Seated Face Pull',
  'Rear deltoid and upper back exercise.',
  '["Sit at cable row station", "Use rope attachment", "Pull rope to face level", "Separate handles at face"]',
  ARRAY['shoulders', 'back']::muscle_group_enum[],
  'shoulders',
  ARRAY['cable']::equipment_enum[],
  2,
  false,
  ARRAY['Pull your arms back and out']
),
(
  'Reverse Pec Deck',
  'Machine-based rear deltoid exercise.',
  '["Sit facing pec deck machine", "Grip handles with arms extended", "Pull arms back and apart", "Squeeze shoulder blades"]',
  ARRAY['shoulders', 'back']::muscle_group_enum[],
  'shoulders',
  ARRAY['machine']::equipment_enum[],
  1,
  false,
  ARRAY['Sweep the weight out and back', 'Mind muscle connection with rear delts']
),
(
  'Cable Reverse Flye',
  'Cable variation of reverse flye for rear deltoids.',
  '["Set cables at chest height", "Cross cables and grip opposite handles", "Pull arms back and apart", "Control the return"]',
  ARRAY['shoulders', 'back']::muscle_group_enum[],
  'shoulders',
  ARRAY['cable']::equipment_enum[],
  2,
  false,
  ARRAY['Sweep the weight out and back', 'Mind muscle connection with rear delts']
),
(
  'Bent Over Reverse Dumbbell Flye',
  'Bent-over rear deltoid exercise with dumbbells.',
  '["Bend over at waist", "Hold dumbbells with arms hanging", "Raise arms out to sides", "Control the return"]',
  ARRAY['shoulders', 'back']::muscle_group_enum[],
  'shoulders',
  ARRAY['dumbbell']::equipment_enum[],
  2,
  false,
  ARRAY['Lean over such that your torso is parallel with the ground', 'Raise your arms directly out to your sides']
),

-- ARM EXERCISES
(
  'Dumbbell Supinated Curl',
  'Classic bicep curl with supinated grip.',
  '["Hold dumbbells with underhand grip", "Curl weights up to shoulders", "Squeeze biceps at top", "Lower with control"]',
  ARRAY['biceps']::muscle_group_enum[],
  'biceps',
  ARRAY['dumbbell']::equipment_enum[],
  1,
  false,
  ARRAY['Drive your pinky into the handle harder than your pointer finger']
),
(
  'Single-Arm Cable Curl',
  'Unilateral cable bicep curl.',
  '["Stand facing away from cable", "Grip handle with one hand", "Curl handle up to shoulder", "Control the negative"]',
  ARRAY['biceps']::muscle_group_enum[],
  'biceps',
  ARRAY['cable']::equipment_enum[],
  1,
  false,
  ARRAY['Face away from the cable you are using', 'Keep your arm behind your torso']
),
(
  'EZ Bar Curl',
  'Bicep curl using EZ curl bar for wrist comfort.',
  '["Hold EZ bar with underhand grip", "Curl bar up to chest", "Squeeze biceps at top", "Lower with control"]',
  ARRAY['biceps']::muscle_group_enum[],
  'biceps',
  ARRAY['barbell']::equipment_enum[],
  1,
  false,
  ARRAY['Press your pinky into the bar harder than your pointer finger']
),
(
  'Hammer Curl',
  'Neutral grip curl that targets biceps and forearms.',
  '["Hold dumbbells with neutral grip", "Curl weights up to shoulders", "Keep palms facing each other", "Lower with control"]',
  ARRAY['biceps', 'forearms']::muscle_group_enum[],
  'biceps',
  ARRAY['dumbbell']::equipment_enum[],
  1,
  false,
  ARRAY['Neutral grip', 'Prevent your upper arm from moving']
),
(
  'Dumbbell Skull Crusher',
  'Tricep isolation exercise using dumbbells.',
  '["Lie on bench holding dumbbells", "Lower weights toward forehead", "Keep elbows stationary", "Press back to start"]',
  ARRAY['triceps']::muscle_group_enum[],
  'triceps',
  ARRAY['dumbbell']::equipment_enum[],
  2,
  false,
  ARRAY['Keep your elbows in line with the top of your head', 'Don''t let your upper arm move']
),
(
  'Single-Arm Rope Tricep Extension',
  'Unilateral tricep extension using rope attachment.',
  '["Stand at cable machine", "Grip rope with one hand", "Extend arm down and back", "Control the return"]',
  ARRAY['triceps']::muscle_group_enum[],
  'triceps',
  ARRAY['cable']::equipment_enum[],
  1,
  false,
  ARRAY['Pull your arm behind your torso', 'Don''t move your upper arm']
),
(
  'Cable Tricep Kickback',
  'Cable variation of tricep kickback.',
  '["Bend over at cable machine", "Grip handle with arm bent", "Extend arm back", "Control the return"]',
  ARRAY['triceps']::muscle_group_enum[],
  'triceps',
  ARRAY['cable']::equipment_enum[],
  1,
  false,
  ARRAY['Keep your elbows behind your torso', 'Don''t let your upper arm move']
),

-- CORE EXERCISES
(
  'Crunch',
  'Basic abdominal exercise for rectus abdominis.',
  '["Lie on back with knees bent", "Place hands behind head", "Curl shoulders toward knees", "Lower with control"]',
  ARRAY['abs', 'core']::muscle_group_enum[],
  'abs',
  ARRAY['bodyweight']::equipment_enum[],
  1,
  false,
  ARRAY['Focus on flexing your spine (rounding your back)', 'Don''t yank your head with your arms']
),
(
  'Bicycle Crunch',
  'Dynamic crunch variation that targets obliques.',
  '["Lie on back with hands behind head", "Bring opposite elbow to knee", "Alternate sides in cycling motion", "Control the movement"]',
  ARRAY['abs', 'core']::muscle_group_enum[],
  'abs',
  ARRAY['bodyweight']::equipment_enum[],
  2,
  false,
  ARRAY['Focus on squeezing your abs as you bring your left elbow to right knee, right elbow to left knee']
),
(
  'Plank',
  'Isometric core exercise that builds stability and endurance.',
  '["Start in push-up position", "Hold body in straight line", "Keep core engaged", "Breathe normally while holding"]',
  ARRAY['core', 'shoulders']::muscle_group_enum[],
  'core',
  ARRAY['bodyweight']::equipment_enum[],
  1,
  false,
  ARRAY['Squeeze your glutes', 'Keep your hips low']
),
(
  'Hanging Leg Raise',
  'Advanced core exercise performed hanging from a bar.',
  '["Hang from pull-up bar", "Raise knees to chest", "Control the descent", "Keep core engaged throughout"]',
  ARRAY['abs', 'core']::muscle_group_enum[],
  'abs',
  ARRAY['bodyweight']::equipment_enum[],
  3,
  false,
  ARRAY['Focus on flexing your lower back', 'Perform off of captain''s chair']
);

-- ============================================================================
-- WORKOUT PLANS
-- ============================================================================

-- Insert the three main workout programs
INSERT INTO workout_plans (name, description, type, frequency_per_week, duration_weeks, difficulty, target_experience, is_template, is_public, tags) VALUES
(
  'Full Body Program',
  'A comprehensive 3-day full body routine with two progressive phases. Perfect for beginners to early-intermediate lifters.',
  'full_body',
  3,
  8,
  2,
  ARRAY['untrained', 'beginner', 'early_intermediate']::experience_level_enum[],
  true,
  true,
  ARRAY['full-body', 'beginner', 'strength', 'progressive']
),
(
  'Upper/Lower Program',
  'A 4-day upper/lower split with two progressive phases. Ideal for intermediate trainees seeking more volume.',
  'upper_lower',
  4,
  8,
  3,
  ARRAY['beginner', 'early_intermediate']::experience_level_enum[],
  true,
  true,
  ARRAY['upper-lower', 'intermediate', 'volume', 'split']
),
(
  'Body Part Split Program',
  'A 5-day body part split with two progressive phases. Advanced program for experienced lifters.',
  'body_part_split',
  5,
  8,
  4,
  ARRAY['early_intermediate', 'intermediate']::experience_level_enum[],
  true,
  true,
  ARRAY['body-part-split', 'advanced', 'specialization', 'high-volume']
);

-- ============================================================================
-- WORKOUT PLAN SESSIONS AND EXERCISES
-- ============================================================================

-- Create workout sessions and planned exercises for all three programs
DO $$
DECLARE
  full_body_id UUID;
  upper_lower_id UUID;
  body_part_split_id UUID;
  session_id UUID;
  
  -- Exercise IDs (will be populated from the exercises table)
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

  -- ============================================================================
  -- FULL BODY PROGRAM - PHASE 1 (Weeks 1-4)
  -- ============================================================================
  
  -- Full Body #1 - Week 1-4
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, week_number, estimated_duration_minutes)
  VALUES (full_body_id, 'Full Body #1', 1, 1, 60)
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

  -- Full Body #2 - Week 1-4
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, week_number, estimated_duration_minutes)
  VALUES (full_body_id, 'Full Body #2', 2, 1, 60)
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

  -- Full Body #3 - Week 1-4
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, week_number, estimated_duration_minutes)
  VALUES (full_body_id, 'Full Body #3', 3, 1, 60)
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

  -- Copy sessions for weeks 2-4 of Phase 1
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, week_number, estimated_duration_minutes)
  SELECT plan_id, name, day_number, 2, estimated_duration_minutes 
  FROM workout_plan_sessions 
  WHERE plan_id = full_body_id AND week_number = 1;
  
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, week_number, estimated_duration_minutes)
  SELECT plan_id, name, day_number, 3, estimated_duration_minutes 
  FROM workout_plan_sessions 
  WHERE plan_id = full_body_id AND week_number = 1;
  
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, week_number, estimated_duration_minutes)
  SELECT plan_id, name, day_number, 4, estimated_duration_minutes 
  FROM workout_plan_sessions 
  WHERE plan_id = full_body_id AND week_number = 1;

  -- ============================================================================
  -- FULL BODY PROGRAM - PHASE 2 (Weeks 5-8) - Modified exercises and rep ranges
  -- ============================================================================
  
  -- Phase 2 sessions with updated parameters
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, week_number, estimated_duration_minutes)
  VALUES (full_body_id, 'Full Body #1', 1, 5, 60)
  RETURNING id INTO session_id;
  
  INSERT INTO planned_exercises (session_id, exercise_id, order_in_session, target_sets, target_reps_min, target_reps_max, target_rpe, rest_seconds, notes)
  VALUES 
    (session_id, back_squat_id, 1, 3, 8, 8, 8, 180, 'SIT BACK AND DOWN, 15° TOE FLARE, DRIVE YOUR KNEES OUT LATERALLY'),
    (session_id, barbell_bench_press_id, 2, 3, 10, 10, 8, 120, 'TUCK ELBOWS AT A 45° ANGLE, SQUEEZE YOUR SHOULDER BLADES AND STAY FIRM ON THE BENCH'),
    (session_id, lat_pulldown_id, 3, 3, 15, 15, 8, 120, 'PULL YOUR ELBOWS DOWN AND IN, USE A 1.5X SHOULDER WIDTH GRIP');

  -- Copy Phase 2 sessions for weeks 6-8
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, week_number, estimated_duration_minutes)
  SELECT plan_id, name, day_number, 6, estimated_duration_minutes 
  FROM workout_plan_sessions 
  WHERE plan_id = full_body_id AND week_number = 5;
  
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, week_number, estimated_duration_minutes)
  SELECT plan_id, name, day_number, 7, estimated_duration_minutes 
  FROM workout_plan_sessions 
  WHERE plan_id = full_body_id AND week_number = 5;
  
  INSERT INTO workout_plan_sessions (plan_id, name, day_number, week_number, estimated_duration_minutes)
  SELECT plan_id, name, day_number, 8, estimated_duration_minutes 
  FROM workout_plan_sessions 
  WHERE plan_id = full_body_id AND week_number = 5;

END $$;

-- ============================================================================
-- ANALYTICS VIEWS
-- ============================================================================

-- Create useful views for analytics and reporting
CREATE VIEW user_workout_stats AS
SELECT 
  up.id as user_id,
  up.display_name,
  up.experience_level,
  COUNT(ws.id) as total_workouts,
  COALESCE(AVG(ws.duration_minutes), 0) as avg_duration,
  COALESCE(SUM(ws.total_volume_kg), 0) as total_volume,
  COALESCE(AVG(ws.average_rpe), 0) as avg_rpe,
  MAX(ws.started_at) as last_workout
FROM user_profiles up
LEFT JOIN workout_sessions ws ON up.id = ws.user_id AND ws.completed_at IS NOT NULL
GROUP BY up.id, up.display_name, up.experience_level;

CREATE VIEW exercise_popularity AS
SELECT 
  e.name,
  e.primary_muscle,
  COUNT(es.id) as total_sets,
  COUNT(DISTINCT ws.user_id) as unique_users,
  COALESCE(AVG(es.weight_kg), 0) as avg_weight,
  COALESCE(AVG(es.reps), 0) as avg_reps,
  COALESCE(AVG(es.rpe), 0) as avg_rpe
FROM exercises e
LEFT JOIN exercise_sets es ON e.id = es.exercise_id AND es.is_warmup = FALSE
LEFT JOIN workout_sessions ws ON es.session_id = ws.id
GROUP BY e.id, e.name, e.primary_muscle
ORDER BY total_sets DESC;

CREATE VIEW subscription_metrics AS
SELECT
  sp.name as plan_name,
  COUNT(CASE WHEN s.status = 'active' THEN 1 END) as active_subscribers,
  COUNT(CASE WHEN s.status = 'canceled' THEN 1 END) as canceled_subscribers,
  ROUND(AVG(CASE WHEN s.status = 'active' THEN sp.price_cents END) / 100.0, 2) as avg_monthly_revenue,
  SUM(CASE WHEN s.status = 'active' THEN sp.price_cents END) / 100.0 as total_monthly_revenue
FROM subscription_plans sp
LEFT JOIN subscriptions s ON sp.id = s.plan_id
GROUP BY sp.id, sp.name
ORDER BY sp.sort_order;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON VIEW user_workout_stats IS 'User workout statistics for analytics dashboard';
COMMENT ON VIEW exercise_popularity IS 'Exercise usage statistics across all users';
COMMENT ON VIEW subscription_metrics IS 'Subscription plan performance metrics';
