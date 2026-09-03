import { Router } from "express";
import { z } from "zod";
import * as service from "./service.js";
import { asyncHandler } from "../../lib/errors.js";
import { validateQuery, validateParams } from "../../lib/validate.js";

const router = Router();
const identifiant = z.object({ id: z.string().min(1).max(160) });

router.get(
  "/",
  validateQuery(z.object({ categorie: z.string().max(60).optional() })),
  asyncHandler(async (req, res) => {
    const { documents, categories } = await service.lister(req.user);
    const { categorie } = req.validatedQuery;
    res.json({
      documents: categorie ? documents.filter((d) => d.categorie === categorie) : documents,
      categories,
    });
  }),
);

/** Téléchargement : le PDF est produit à la volée à partir du dossier. */
router.get(
  "/:id/telecharger",
  validateParams(identifiant),
  asyncHandler(async (req, res) => {
    const { nom, octets } = await service.contenu(req.user, req.params.id);
    await service.marquerOuvert(req.user, req.params.id).catch(() => {});

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", octets.length);
    res.setHeader("Content-Disposition", `inline; filename="${nom}"`);
    res.send(octets);
  }),
);

router.post(
  "/:id/favori",
  validateParams(identifiant),
  asyncHandler(async (req, res) => {
    res.json({ favori: await service.basculerFavori(req.user, req.params.id) });
  }),
);

export default router;
