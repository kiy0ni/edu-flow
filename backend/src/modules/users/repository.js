import { queryOne, queryAll, transaction } from "../../lib/db.js";
import { encrypt } from "../../lib/crypto.js";

const COLONNES_PUBLIQUES = `
  id, provider, provider_account_id, username, first_name, last_name, email, phone,
  avatar_url, rôle, class_label, school_name, provider_meta, provider_synced_at,
  last_login_at, created_at
`;

export const findById = (id) => queryOne("SELECT * FROM users WHERE id = $1", [id]);

export const findByProviderAccount = (provider, accountId) =>
  queryOne("SELECT * FROM users WHERE provider = $1 AND provider_account_id = $2", [provider, accountId]);

/** Cree ou met a jour l'utilisateur a partir du profil renvoye par le provider. */
export const upsertFromProfile = async ({ provider, compteId, profil, token, meta }) =>
  transaction(async (client) => {
    const { rows } = await client.query(
      `
      INSERT INTO users (provider, provider_account_id, username, first_name, last_name, email, phone,
                         avatar_url, role, class_label, school_name, provider_token_enc, provider_meta,
                         provider_synced_at, last_login_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now(), now())
      ON CONFLICT (provider, provider_account_id) DO UPDATE SET
        username           = COALESCE(EXCLUDED.username, users.username),
        first_name         = EXCLUDED.first_name,
        last_name          = EXCLUDED.last_name,
        email              = COALESCE(EXCLUDED.email, users.email),
        phone              = COALESCE(EXCLUDED.phone, users.phone),
        avatar_url         = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
        role               = EXCLUDED.role,
        class_label        = COALESCE(EXCLUDED.class_label, users.class_label),
        school_name        = COALESCE(EXCLUDED.school_name, users.school_name),
        provider_token_enc = COALESCE(EXCLUDED.provider_token_enc, users.provider_token_enc),
        provider_meta      = users.provider_meta || EXCLUDED.provider_meta,
        provider_synced_at = now(),
        last_login_at      = now(),
        updated_at         = now()
      RETURNING *
      `,
      [
        provider,
        String(compteId),
        profil.identifiant ?? null,
        profil.prenom ?? "",
        profil.nom ?? "",
        profil.email ?? null,
        profil.telephone ?? null,
        profil.avatarUrl ?? null,
        profil.role ?? "eleve",
        profil.classe ?? null,
        profil.etablissement ?? null,
        token ? encrypt(token) : null,
        JSON.stringify(meta ?? {}),
      ],
    );

    const user = rows[0];
    await client.query(
      "INSERT INTO user_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING",
      [user.id],
    );
    return user;
  });

export const updateProfile = (id, { prenom, nom, email, telephone }) =>
  queryOne(
    `UPDATE users SET
       first_name = COALESCE($2, first_name),
       last_name  = COALESCE($3, last_name),
       email      = COALESCE($4, email),
       phone      = COALESCE($5, phone),
       updated_at = now()
     WHERE id = $1
     RETURNING ${COLONNES_PUBLIQUES}`,
    [id, prenom ?? null, nom ?? null, email ?? null, telephone ?? null],
  );

export const updatePassword = (id, hash) =>
  queryOne("UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1 RETURNING id", [id, hash]);

export const getPreferences = (userId) =>
  queryOne("SELECT * FROM user_preferences WHERE user_id = $1", [userId]);

export const upsertPreferences = (userId, prefs) =>
  queryOne(
    // Les contraintes NOT NULL sont evaluees avant la resolution du conflit :
    // la ligne inseree doit donc deja porter les valeurs par defaut.
    `INSERT INTO user_preferences (user_id, theme, accent, locale, ai_opt_in, notifications, study, updated_at)
     VALUES ($1, COALESCE($2,'system'), COALESCE($3,'indigo'), COALESCE($4,'fr-FR'), COALESCE($5,true),
             COALESCE($6,'{}'::jsonb), COALESCE($7,'{}'::jsonb), now())
     -- On repart des parametres bruts, et non d'EXCLUDED : les valeurs par
     -- defaut de l'INSERT ecraseraient sinon les preferences existantes.
     ON CONFLICT (user_id) DO UPDATE SET
       theme         = COALESCE($2, user_preferences.theme),
       accent        = COALESCE($3, user_preferences.accent),
       locale        = COALESCE($4, user_preferences.locale),
       ai_opt_in     = COALESCE($5, user_preferences.ai_opt_in),
       notifications = user_preferences.notifications || COALESCE($6::jsonb, '{}'::jsonb),
       study         = user_preferences.study || COALESCE($7::jsonb, '{}'::jsonb),
       updated_at    = now()
     RETURNING *`,
    [
      userId,
      prefs.theme ?? null,
      prefs.accent ?? null,
      prefs.locale ?? null,
      prefs.aiOptIn ?? null,
      prefs.notifications ? JSON.stringify(prefs.notifications) : null,
      prefs.study ? JSON.stringify(prefs.study) : null,
    ],
  );

export const listSessions = (userId) =>
  queryAll(
    `SELECT id, user_agent, ip, created_at, last_used_at, expires_at
     FROM sessions WHERE user_id = $1 AND revoked_at IS NULL ORDER BY last_used_at DESC`,
    [userId],
  );

export { COLONNES_PUBLIQUES };
