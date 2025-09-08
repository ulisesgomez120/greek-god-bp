-- Seed: Insert initial exercise tutorial videos by matching exercise name (case-insensitive)
-- Expanded to include every tutorial listed in context/exercise-tutorials.md
-- Usage: run against your staging DB after applying migrations. This script will:
-- 1) create a helper table for unmatched headings (public.seed_unmatched_exercise_tutorials)
-- 2) attempt to match each tutorial's exercise_name to an existing exercises.name (case-insensitive)
-- 3) insert matched tutorials into public.exercise_tutorial_videos (skipping duplicates)
-- 4) insert unmatched rows into the helper table for manual mapping/review
-- IMPORTANT: Run this on staging first. The script uses exact case-insensitive name matches (lower(e.name) = lower(t.exercise_name)).
-- Add/adjust rows if your canonical exercise names differ.

BEGIN;

-- Helper table to record unmatched headings for manual mapping
CREATE TABLE IF NOT EXISTS public.seed_unmatched_exercise_tutorials (
  id serial PRIMARY KEY,
  exercise_name text NOT NULL,
  title text,
  url text,
  created_at timestamptz DEFAULT now()
);

-- Temporary table to hold the seed rows for this session
CREATE TEMP TABLE tmp_tutorials (
  exercise_name text,
  title text,
  url text
) ON COMMIT DROP;

-- Populate the temp table with the expanded VALUES list
INSERT INTO tmp_tutorials (exercise_name, title, url)
VALUES
  -- Lower Body Exercises
  ($$Back Squat$$, $$How to PROPERLY Squat for Growth (4 Easy Steps)$$, $$https://www.youtube.com/watch?v=gcNh17Ckjgg$$),
  ($$Back Squat$$, $$How to Barbell Back Squat | A Tutorial for Beginners$$, $$https://www.youtube.com/watch?v=8PMjqgR8Wa8$$),
  ($$Back Squat$$, $$BEGINNER'S GUIDE TO BACK SQUATS$$, $$https://www.youtube.com/watch?v=irA7MTz96ho$$),

  ($$Goblet Squat$$, $$How to do Goblet Squats$$, $$https://www.youtube.com/watch?v=NNdneO3bP2E$$),
  ($$Goblet Squat$$, $$How to Do the Goblet Squat | Perfect Form for Strength & Mobility$$, $$https://www.youtube.com/watch?v=V0f5uvsbksg$$),
  ($$Goblet Squat$$, $$How to Goblet Squat - The Complete Guide for Beginners$$, $$https://www.youtube.com/watch?v=9KzZD_n2r64$$),

  ($$Deadlift$$, $$How to Deadlift for Beginners$$, $$https://www.youtube.com/watch?v=xcomIo8MWyc$$),
  ($$Deadlift$$, $$How To Deadlift: 5 Step Deadlift | 2022$$, $$https://www.youtube.com/watch?v=MBbyAqvTNkU$$),
  ($$Deadlift$$, $$Learning to Deadlift | The Starting Strength Method$$, $$https://www.youtube.com/watch?v=p2OPUi4xGrM$$),

  ($$Romanian Deadlift$$, $$Romanian Deadlift | Nuffield Health$$, $$https://www.youtube.com/watch?v=7j-2w4-P14I$$),
  ($$Romanian Deadlift$$, $$How to do romanian deadlifts safely$$, $$https://www.youtube.com/watch?v=ZEnWV4kguKc$$),
  ($$Romanian Deadlift$$, $$How To Perform PERFECT Romanian Deadlifts | RDLs$$, $$https://www.youtube.com/watch?v=uhghy9pFIPY$$),

  ($$Dumbbell Walking Lunge$$, $$How to PROPERLY Walking Dumbbell Lunge (FIX THIS NOW!)$$, $$https://www.youtube.com/watch?v=_DLIS8SySzs$$),
  ($$Dumbbell Walking Lunge$$, $$How to do Dumbbell walking Lunge$$, $$https://www.youtube.com/watch?v=6GgXWvtWocc$$),
  ($$Dumbbell Walking Lunge$$, $$Dumbbell Walking Lunge - How To$$, $$https://www.youtube.com/watch?v=I34ysEkPK7w$$),

  ($$Barbell Hip Thrust$$, $$Hip Thrust Tutorial - Proper Form and Technique$$, $$https://www.youtube.com/watch?v=pF17m_CXfL0$$),
  ($$Barbell Hip Thrust$$, $$How To Do A Barbell Hip Thrust The RIGHT Way! (FIX THIS!!!)$$, $$https://www.youtube.com/watch?v=S_uZP4UH6J0$$),
  ($$Barbell Hip Thrust$$, $$HOW TO HIP THRUST | 2024 Complete Beginner's Guide$$, $$https://www.youtube.com/watch?v=jQkKeL4Cg8M$$),

  ($$Dumbbell Single-Leg Hip Thrust$$, $$How To Do Single Leg Hip Thrusts$$, $$https://www.youtube.com/watch?v=1u-b25VJVFU$$),
  ($$Dumbbell Single-Leg Hip Thrust$$, $$Single Leg Dumbbell Hip Thrust (Full Tutorial) - Glute Exercises for Beginners$$, $$https://www.youtube.com/watch?v=L4nTaesNm0E$$),

  ($$Leg Extension$$, $$Planet Fitness - How To Use Leg Extension Machine$$, $$https://www.youtube.com/watch?v=8Jqof7z3QYM$$),
  ($$Leg Extension$$, $$Exercise Tutorial: Technogym Leg Extension Machine$$, $$https://www.youtube.com/watch?v=2lvdnQg04PM$$),
  ($$Leg Extension$$, $$How to Do Leg Extensions with GREAT Technique (Grow Your Quads)$$, $$https://www.youtube.com/watch?v=o90ocSBDJis$$),

  ($$Single-Leg Leg Extension$$, $$How To: Seated Single-Leg Extension (Cybex)$$, $$https://www.youtube.com/watch?v=I1F58vIjbvc$$),
  ($$Single-Leg Leg Extension$$, $$Cable Machine Single Leg Extension | Great Leg Definition$$, $$https://www.youtube.com/watch?v=VW5BYl5ouRg$$),
  ($$Single-Leg Leg Extension$$, $$How To Do A Single Leg Extension$$, $$https://www.youtube.com/watch?v=82IuSLk5zNc$$),

  ($$Lying Leg Curl$$, $$How to Lying Leg Curl | Proper Technique, Set Up, & Mistakes$$, $$https://www.youtube.com/watch?v=vl5nUdE9mWM$$),
  ($$Lying Leg Curl$$, $$How to do a Lying Leg Curl$$, $$https://www.youtube.com/watch?v=NlZeAGZ_YJw$$),
  ($$Lying Leg Curl$$, $$Lying Leg Curl: A Secret Exercise For Huge Hamstrings$$, $$https://www.youtube.com/watch?v=PtmNn03p3hU$$),

  ($$Single-Leg Lying Leg Curl$$, $$How To: Single Leg Lying Leg Curl$$, $$https://www.youtube.com/watch?v=L7eU0RhlXBs$$),
  ($$Single-Leg Lying Leg Curl$$, $$Lying single leg hamstring curl$$, $$https://www.youtube.com/watch?v=5T7E5wNG99I$$),
  ($$Single-Leg Lying Leg Curl$$, $$How to do a Single-Leg Lying Curl | Proper Form & Technique | NASM$$, $$https://www.youtube.com/watch?v=kGIfh3hHY0w$$),

  ($$Seated Leg Curl$$, $$How To Use Seated Leg Curl Machine - Planet Fitness$$, $$https://www.youtube.com/watch?v=fK0uZ3KRZRI$$),
  ($$Seated Leg Curl$$, $$Exercise Tutorial: Technogym Seated Leg Curl Machine$$, $$https://www.youtube.com/watch?v=IOufFLwNOTU$$),
  ($$Seated Leg Curl$$, $$Beginner's Guide: Seated Leg Curl$$, $$https://www.youtube.com/watch?v=t9sTSr-JYSs$$),

  ($$Leg Press$$, $$Seated Leg Press - Instructional Fitness$$, $$https://www.youtube.com/watch?v=Aq5uxXrXq7c$$),
  ($$Leg Press$$, $$How to Use the Linear Leg Press$$, $$https://www.youtube.com/watch?v=_gIdzap4Hrg$$),
  ($$Leg Press$$, $$3 Leg Press Variations for Muscle Gain$$, $$https://www.youtube.com/watch?v=CHPHn-OnTqE$$),

  ($$Machine Seated Hip Abduction$$, $$How to PROPERLY Use The Abductor Machine (STOP DOING THIS)$$, $$https://www.youtube.com/watch?v=OjI5OpV6IWA$$),
  ($$Machine Seated Hip Abduction$$, $$How To Use The Seated Hip Abductor (Outer Thigh)$$, $$https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&start_radio=1$$),
  ($$Machine Seated Hip Abduction$$, $$Seated Abduction Machine$$, $$https://www.youtube.com/watch?v=50-DOb9Nu-4$$),

  ($$Standing Calf Raise$$, $$Standing Calf Raises - Calves Exercise - Bodybuilding.com$$, $$https://www.youtube.com/watch?v=MAMzF7iZNkc$$),
  ($$Standing Calf Raise$$, $$Standing Calf Raise$$, $$https://www.youtube.com/watch?v=k67UjgvJdEk$$),
  ($$Standing Calf Raise$$, $$How to Do Calf Raises$$, $$https://www.youtube.com/watch?v=gwLzBJYoWlI$$),

  -- Upper Body Pressing Exercises
  ($$Barbell Bench Press$$, $$How to Bench Press: Best Setup & Bar Path to Bench More Weight$$, $$https://www.youtube.com/watch?v=JY2PW3LhHtQ$$),
  ($$Barbell Bench Press$$, $$How to Bench Press with Proper Form (AVOID MISTAKES!)$$, $$https://www.youtube.com/watch?v=-MAABwVKxok$$),
  ($$Barbell Bench Press$$, $$How to Perform Bench Press - Tutorial & Proper Form$$, $$https://www.youtube.com/watch?v=gRVjAtPip0Y$$),

  ($$Dumbbell Incline Press$$, $$How To PROPERLY Dumbbell Incline Press Like A Pro$$, $$https://www.youtube.com/watch?v=awEEyL5zGvU$$),
  ($$Dumbbell Incline Press$$, $$How To: Dumbbell Incline Chest Press$$, $$https://www.youtube.com/watch?v=8iPEnn-ltC8$$),
  ($$Dumbbell Incline Press$$, $$Grow Your Chest with the INCINE DUMBBELL PRESS | Mind Pump$$, $$https://www.youtube.com/watch?v=0G2_XV7slIg$$),

  ($$Close-Grip Bench Press$$, $$The Close Grip Bench Press | How To Perform It Correctly$$, $$https://www.youtube.com/watch?v=JCV8-OCr_Kc$$),
  ($$Close-Grip Bench Press$$, $$Close-Grip Bench Press (TRICEPS BUILDER) || PERFECT FORM$$, $$https://www.youtube.com/watch?v=UYJsFzqdgK4$$),
  ($$Close-Grip Bench Press$$, $$Close Grip Bench Press: Gym Shorts (How To)$$, $$https://www.youtube.com/watch?v=hWEpF7lFR9Q$$),

  ($$Machine Incline Chest Press$$, $$Incline Chest Press - Exercise Tutorial$$, $$https://www.youtube.com/watch?v=1-R20ZHUn98$$),
  ($$Machine Incline Chest Press$$, $$How To: Incline Chest Press (Hammer Strength)$$, $$https://www.youtube.com/watch?v=ig0NyNlSce4$$),
  ($$Machine Incline Chest Press$$, $$Tuesday Tips | HOW TO - Machine Incline Press with Hunter Labrada$$, $$https://www.youtube.com/watch?v=YiC1-pNP4ig$$),

  ($$Dumbbell Floor Press$$, $$How To PROPERLY Dumbbell Floor Press (FIX YOUR FORM NOW)$$, $$https://www.youtube.com/watch?v=AqYFvc9t_vU$$),
  ($$Dumbbell Floor Press$$, $$How To: Dumbbell Floor Press$$, $$https://www.youtube.com/watch?v=uUGDRwge4F8$$),
  ($$Dumbbell Floor Press$$, $$DUMBBELL FLOOR PRESS$$, $$https://www.youtube.com/watch?v=lNdi7VEf2Ew$$),

  ($$Assisted Dip$$, $$How To: Assisted Dip Machine$$, $$https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&start_radio=1$$),
  ($$Assisted Dip$$, $$Exercise Tutorial: Assisted Dips$$, $$https://www.youtube.com/watch?v=kbmVlw-i0Vs$$),
  ($$Assisted Dip$$, $$Assisted Dips Using a Resistance Band- Safe and Effective!$$, $$https://www.youtube.com/watch?v=FVY05-o3aGc$$),

  ($$Overhead Press$$, $$How To Perfect The Overhead Press$$, $$https://www.youtube.com/watch?v=-5MmFTKLC-0$$),
  ($$Overhead Press$$, $$How to PROPERLY Overhead Press - Colossus Fitness$$, $$https://www.youtube.com/watch?v=NAtsHyowOXg$$),
  ($$Overhead Press$$, $$Barbell Overhead Press Beginners and Intermediates #howto$$, $$https://www.youtube.com/watch?v=yWZGBBZoVXc$$),

  ($$Dumbbell Seated Shoulder Press$$, $$How To Do: Seated Dumbbell Overhead Press$$, $$https://www.youtube.com/watch?v=C0We_bEyxlM$$),
  ($$Dumbbell Seated Shoulder Press$$, $$How To: Dumbbell Shoulder Press$$, $$https://www.youtube.com/watch?v=qEwKCR5JCog$$),
  ($$Dumbbell Seated Shoulder Press$$, $$How To PROPERLY Dumbbell Shoulder Press (LEARN FAST)$$, $$https://www.youtube.com/watch?v=vlFGTI5JzjI$$),

  -- Upper Body Pulling Exercises
  ($$Lat Pulldown$$, $$How to do Lat Pulldowns (AVOID MISTAKES!)$$, $$https://www.youtube.com/watch?v=SALxEARiMkw$$),
  ($$Lat Pulldown$$, $$Beginner's Guide: Lat Pulldown$$, $$https://www.youtube.com/watch?v=AOpi-p0cJkc$$),

  ($$Single-Arm Pulldown$$, $$Exercise Tutorial: Single-Arm Lat Pull-Down$$, $$https://www.youtube.com/watch?v=M9xUoJYtXtc$$),
  ($$Single-Arm Pulldown$$, $$How to do Single Arm Lat Pulldowns$$, $$https://www.youtube.com/watch?v=0BT533ueEdI$$),
  ($$Single-Arm Pulldown$$, $$One-Arm Lat Pulldown by Jim Stoppani$$, $$https://www.youtube.com/watch?v=iVfZB4YmLRM$$),

  ($$Reverse-Grip Lat Pulldown$$, $$How To Do A Reverse Grip Lat Pulldown$$, $$https://www.youtube.com/watch?v=kBEdxDkPgBI$$),
  ($$Reverse-Grip Lat Pulldown$$, $$How To: Reverse Lat Pulldown$$, $$https://www.youtube.com/watch?v=apzFTbsm7HU$$),
  ($$Reverse-Grip Lat Pulldown$$, $$The Reverse Grip Lat Pulldown | How To Perform It Correctly$$, $$https://www.youtube.com/watch?v=D-aYXhHBDI8$$),

  ($$Neutral-Grip Pulldown$$, $$Neutral-Grip Pulldown Tutorial$$, $$https://www.youtube.com/watch?v=4P3-TXbH4tw$$),
  ($$Neutral-Grip Pulldown$$, $$Neutral Grip Pulldowns [Perfect Form in 60 Seconds]$$, $$https://www.youtube.com/watch?v=E1FK9APxk54$$),
  ($$Neutral-Grip Pulldown$$, $$Neutral grip lat pulldown$$, $$https://www.youtube.com/watch?v=4y-GyEQ74Hk$$),

  ($$Chest-Supported T-Bar Row$$, $$How To Do A WIDE GRIP CHEST SUPPORTED T-BAR ROW$$, $$https://www.youtube.com/watch?v=0m8Cw0fHPQw$$),
  ($$Chest-Supported T-Bar Row$$, $$T-Bar Row: Boost Your Back Workout With Proper Technique$$, $$https://www.youtube.com/watch?v=uVwmw_FVIXI$$),
  ($$Chest-Supported T-Bar Row$$, $$Exercise Tutorial - Chest Supported T Bar Row$$, $$https://www.youtube.com/watch?v=zL7JWm_beA8$$),

  ($$Dumbbell Row$$, $$STOP F\*cking Up Dumbbell Rows (PROPER FORM!)$$, $$https://www.youtube.com/watch?v=gfUg6qWohTk$$),
  ($$Dumbbell Row$$, $$How to Perform Single Arm Dumbbell Rows$$, $$https://www.youtube.com/watch?v=nMFCMNKnLgQ$$),
  ($$Dumbbell Row$$, $$How To: Dumbbell Bent-Over Row (Single-Arm)$$, $$https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&start_radio=1$$),

  ($$Barbell Bent Over Row$$, $$Bent Over Barbell Row - Exercise Tutorial$$, $$https://www.youtube.com/watch?v=TJiouaKew_k$$),
  ($$Barbell Bent Over Row$$, $$How To: Bent Over Barbell Row$$, $$https://www.youtube.com/watch?v=vT2GjY_Umpw$$),
  ($$Barbell Bent Over Row$$, $$Bent Over Row With A Barbell For Beginners$$, $$https://www.youtube.com/watch?v=2_FyNw6DZgw$$),

  ($$Cable Seated Row$$, $$Seated Cable Row | Exercise Guide$$, $$https://www.youtube.com/watch?v=xQNrFHEMhI4$$),
  ($$Cable Seated Row$$, $$How to Do a Seated Cable Row$$, $$https://www.youtube.com/watch?v=f_r95UajQcg$$),
  ($$Cable Seated Row$$, $$How to PROPERLY Seated Cable Row (DO THIS NOW)$$, $$https://www.youtube.com/watch?v=7BkgqzC6WsM$$),

  -- Isolation Exercises
  ($$Cable Flye$$, $$How To: High Cable Chest Fly$$, $$https://www.youtube.com/watch?v=Iwe6AmxVf7o$$),
  ($$Cable Flye$$, $$Mid-Cable Chest Fly | Proper Technique & Common Mistakes$$, $$https://www.youtube.com/watch?v=4Y8QgiT2-OA$$),
  ($$Cable Flye$$, $$How to PROPERLY Low Cable Chest Fly (FIX YOUR FORM NOW)$$, $$https://www.youtube.com/watch?v=fAmLAQVFq9k$$),

  ($$Pec Deck$$, $$Perfect Pec Deck$$, $$https://www.youtube.com/watch?v=JJitfZKlKk4$$),
  ($$Pec Deck$$, $$How To Do A Pec Deck Fly (BEGINNER)$$, $$https://www.youtube.com/watch?v=JYmszQs-mRs$$),
  ($$Pec Deck$$, $$Instructional Fitness - Pec Decks$$, $$https://www.youtube.com/watch?v=A_uwDymTVwY$$),

  ($$Dumbbell Lateral Raise$$, $$How to Do Side Lateral Raises (with PERFECT FORM)$$, $$https://www.youtube.com/watch?v=Gmi_DCnJ93c$$),
  ($$Dumbbell Lateral Raise$$, $$How to Perform Dumbbell Lateral Raise | Form Tutorial$$, $$https://www.youtube.com/watch?v=Y29xKcze8Ik$$),
  ($$Dumbbell Lateral Raise$$, $$How To: Dumbbell Side Lateral Raise$$, $$https://www.youtube.com/watch?v=3VcKaXpzqRo$$),

  ($$Cable Lateral Raise$$, $$Cable Lateral Raise How To (Finally Get Cannonball Delts)$$, $$https://www.youtube.com/watch?v=tf3PNHeeWCQ$$),
  ($$Cable Lateral Raise$$, $$How to PROPERLY Cable Lateral Raise (TRY THIS!)$$, $$https://www.youtube.com/watch?v=qitQHqNZbeM$$),
  ($$Cable Lateral Raise$$, $$Exercise Tutorial: Cable Shoulder Lateral Raise$$, $$https://www.youtube.com/watch?v=zzB2gzOh5i4$$),

  ($$Seated Face Pull$$, $$How To: Face Pull$$, $$https://www.youtube.com/watch?v=rep-qVOkqgk$$),
  ($$Seated Face Pull$$, $$How To Do Seated Cable Face Pull | Exercise Demo$$, $$https://www.youtube.com/watch?v=4UhV4cCkugM$$),
  ($$Seated Face Pull$$, $$STOP F\*cking Up Face Pulls (PROPER FORM!)$$, $$https://www.youtube.com/watch?v=ljgqer1ZpXg$$),

  ($$Reverse Pec Deck$$, $$How to Reverse Pec dec$$, $$https://www.youtube.com/watch?v=6cHY60y7QRU$$),
  ($$Reverse Pec Deck$$, $$Reverse Pec Deck - Exercise Tutorial$$, $$https://www.youtube.com/watch?v=3RLqAh8-9Pg$$),
  ($$Reverse Pec Deck$$, $$How to PROPERLY Reverse Pec Deck Fly (DO THIS)$$, $$https://www.youtube.com/watch?v=dC7jhEk-29A$$),

  ($$Cable Reverse Flye$$, $$Exercise Tutorial: Cable Standing Reverse Fly$$, $$https://www.youtube.com/watch?v=CfLXDFh110w$$),
  ($$Cable Reverse Flye$$, $$How To Reverse Cable Fly | Rear Delts and Upper Back$$, $$https://www.youtube.com/watch?v=zM7yAE6dFiA$$),
  ($$Cable Reverse Flye$$, $$Cable Reverse Fly using a cable system$$, $$https://www.youtube.com/watch?v=CJc17AED6as$$),

  ($$Bent Over Reverse Dumbbell Flye$$, $$How to PROPERLY Dumbbell Rear Delt Fly$$, $$https://www.youtube.com/watch?v=buuYPLVXsJg$$),
  ($$Bent Over Reverse Dumbbell Flye$$, $$Bent Over Reverse Fly$$, $$https://www.youtube.com/watch?v=84XhJDxRf10$$),
  ($$Bent Over Reverse Dumbbell Flye$$, $$Bent Over Dumbbell Reverse Fly$$, $$https://www.youtube.com/watch?v=evXOlgLTPCw$$),

  ($$Dumbbell Supinated Curl$$, $$How to Do Dumbbell Supinated Curls$$, $$https://www.youtube.com/watch?v=OtFLz4RwYMQ$$),
  ($$Dumbbell Supinated Curl$$, $$Want Bigger Biceps? Try This: The Dumbbell Supinated Curl$$, $$https://www.youtube.com/watch?v=kNi1xK-r-aI$$),
  ($$Dumbbell Supinated Curl$$, $$Supinating Dumbbell Curl | Olympic Weightlifting Exercise Library$$, $$https://www.youtube.com/watch?v=2TiEnyiDwfM$$),

  ($$Single-Arm Cable Curl$$, $$Single Arm Cable Curl - Exercise Tutorial$$, $$https://www.youtube.com/watch?v=njLoCel5lUI$$),
  ($$Single-Arm Cable Curl$$, $$Single-Arm Cable Curl | Olympic Weightlifting Exercise Library$$, $$https://www.youtube.com/watch?v=C2RhWTlwx_U$$),
  ($$Single-Arm Cable Curl$$, $$Exercise Index - One Arm Cable Curl$$, $$https://www.youtube.com/watch?v=Qbk5A7lWVOE$$),

  ($$EZ Bar Curl$$, $$Exercise Tutorial: EZ Bar Bicep Curl$$, $$https://www.youtube.com/watch?v=SDFZBaJcTsU$$),
  ($$EZ Bar Curl$$, $$How To EZ Bar Curl With Perfect Form (Grow Your Biceps)$$, $$https://www.youtube.com/watch?v=5NsFLGUf0Fo$$),
  ($$EZ Bar Curl$$, $$EZ Bar Bicep Curl - Exercise Tutorial$$, $$https://www.youtube.com/watch?v=kFwMu_o0UsA$$),

  ($$Hammer Curl$$, $$How To: Dumbbell Hammer Curl$$, $$https://www.youtube.com/watch?v=zC3nLlEvin4$$),
  ($$Hammer Curl$$, $$Dumbbell Hammer Curls Tutorial | CORRECT TECHNIQUE (!)$$, $$https://www.youtube.com/watch?v=OPqe0kCxmR8$$),
  ($$Hammer Curl$$, $$Dumbbell Hammer Curl (BICEPS PEAK BUILDER!)$$, $$https://www.youtube.com/watch?v=8XLxfXROrTo$$),

  ($$Dumbbell Skull Crusher$$, $$Tricep Skull Crushers (Dumbbell, Barbell, EZ Bar)$$, $$https://www.youtube.com/watch?v=gfb0w2d3-pU$$),
  ($$Dumbbell Skull Crusher$$, $$Dumbbell Skull Crusher$$, $$https://www.youtube.com/watch?v=rIvTWKxQQOk$$),
  ($$Dumbbell Skull Crusher$$, $$How To: Dumbbell Skull Crusher$$, $$https://www.youtube.com/watch?v=ir5PsbniVSc$$),

  ($$Single-Arm Rope Tricep Extension$$, $$Single Arm Rope Tricep Extension - Exercise Tutorial$$, $$https://www.youtube.com/watch?v=VAG6F2H_Asg$$),
  ($$Single-Arm Rope Tricep Extension$$, $$How to do Single-Arm Tricep Extensions on a Cable Machine$$, $$https://www.youtube.com/watch?v=juNUDw4hVHU$$),
  ($$Single-Arm Rope Tricep Extension$$, $$Single Arm Tricep Extension - YouTube$$, $$https://www.youtube.com/watch?v=M_-jcPRO_h0$$),

  ($$Cable Tricep Kickback$$, $$Tricep Cable Kickback$$, $$https://www.youtube.com/watch?v=VIH5vgxw_9c$$),
  ($$Cable Tricep Kickback$$, $$How To: Kill It With Tricep Cable Rope Kick-Backs$$, $$https://www.youtube.com/watch?v=n1wFHU8Pkfc$$),
  ($$Cable Tricep Kickback$$, $$Tricep Focus Session- Tricep Cable Kickback$$, $$https://www.youtube.com/watch?v=8N_FtjbpO2k$$),

  -- Core Exercises
  ($$Crunch$$, $$Bowflex® How-To | Crunches for Beginners$$, $$https://www.youtube.com/watch?v=0OxOI3sAIrM$$),
  ($$Crunch$$, $$How to Do Crunches$$, $$https://www.youtube.com/watch?v=Xyd_fa5zoEU$$),
  ($$Crunch$$, $$How To Do Crunches | The Right Way | Well+Good$$, $$https://www.youtube.com/watch?v=0t4t3IpiEao$$),

  ($$Bicycle Crunch$$, $$How to Do a Bicycle Crunch Exercise | 30 Seconds | MedBridge$$, $$https://www.youtube.com/watch?v=VaL7XWK3MVE$$),
  ($$Bicycle Crunch$$, $$How To Do A Bicycle Crunch | The Right Way | Well+Good$$, $$https://www.youtube.com/watch?v=wpRI3xBhJmo$$),
  ($$Bicycle Crunch$$, $$How to Do a Bicycle Crunch | Boot Camp Workout$$, $$https://www.youtube.com/watch?v=Iwyvozckjak$$),

  ($$Plank$$, $$How To: Plank$$, $$https://www.youtube.com/watch?v=pSHjTRCQxIw$$),
  ($$Plank$$, $$Planks for Beginners | Bowflex®$$, $$https://www.youtube.com/watch?v=ASdvN_XEl_c$$),
  ($$Plank$$, $$How To Plank (Proper Form | Cues | Progressions)$$, $$https://www.youtube.com/watch?v=A2b2EmIg0dA$$),

  ($$Hanging Leg Raise$$, $$Hanging Leg Raise (HLR) | Olympic Weightlifting Exercise Library$$, $$https://www.youtube.com/watch?v=PjlPiVTtWA4$$),
  ($$Hanging Leg Raise$$, $$Hanging Leg Raise - Ab Exercise - Bodybuilding.com$$, $$https://www.youtube.com/watch?v=Nw0LOKe3_l8$$),
  ($$Hanging Leg Raise$$, $$Hanging Leg Raise | HOW-TO$$, $$https://www.youtube.com/watch?v=Pr1ieGZ5atk$$)
;

-- Insert matched tutorials (avoid duplicate url for same exercise)
INSERT INTO public.exercise_tutorial_videos (exercise_id, title, url, created_at)
SELECT e.id, t.title, t.url, now()
FROM tmp_tutorials t
JOIN public.exercises e ON lower(e.name) = lower(t.exercise_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.exercise_tutorial_videos etv
  WHERE etv.exercise_id = e.id AND etv.url = t.url
);

-- Insert unmatched into helper table for manual review
INSERT INTO public.seed_unmatched_exercise_tutorials (exercise_name, title, url, created_at)
SELECT t.exercise_name, t.title, t.url, now()
FROM tmp_tutorials t
LEFT JOIN public.exercises e ON lower(e.name) = lower(t.exercise_name)
WHERE e.id IS NULL;

COMMIT;
