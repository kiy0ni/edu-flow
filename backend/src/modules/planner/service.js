import crypto from "node:crypto";
import { queryAll, queryOne, query, transaction } from "../../lib/db.js";
import * as timetable from "../timetable/service.js";
import * as homework from "../homework/service.js";
import * as grades from "../grades/compute.js";
import gateway from "../../providers/gateway.js";
import { getPreferences } from "../users/repository.js";
import { today, addDays, daysBetween, timeToMinutes, minutesToTime, frDay, dateFr } from "../../lib/dates.js";
import * as activite from "../activite/service.js";

/**
 * Planificateur de revisions autonome.
 *
 * Il ne se contente pas de lister le travail a faire : il le *place* dans les
 * creneaux reellement libres de l'eleve, en arbitrant entre quatre sources de
 * priorite, puis applique une repetition espacee avant les evaluations.
 *
 * L'algorithme est entierement déterministe - aucune IA n'est requise.
 */

/** Nombre au format francais (virgule decimale). */
const nombreFr = (n) => (n === null || n === undefined ? "—" : String(n).replace(".", ","));

const PARAMS_DEFAUT = { debut: "17:00", fin: "20:30", dureeBloc: 45, pause: 10, joursOff: ["dimanche"] };

/** Etape 1 : construire la liste des taches candidates, avec un poids de priorite. */
const collecterTaches = async (user, horizon) => {
  const fin = addDays(today(), horizon);

  const [devoirs, cours, notesData, cartesDues] = await Promise.all([
    homework.lister(user, { from: today(), to: fin }),
    gateway.emploiDuTemps(user, { from: today(), to: fin }),
    gateway.notes(user, { periode: "annee" }),
    queryAll(
      `SELECT d.id, d.title, d.subject, count(c.id)::int AS dues
       FROM decks d JOIN cards c ON c.deck_id = d.id
       WHERE d.user_id = $1 AND c.due_on <= CURRENT_DATE
       GROUP BY d.id, d.title, d.subject`,
      [user.id],
    ),
  ]);

  const taches = [];

  // (a) Devoirs a rendre : priorite directement issue du score d'urgence.
  for (const devoir of devoirs.filter((d) => !d.fait)) {
    taches.push({
      kind: devoir.type === "controle" ? "controle" : "devoir",
      titre: devoir.intitule,
      detail: devoir.contenu,
      subject: devoir.matiere,
      homeworkId: devoir.id,
      minutes: devoir.dureeEstimee,
      echeance: devoir.dueDate,
      poids: devoir.urgence,
    });
  }

  // (b) Evaluations annoncees dans l'emploi du temps : revisions espacees J-7 / J-3 / J-1.
  const evaluations = cours.filter((c) => c.type === "evaluation" && !c.annule);
  for (const eval_ of evaluations) {
    const restant = daysBetween(today(), eval_.date);
    if (restant < 0) continue;
    for (const jalon of [7, 3, 1].filter((j) => j <= restant)) {
      taches.push({
        kind: "controle",
        titre: `Révision ${eval_.matiere} (J-${jalon})`,
        detail: `Préparation de l'évaluation du ${dateFr(eval_.date)}.`,
        subject: eval_.matiere,
        homeworkId: null,
        minutes: jalon === 1 ? 30 : 45,
        echeance: addDays(eval_.date, -jalon),
        poids: 85 - jalon * 4,
      });
    }
  }

  // (c) Cartes de revision arrivees a echeance (repetition espacee).
  for (const paquet of cartesDues) {
    taches.push({
      kind: "revision",
      titre: `Flashcards : ${paquet.title}`,
      detail: `${paquet.dues} carte(s) a revoir.`,
      subject: paquet.subject,
      homeworkId: null,
      minutes: Math.min(45, 5 + paquet.dues * 1.5),
      echeance: today(),
      poids: 70,
    });
  }

  // (d) Matieres fragiles : renforcement si de la place reste disponible.
  const agregats = grades.parMatiere(notesData.notes ?? [], notesData.matieres ?? []);
  const moyenne = grades.moyenneGenerale(agregats);
  const fragiles = agregats.filter(
    (m) => m.moyenne !== null && moyenne !== null && (m.moyenne < moyenne - 1.5 || m.tendance.direction === "baisse"),
  );
  for (const matiere of fragiles.slice(0, 3)) {
    taches.push({
      kind: "revision",
      titre: `Renforcement ${matiere.matiere}`,
      detail:
        matiere.tendance.direction === "baisse"
          ? `Moyenne en baisse de ${nombreFr(Math.abs(matiere.tendance.delta))} pt : reprendre les derniers chapitres.`
          : `Matière sous la moyenne générale (${nombreFr(matiere.moyenne)}/20).`,
      subject: matiere.matiere,
      homeworkId: null,
      minutes: 45,
      echeance: addDays(today(), 7),
      poids: 45,
    });
  }

  // Le plus urgent d'abord ; a poids egal, l'echeance la plus proche.
  return taches.sort((a, b) => (b.poids - a.poids) || (a.échéance < b.echeance ? -1 : 1));
};

/** Etape 2 : decouper les creneaux libres en blocs de travail exploitables. */
const decouperCreneaux = (creneaux, { dureeBloc, pause }) => {
  const blocs = [];
  for (const creneau of creneaux) {
    let curseur = timeToMinutes(creneau.debut);
    const limite = timeToMinutes(creneau.fin);
    while (limite - curseur >= 20) {
      const duree = Math.min(dureeBloc, limite - curseur);
      blocs.push({
        date: creneau.date,
        debut: minutesToTime(curseur),
        fin: minutesToTime(curseur + duree),
        minutes: duree,
      });
      curseur += duree + pause;
    }
  }
  return blocs.sort((a, b) => (a.date === b.date ? (a.debut < b.debut ? -1 : 1) : a.date < b.date ? -1 : 1));
};

/** Etape 3 : affecter les taches aux blocs en respectant les echeances. */
const affecter = (taches, blocs) => {
  const restants = [...blocs];
  const plan = [];

  for (const tache of taches) {
    let aPlacer = Math.max(20, Math.round(tache.minutes));

    while (aPlacer >= 20) {
      // Un bloc n'est eligible que s'il tombe avant l'echeance de la tache.
      const index = restants.findIndex((b) => daysBetween(b.date, tache.echeance) >= 0);
      if (index === -1) break;

      const bloc = restants.splice(index, 1)[0];
      plan.push({
        ...bloc,
        kind: tache.kind,
        subject: tache.subject,
        titre: tache.titre,
        detail: tache.detail,
        homeworkId: tache.homeworkId,
        priorite: Math.max(1, Math.min(5, Math.round(6 - tache.poids / 22))),
      });
      aPlacer -= bloc.minutes;
    }
  }

  return { plan, blocsInutilises: restants, tachesNonPlacees: taches.length - new Set(plan.map((p) => p.titre)).size };
};

/** Genere et enregistre un plan de revisions pour les `horizon` prochains jours. */
export const genererPlan = async (user, { horizon = 7 } = {}) => {
  const prefs = (await getPreferences(user.id))?.study ?? {};
  const params = { ...PARAMS_DEFAUT, ...prefs };

  const creneaux = await timetable.creneauxLibres(user, {
    from: today(),
    to: addDays(today(), horizon),
    debutJournee: params.debut,
    finJournee: params.fin,
    joursOff: params.joursOff ?? [],
  });

  const taches = await collecterTaches(user, horizon);
  const blocs = decouperCreneaux(creneaux, params);
  const { plan, blocsInutilises } = affecter(taches, blocs);

  const generationId = crypto.randomUUID();

  await transaction(async (client) => {
    // On ne remplace que les blocs auto-generes a venir : les ajouts manuels
    // et l'historique sont preserves.
    await client.query(
      `DELETE FROM planner_blocks
       WHERE user_id = $1 AND auto_generated = true AND day >= CURRENT_DATE AND status = 'planifie'`,
      [user.id],
    );

    for (const bloc of plan) {
      await client.query(
        `INSERT INTO planner_blocks
           (user_id, day, start_time, end_time, kind, subject, title, detail, homework_id, priority, auto_generated, generation_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11)`,
        [
          user.id,
          bloc.date,
          bloc.debut,
          bloc.fin,
          bloc.kind,
          bloc.subject,
          bloc.titre,
          bloc.detail,
          bloc.homeworkId,
          bloc.priorite,
          generationId,
        ],
      );
    }
  });

  return {
    generationId,
    horizon,
    parametres: params,
    statistiques: {
      blocsPlanifies: plan.length,
      minutesPlanifiees: plan.reduce((a, b) => a + b.minutes, 0),
      creneauxDisponibles: blocs.length,
      creneauxLibresRestants: blocsInutilises.length,
      tachesIdentifiees: taches.length,
      couverture: blocs.length ? Math.round((plan.length / blocs.length) * 100) : 0,
    },
  };
};

/** Plan enregistre, regroupe par jour. */
export const lirePlan = async (user, { from = today(), to = addDays(today(), 7) } = {}) => {
  const blocs = await queryAll(
    `SELECT id, day::text AS date, to_char(start_time,'HH24:MI') AS debut, to_char(end_time,'HH24:MI') AS fin,
            kind, subject, title AS titre, detail, homework_id AS "homeworkId",
            priority AS priorite, status, auto_generated AS "auto"
     FROM planner_blocks
     WHERE user_id = $1 AND day BETWEEN $2 AND $3
     ORDER BY day, start_time`,
    [user.id, from, to],
  );

  const parJour = new Map();
  for (const bloc of blocs) {
    if (!parJour.has(bloc.date)) parJour.set(bloc.date, []);
    parJour.get(bloc.date).push(bloc);
  }

  const jours = [...parJour.entries()].map(([date, liste]) => ({
    date,
    jour: frDay(date),
    blocs: liste,
    minutes: liste.reduce((a, b) => a + (timeToMinutes(b.fin) - timeToMinutes(b.debut)), 0),
  }));

  return {
    from,
    to,
    jours,
    total: {
      blocs: blocs.length,
      faits: blocs.filter((b) => b.status === "fait").length,
      minutes: jours.reduce((a, j) => a + j.minutes, 0),
    },
  };
};

export const majBloc = (user, id, patch) => {
  if (patch.status === "fait") activite.enregistrer(user.id, "bloc").catch(() => {});
  return majBlocEnBase(user, id, patch);
};

const majBlocEnBase = (user, id, patch) =>
  queryOne(
    `UPDATE planner_blocks SET
       status     = COALESCE($3, status),
       day        = COALESCE($4::date, day),
       start_time = COALESCE($5::time, start_time),
       end_time   = COALESCE($6::time, end_time),
       title      = COALESCE($7, title)
     WHERE id = $1 AND user_id = $2
     RETURNING id, day::text AS date, to_char(start_time,'HH24:MI') AS debut,
               to_char(end_time,'HH24:MI') AS fin, status, title AS titre`,
    [id, user.id, patch.status ?? null, patch.date ?? null, patch.debut ?? null, patch.fin ?? null, patch.titre ?? null],
  );

export const creerBloc = (user, bloc) =>
  queryOne(
    `INSERT INTO planner_blocks (user_id, day, start_time, end_time, kind, subject, title, detail, priority, auto_generated)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false)
     RETURNING id, day::text AS date, to_char(start_time,'HH24:MI') AS debut, to_char(end_time,'HH24:MI') AS fin, title AS titre`,
    [user.id, bloc.date, bloc.debut, bloc.fin, bloc.kind, bloc.subject ?? null, bloc.titre, bloc.detail ?? null, bloc.priorite ?? 3],
  );

export const supprimerBloc = (user, id) =>
  query("DELETE FROM planner_blocks WHERE id = $1 AND user_id = $2", [id, user.id]);
