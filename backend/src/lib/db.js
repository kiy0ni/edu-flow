import pg from "pg";
import env from "../config/env.js";
import logger from "./logger.js";

// Les colonnes NUMERIC reviennent en string par defaut : on les veut en nombre.
pg.types.setTypeParser(1700, (value) => (value === null ? null : Number.parseFloat(value)));
// BIGINT (count(*)) -> number
pg.types.setTypeParser(20, (value) => (value === null ? null : Number.parseInt(value, 10)));

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
  max: 12,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (err) => logger.error({ err }, "Erreur inattendue du pool PostgreSQL"));

export const query = (text, params) => pool.query(text, params);

/** Retourne la premiere ligne ou null. */
export const queryOne = async (text, params) => {
  const { rows } = await pool.query(text, params);
  return rows[0] ?? null;
};

/** Retourne toutes les lignes. */
export const queryAll = async (text, params) => {
  const { rows } = await pool.query(text, params);
  return rows;
};

/** Execute un callback dans une transaction, avec rollback automatique. */
export const transaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

export const closePool = () => pool.end();
