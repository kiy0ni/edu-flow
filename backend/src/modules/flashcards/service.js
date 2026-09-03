import { queryAll, queryOne, query, transaction } from "../../lib/db.js";
import { planifier, etatCarte } from "./sm2.js";
import { notFound } from "../../lib/errors.js";
import { subjectColor } from "../../providers/subjects.js";
import * as activite from "../activite/service.js";

const assurerPaquet = async (userId, deckId) => {
  const paquet = await queryOne("SELECT * FROM decks WHERE id = $1 AND user_id = $2", [deckId, userId]);
  if (!paquet) throw notFound("Paquet introuvable.");
  return paquet;
};

export const listerPaquets = async (userId) => {
  const paquets = await queryAll(
    `SELECT d.id, d.title AS titre, d.subject AS matiere, d.description, d.source, d.created_at,
            count(c.id)::int AS cartes,
            count(c.id) FILTER (WHERE c.due_on <= CURRENT_DATE)::int AS dues,
            count(c.id) FILTER (WHERE c.repetitions = 0)::int AS nouvelles,
            count(c.id) FILTER (WHERE c.interval_days >= 21)::int AS acquises
     FROM decks d LEFT JOIN cards c ON c.deck_id = d.id
     WHERE d.user_id = $1
     GROUP BY d.id
     ORDER BY dues DESC, d.updated_at DESC`,
    [userId],
  );

  return paquets.map((p) => ({
    ...p,
    couleur: subjectColor(p.matiere),
    progression: p.cartes ? Math.round((p.acquises / p.cartes) * 100) : 0,
  }));
};

export const creerPaquet = (userId, { titre, matiere, description, source = "manuel" }) =>
  queryOne(
    `INSERT INTO decks (user_id, title, subject, description, source)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, title AS titre, subject AS matiere, description, source, created_at`,
    [userId, titre, matiere ?? null, description ?? null, source],
  );

export const supprimerPaquet = (userId, deckId) =>
  query("DELETE FROM decks WHERE id = $1 AND user_id = $2", [deckId, userId]);

export const listerCartes = async (userId, deckId) => {
  await assurerPaquet(userId, deckId);
  const cartes = await queryAll(
    `SELECT id, front AS recto, back AS verso, hint AS indice, ease, interval_days, repetitions,
            lapses, due_on::text AS "dueLe", last_reviewed AS "revuLe"
     FROM cards WHERE deck_id = $1 ORDER BY due_on, created_at`,
    [deckId],
  );
  return cartes.map((c) => ({ ...c, etat: etatCarte(c) }));
};

/** Ajoute des cartes en lot (utilise aussi par la generation IA). */
export const ajouterCartes = async (userId, deckId, cartes) => {
  await assurerPaquet(userId, deckId);
  return transaction(async (client) => {
    const creees = [];
    for (const carte of cartes) {
      const { rows } = await client.query(
        `INSERT INTO cards (deck_id, front, back, hint)
         VALUES ($1,$2,$3,$4)
         RETURNING id, front AS recto, back AS verso, hint AS indice, due_on::text AS "dueLe"`,
        [deckId, carte.recto, carte.verso, carte.indice ?? null],
      );
      creees.push(rows[0]);
    }
    await client.query("UPDATE decks SET updated_at = now() WHERE id = $1", [deckId]);
    return creees;
  });
};

/** File de revision du jour : cartes dues, puis nouvelles, dans la limite demandee. */
export const fileDuJour = async (userId, { deckId = null, limite = 20 } = {}) => {
  const cartes = await queryAll(
    `SELECT c.id, c.front AS recto, c.back AS verso, c.hint AS indice, c.repetitions,
            c.interval_days, c.due_on::text AS "dueLe", d.id AS "deckId", d.title AS paquet, d.subject AS matiere
     FROM cards c JOIN decks d ON d.id = c.deck_id
     WHERE d.user_id = $1 AND ($2::uuid IS NULL OR d.id = $2::uuid) AND c.due_on <= CURRENT_DATE
     ORDER BY (c.repetitions = 0), c.due_on, random()
     LIMIT $3`,
    [userId, deckId, limite],
  );

  return cartes.map((c) => ({ ...c, couleur: subjectColor(c.matiere), etat: etatCarte(c) }));
};

/** Enregistre une revision et reprogramme la carte. */
export const noterCarte = async (userId, cardId, quality) => {
  // Chaque carte notée alimente le journal d'activité.
  activite.enregistrer(userId, "carte").catch(() => {});
  const carte = await queryOne(
    `SELECT c.* FROM cards c JOIN decks d ON d.id = c.deck_id WHERE c.id = $1 AND d.user_id = $2`,
    [cardId, userId],
  );
  if (!carte) throw notFound("Carte introuvable.");

  const suivant = planifier(carte, quality);

  return transaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE cards SET ease = $2, interval_days = $3, repetitions = $4, lapses = $5,
              due_on = CURRENT_DATE + ($3)::int, last_reviewed = now()
       WHERE id = $1
       RETURNING id, due_on::text AS "dueLe", interval_days AS intervalle, repetitions, ease`,
      [cardId, suivant.ease, suivant.intervalle, suivant.repetitions, suivant.lapses],
    );

    await client.query(
      `INSERT INTO card_reviews (card_id, user_id, quality, interval_before, interval_after)
       VALUES ($1,$2,$3,$4,$5)`,
      [cardId, userId, quality, carte.interval_days, suivant.intervalle],
    );

    return { carte: rows[0], maitrisee: suivant.maitrisee };
  });
};

/** Statistiques de revision des 30 derniers jours. */
export const statistiques = async (userId) => {
  const [global] = await queryAll(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE quality >= 3)::int AS reussies,
            count(DISTINCT date_trunc('day', reviewed_at))::int AS "joursActifs"
     FROM card_reviews WHERE user_id = $1 AND reviewed_at > now() - interval '30 days'`,
    [userId],
  );

  const parJour = await queryAll(
    `SELECT reviewed_at::date::text AS date, count(*)::int AS revisions,
            count(*) FILTER (WHERE quality >= 3)::int AS reussies
     FROM card_reviews WHERE user_id = $1 AND reviewed_at > now() - interval '30 days'
     GROUP BY 1 ORDER BY 1`,
    [userId],
  );

  return {
    total: global?.total ?? 0,
    tauxReussite: global?.total ? Math.round((global.reussies / global.total) * 100) : null,
    joursActifs: global?.joursActifs ?? 0,
    parJour,
  };
};
