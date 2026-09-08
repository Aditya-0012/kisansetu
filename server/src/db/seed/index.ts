/**
 * Loads the generated seed.sql into the database.
 *
 * seed.sql is produced by scripts/generate_seed.py — a single Python script
 * that generates entities, the 150-day demand/price time series, and every
 * downstream relationship (offers → orders → batches → payments → ratings)
 * from one consistent source, so the DB and the ML training CSVs in
 * ml/data/ never drift apart. Re-run the generator, then this script,
 * to refresh the demo dataset.
 *
 * Usage: npm run seed --workspace=server
 */
import fs from "fs";
import path from "path";
import { pool } from "../pool";

async function run() {
  const sqlPath = path.join(__dirname, "seed.sql");
  if (!fs.existsSync(sqlPath)) {
    console.error(
      `seed.sql not found at ${sqlPath}.\n` +
        `Generate it first: python3 scripts/generate_seed.py`
    );
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, "utf-8");
  console.log("Loading seed.sql ...");
  // seed.sql uses COPY ... FROM stdin for the bulk time-series tables, which
  // the `pg` driver's simple query protocol does not support directly, so we
  // shell out to psql for this one operation — same approach used to load it
  // during development. If psql isn't available, fall back to running the
  // file through the pool anyway (it will fail loudly on the COPY blocks and
  // tell you to install the postgres client).
  const { execSync } = await import("child_process");
  try {
    execSync(`psql -v ON_ERROR_STOP=1 -d "${process.env.DATABASE_URL}" -f "${sqlPath}"`, {
      stdio: "inherit",
    });
    console.log("Seed complete (via psql).");
  } catch (err) {
    console.warn("psql not available or failed — falling back to pg pool (COPY blocks will fail).");
    await pool.query(sql);
    console.log("Seed complete (via pg pool).");
  }
  await pool.end();
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
