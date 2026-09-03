import { queryOne, query } from "./db.js";
import logger from "./logger.js";

/**
 * Cache persistant par utilisateur, adosse a la table provider_cache.
 * Objectif : ne pas marteler l'API amont (École Directe est lente et fragile)
 * tout en gardant des donnees fraiches.
 */
export const cached = async (userId, key, ttlSeconds, producer) => {
  const hit = await queryOne(
    "SELECT payload, fetched_at FROM provider_cache WHERE user_id = $1 AND cache_key = $2 AND expires_at > now()",
    [userId, key],
  );
  if (hit) return hit.payload;

  let valeur;
  try {
    valeur = await producer();
  } catch (err) {
    // Repli sur une valeur perimee plutot que d'echouer : l'ENT reste consultable.
    const perime = await queryOne(
      "SELECT payload FROM provider_cache WHERE user_id = $1 AND cache_key = $2",
      [userId, key],
    );
    if (perime) {
      logger.warn({ err: err.message, key }, "Provider indisponible : repli sur le cache périmé");
      return perime.payload;
    }
    throw err;
  }

  await query(
    `INSERT INTO provider_cache (user_id, cache_key, payload, fetched_at, expires_at)
     VALUES ($1, $2, $3, now(), now() + ($4 || ' seconds')::interval)
     ON CONFLICT (user_id, cache_key) DO UPDATE
       SET payload = EXCLUDED.payload, fetched_at = now(), expires_at = EXCLUDED.expires_at`,
    [userId, key, JSON.stringify(valeur), String(ttlSeconds)],
  );

  return valeur;
};

export const invalidate = (userId, prefix) =>
  query("DELETE FROM provider_cache WHERE user_id = $1 AND cache_key LIKE $2", [userId, `${prefix}%`]);

export const purgeExpired = async () => {
  const { rowCount } = await query("DELETE FROM provider_cache WHERE expires_at < now() - interval '2 days'");
  return rowCount;
};
