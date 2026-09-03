import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, closePool } from "../lib/db.js";
import logger from "../lib/logger.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "migrations");

const ensureTable = () =>
  pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

/** Applique toutes les migrations SQL non encore jouees, dans l'ordre alphabetique. */
export const runMigrations = async () => {
  await ensureTable();
  const { rows } = await pool.query("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.name));

  const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    logger.info("Base à jour : aucune migration a appliquer.");
    return [];
  }

  for (const file of pending) {
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      logger.info(`Migration appliquee : ${file}`);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      logger.error({ err }, `Échec de la migration ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }
  return pending;
};

// Execution directe : `npm run migrate`
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
