import gateway from "../../providers/gateway.js";
import * as messagerie from "../messages/service.js";
import * as homework from "../homework/service.js";
import { queryAll, query } from "../../lib/db.js";
import { getPreferences } from "../users/repository.js";
import { today, addDays, daysBetween } from "../../lib/dates.js";
import logger from "../../lib/logger.js";

/**
 * Detecteur de notifications.
 *
 * Il compare l'etat courant des donnees a ce qui a deja ete notifie (via
 * `dedupe_key`) et n'emet que les nouveautes. Il est idempotent : on peut
 * l'appeler a chaque chargement sans generer de doublons.
 */

const emettre = (lot, { type, severite, titre, corps, lien, cle }) =>
  lot.push({ type, severite, titre, corps, lien, cle });

export const detecter = async (user) => {
  const prefs = (await getPreferences(user.id))?.notifications ?? {};
  const lot = [];

  const [notesData, devoirs, vieScolaire, messages] = await Promise.all([
    gateway.notes(user, { periode: "annee" }).catch(() => ({ notes: [] })),
    homework.lister(user, { from: today(), to: addDays(today(), 7) }).catch(() => []),
    gateway.vieScolaire(user).catch(() => []),
    messagerie.lister(user, { dossier: "reception" }).catch(() => []),
  ]);

  // --- Nouvelles notes (14 derniers jours) ---
  if (prefs.nouvelleNote !== false) {
    const recentes = (notesData.notes ?? []).filter(
      (n) => daysBetween(n.date, today()) >= 0 && daysBetween(n.date, today()) <= 14,
    );
    for (const note of recentes.slice(0, 20)) {
      const bonne = note.moyenneClasse !== null && note.valeur > note.moyenneClasse;
      emettre(lot, {
        type: "note",
        severite: note.valeur < note.bareme / 2 ? "attention" : bonne ? "succes" : "info",
        titre: `Nouvelle note en ${note.matiere}`,
        corps: `${note.valeur}/${note.bareme} - ${note.intitule}${
          note.moyenneClasse !== null ? ` (moyenne de classe : ${note.moyenneClasse})` : ""
        }`,
        lien: "/notes",
        cle: `note:${note.id}`,
      });
    }
  }

  // --- Devoirs dont l'echeance approche ---
  if (prefs.devoirProche !== false) {
    for (const devoir of devoirs.filter((d) => !d.fait && d.joursRestants >= 0 && d.joursRestants <= 2)) {
      emettre(lot, {
        type: "devoir",
        severite: devoir.type === "controle" ? "attention" : "info",
        titre:
          devoir.joursRestants === 0
            ? `${devoir.matiere} : à rendre aujourd'hui`
            : `${devoir.matiere} : ${devoir.joursRestants === 1 ? "demain" : `dans ${devoir.joursRestants} jours`}`,
        corps: devoir.intitule,
        lien: "/devoirs",
        cle: `devoir:${devoir.id}:${devoir.dueDate}`,
      });
    }

    for (const devoir of devoirs.filter((d) => d.enRetard)) {
      emettre(lot, {
        type: "devoir",
        severite: "urgent",
        titre: `En retard : ${devoir.matiere}`,
        corps: `${devoir.intitule} - échéance dépassée depuis ${Math.abs(devoir.joursRestants)} jour(s).`,
        lien: "/devoirs",
        cle: `retard:${devoir.id}`,
      });
    }
  }

  // --- Absences a justifier ---
  if (prefs.absence !== false) {
    for (const evenement of vieScolaire.filter((v) => !v.justifie && v.type !== "sanction").slice(0, 10)) {
      emettre(lot, {
        type: "assiduite",
        severite: "attention",
        titre: `${evenement.type === "absence" ? "Absence" : "Retard"} à justifier`,
        corps: `Le ${evenement.date}${evenement.debut ? ` a ${evenement.debut}` : ""} - motif : ${evenement.motif}.`,
        lien: "/vie-scolaire",
        cle: `justif:${evenement.id}`,
      });
    }
  }

  // --- Messages non lus ---
  if (prefs.message !== false) {
    for (const message of messages.filter((m) => !m.lu).slice(0, 10)) {
      emettre(lot, {
        type: "message",
        severite: "info",
        titre: `Message de ${message.expediteur}`,
        corps: message.sujet,
        lien: "/messagerie",
        cle: `message:${message.id}`,
      });
    }
  }

  if (lot.length === 0) return 0;

  // Insertion idempotente en un seul aller-retour : les cles deja vues sont ignorees.
  const { rowCount } = await query(
    `INSERT INTO notifications (user_id, type, severity, title, body, link, dedupe_key)
     SELECT $1, t.type, t.severite, t.titre, t.corps, t.lien, t.cle
     FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[])
          AS t(type, severite, titre, corps, lien, cle)
     ON CONFLICT (user_id, dedupe_key) DO NOTHING`,
    [
      user.id,
      lot.map((n) => n.type),
      lot.map((n) => n.severite),
      lot.map((n) => n.titre),
      lot.map((n) => n.corps),
      lot.map((n) => n.lien),
      lot.map((n) => n.cle),
    ],
  );

  logger.debug({ userId: user.id, nouvelles: rowCount }, "Detection de notifications terminée");
  return rowCount;
};

export const lister = async (user, { seulementNonLues = false, limite = 50 } = {}) => {
  const notifications = await queryAll(
    `SELECT id, type, severity AS severite, title AS titre, body AS corps, link AS lien,
            read_at AS "luLe", created_at AS "creeLe"
     FROM notifications
     WHERE user_id = $1 ${seulementNonLues ? "AND read_at IS NULL" : ""}
     ORDER BY read_at IS NOT NULL, created_at DESC
     LIMIT $2`,
    [user.id, limite],
  );

  const [compte] = await queryAll(
    "SELECT count(*)::int AS total FROM notifications WHERE user_id = $1 AND read_at IS NULL",
    [user.id],
  );

  return { notifications, nonLues: compte?.total ?? 0 };
};

export const marquerLue = (user, id) =>
  query("UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL", [id, user.id]);

export const toutMarquerLu = (user) =>
  query("UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL", [user.id]);

/** Purge des notifications lues de plus de 30 jours. */
export const purger = async () => {
  const { rowCount } = await query(
    "DELETE FROM notifications WHERE read_at IS NOT NULL AND read_at < now() - interval '30 days'",
  );
  return rowCount;
};
