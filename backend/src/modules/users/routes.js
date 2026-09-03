import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import * as repo from "./repository.js";
import gateway from "../../providers/gateway.js";
import { asyncHandler, badRequest } from "../../lib/errors.js";
import { validateBody } from "../../lib/validate.js";
import { publicUser } from "../auth/service.js";

const router = Router();

/** Profil complet : donnees locales enrichies par le profil de l'etablissement. */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const [profilAmont, preferences] = await Promise.all([
      gateway.profil(req.user).catch(() => null),
      repo.getPreferences(req.user.id),
    ]);

    res.json({
      utilisateur: publicUser(req.user),
      profil: profilAmont,
      preferences: formaterPreferences(preferences),
    });
  }),
);

router.patch(
  "/",
  validateBody(
    z.object({
      prenom: z.string().min(1).max(80).optional(),
      nom: z.string().min(1).max(80).optional(),
      email: z.string().email().max(160).optional(),
      telephone: z.string().max(30).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    if (Object.keys(req.body).length === 0) throw badRequest("Aucun champ a mettre à jour.");
    const utilisateur = await repo.updateProfile(req.user.id, req.body);
    res.json({ utilisateur });
  }),
);

router.put(
  "/mot-de-passe",
  validateBody(
    z
      .object({
        motDePasseActuel: z.string().max(200).optional(),
        nouveauMotDePasse: z.string().min(10, "10 caractères minimum.").max(200),
        confirmation: z.string(),
      })
      .refine((d) => d.nouveauMotDePasse === d.confirmation, {
        message: "La confirmation ne correspond pas.",
        path: ["confirmation"],
      }),
  ),
  asyncHandler(async (req, res) => {
    // Le mot de passe local est distinct de celui de l'etablissement : il sert
    // uniquement au chiffrement local et a la reconnexion hors ligne.
    if (req.user.password_hash) {
      const ok = await bcrypt.compare(req.body.motDePasseActuel ?? "", req.user.password_hash);
      if (!ok) throw badRequest("Mot de passe actuel incorrect.");
    }
    await repo.updatePassword(req.user.id, await bcrypt.hash(req.body.nouveauMotDePasse, 12));
    res.json({ message: "Mot de passe mis à jour." });
  }),
);

const formaterPreferences = (p) =>
  p
    ? {
        theme: p.theme,
        accent: p.accent,
        locale: p.locale,
        aiOptIn: p.ai_opt_in,
        notifications: p.notifications,
        study: p.study,
      }
    : null;

router.get(
  "/preferences",
  asyncHandler(async (req, res) => {
    res.json({ preferences: formaterPreferences(await repo.getPreferences(req.user.id)) });
  }),
);

router.put(
  "/preferences",
  validateBody(
    z.object({
      theme: z.enum(["light", "dark", "system"]).optional(),
      accent: z.string().max(24).optional(),
      locale: z.string().max(12).optional(),
      aiOptIn: z.boolean().optional(),
      notifications: z.record(z.string(), z.boolean()).optional(),
      study: z
        .object({
          debut: z.string().regex(/^\d{2}:\d{2}$/).optional(),
          fin: z.string().regex(/^\d{2}:\d{2}$/).optional(),
          dureeBloc: z.number().int().min(15).max(120).optional(),
          pause: z.number().int().min(0).max(60).optional(),
          joursOff: z.array(z.string()).max(7).optional(),
        })
        .optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const preferences = await repo.upsertPreferences(req.user.id, req.body);
    res.json({ preferences: formaterPreferences(preferences) });
  }),
);

router.get(
  "/sessions",
  asyncHandler(async (req, res) => {
    res.json({ sessions: await repo.listSessions(req.user.id) });
  }),
);

router.post(
  "/rafraichir",
  asyncHandler(async (req, res) => {
    await gateway.rafraichir(req.user);
    res.json({ message: "Données rechargees depuis l'établissement." });
  }),
);

export default router;
