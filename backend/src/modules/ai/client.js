import Anthropic from "@anthropic-ai/sdk";
import env from "../../config/env.js";
import { unavailable, tooManyRequests } from "../../lib/errors.js";
import { queryOne } from "../../lib/db.js";

/**
 * Acces au modele Claude.
 * L'IA est entierement optionnelle : sans cle API, les routes concernees
 * repondent proprement au lieu de planter, et le reste de l'ENT fonctionne.
 */

let client = null;

export const aiDisponible = () => env.aiEnabled;

export const getClient = () => {
  if (!env.aiEnabled) {
    throw unavailable(
      "L'assistant IA n'est pas configuré sur cette instance (variable ANTHROPIC_API_KEY absente).",
    );
  }
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
};

export const MODELE = env.AI_MODEL;
export const EFFORT = env.AI_EFFORT;

/** Verifie et incremente le quota journalier de l'utilisateur. */
export const consommerQuota = async (userId) => {
  const ligne = await queryOne(
    `INSERT INTO ai_usage (user_id, day, messages) VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (user_id, day) DO UPDATE SET messages = ai_usage.messages + 1
     RETURNING messages`,
    [userId],
  );
  if (ligne.messages > env.AI_DAILY_MESSAGE_LIMIT) {
    throw tooManyRequests(
      `Quota quotidien d'assistant atteint (${env.AI_DAILY_MESSAGE_LIMIT} requêtes). Il se reinitialise demain.`,
    );
  }
  return ligne.messages;
};

export const enregistrerUsage = (userId, usage) =>
  queryOne(
    `INSERT INTO ai_usage (user_id, day, input_tokens, output_tokens)
     VALUES ($1, CURRENT_DATE, $2, $3)
     ON CONFLICT (user_id, day) DO UPDATE SET
       input_tokens  = ai_usage.input_tokens + EXCLUDED.input_tokens,
       output_tokens = ai_usage.output_tokens + EXCLUDED.output_tokens
     RETURNING messages`,
    [userId, usage?.input_tokens ?? 0, usage?.output_tokens ?? 0],
  );

export const quotaRestant = async (userId) => {
  const ligne = await queryOne(
    "SELECT messages FROM ai_usage WHERE user_id = $1 AND day = CURRENT_DATE",
    [userId],
  );
  return Math.max(0, env.AI_DAILY_MESSAGE_LIMIT - (ligne?.messages ?? 0));
};
