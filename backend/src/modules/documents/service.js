import gateway from "../../providers/gateway.js";
import * as generateur from "./generateur.js";
import * as timetable from "../timetable/service.js";
import { queryAll, query } from "../../lib/db.js";
import { notFound } from "../../lib/errors.js";
import { today, startOfWeek, endOfWeek, daysBetween } from "../../lib/dates.js";

/**
 * Documents de l'établissement.
 *
 * Deux natures coexistent :
 *  - les pièces **produites à la demande** à partir du dossier de l'élève
 *    (bulletins, relevés, attestations, emploi du temps) : leur identifiant
 *    porte la recette de fabrication et le PDF est généré au téléchargement ;
 *  - les pièces **fournies par l'établissement**, relayées telles quelles.
 */

export const lister = async (user) => {
  const [distants, periodes, etats] = await Promise.all([
    gateway.documents(user).catch(() => []),
    gateway.periodes(user).catch(() => []),
    queryAll("SELECT document_id, opened_at, starred FROM document_state WHERE user_id = $1", [user.id]),
  ]);

  const parId = new Map(etats.map((e) => [e.document_id, e]));

  // Une pièce est datée de la période qu'elle couvre, pas du jour où le PDF
  // est fabriqué : une période encore en cours porte la date du jour.
  const dateDePeriode = (p) => (daysBetween(p.fin, today()) >= 0 ? p.fin : today());
  const periodesEntamees = periodes.filter((p) => daysBetween(p.debut, today()) >= 0);

  const generes = [
    ...periodesEntamees.map((p) => ({
      id: `gen:bulletin:${p.code}`,
      nom: `Bulletin — ${p.libelle}.pdf`,
      categorie: "Bulletins",
      description: `Moyennes, appréciations et synthèse du ${p.libelle.toLowerCase()}.`,
      date: dateDePeriode(p),
    })),
    ...periodesEntamees.map((p) => ({
      id: `gen:releve:${p.code}`,
      nom: `Relevé de notes — ${p.libelle}.pdf`,
      categorie: "Bulletins",
      description: "Détail de toutes les évaluations de la période.",
      date: dateDePeriode(p),
    })),
    {
      id: "gen:attestation",
      nom: "Attestation de scolarité.pdf",
      categorie: "Administratif",
      description: "Justificatif d'inscription pour l'année en cours.",
      date: periodes[0]?.debut ?? today(),
    },
    {
      id: "gen:edt",
      nom: "Emploi du temps de la semaine.pdf",
      categorie: "Administratif",
      description: "Planning hebdomadaire imprimable.",
      date: startOfWeek(today()),
    },
  ];

  const tous = [...generes, ...distants].map((d) => {
    const etat = parId.get(d.id);
    return {
      ...d,
      type: d.type ?? "pdf",
      date: d.date ?? today(),
      genere: String(d.id).startsWith("gen:"),
      telechargeable: String(d.id).startsWith("gen:") || Boolean(d.url) || Boolean(d.statique),
      ouvertLe: etat?.opened_at ?? null,
      favori: etat?.starred ?? false,
    };
  });

  return {
    documents: tous.sort((a, b) => (a.date === b.date ? a.nom.localeCompare(b.nom) : a.date < b.date ? 1 : -1)),
    categories: [...new Set(tous.map((d) => d.categorie))].sort(),
  };
};

/** Produit le contenu binaire d'un document et son nom de fichier. */
export const contenu = async (user, id) => {
  const profil = await gateway.profil(user);

  if (id.startsWith("gen:")) {
    const [, genre, argument] = id.split(":");

    if (genre === "attestation") {
      return { nom: "attestation-de-scolarite.pdf", octets: generateur.attestation({ profil }) };
    }

    if (genre === "edt") {
      const semaine = await timetable.semaine(user, { from: startOfWeek(today()), to: endOfWeek(today()) });
      return {
        nom: "emploi-du-temps.pdf",
        octets: generateur.emploiDuTempsPdf({ profil, jours: semaine.jours }),
      };
    }

    const { notes, periodes, matieres } = await gateway.notes(user, { periode: "annee" });
    const periode = periodes.find((p) => p.code === argument);
    if (!periode) throw notFound("Période introuvable.");

    if (genre === "bulletin") {
      return {
        nom: `bulletin-${periode.code.toLowerCase()}.pdf`,
        octets: generateur.bulletin({ profil, periode, notes, matieres }),
      };
    }
    if (genre === "releve") {
      return {
        nom: `releve-de-notes-${periode.code.toLowerCase()}.pdf`,
        octets: generateur.releveDeNotes({ profil, periode, notes }),
      };
    }
    throw notFound("Document introuvable.");
  }

  // Pièces de l'établissement dont le contenu est rédigé côté EduFlow.
  const { documents } = await lister(user);
  const document = documents.find((d) => d.id === id);
  if (!document) throw notFound("Document introuvable.");
  if (document.statique) {
    const octets = generateur.documentStatique(document.statique, profil);
    if (octets) return { nom: `${document.statique}.pdf`, octets };
  }

  throw notFound("Ce document n'est pas disponible au téléchargement.");
};

export const marquerOuvert = (user, id) =>
  query(
    `INSERT INTO document_state (user_id, document_id, opened_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id, document_id) DO UPDATE SET opened_at = now()`,
    [user.id, id],
  );

export const basculerFavori = async (user, id) => {
  const { rows } = await query(
    `INSERT INTO document_state (user_id, document_id, starred) VALUES ($1, $2, true)
     ON CONFLICT (user_id, document_id) DO UPDATE SET starred = NOT document_state.starred
     RETURNING starred`,
    [user.id, id],
  );
  return rows[0].starred;
};
