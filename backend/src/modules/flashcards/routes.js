import { Router } from "express";
import { z } from "zod";
import * as service from "./service.js";
import { asyncHandler } from "../../lib/errors.js";
import { validateBody, validateQuery, validateParams } from "../../lib/validate.js";

const router = Router();
const uuid = z.object({ id: z.string().uuid() });

const carteSchema = z.object({
  recto: z.string().min(1).max(1000),
  verso: z.string().min(1).max(2000),
  indice: z.string().max(500).optional(),
});

router.get("/", asyncHandler(async (req, res) => res.json({ paquets: await service.listerPaquets(req.user.id) })));

router.post(
  "/",
  validateBody(
    z.object({
      titre: z.string().min(1).max(120),
      matiere: z.string().max(80).optional(),
      description: z.string().max(500).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    res.status(201).json({ paquet: await service.creerPaquet(req.user.id, req.body) });
  }),
);

router.get(
  "/revision",
  validateQuery(
    z.object({
      paquet: z.string().uuid().optional(),
      limite: z.coerce.number().int().min(1).max(100).default(20),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { paquet, limite } = req.validatedQuery;
    res.json({ cartes: await service.fileDuJour(req.user.id, { deckId: paquet ?? null, limite }) });
  }),
);

router.get("/statistiques", asyncHandler(async (req, res) => res.json(await service.statistiques(req.user.id))));

router.get(
  "/:id/cartes",
  validateParams(uuid),
  asyncHandler(async (req, res) => {
    res.json({ cartes: await service.listerCartes(req.user.id, req.params.id) });
  }),
);

router.post(
  "/:id/cartes",
  validateParams(uuid),
  validateBody(z.object({ cartes: z.array(carteSchema).min(1).max(100) })),
  asyncHandler(async (req, res) => {
    res.status(201).json({ cartes: await service.ajouterCartes(req.user.id, req.params.id, req.body.cartes) });
  }),
);

router.delete(
  "/:id",
  validateParams(uuid),
  asyncHandler(async (req, res) => {
    await service.supprimerPaquet(req.user.id, req.params.id);
    res.status(204).end();
  }),
);

/** Notation d'une carte : 0-5 (echelle SM-2). */
router.post(
  "/cartes/:id/reviser",
  validateParams(uuid),
  validateBody(z.object({ quality: z.number().int().min(0).max(5) })),
  asyncHandler(async (req, res) => {
    res.json(await service.noterCarte(req.user.id, req.params.id, req.body.quality));
  }),
);

export default router;
