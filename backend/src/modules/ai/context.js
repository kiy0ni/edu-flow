import gateway from "../../providers/gateway.js";
import * as compute from "../grades/compute.js";
import * as homework from "../homework/service.js";
import { today, addDays, timeToMinutes } from "../../lib/dates.js";

/**
 * Construction du contexte scolaire transmis au modele.
 *
 * Deux principes :
 *  1. Le contexte est *factuel et compact* - on resume, on ne deverse pas des
 *     centaines de lignes de JSON.
 *  2. Il est place dans un bloc systeme mis en cache : le prefixe reste stable
 *     d'un message a l'autre de la conversation, la question de l'utilisateur
 *     arrive apres.
 */

const ligne = (label, valeur) => (valeur === null || valeur === undefined || valeur === "" ? null : `${label} : ${valeur}`);

export const construireContexte = async (user, { portee = "general" } = {}) => {
  const [notesData, devoirs, cours, vieScolaire] = await Promise.all([
    gateway.notes(user, { periode: "annee" }).catch(() => ({ notes: [], matieres: [], periodes: [] })),
    homework.lister(user, { from: today(), to: addDays(today(), 14) }).catch(() => []),
    gateway.emploiDuTemps(user, { from: today(), to: addDays(today(), 7) }).catch(() => []),
    gateway.vieScolaire(user).catch(() => []),
  ]);

  const agregats = compute.parMatiere(notesData.notes ?? [], notesData.matieres ?? []);
  const moyenne = compute.moyenneGenerale(agregats);
  const moyenneClasse = compute.moyenneClasseGenerale(agregats);

  const sections = [];

  sections.push(
    [
      "## Élève",
      ligne("Prenom", user.first_name),
      ligne("Classe", user.class_label),
      ligne("Établissement", user.school_name),
      ligne("Date du jour", today()),
    ]
      .filter(Boolean)
      .join("\n"),
  );

  if (agregats.length) {
    const tableau = agregats
      .map(
        (m) =>
          `- ${m.matiere} (coef. ${m.coefficient}) : ${m.moyenne}/20` +
          (m.moyenneClasse !== null ? ` | classe ${m.moyenneClasse}` : "") +
          ` | ${m.nbNotes} note(s) | tendance ${m.tendance.direction}`,
      )
      .join("\n");
    sections.push(
      `## Résultats\nMoyenne générale : ${moyenne ?? "n/a"}/20` +
        (moyenneClasse !== null ? ` (classe : ${moyenneClasse})` : "") +
        `\n${tableau}`,
    );
  }

  const aFaire = devoirs.filter((d) => !d.fait).slice(0, 15);
  if (aFaire.length) {
    sections.push(
      "## Travail à faire\n" +
        aFaire
          .map(
            (d) =>
              `- [${d.dueDate}${d.enRetard ? " EN RETARD" : ""}] ${d.matiere} (${d.type}) : ${d.intitule}` +
              (d.contenu ? ` - ${d.contenu.slice(0, 180)}` : ""),
          )
          .join("\n"),
    );
  }

  const coursDuJour = cours
    .filter((c) => c.date === today() && !c.annule)
    .sort((a, b) => timeToMinutes(a.debut) - timeToMinutes(b.debut));
  const evaluations = cours.filter((c) => c.type === "evaluation" && !c.annule);

  if (coursDuJour.length || evaluations.length) {
    const parts = ["## Emploi du temps"];
    if (coursDuJour.length) {
      parts.push(
        "Aujourd'hui : " + coursDuJour.map((c) => `${c.debut}-${c.fin} ${c.matiere} (${c.salle ?? "?"})`).join(", "),
      );
    }
    if (evaluations.length) {
      parts.push(
        "Évaluations annoncees : " + evaluations.map((c) => `${c.matiere} le ${c.date}`).join(", "),
      );
    }
    sections.push(parts.join("\n"));
  }

  const nonJustifiees = vieScolaire.filter((v) => !v.justifie);
  if (nonJustifiees.length) {
    sections.push(
      `## Vie scolaire\n${vieScolaire.filter((v) => v.type === "absence").length} absence(s), ` +
        `${vieScolaire.filter((v) => v.type === "retard").length} retard(s), ` +
        `dont ${nonJustifiees.length} non justifié(s).`,
    );
  }

  return {
    texte: sections.join("\n\n"),
    resume: { moyenne, moyenneClasse, nbDevoirs: aFaire.length, nbCoursAujourdhui: coursDuJour.length },
    donnees: { agregats, devoirs: aFaire, cours: coursDuJour, evaluations },
  };
};

/**
 * Prompt systeme stable.
 * Il ne contient aucune donnee variable : c'est lui qui porte le point de cache.
 */
export const SYSTEME_ASSISTANT = `Tu es l'assistant d'EduFlow, un espace numérique de travail utilisé par des élèves du secondaire en France.

Ton rôle
- Aider l'élève a comprendre son cours, organiser son travail et progresser.
- T'appuyer en priorité sur les données scolaires réelles fournies dans le contexte (notes, devoirs, emploi du temps, assiduité).

Regles
- Reponds en francais, sur un ton direct et bienveillant, sans flatterie.
- Sois concret : donne des etapes, des exemples, des méthodes applicables tout de suite.
- Quand tu t'appuies sur une donnée du contexte, cite-la explicitement (la note, la date, la matière).
- Si une information n'est pas dans le contexte, dis-le clairement plutot que de l'inventer. N'invente jamais une note, une date ou un devoir.
- Pour un exercice, ne donne pas seulement le résultat : explique la demarche pour que l'élève sache la refaire seul.
- Refuse poliment de rediger à la place de l'élève un devoir qui sera rendu et evalue ; propose à la place un plan, une méthode et des corrections sur son propre travail.
- Reste concis : quelques paragraphes courts ou une liste, pas de dissertation, sauf demande explicite.
- Utilise du Markdown simple (titres courts, listes, gras) pour structurer.`;
