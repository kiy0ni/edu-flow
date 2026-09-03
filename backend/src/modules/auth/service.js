import { getProvider } from "../../providers/index.js";
import * as users from "../users/repository.js";
import { query, queryOne } from "../../lib/db.js";
import { encrypt, decrypt, sha256, randomToken } from "../../lib/crypto.js";
import { signAccessToken, signChallengeToken, verifyToken, ttlToMs } from "../../lib/tokens.js";
import { AppError, unauthorized } from "../../lib/errors.js";
import env from "../../config/env.js";
import logger from "../../lib/logger.js";

const publicUser = (user) => ({
  id: user.id,
  source: user.provider,
  prenom: user.first_name,
  nom: user.last_name,
  email: user.email,
  telephone: user.phone,
  role: user.role,
  classe: user.class_label,
  etablissement: user.school_name,
  avatarUrl: user.avatar_url,
  derniereConnexion: user.last_login_at,
});

const createSession = async (userId, { ip, userAgent }) => {
  const refreshToken = randomToken();
  const expiresAt = new Date(Date.now() + ttlToMs(env.JWT_REFRESH_TTL));
  await query(
    `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, sha256(refreshToken), userAgent?.slice(0, 250) ?? null, ip ?? null, expiresAt],
  );
  return { refreshToken, expiresAt };
};

const issue = async (user, contexte) => {
  const { refreshToken, expiresAt } = await createSession(user.id, contexte);
  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role, source: user.provider }),
    refreshToken,
    expireLe: expiresAt.toISOString(),
    utilisateur: publicUser(user),
  };
};

/**
 * Connexion.
 * Sur École Directe, une double authentification par QCM peut etre exigee :
 * on renvoie alors la question a l'utilisateur avec un jeton de defi court.
 */
export const login = async ({ source, identifiant, motdepasse }, contexte) => {
  const provider = getProvider(source);

  // Reutilise le couple {cn, cv} deja valide pour ce compte, s'il existe.
  const existant = await queryOne(
    "SELECT provider_meta FROM users WHERE provider = $1 AND lower(username) = lower($2)",
    [source, identifiant],
  );
  const doubleAuthMemorisee = existant?.provider_meta?.doubleAuth ?? null;

  let resultat;
  try {
    resultat = await provider.authenticate({ identifiant, motdepasse, doubleAuth: doubleAuthMemorisee });
  } catch (err) {
    if (err?.code === "double_auth_requise" && provider.getQcm) {
      return demarrerDoubleAuth(provider, err, { source, identifiant, motdepasse });
    }
    throw err;
  }

  const user = await users.upsertFromProfile({
    provider: source,
    compteId: resultat.compteId,
    profil: { ...resultat.profil, identifiant },
    token: resultat.token,
    meta: resultat.meta,
  });

  return issue(user, contexte);
};

const demarrerDoubleAuth = async (provider, err, credentials) => {
  const tokenTemporaire = err.payload?.token;
  if (!tokenTemporaire) throw unauthorized("Double authentification requise mais inexploitable.");

  const qcm = await provider.getQcm(tokenTemporaire);
  const challenge = signChallengeToken({
    source: credentials.source,
    identifiant: credentials.identifiant,
    secret: encrypt(credentials.motdepasse),
    edToken: qcm.token ?? tokenTemporaire,
  });

  const erreur = new AppError(
    401,
    "double_auth_requise",
    "École Directe demande une vérification supplémentaire.",
  );
  erreur.payload = { challenge, question: qcm.question, propositions: qcm.propositions };
  throw erreur;
};

/** Repond au QCM de double authentification puis termine la connexion. */
export const resoudreDoubleAuth = async ({ challenge, reponse }, contexte) => {
  const payload = verifyToken(challenge, "challenge");
  const provider = getProvider(payload.source);
  if (!provider.postQcm) throw unauthorized("Cette source ne gère pas la double authentification.");

  const doubleAuth = await provider.postQcm(payload.edToken, reponse);
  const motdepasse = decrypt(payload.secret);
  if (!motdepasse) throw unauthorized("Défi expiré, recommencez la connexion.");

  const resultat = await provider.authenticate({
    identifiant: payload.identifiant,
    motdepasse,
    doubleAuth,
  });

  const user = await users.upsertFromProfile({
    provider: payload.source,
    compteId: resultat.compteId,
    profil: { ...resultat.profil, identifiant: payload.identifiant },
    token: resultat.token,
    meta: { ...resultat.meta, doubleAuth },
  });

  return issue(user, contexte);
};

/** Rotation du refresh token : l'ancien est revoque a chaque usage. */
export const refresh = async (refreshToken, contexte) => {
  if (!refreshToken) throw unauthorized("Jeton de rafraîchissement manquant.");

  const session = await queryOne(
    `SELECT s.*, u.id AS uid FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.refresh_token_hash = $1`,
    [sha256(refreshToken)],
  );

  if (!session || session.revoked_at || new Date(session.expires_at) < new Date()) {
    throw unauthorized("Session expirée, reconnectez-vous.");
  }

  await query("UPDATE sessions SET revoked_at = now() WHERE id = $1", [session.id]);
  const user = await users.findById(session.user_id);
  if (!user) throw unauthorized("Compte introuvable.");

  return issue(user, contexte);
};

export const logout = async (refreshToken) => {
  if (!refreshToken) return;
  await query("UPDATE sessions SET revoked_at = now() WHERE refresh_token_hash = $1 AND revoked_at IS NULL", [
    sha256(refreshToken),
  ]);
};

export const logoutAll = (userId) =>
  query("UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);

/** Purge les sessions expirees (appelee periodiquement). */
export const purgeSessions = async () => {
  const { rowCount } = await query(
    "DELETE FROM sessions WHERE expires_at < now() - interval '7 days' OR revoked_at < now() - interval '7 days'",
  );
  if (rowCount) logger.debug(`${rowCount} session(s) expirée(s) purgee(s).`);
  return rowCount;
};

export { publicUser };
