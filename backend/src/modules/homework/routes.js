import { Router } from "express";
import { z } from "zod";
import * as service from "./service.js";
import { asyncHandler } from "../../lib/errors.js";
import { validateBody, validateQuery, validateParams } from "../../lib/validate.js";
import { ISO_DAY } from "../../lib/dates.js";

const router = Router();

router.get(
  "/",
  validateQuery(
    z.object({
      from: z.string().regex(ISO_DAY).optional(),
      to: z.string().regex(ISO_DAY).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const devoirs = await service.lister(req.user, req.validatedQuery);
    res.json({
      devoirs,
      resume: {
        total: devoirs.length,
        aFaire: devoirs.filter((d) => !d.fait).length,
        enRetard: devoirs.filter((d) => d.enRetard).length,
        controles: devoirs.filter((d) => d.type === "controle" && !d.fait).length,
      },
    });
  }),
);

router.get(
  "/charge",
  validateQuery(z.object({ jours: z.coerce.number().int().min(1).max(60).default(14) })),
  asyncHandler(async (req, res) => {
    res.json(await service.chargeDeTravail(req.user, req.validatedQuery));
  }),
);

router.patch(
  "/:id",
  validateParams(z.object({ id: z.string().min(1).max(160) })),
  validateBody(
    z.object({
      fait: z.boolean().optional(),
      dureeEstimee: z.number().int().min(5).max(480).optional(),
      difficulte: z.number().int().min(1).max(5).optional(),
      notes: z.string().max(2000).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const etat = await service.majEtat(req.user, req.params.id, req.body);
    res.json({ etat });
  }),
);

export default router;
