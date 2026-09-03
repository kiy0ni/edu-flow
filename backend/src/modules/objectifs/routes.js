import { Router } from "express";
import { z } from "zod";
import * as service from "./service.js";
import { asyncHandler } from "../../lib/errors.js";
import { validateBody, validateQuery, validateParams } from "../../lib/validate.js";

const router = Router();

router.get(
  "/",
  validateQuery(z.object({ periode: z.string().max(20).optional() })),
  asyncHandler(async (req, res) => {
    res.json(await service.lister(req.user, req.validatedQuery));
  }),
);

router.put(
  "/",
  validateBody(
    z.object({
      matiereCode: z.string().min(1).max(30),
      periodeCode: z.string().min(1).max(20),
      cible: z.number().min(1).max(20),
      note: z.string().max(300).nullable().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    await service.definir(req.user, req.body);
    res.json(await service.lister(req.user, { periode: req.body.periodeCode }));
  }),
);

router.delete(
  "/:periodeCode/:matiereCode",
  validateParams(z.object({ periodeCode: z.string().max(20), matiereCode: z.string().max(30) })),
  asyncHandler(async (req, res) => {
    await service.supprimer(req.user, req.params.matiereCode, req.params.periodeCode);
    res.status(204).end();
  }),
);

export default router;
