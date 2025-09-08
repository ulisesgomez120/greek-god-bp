/**
 * Seed script: supabase/seed_exercise_tutorials.js
 *
 * Usage:
 *   SUPABASE_URL=https://your-project.supabase.co SUPABASE_SERVICE_ROLE_KEY=your_service_role_key node supabase/seed_exercise_tutorials.js
 *
 * Notes:
 * - This script requires a Supabase Service Role key (or another key with insert privileges on the target table).
 * - It parses context/exercise-tutorials.md and attempts a case-insensitive exact match on exercises.name.
 * - For matched exercise names it inserts rows into public.exercise_tutorial_videos (exercise_id, title, url, created_at).
 * - Unmatched headings are written to supabase/seed_unmatched_exercise_tutorials.txt for manual review.
 *
 * IMPORTANT: This script performs writes to your database. Run in staging first.
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const MD_PATH = path.join(__dirname, "..", "context", "exercise-tutorials.md");
const UNMATCHED_OUT = path.join(__dirname, "seed_unmatched_exercise_tutorials.txt");

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set environment variables and re-run.\n" +
        "Example:\n  SUPABASE_URL=https://xyz.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxxxx node supabase/seed_exercise_tutorials.js"
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  let md;
  try {
    md = fs.readFileSync(MD_PATH, "utf8");
  } catch (err) {
    console.error("Failed to read markdown file:", MD_PATH, err);
    process.exit(1);
  }

  // Parse: find headings that start with "### " (exercise headings in this document)
  const lines = md.split(/\r?\n/);

  const exercises = []; // { name, tutorials: [{title, url}] }
  let current = null;

  const headingRe = /^\s*###\s+(.+)\s*$/;
  const bulletRe = /^\s*-\s*\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i;

  for (const line of lines) {
    const h = line.match(headingRe);
    if (h) {
      const name = h[1].trim();
      current = { name, tutorials: [] };
      exercises.push(current);
      continue;
    }

    if (!current) continue;

    const b = line.match(bulletRe);
    if (b) {
      const title = b[1].trim();
      const url = b[2].trim();
      current.tutorials.push({ title, url });
    }
  }

  console.log(`Found ${exercises.length} exercise headings. Preparing to match and insert tutorials.`);

  const unmatched = [];

  for (const ex of exercises) {
    try {
      // find exercise id by case-insensitive exact match on name
      const { data: rows, error: findError } = await supabase
        .from("exercises")
        .select("id,name")
        .ilike("name", ex.name)
        .limit(1);

      if (findError) {
        console.error("Error querying exercises for name:", ex.name, findError);
        unmatched.push({ name: ex.name, reason: "query_error" });
        continue;
      }

      if (!rows || rows.length === 0) {
        // try exact lower-case equality as fallback
        const { data: rows2, error: findError2 } = await supabase
          .from("exercises")
          .select("id,name")
          .eq("name", ex.name)
          .limit(1);

        if (findError2) {
          console.error("Error fallback querying exercises for name:", ex.name, findError2);
          unmatched.push({ name: ex.name, reason: "query_error" });
          continue;
        }

        if (!rows2 || rows2.length === 0) {
          unmatched.push({ name: ex.name, reason: "no_match" });
          continue;
        } else {
          // use rows2[0]
          const exerciseId = rows2[0].id;
          await insertTutorialsForExercise(supabase, exerciseId, ex);
        }
      } else {
        const exerciseId = rows[0].id;
        await insertTutorialsForExercise(supabase, exerciseId, ex);
      }
    } catch (err) {
      console.error("Unexpected error processing exercise:", ex.name, err);
      unmatched.push({ name: ex.name, reason: "unexpected_error", error: String(err) });
    }
  }

  // write unmatched to file for manual review
  if (unmatched.length > 0) {
    const out = unmatched.map((u) => `${u.name} -- ${u.reason}${u.error ? " -- " + u.error : ""}`).join("\n");
    fs.writeFileSync(UNMATCHED_OUT, out, "utf8");
    console.log(`Wrote ${unmatched.length} unmatched headings to ${UNMATCHED_OUT}`);
  } else {
    // ensure previous file is removed if exists
    try {
      if (fs.existsSync(UNMATCHED_OUT)) fs.unlinkSync(UNMATCHED_OUT);
    } catch {}
    console.log("All headings matched successfully.");
  }

  console.log("Seed complete.");
  process.exit(0);
}

async function insertTutorialsForExercise(supabase, exerciseId, ex) {
  if (!ex.tutorials || ex.tutorials.length === 0) {
    console.log(`No tutorials for "${ex.name}", skipping.`);
    return;
  }

  const inserts = ex.tutorials.map((t) => ({
    exercise_id: exerciseId,
    title: t.title,
    url: t.url,
    created_at: new Date().toISOString(),
  }));

  try {
    // Insert in a single batch; adjust chunking if dataset is large
    const { data, error } = await supabase.from("exercise_tutorial_videos").insert(inserts).select();

    if (error) {
      console.error(`Failed to insert tutorials for "${ex.name}" (exercise_id=${exerciseId}):`, error);
      return;
    }

    console.log(`Inserted ${data.length} tutorial(s) for "${ex.name}" (exercise_id=${exerciseId}).`);
  } catch (err) {
    console.error(`Unexpected insert error for "${ex.name}":`, err);
  }
}

main().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
