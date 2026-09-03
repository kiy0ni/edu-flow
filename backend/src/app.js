import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";

import env from "./config/env.js";
import logger from "./lib/logger.js";
import apiRouter from "./routes/index.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { pool } from "./lib/db.js";

export const createApp = () => {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(compression());
  app.use(
    cors({
      // Une origine refusee n'est pas une panne : on repond simplement sans
      // en-tete CORS, le navigateur bloquera de lui-meme. Lever une exception
      // ici produirait une 500 et polluerait les journaux.
      origin: (origin, callback) => callback(null, !origin || env.corsOrigins.includes(origin)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/api/v1/sante" },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
    }),
  );

  app.get("/api/v1/sante", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ statut: "ok", base: "connectee", ia: env.aiEnabled, horodatage: new Date().toISOString() });
    } catch {
      res.status(503).json({ statut: "degrade", base: "injoignable" });
    }
  });

  app.use("/api/v1", apiLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;
