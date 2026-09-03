import { AppError } from "../lib/errors.js";
import logger from "../lib/logger.js";
import env from "../config/env.js";

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    erreur: { code: "not_found", message: `Route inconnue : ${req.method} ${req.originalUrl}` },
  });
};

/* eslint-disable no-unused-vars */
export const errorHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error({ err }, err.message);
    else logger.debug({ code: err.code, path: req.originalUrl }, err.message);

    return res.status(err.status).json({
      erreur: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
        ...(err.payload ? { contexte: err.payload } : {}),
      },
    });
  }

  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ erreur: { code: "json_invalide", message: "Corps JSON illisible." } });
  }

  logger.error({ err, path: req.originalUrl }, "Erreur non geree");
  res.status(500).json({
    erreur: {
      code: "erreur_interne",
      message: "Une erreur interne est survenue.",
      ...(env.isProd ? {} : { debug: err?.message }),
    },
  });
};
