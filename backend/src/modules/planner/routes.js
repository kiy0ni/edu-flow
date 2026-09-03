import { Router } from "express";
import { z } from "zod";
import * as service from "./service.js";
import { asyncHandler, notFound } from "../../lib/errors.js";
import { validateBody, validateQuery, validateParams } from "../../lib/validate.js";
import { ISO_DAY } from "../../lib/dates.js";

const router = Router();
const uuid = z.object({ id: z.string().uuid() });
const heure = z.string().regex(/^\d{2}:\d{2}$/);

router.get(
  "/",
  validateQuery(z.object({ from: z.string().regex(ISO_DAY).optional(), to: z.string().regex(ISO_DAY).optional() })),
  asyncHandler(async (req, res) => {
    res.json(await service.lirePlan(req.user, req.validatedQuery));
  }),
);

/** Relance une generation complete du plan. */
router.post(
  "/generer",
  validateBody(z.object({ horizon: z.number().int().min(1).max(30).default(7) })),
  asyncHandler(async (req, res) => {
    const resultat = await service.genererPlan(req.user, req.body);
    const plan = await service.lirePlan(req.user, {});
    res.json({ ...resultat, plan });
  }),
);

router.post(
  "/blocs",
  validateBody(
    z.object({
      date: z.string().regex(ISO_DAY),
      debut: heure,
      fin: heure,
      titre: z.string().min(1).max(160),
      detail: z.string().max(1000).optional(),
      kind: z.enum(["revision", "devoir", "controle", "pause", "autre"]).default("revision"),
      subject: z.string().max(80).optional(),
      priorite: z.number().int().min(1).max(5).default(3),
    }),
  ),
  asyncHandler(async (req, res) => {
    res.status(201).json({ bloc: await service.creerBloc(req.user, req.body) });
  }),
);

router.patch(
  "/blocs/:id",
  validateParams(uuid),
  validateBody(
    z.object({
      status: z.enum(["planifie", "fait", "reporte", "annule"]).optional(),
      date: z.string().regex(ISO_DAY).optional(),
      debut: heure.optional(),
      fin: heure.optional(),
      titre: z.string().min(1).max(160).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const bloc = await service.majBloc(req.user, req.params.id, req.body);
    if (!bloc) throw notFound("Bloc introuvable.");
    res.json({ bloc });
  }),
);

router.delete(
  "/blocs/:id",
  validateParams(uuid),
  asyncHandler(async (req, res) => {
    await service.supprimerBloc(req.user, req.params.id);
    res.status(204).end();
  }),
);

export default router;
