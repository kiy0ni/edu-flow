import crypto from "node:crypto";
import env from "../config/env.js";
import logger from "./logger.js";

const ALGO = "aes-256-gcm";

const resolveKey = () => {
  if (env.ENCRYPTION_KEY && /^[0-9a-fA-F]{64}$/.test(env.ENCRYPTION_KEY)) {
    return Buffer.from(env.ENCRYPTION_KEY, "hex");
  }
  if (env.isProd) throw new Error("ENCRYPTION_KEY manquant ou invalide en production.");
  logger.warn("ENCRYPTION_KEY absent : dérivation d'une clé de développement depuis JWT_SECRET.");
  return crypto.createHash("sha256").update(`eduflow-dev:${env.JWT_SECRET}`).digest();
};

const key = resolveKey();

/** Chiffre une chaine (AES-256-GCM). Retourne "iv.tag.ciphertext" en base64url. */
export const encrypt = (plaintext) => {
  if (plaintext == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
};

/** Dechiffre une valeur produite par encrypt(). Retourne null si illisible. */
export const decrypt = (payload) => {
  if (!payload) return null;
  try {
    const [ivB64, tagB64, dataB64] = String(payload).split(".");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
};

/** Hash SHA-256 en hex - utilise pour indexer les refresh tokens sans les stocker en clair. */
export const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

export const randomToken = (bytes = 48) => crypto.randomBytes(bytes).toString("base64url");
