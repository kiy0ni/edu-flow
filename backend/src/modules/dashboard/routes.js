import { Router } from "express";
import gateway from "../../providers/gateway.js";
import * as timetable from "../timetable/service.js";
import * as homework from "../homework/service.js";
import * as planner from "../planner/service.js";
import * as compute from "../grades/compute.js";
import { queryAll } from "../../lib/db.js";
import { lister as listerNotifications } from "../notifications/service.js";
import { asyncHandler } from "../../lib/errors.js";
import { today, addDays, timeToMinutes, frDay } from "../../lib/dates.js";
import * as activite from "../activite/service.js";

const router = Router();

/**
 * Ecran d'accueil : une seule requete assemble tout ce qui doit etre visible
 * d'un coup d'oeil. Chaque source echoue independamment pour qu'un provider
 * indisponible ne vide pas toute la page.
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user;
    const demain = addDays(today(), 1);

    const [cours, prochain, devoirs, notesData, plan, cartesDues, notifications, serie] = await Promise.all([
      gateway.emploiDuTemps(user, { from: today(), to: demain }).catch(() => []),
      timetable.prochainCours(user).catch(() => null),
      homework.lister(user, { from: today(), to: addDays(today(), 14) }).catch(() => []),
      gateway.notes(user, { periode: "annee" }).catch(() => ({ notes: [], matieres: [], periodes: [] })),
      planner.lirePlan(user, { from: today(), to: today() }).catch(() => ({ jours: [] })),
      queryAll(
        `SELECT count(c.id)::int AS total FROM cards c JOIN decks d ON d.id = c.deck_id
         WHERE d.user_id = $1 AND c.due_on <= CURRENT_DATE`,
        [user.id],
      ).catch(() => [{ total: 0 }]),
      listerNotifications(user, { seulementNonLues: true, limite: 5 }).catch(() => ({ notifications: [], nonLues: 0 })),
      activite.serie(user.id).catch(() => ({ courante: 0, meilleure: 0, actifAujourdhui: false, joursActifs30: 0 })),
    ]);

    const coursDuJour = cours
      .filter((c) => c.date === today())
      .sort((a, b) => timeToMinutes(a.debut) - timeToMinutes(b.debut));

    const agregats = compute.parMatiere(notesData.notes ?? [], notesData.matieres ?? []);
    const dernieresNotes = [...(notesData.notes ?? [])]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 4);

    res.json({
      date: today(),
      jour: frDay(today()),
      salutation: {
        prenom: user.first_name,
        classe: user.class_label,
        etablissement: user.school_name,
      },
      journee: {
        cours: coursDuJour,
        prochainCours: prochain,
        demain: cours.filter((c) => c.date === demain).sort((a, b) => timeToMinutes(a.debut) - timeToMinutes(b.debut)),
        heuresDeCours:
          Math.round(
            coursDuJour
              .filter((c) => !c.annule)
              .reduce((a, c) => a + (timeToMinutes(c.fin) - timeToMinutes(c.debut)) / 60, 0) * 10,
          ) / 10,
      },
      devoirs: {
        aFaire: devoirs.filter((d) => !d.fait).slice(0, 6),
        pourDemain: devoirs.filter((d) => !d.fait && d.dueDate === demain).length,
        enRetard: devoirs.filter((d) => d.enRetard).length,
        controlesSemaine: devoirs.filter(
          (d) => d.type === "controle" && !d.fait && d.joursRestants >= 0 && d.joursRestants <= 7,
        ).length,
      },
      notes: {
        moyenneGenerale: compute.moyenneGenerale(agregats),
        moyenneClasse: compute.moyenneClasseGenerale(agregats),
        dernieres: dernieresNotes,
      },
      revisions: {
        cartesDues: cartesDues[0]?.total ?? 0,
        blocsDuJour: plan.jours[0]?.blocs ?? [],
        minutesPlanifiees: plan.jours[0]?.minutes ?? 0,
      },
      serie,
      notifications,
    });
  }),
);

export default router;
