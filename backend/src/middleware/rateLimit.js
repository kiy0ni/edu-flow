import rateLimit from "express-rate-limit";
import env from "../config/env.js";

const reponse = (message) => (req, res) =>
  res.status(429).json({ erreur: { code: "too_many_requests", message } });

const desactive = env.NODE_ENV === "test";

/** Limite globale de l'API. */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => desactive,
  handler: reponse("Trop de requêtes, patientez un instant."),
});

/** Limite stricte sur les routes d'authentification (anti bruteforce). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 12,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => desactive,
  handler: reponse("Trop de tentatives de connexion. Réessayez dans quelques minutes."),
});

/** Limite dediee aux appels IA, plus couteux. */
export const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => desactive,
  handler: reponse("Trop de requêtes vers l'assistant. Patientez quelques secondes."),
});
