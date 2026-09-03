import jwt from "jsonwebtoken";
import env from "../config/env.js";
import { unauthorized } from "./errors.js";

const ISSUER = "eduflow";

export const signAccessToken = (payload) =>
  jwt.sign({ ...payload, typ: "access" }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
    issuer: ISSUER,
  });

/** Jeton court utilise pendant la double authentification École Directe. */
export const signChallengeToken = (payload) =>
  jwt.sign({ ...payload, typ: "challenge" }, env.JWT_SECRET, { expiresIn: "5m", issuer: ISSUER });

export const verifyToken = (token, type) => {
  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET, { issuer: ISSUER });
  } catch (err) {
    throw unauthorized(err.name === "TokenExpiredError" ? "Session expirée." : "Jeton invalide.");
  }
  if (type && decoded.typ !== type) throw unauthorized("Jeton de type incorrect.");
  return decoded;
};

/** Convertit "30d" / "30m" / "45s" en millisecondes. */
export const ttlToMs = (ttl) => {
  const match = /^(\d+)([smhd])$/.exec(String(ttl));
  if (!match) return 30 * 24 * 3600 * 1000;
  const unites = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(match[1]) * unites[match[2]];
};
