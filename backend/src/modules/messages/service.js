import gateway from "../../providers/gateway.js";
import { queryAll, queryOne, query } from "../../lib/db.js";
import { notFound, badRequest } from "../../lib/errors.js";

/**
 * Messagerie.
 *
 * Le contenu reçu appartient à l'établissement ; l'état de lecture, la mise en
 * favori, l'archivage et la corbeille sont propres à EduFlow et fusionnés ici.
 * Les messages rédigés depuis l'application sont conservés dans `outbox`.
 */

const etats = async (userId) => {
  const lignes = await queryAll("SELECT * FROM message_state WHERE user_id = $1", [userId]);
  return new Map(lignes.map((l) => [l.message_id, l]));
};

const fusionner = (message, etat) => ({
  ...message,
  lu: etat ? Boolean(etat.read_at) : message.lu,
  luLe: etat?.read_at ?? null,
  favori: etat?.starred ?? false,
  archive: etat?.archived ?? false,
});

const versMessage = (envoye) => ({
  id: `env-${envoye.id}`,
  date: envoye.created_at.toISOString().slice(0, 10),
  envoyeLe: envoye.created_at,
  expediteur: "Moi",
  destinataire: (envoye.destinataires ?? []).map((d) => d.nom ?? d).join(", ") || "—",
  destinataires: envoye.destinataires ?? [],
  sujet: envoye.sujet,
  apercu: envoye.corps.replace(/\s+/g, " ").slice(0, 160),
  corps: envoye.corps,
  lu: true,
  favori: false,
  archive: false,
  dossier: "envoyes",
  repondA: envoye.repond_a,
  pieces: [],
  local: true,
});

/** Liste un dossier : réception, envoyés, archives ou corbeille. */
export const lister = async (user, { dossier = "reception", recherche = "" } = {}) => {
  const carte = await etats(user.id);

  if (dossier === "envoyes") {
    const envoyes = await queryAll(
      "SELECT * FROM outbox WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC",
      [user.id],
    );
    return filtrer(envoyes.map(versMessage), recherche);
  }

  const recus = (await gateway.messages(user, { dossier: "reception" }).catch(() => [])).map((m) =>
    fusionner(m, carte.get(m.id)),
  );

  const supprimes = new Set(
    [...carte.entries()].filter(([, e]) => e.deleted_at).map(([id]) => id),
  );

  if (dossier === "corbeille") {
    return filtrer(recus.filter((m) => supprimes.has(m.id)), recherche);
  }
  if (dossier === "archives") {
    return filtrer(recus.filter((m) => m.archive && !supprimes.has(m.id)), recherche);
  }
  return filtrer(recus.filter((m) => !m.archive && !supprimes.has(m.id)), recherche);
};

const filtrer = (messages, recherche) => {
  if (!recherche) return messages;
  const terme = recherche.toLowerCase();
  return messages.filter((m) =>
    [m.sujet, m.expediteur, m.destinataire, m.apercu].some((champ) =>
      String(champ ?? "").toLowerCase().includes(terme),
    ),
  );
};

/** Lit un message et le marque comme lu. */
export const lire = async (user, id) => {
  if (id.startsWith("env-")) {
    const envoye = await queryOne(
      "SELECT * FROM outbox WHERE id = $1 AND user_id = $2",
      [id.slice(4), user.id],
    );
    if (!envoye) throw notFound("Message introuvable.");
    return versMessage(envoye);
  }

  const message = await gateway.message(user, id);
  await query(
    `INSERT INTO message_state (user_id, message_id, read_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id, message_id) DO UPDATE
       SET read_at = COALESCE(message_state.read_at, now()), updated_at = now()`,
    [user.id, id],
  );

  const carte = await etats(user.id);
  return { ...fusionner(message, carte.get(id)), lu: true };
};

const majEtat = (userId, id, colonne, valeur) =>
  queryOne(
    `INSERT INTO message_state (user_id, message_id, ${colonne}) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, message_id) DO UPDATE SET ${colonne} = $3, updated_at = now()
     RETURNING ${colonne} AS valeur`,
    [userId, id, valeur],
  );

export const marquerLu = (user, id, lu) =>
  majEtat(user.id, id, "read_at", lu ? new Date() : null);

export const basculerFavori = async (user, id) => {
  const ligne = await queryOne(
    `INSERT INTO message_state (user_id, message_id, starred) VALUES ($1, $2, true)
     ON CONFLICT (user_id, message_id) DO UPDATE SET starred = NOT message_state.starred, updated_at = now()
     RETURNING starred`,
    [user.id, id],
  );
  return ligne.starred;
};

export const archiver = (user, id, archive) => majEtat(user.id, id, "archived", archive);

export const supprimer = async (user, id) => {
  if (id.startsWith("env-")) {
    await query("UPDATE outbox SET deleted_at = now() WHERE id = $1 AND user_id = $2", [id.slice(4), user.id]);
    return;
  }
  await majEtat(user.id, id, "deleted_at", new Date());
};

export const restaurer = (user, id) => majEtat(user.id, id, "deleted_at", null);

export const toutMarquerLu = async (user) => {
  const messages = await lister(user, { dossier: "reception" });
  const aMarquer = messages.filter((m) => !m.lu).map((m) => m.id);
  if (!aMarquer.length) return 0;

  await query(
    `INSERT INTO message_state (user_id, message_id, read_at)
     SELECT $1, id, now() FROM unnest($2::text[]) AS id
     ON CONFLICT (user_id, message_id) DO UPDATE SET read_at = COALESCE(message_state.read_at, now())`,
    [user.id, aMarquer],
  );
  return aMarquer.length;
};

/** Destinataires proposés à la rédaction. */
export const destinataires = async (user) => {
  const [matieres, profil] = await Promise.all([
    gateway.matieres(user).catch(() => []),
    gateway.profil(user).catch(() => ({})),
  ]);

  const enseignants = matieres
    .filter((m) => m.professeur)
    .map((m) => ({
      id: `prof:${m.code}`,
      nom: m.professeur,
      role: `Professeur de ${m.nom}`,
      groupe: "Enseignants",
    }));

  const services = [
    { id: "svc:vie-scolaire", nom: "Vie scolaire", role: "Absences, retards, justificatifs", groupe: "Services" },
    { id: "svc:direction", nom: "Direction", role: "Chef d'établissement", groupe: "Services" },
    { id: "svc:secretariat", nom: "Secrétariat", role: "Démarches administratives", groupe: "Services" },
    { id: "svc:orientation", nom: "Pôle orientation", role: "Parcoursup, projets d'études", groupe: "Services" },
    { id: "svc:cdi", nom: "CDI", role: "Documentation et ressources", groupe: "Services" },
    { id: "svc:infirmerie", nom: "Infirmerie", role: "Santé et bien-être", groupe: "Services" },
  ];

  if (profil.professeurPrincipal) {
    enseignants.unshift({
      id: "prof:principal",
      nom: profil.professeurPrincipal,
      role: "Professeur principal",
      groupe: "Enseignants",
    });
  }

  // Deux enseignants peuvent partager un nom : on déduplique sur le libellé.
  const vus = new Set();
  const uniques = enseignants.filter((e) => !vus.has(e.nom) && vus.add(e.nom));

  return [...uniques, ...services];
};

/** Enregistre un message rédigé depuis EduFlow. */
export const envoyer = async (user, { destinataires: cibles, sujet, corps, repondA = null }) => {
  if (!cibles?.length) throw badRequest("Choisissez au moins un destinataire.");

  const envoye = await queryOne(
    `INSERT INTO outbox (user_id, destinataires, sujet, corps, repond_a)
     VALUES ($1, $2::jsonb, $3, $4, $5)
     RETURNING *`,
    [user.id, JSON.stringify(cibles), sujet, corps, repondA],
  );

  // Répondre à un message le marque implicitement comme lu.
  if (repondA) await marquerLu(user, repondA, true).catch(() => {});

  return versMessage(envoye);
};

export const compteNonLus = async (user) => {
  const messages = await lister(user, { dossier: "reception" });
  return messages.filter((m) => !m.lu).length;
};
