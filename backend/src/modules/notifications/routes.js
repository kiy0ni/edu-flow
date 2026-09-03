import { Router } from "express";
import { z } from "zod";
import * as service from "./service.js";
import { asyncHandler } from "../../lib/errors.js";
import { validateQuery, validateParams, booleanQuery } from "../../lib/validate.js";
import logger from "../../lib/logger.js";

const router = Router();

router.get(
  "/",
  validateQuery(
    z.object({
      nonLues: booleanQuery(false),
      limite: z.coerce.number().int().min(1).max(200).default(50),
      detecter: booleanQuery(true),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { nonLues, limite, detecter } = req.validatedQuery;
    // La detection est best-effort : elle ne doit jamais bloquer l'affichage.
    if (detecter) {
      await service.detecter(req.user).catch((err) => logger.warn({ err: err.message }, "Detection ignoree"));
    }
    res.json(await service.lister(req.user, { seulementNonLues: nonLues, limite }));
  }),
);

router.post(
  "/:id/lue",
  validateParams(z.object({ id: z.string().uuid() })),
  asyncHandler(async (req, res) => {
    await service.marquerLue(req.user, req.params.id);
    res.json({ message: "Notification marquee comme lue." });
  }),
);

router.post(
  "/tout-lire",
  asyncHandler(async (req, res) => {
    await service.toutMarquerLu(req.user);
    res.json({ message: "Toutes les notifications sont marquées comme lues." });
  }),
);

export default router;
