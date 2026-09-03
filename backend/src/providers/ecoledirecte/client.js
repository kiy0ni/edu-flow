import axios from "axios";
import env from "../../config/env.js";
import logger from "../../lib/logger.js";
import { AppError, unauthorized, upstreamError, unavailable } from "../../lib/errors.js";

/**
 * Client bas niveau de l'API École Directe.
 *
 * Particularites de cette API qu'il faut absolument respecter :
 *  - le corps est du form-urlencoded contenant un unique champ `data` en JSON ;
 *  - le jeton d'authentification circule dans l'en-tete `X-Token` et il est
 *    **regenere a chaque appel** : il faut propager le nouveau jeton ;
 *  - les erreurs metier reviennent en HTTP 200 avec un `code` non nul.
 */

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const http = axios.create({
  baseURL: env.ECOLEDIRECTE_API_BASE_URL,
  timeout: 15_000,
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": USER_AGENT,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "fr-FR,fr;q=0.9",
    Origin: "https://www.ecoledirecte.com",
    Referer: "https://www.ecoledirecte.com/",
  },
});

/** Codes metier renvoyes par École Directe dans un corps HTTP 200. */
const CODES = {
  OK: 200,
  DOUBLE_AUTH_REQUISE: 250,
  IDENTIFIANTS_INVALIDES: 505,
  COMPTE_BLOQUE: 525,
  TOKEN_INVALIDE: 520,
  MAINTENANCE: 535,
};

const messageForCode = (code, message) => {
  switch (code) {
    case CODES.IDENTIFIANTS_INVALIDES:
      return "Identifiant ou mot de passe École Directe incorrect.";
    case CODES.COMPTE_BLOQUE:
      return "Compte École Directe temporairement bloqué. Réessayez plus tard.";
    case CODES.TOKEN_INVALIDE:
      return "Session École Directe expirée, veuillez vous reconnecter.";
    case CODES.MAINTENANCE:
      return "École Directe est en maintenance.";
    default:
      return message || `École Directe a renvoyé une erreur (code ${code}).`;
  }
};

/**
 * Execute un appel École Directe.
 * @returns {{data: any, token: string|null, code: number}}
 */
export const call = async (path, { data = {}, token = null, params = {} } = {}) => {
  const body = `data=${encodeURIComponent(JSON.stringify(data))}`;
  let response;

  try {
    response = await http.post(path, body, {
      params: { v: env.ECOLEDIRECTE_API_VERSION, ...params },
      headers: token ? { "X-Token": token } : {},
    });
  } catch (err) {
    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      throw unavailable("École Directe ne repond pas (delai dépassé).");
    }
    logger.warn({ err: err.message, path }, "Appel École Directe en échec reseau");
    throw upstreamError("Impossible de joindre École Directe.");
  }

  const payload = response.data ?? {};
  const code = Number(payload.code ?? 0);

  if (code === CODES.OK) {
    return { data: payload.data, token: payload.token ?? token, code };
  }

  if (code === CODES.DOUBLE_AUTH_REQUISE) {
    const err = new AppError(401, "double_auth_requise", "Double authentification École Directe requise.");
    err.payload = payload;
    throw err;
  }

  if ([CODES.IDENTIFIANTS_INVALIDES, CODES.COMPTE_BLOQUE, CODES.TOKEN_INVALIDE].includes(code)) {
    throw unauthorized(messageForCode(code, payload.message));
  }

  throw upstreamError(messageForCode(code, payload.message), { code });
};

export const decodeB64 = (value) => {
  try {
    return Buffer.from(String(value ?? ""), "base64").toString("utf8");
  } catch {
    return "";
  }
};

export const encodeB64 = (value) => Buffer.from(String(value ?? ""), "utf8").toString("base64");

export { CODES };
