import gateway from "../../providers/gateway.js";
import { queryAll, queryOne } from "../../lib/db.js";
import { today, addDays, daysBetween } from "../../lib/dates.js";
import * as activite from "../activite/service.js";

/**
 * Les devoirs proviennent de l'établissement ; l'etat "fait", l'estimation de
 * duree et les notes personnelles sont propres a EduFlow et fusionnes ici.
 */
export const lister = async (user, { from = addDays(today(), -7), to = addDays(today(), 30) } = {}) => {
  const [devoirs, etats] = await Promise.all([
    gateway.devoirs(user, { from, to }),
    queryAll("SELECT * FROM homework_state WHERE user_id = $1", [user.id]),
  ]);

  const parId = new Map(etats.map((e) => [e.homework_id, e]));

  return devoirs
    .map((devoir) => {
      const etat = parId.get(devoir.id);
      const restant = daysBetween(today(), devoir.dueDate);
      return {
        ...devoir,
        fait: etat?.done ?? devoir.faitDistant ?? false,
        faitLe: etat?.done_at ?? null,
        dureeEstimee: etat?.estimated_minutes ?? devoir.dureeEstimee ?? 30,
        difficulte: etat?.difficulty ?? devoir.difficulte ?? 3,
        notesPerso: etat?.notes ?? null,
        joursRestants: restant,
        enRetard: restant < 0 && !(etat?.done ?? false),
        urgence: urgence(devoir, restant, etat?.done ?? false),
      };
    })
    .sort((a, b) => (a.dueDate === b.dueDate ? b.urgence - a.urgence : a.dueDate < b.dueDate ? -1 : 1));
};

/**
 * Score d'urgence 0-100 : combine l'echeance, le type et la difficulte.
 * Utilise pour trier l'affichage et alimenter le planificateur.
 */
const urgence = (devoir, joursRestants, fait) => {
  if (fait) return 0;
  const proximite = joursRestants < 0 ? 100 : Math.max(0, 100 - joursRestants * 12);
  const poidsType = devoir.type === "controle" ? 25 : devoir.type === "devoir" ? 12 : 6;
  const poidsDifficulte = (devoir.difficulte ?? 3) * 4;
  return Math.min(100, Math.round(proximite * 0.65 + poidsType + poidsDifficulte));
};

export const majEtat = async (user, homeworkId, patch) => {
  // Terminer un devoir alimente le journal d'activité (série de jours actifs).
  if (patch.fait === true) activite.enregistrer(user.id, "devoir").catch(() => {});
  const existant = await queryOne(
    "SELECT * FROM homework_state WHERE user_id = $1 AND homework_id = $2",
    [user.id, homeworkId],
  );

  const fait = patch.fait ?? existant?.done ?? false;

  return queryOne(
    `INSERT INTO homework_state (user_id, homework_id, done, done_at, estimated_minutes, difficulty, notes, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now())
     ON CONFLICT (user_id, homework_id) DO UPDATE SET
       done              = EXCLUDED.done,
       done_at           = EXCLUDED.done_at,
       estimated_minutes = COALESCE(EXCLUDED.estimated_minutes, homework_state.estimated_minutes),
       difficulty        = COALESCE(EXCLUDED.difficulty, homework_state.difficulty),
       notes             = COALESCE(EXCLUDED.notes, homework_state.notes),
       updated_at        = now()
     RETURNING *`,
    [
      user.id,
      homeworkId,
      fait,
      fait ? (existant?.done ? existant.done_at : new Date()) : null,
      patch.dureeEstimee ?? null,
      patch.difficulte ?? null,
      patch.notes ?? null,
    ],
  );
};

/** Charge de travail jour par jour, pour reperer les pics avant qu'ils n'arrivent. */
export const chargeDeTravail = async (user, { jours = 14 } = {}) => {
  const devoirs = await lister(user, { from: today(), to: addDays(today(), jours) });
  const parJour = new Map();

  for (const devoir of devoirs) {
    if (devoir.fait) continue;
    const entree = parJour.get(devoir.dueDate) ?? { date: devoir.dueDate, minutes: 0, devoirs: [], controles: 0 };
    entree.minutes += devoir.dureeEstimee;
    entree.devoirs.push({ id: devoir.id, matiere: devoir.matiere, couleur: devoir.couleur, type: devoir.type });
    if (devoir.type === "controle") entree.controles += 1;
    parJour.set(devoir.dueDate, entree);
  }

  const liste = [...parJour.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  const total = liste.reduce((a, j) => a + j.minutes, 0);

  return {
    jours: liste.map((j) => ({
      ...j,
      niveau: j.minutes > 150 || j.controles >= 2 ? "eleve" : j.minutes > 75 ? "moyen" : "faible",
    })),
    totalMinutes: total,
    moyenneParJour: liste.length ? Math.round(total / liste.length) : 0,
    picMax: liste.reduce((max, j) => (j.minutes > (max?.minutes ?? 0) ? j : max), null),
  };
};
