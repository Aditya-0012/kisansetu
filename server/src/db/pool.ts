import { Pool } from "pg";
import { env } from "../config/env";

/**
 * Single shared connection pool for the whole process. Every repository
 * imports `pool` (or `query`) from here rather than opening its own
 * connections — this is the one place that knows about `pg`, so swapping
 * drivers later (e.g. a managed Postgres proxy) only touches this file.
 */
const isLocal =
  env.DATABASE_URL.includes("localhost") || env.DATABASE_URL.includes("127.0.0.1");

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err: Error) => {
  // A background/idle client failed — don't crash the whole process for it,
  // but do make it loud in logs since it usually means the DB connection
  // was dropped.
  console.error("Unexpected Postgres pool error:", err);
});

export async function query<T = any>(text: string, params?: any[]) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const durationMs = Date.now() - start;
  if (durationMs > 200) {
    console.warn(`[slow query] ${durationMs}ms: ${text.slice(0, 120)}`);
  }
  return result as { rows: T[]; rowCount: number };
}

export async function withTransaction<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
