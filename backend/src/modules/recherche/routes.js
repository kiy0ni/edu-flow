import { Router } from "express";
import { z } from "zod";
import gateway from "../../providers/gateway.js";
import * as messagerie from "../messages/service.js";
import * as documents from "../documents/service.js";
import * as devoirs from "../homework/service.js";
import { asyncHandler } from "../../lib/errors.js";
import { validateQuery } from "../../lib/validate.js";
import { today, addDays, dateFr } from "../../lib/dates.js";

const router = Router();

/** Normalise pour une comparaison insensible à la casse et aux accents. */
const plat = (valeur) =>
  String(valeur ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Score de pertinence : un début de mot vaut mieux qu'une occurrence au milieu,
 * et un titre vaut mieux qu'un corps de texte.
 */
const score = (champs, terme) => {
  let total = 0;
  champs.forEach(({ valeur, poids }) => {
    const texte = plat(valeur);
    if (!texte) return;
    const position = texte.indexOf(terme);
    if (position === -1) return;
    const debutDeMot = position === 0 || /[\s'-]/.test(texte[position - 1]);
    total += poids * (debutDeMot ? 2 : 1);
  });
  return total;
};

/**
 * Recherche transversale.
 * Interroge en parallèle les ressources déjà chargées par ailleurs (le cache du
 * gateway évite de solliciter la source à chaque frappe) et renvoie des
 * résultats déjà classés, prêts à être affichés.
 */
router.get(
  "/",
  validateQuery(z.object({ q: z.string().min(1).max(80), limite: z.coerce.number().min(1).max(40).default(20) })),
  asyncHandler(async (req, res) => {
    const terme = plat(req.validatedQuery.q.trim());
    const { limite } = req.validatedQuery;

    const [listeDevoirs, notes, cours, messages, docs, actualites] = await Promise.all([
      devoirs.lister(req.user, { from: addDays(today(), -60), to: addDays(today(), 60) }).catch(() => []),
      gateway.notes(req.user, { periode: "annee" }).catch(() => ({ notes: [] })),
      gateway.emploiDuTemps(req.user, { from: today(), to: addDays(today(), 14) }).catch(() => []),
      messagerie.lister(req.user, { dossier: "reception" }).catch(() => []),
      documents.lister(req.user).catch(() => ({ documents: [] })),
      gateway.actualites(req.user).catch(() => []),
    ]);

    const resultats = [];
    const ajouter = (type, element, champs, cible) => {
      const pertinence = score(champs, terme);
      if (pertinence > 0) resultats.push({ type, pertinence, cible, ...element });
    };

    for (const d of listeDevoirs) {
      ajouter(
        "devoir",
        { id: d.id, titre: d.intitule, detail: `${d.matiere} · à rendre le ${dateFr(d.dueDate)}`, couleur: d.couleur },
        [
          { valeur: d.intitule, poids: 5 },
          { valeur: d.matiere, poids: 3 },
          { valeur: d.contenu, poids: 1 },
        ],
        "/devoirs",
      );
    }

    for (const n of notes.notes ?? []) {
      ajouter(
        "note",
        { id: n.id, titre: n.intitule, detail: `${n.matiere} · ${n.valeur}/${n.bareme}`, couleur: n.couleur },
        [
          { valeur: n.intitule, poids: 5 },
          { valeur: n.matiere, poids: 3 },
        ],
        "/notes",
      );
    }

    for (const c of cours) {
      ajouter(
        "cours",
        {
          id: c.id,
          titre: c.matiere,
          detail: `${dateFr(c.date, "court")} · ${c.debut}–${c.fin}${c.salle ? ` · ${c.salle}` : ""}`,
          couleur: c.couleur,
        },
        [
          { valeur: c.matiere, poids: 5 },
          { valeur: c.professeur, poids: 3 },
          { valeur: c.salle, poids: 2 },
        ],
        "/emploi-du-temps",
      );
    }

    for (const m of messages) {
      ajouter(
        "message",
        { id: m.id, titre: m.sujet, detail: `${m.expediteur} · ${dateFr(m.date, "court")}` },
        [
          { valeur: m.sujet, poids: 5 },
          { valeur: m.expediteur, poids: 3 },
          { valeur: m.apercu, poids: 1 },
        ],
        "/messagerie",
      );
    }

    for (const d of docs.documents ?? []) {
      ajouter(
        "document",
        { id: d.id, titre: d.nom, detail: d.categorie },
        [
          { valeur: d.nom, poids: 5 },
          { valeur: d.description, poids: 2 },
          { valeur: d.categorie, poids: 1 },
        ],
        "/documents",
      );
    }

    for (const a of actualites) {
      ajouter(
        "actualite",
        { id: a.id, titre: a.titre, detail: `${a.auteur} · ${dateFr(a.date, "court")}` },
        [
          { valeur: a.titre, poids: 5 },
          { valeur: a.contenu, poids: 1 },
        ],
        "/actualites",
      );
    }

    resultats.sort((a, b) => b.pertinence - a.pertinence);

    res.json({
      terme: req.validatedQuery.q,
      total: resultats.length,
      resultats: resultats.slice(0, limite),
    });
  }),
);

export default router;
