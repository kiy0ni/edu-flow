import { Router } from "express";
import { z } from "zod";
import * as service from "./service.js";
import { asyncHandler } from "../../lib/errors.js";
import { validateBody, validateQuery, validateParams } from "../../lib/validate.js";

const router = Router();
const identifiant = z.object({ id: z.string().min(1).max(160) });

router.get(
  "/",
  validateQuery(
    z.object({
      dossier: z.enum(["reception", "envoyes", "archives", "corbeille"]).default("reception"),
      recherche: z.string().max(120).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const messages = await service.lister(req.user, req.validatedQuery);
    res.json({
      messages: messages.map(({ corps, ...reste }) => reste),
      nonLus: messages.filter((m) => !m.lu).length,
    });
  }),
);

router.get(
  "/destinataires",
  asyncHandler(async (req, res) => {
    res.json({ destinataires: await service.destinataires(req.user) });
  }),
);

router.post(
  "/",
  validateBody(
    z.object({
      destinataires: z
        .array(z.object({ id: z.string().max(80), nom: z.string().min(1).max(120) }))
        .min(1, "Choisissez au moins un destinataire.")
        .max(10),
      sujet: z.string().min(1, "L'objet est requis.").max(200),
      corps: z.string().min(1, "Le message est vide.").max(10_000),
      repondA: z.string().max(160).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    res.status(201).json({ message: await service.envoyer(req.user, req.body) });
  }),
);

router.post(
  "/tout-lire",
  asyncHandler(async (req, res) => {
    res.json({ marques: await service.toutMarquerLu(req.user) });
  }),
);

router.get(
  "/:id",
  validateParams(identifiant),
  asyncHandler(async (req, res) => {
    res.json({ message: await service.lire(req.user, req.params.id) });
  }),
);

router.post(
  "/:id/lu",
  validateParams(identifiant),
  validateBody(z.object({ lu: z.boolean().default(true) })),
  asyncHandler(async (req, res) => {
    await service.marquerLu(req.user, req.params.id, req.body.lu);
    res.json({ lu: req.body.lu });
  }),
);

router.post(
  "/:id/favori",
  validateParams(identifiant),
  asyncHandler(async (req, res) => {
    res.json({ favori: await service.basculerFavori(req.user, req.params.id) });
  }),
);

router.post(
  "/:id/archiver",
  validateParams(identifiant),
  validateBody(z.object({ archive: z.boolean().default(true) })),
  asyncHandler(async (req, res) => {
    await service.archiver(req.user, req.params.id, req.body.archive);
    res.json({ archive: req.body.archive });
  }),
);

router.delete(
  "/:id",
  validateParams(identifiant),
  asyncHandler(async (req, res) => {
    await service.supprimer(req.user, req.params.id);
    res.status(204).end();
  }),
);

router.post(
  "/:id/restaurer",
  validateParams(identifiant),
  asyncHandler(async (req, res) => {
    await service.restaurer(req.user, req.params.id);
    res.json({ restaure: true });
  }),
);

export default router;
