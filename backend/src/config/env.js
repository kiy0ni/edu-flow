import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const bool = (def) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? def : v === "true" || v === "1"));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL est requis"),
  DATABASE_SSL: bool(false),

  JWT_SECRET: z.string().min(1),
  JWT_ACCESS_TTL: z.string().default("30m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  ENCRYPTION_KEY: z.string().optional(),

  ECOLEDIRECTE_API_BASE_URL: z.string().url().default("https://api.ecoledirecte.com"),
  ECOLEDIRECTE_API_VERSION: z.string().default("4.75.0"),
  ALLOW_DEMO_ACCOUNTS: bool(true),

  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-opus-5"),
  AI_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).default("medium"),
  AI_DAILY_MESSAGE_LIMIT: z.coerce.number().int().positive().default(80),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  console.error(`Configuration invalide :\n${details}\n\nCopiez backend/.env.example vers backend/.env et completez-le.`);
  process.exit(1);
}

const raw = parsed.data;

if (raw.NODE_ENV === "production") {
  if (raw.JWT_SECRET.length < 32) {
    console.error("JWT_SECRET doit faire au moins 32 caractères en production.");
    process.exit(1);
  }
  if (!raw.ENCRYPTION_KEY || raw.ENCRYPTION_KEY.length !== 64) {
    console.error("ENCRYPTION_KEY (64 caractères hex) est requis en production.");
    process.exit(1);
  }
}

export const env = {
  ...raw,
  corsOrigins: raw.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
  isProd: raw.NODE_ENV === "production",
  isDev: raw.NODE_ENV === "development",
  aiEnabled: Boolean(raw.ANTHROPIC_API_KEY),
};

export default env;
