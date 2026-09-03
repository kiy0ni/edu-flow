import { Router } from "express";
import { z } from "zod";
import * as service from "./service.js";
import { asyncHandler } from "../../lib/errors.js";
import { validateBody } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { authLimiter } from "../../middleware/rateLimit.js";
import { providersDisponibles } from "../../providers/index.js";
import { publicUser } from "./service.js";
import env from "../../config/env.js";

const router = Router();

const REFRESH_COOKIE = "eduflow_refresh";
const cookieOptions = {
  httpOnly: true,
  sameSite: env.isProd ? "strict" : "lax",
  secure: env.isProd,
  path: "/api/v1/auth",
  maxAge: 30 * 24 * 3600 * 1000,
};

/** Le refresh token voyage en cookie httpOnly, et en corps pour les clients natifs. */
const repondreAvecJetons = (res, resultat) => {
  res.cookie(REFRESH_COOKIE, resultat.refreshToken, cookieOptions);
  res.json(resultat);
};

const contexte = (req) => ({
  ip: req.ip,
  userAgent: req.headers["user-agent"],
});

const loginSchema = z.object({
  source: z.enum(["ecoledirecte", "demo"]).default("ecoledirecte"),
  identifiant: z.string().min(1, "Identifiant requis.").max(120),
  motdepasse: z.string().min(1, "Mot de passe requis.").max(200),
});

const qcmSchema = z.object({
  challenge: z.string().min(10),
  reponse: z.string().min(1),
});

router.get("/sources", (_req, res) => res.json({ sources: providersDisponibles(), demoActif: env.ALLOW_DEMO_ACCOUNTS }));

router.post(
  "/login",
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const resultat = await service.login(req.body, contexte(req));
    repondreAvecJetons(res, resultat);
  }),
);

router.post(
  "/double-auth",
  authLimiter,
  validateBody(qcmSchema),
  asyncHandler(async (req, res) => {
    const resultat = await service.resoudreDoubleAuth(req.body, contexte(req));
    repondreAvecJetons(res, resultat);
  }),
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    const resultat = await service.refresh(token, contexte(req));
    repondreAvecJetons(res, resultat);
  }),
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await service.logout(req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken);
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
    res.json({ message: "Déconnecté." });
  }),
);

router.post(
  "/logout-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    await service.logoutAll(req.user.id);
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
    res.json({ message: "Toutes les sessions ont été fermees." });
  }),
);

router.get("/me", requireAuth, (req, res) => res.json({ utilisateur: publicUser(req.user) }));

export default router;
