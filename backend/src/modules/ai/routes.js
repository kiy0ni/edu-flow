import { Router } from "express";
import { z } from "zod";
import * as service from "./service.js";
import * as flashcards from "../flashcards/service.js";
import { aiDisponible, quotaRestant, MODELE } from "./client.js";
import { asyncHandler, unavailable } from "../../lib/errors.js";
import { validateBody, validateQuery, validateParams } from "../../lib/validate.js";
import { aiLimiter } from "../../middleware/rateLimit.js";
import logger from "../../lib/logger.js";

const router = Router();
const uuid = z.object({ id: z.string().uuid() });

/** Toutes les routes IA sont conditionnees a la disponibilite du modele. */
const exigerIA = (_req, _res, next) =>
  aiDisponible()
    ? next()
    : next(
        unavailable(
          "L'assistant IA n'est pas activé sur cette instance. Renseignez ANTHROPIC_API_KEY pour l'activer.",
        ),
      );

router.get(
  "/statut",
  asyncHandler(async (req, res) => {
    res.json({
      disponible: aiDisponible(),
      modele: aiDisponible() ? MODELE : null,
      quotaRestant: aiDisponible() ? await quotaRestant(req.user.id) : 0,
    });
  }),
);

// ------------------------------------------------------------------ conversation

/**
 * Chat en streaming (Server-Sent Events).
 * Le front consomme `debut`, `delta`, `fin` et `erreur`.
 */
router.post(
  "/chat",
  exigerIA,
  aiLimiter,
  validateBody(
    z.object({
      message: z.string().min(1).max(4000),
      conversationId: z.string().uuid().optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const emit = (evenement, donnees) => {
      res.write(`event: ${evenement}\n`);
      res.write(`data: ${JSON.stringify(donnees)}\n\n`);
    };

    try {
      await service.discuter(req.user, req.body, emit);
    } catch (err) {
      logger.warn({ err: err.message }, "Échec du flux assistant");
      emit("erreur", { message: err.expected ? err.message : "L'assistant est momentanément indisponible." });
    } finally {
      res.end();
    }
  }),
);

router.get(
  "/conversations",
  asyncHandler(async (req, res) => res.json({ conversations: await service.listerConversations(req.user.id) })),
);

router.get(
  "/conversations/:id",
  validateParams(uuid),
  asyncHandler(async (req, res) => res.json(await service.lireConversation(req.user.id, req.params.id))),
);

router.delete(
  "/conversations/:id",
  validateParams(uuid),
  asyncHandler(async (req, res) => {
    await service.supprimerConversation(req.user.id, req.params.id);
    res.status(204).end();
  }),
);

// -------------------------------------------------------------------- generation

router.post(
  "/brief",
  exigerIA,
  aiLimiter,
  asyncHandler(async (req, res) => res.json({ brief: await service.briefDuJour(req.user) })),
);

const sujetSchema = z.object({
  sujet: z.string().min(2).max(300),
  matiere: z.string().max(80).optional(),
  detail: z.string().max(2000).optional(),
});

router.post(
  "/fiche",
  exigerIA,
  aiLimiter,
  validateBody(sujetSchema),
  asyncHandler(async (req, res) => res.status(201).json({ fiche: await service.genererFiche(req.user, req.body) })),
);

router.post(
  "/quiz",
  exigerIA,
  aiLimiter,
  validateBody(sujetSchema.extend({ nbQuestions: z.number().int().min(3).max(20).default(8) })),
  asyncHandler(async (req, res) => res.status(201).json({ quiz: await service.genererQuiz(req.user, req.body) })),
);

/**
 * Genere des cartes et, si un paquet est fourni, les y ajoute directement.
 * Sinon un paquet dedie est cree : l'eleve peut reviser immediatement.
 */
router.post(
  "/cartes",
  exigerIA,
  aiLimiter,
  validateBody(
    sujetSchema.extend({
      nombre: z.number().int().min(4).max(30).default(12),
      paquetId: z.string().uuid().optional(),
      titrePaquet: z.string().max(120).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const cartes = await service.genererCartes(req.user, req.body);

    const paquetId =
      req.body.paquetId ??
      (
        await flashcards.creerPaquet(req.user.id, {
          titre: req.body.titrePaquet ?? req.body.sujet.slice(0, 100),
          matiere: req.body.matiere,
          description: `Généré automatiquement à partir de : ${req.body.sujet}`,
          source: "ia",
        })
      ).id;

    const creees = await flashcards.ajouterCartes(req.user.id, paquetId, cartes);
    res.status(201).json({ paquetId, cartes: creees, nombre: creees.length });
  }),
);

// --------------------------------------------------------------------- documents

router.get(
  "/documents",
  validateQuery(z.object({ type: z.enum(["fiche", "quiz", "brief", "plan", "resume"]).optional() })),
  asyncHandler(async (req, res) =>
    res.json({ documents: await service.listerArtefacts(req.user.id, req.validatedQuery.type) }),
  ),
);

router.get(
  "/documents/:id",
  validateParams(uuid),
  asyncHandler(async (req, res) => res.json({ document: await service.lireArtefact(req.user.id, req.params.id) })),
);

router.delete(
  "/documents/:id",
  validateParams(uuid),
  asyncHandler(async (req, res) => {
    await service.supprimerArtefact(req.user.id, req.params.id);
    res.status(204).end();
  }),
);

export default router;
