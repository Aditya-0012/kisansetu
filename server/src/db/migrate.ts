/**
 * Minimal migration runner.
 *
 * Applies every .sql file in db/migrations in filename order, tracking what
 * has already run in a `schema_migrations` table so this is safe to re-run
 * (idempotent — migrations themselves use IF NOT EXISTS / ON CONFLICT).
 *
 * Usage: npm run migrate --workspace=server
 */
import fs from "fs";
import path from "path";
import { pool } from "./pool";

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function alreadyApplied(filename: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM schema_migrations WHERE filename = $1`,
    [filename]
  );
  return rows.length > 0;
}

async function run() {
  const dir = path.join(__dirname, "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  await ensureMigrationsTable();

  for (const file of files) {
    if (await alreadyApplied(file)) {
      console.log(`skip  ${file} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), "utf-8");
    console.log(`apply ${file}`);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        `INSERT INTO schema_migrations (filename) VALUES ($1)`,
        [file]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  console.log("Migrations complete.");
  await pool.end();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
