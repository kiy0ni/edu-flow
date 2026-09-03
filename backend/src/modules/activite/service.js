import { queryAll, queryOne, query } from "../../lib/db.js";
import { today, addDays, daysBetween, eachDay, startOfWeek } from "../../lib/dates.js";

/**
 * Journal d'activité de travail.
 *
 * Une journée compte comme active dès qu'un travail réel y a été effectué :
 * devoir terminé, cartes révisées, session de concentration ou bloc du plan
 * mené à son terme. Le journal alimente la série de jours consécutifs et le
 * bilan hebdomadaire.
 */

const COLONNES = {
  devoir: "devoirs_faits",
  carte: "cartes_revisees",
  focus: "minutes_focus",
  bloc: "blocs_termines",
};

/** Incrémente le compteur du jour pour un type d'activité. */
export const enregistrer = async (userId, type, quantite = 1, jour = today()) => {
  const colonne = COLONNES[type];
  if (!colonne || quantite <= 0) return;
  await query(
    `INSERT INTO journal_activite (user_id, jour, ${colonne}) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, jour) DO UPDATE SET ${colonne} = journal_activite.${colonne} + $3`,
    [userId, jour, quantite],
  );
};

const estActif = (ligne) =>
  ligne.devoirs_faits > 0 || ligne.cartes_revisees > 0 || ligne.minutes_focus > 0 || ligne.blocs_termines > 0;

/**
 * Série de jours actifs consécutifs.
 * La journée en cours ne casse pas la série tant qu'elle n'est pas terminée :
 * on repart donc de la veille si aujourd'hui est encore vide.
 */
export const serie = async (userId) => {
  const lignes = await queryAll(
    `SELECT jour::text AS jour, devoirs_faits, cartes_revisees, minutes_focus, blocs_termines
       FROM journal_activite
      WHERE user_id = $1 AND jour >= CURRENT_DATE - INTERVAL '400 days'
      ORDER BY jour DESC`,
    [userId],
  );

  const actifs = new Set(lignes.filter(estActif).map((l) => l.jour));
  const maintenant = today();
  let courante = 0;
  let curseur = actifs.has(maintenant) ? maintenant : addDays(maintenant, -1);

  while (actifs.has(curseur)) {
    courante += 1;
    curseur = addDays(curseur, -1);
  }

  // Meilleure série jamais tenue.
  let meilleure = 0;
  let enCours = 0;
  const tries = [...actifs].sort();
  for (let i = 0; i < tries.length; i += 1) {
    enCours = i > 0 && daysBetween(tries[i - 1], tries[i]) === 1 ? enCours + 1 : 1;
    meilleure = Math.max(meilleure, enCours);
  }

  return {
    courante,
    meilleure,
    actifAujourdhui: actifs.has(maintenant),
    joursActifs30: [...actifs].filter((j) => daysBetween(j, maintenant) <= 30).length,
  };
};

/** Détail des sept derniers jours, pour le graphique du bilan. */
export const semaine = async (userId, { fin = today() } = {}) => {
  const debut = addDays(fin, -6);
  const lignes = await queryAll(
    `SELECT jour::text AS jour, devoirs_faits, cartes_revisees, minutes_focus, blocs_termines
       FROM journal_activite
      WHERE user_id = $1 AND jour BETWEEN $2 AND $3`,
    [userId, debut, fin],
  );
  const parJour = new Map(lignes.map((l) => [l.jour, l]));

  return eachDay(debut, fin).map((jour) => {
    const l = parJour.get(jour) ?? { devoirs_faits: 0, cartes_revisees: 0, minutes_focus: 0, blocs_termines: 0 };
    return {
      date: jour,
      devoirs: l.devoirs_faits,
      cartes: l.cartes_revisees,
      minutes: l.minutes_focus,
      blocs: l.blocs_termines,
      actif: estActif(l),
    };
  });
};

/** Comparaison semaine en cours / semaine précédente. */
export const comparaisonHebdomadaire = async (userId) => {
  const lundi = startOfWeek(today());
  const ligne = await queryOne(
    `SELECT
       coalesce(sum(devoirs_faits)   FILTER (WHERE jour >= $2), 0)::int AS devoirs_semaine,
       coalesce(sum(cartes_revisees) FILTER (WHERE jour >= $2), 0)::int AS cartes_semaine,
       coalesce(sum(minutes_focus)   FILTER (WHERE jour >= $2), 0)::int AS minutes_semaine,
       coalesce(sum(devoirs_faits)   FILTER (WHERE jour >= $3 AND jour < $2), 0)::int AS devoirs_avant,
       coalesce(sum(cartes_revisees) FILTER (WHERE jour >= $3 AND jour < $2), 0)::int AS cartes_avant,
       coalesce(sum(minutes_focus)   FILTER (WHERE jour >= $3 AND jour < $2), 0)::int AS minutes_avant
     FROM journal_activite
     WHERE user_id = $1 AND jour >= $3`,
    [userId, lundi, addDays(lundi, -7)],
  );

  const ecart = (courant, precedent) => (precedent === 0 ? (courant > 0 ? 100 : 0) : Math.round(((courant - precedent) / precedent) * 100));

  return {
    devoirs: { semaine: ligne.devoirs_semaine, precedente: ligne.devoirs_avant, evolution: ecart(ligne.devoirs_semaine, ligne.devoirs_avant) },
    cartes: { semaine: ligne.cartes_semaine, precedente: ligne.cartes_avant, evolution: ecart(ligne.cartes_semaine, ligne.cartes_avant) },
    minutes: { semaine: ligne.minutes_semaine, precedente: ligne.minutes_avant, evolution: ecart(ligne.minutes_semaine, ligne.minutes_avant) },
  };
};
