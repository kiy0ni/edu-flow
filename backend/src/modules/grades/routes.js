import { Router } from "express";
import { z } from "zod";
import gateway from "../../providers/gateway.js";
import * as compute from "./compute.js";
import { asyncHandler } from "../../lib/errors.js";
import { validateBody, validateQuery } from "../../lib/validate.js";

const router = Router();

const chargerNotes = async (user, periode) => {
  const { notes, periodes, matieres } = await gateway.notes(user, { periode: "annee" });
  const filtrees = periode && periode !== "annee" ? notes.filter((n) => n.periodeCode === periode) : notes;
  return { notes, filtrees, periodes, matieres };
};

router.get(
  "/",
  validateQuery(z.object({ periode: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const periode = req.validatedQuery.periode ?? "annee";
    const { filtrees, periodes, matieres } = await chargerNotes(req.user, periode);
    const agregats = compute.parMatiere(filtrees, matieres);

    res.json({
      periode,
      periodes,
      notes: filtrees,
      parMatiere: agregats,
      moyenneGenerale: compute.moyenneGenerale(agregats),
      moyenneClasse: compute.moyenneClasseGenerale(agregats),
    });
  }),
);

router.get(
  "/synthese",
  asyncHandler(async (req, res) => {
    const { notes, periodes, matieres } = await chargerNotes(req.user, "annee");
    const agregats = compute.parMatiere(notes, matieres);
    const moyenne = compute.moyenneGenerale(agregats);
    const classe = compute.moyenneClasseGenerale(agregats);

    res.json({
      moyenneGenerale: moyenne,
      moyenneClasse: classe,
      positionRelative: moyenne !== null && classe !== null ? compute.arrondi(moyenne - classe) : null,
      nbNotes: notes.length,
      evolution: compute.evolutionParPeriode(notes, periodes, matieres),
      meilleures: agregats.slice(0, 3),
      fragiles: [...agregats].reverse().slice(0, 3),
      dernieres: [...notes].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8),
    });
  }),
);

const simulationSchema = z.object({
  periode: z.string().optional(),
  ajouts: z
    .array(
      z.object({
        matiereCode: z.string().min(1),
        valeur: z.number().min(0).max(100),
        bareme: z.number().positive().max(100).default(20),
        coefficient: z.number().positive().max(20).default(1),
      }),
    )
    .max(20)
    .default([]),
  exclusions: z.array(z.string()).max(50).default([]),
});

router.post(
  "/simulation",
  validateBody(simulationSchema),
  asyncHandler(async (req, res) => {
    const { filtrees, matieres } = await chargerNotes(req.user, req.body.periode ?? "annee");
    res.json(compute.simuler(filtrees, matieres, req.body));
  }),
);

const objectifSchema = z.object({
  periode: z.string().optional(),
  matiereCode: z.string().min(1),
  objectif: z.number().min(0).max(20),
  coefficient: z.number().positive().max(20).default(1),
});

/** "Quelle note me faut-il pour atteindre X de moyenne générale ?" */
router.post(
  "/objectif",
  validateBody(objectifSchema),
  asyncHandler(async (req, res) => {
    const { filtrees, matieres } = await chargerNotes(req.user, req.body.periode ?? "annee");
    const requise = compute.noteNecessaire(filtrees, matieres, req.body);
    res.json({
      matiereCode: req.body.matiereCode,
      objectif: req.body.objectif,
      noteNecessaire: requise,
      atteignable: requise !== null,
      message:
        requise === null
          ? "Cet objectif n'est pas atteignable avec une seule évaluation supplémentaire."
          : `Il faut au moins ${requise}/20 (coef. ${req.body.coefficient}) pour atteindre ${req.body.objectif} de moyenne générale.`,
    });
  }),
);

export default router;
