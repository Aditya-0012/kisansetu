import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { pool } from "./db/pool";

async function main() {
  // Fail fast with a clear message if the DB is unreachable, rather than
  // booting an API that will 500 on every request.
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    logger.error("Could not connect to Postgres. Is DATABASE_URL correct and the DB running?", {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }

  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`KisanSetu API listening on port ${env.PORT}`, { env: env.NODE_ENV });
  });
}

main();
