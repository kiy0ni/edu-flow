import { z } from "zod";
import { badRequest } from "./errors.js";

/**
 * Booleen issu d'une query string.
 * `z.coerce.boolean()` applique Boolean(valeur) : la chaine "false" vaudrait
 * donc `true`. On interprete explicitement les formes textuelles usuelles.
 */
export const booleanQuery = (defaut = false) =>
  z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return defaut;
      if (typeof v === "boolean") return v;
      return ["true", "1", "oui", "yes"].includes(v.toLowerCase());
    });

const formatIssues = (error) =>
  error.issues.map((issue) => ({
    champ: issue.path.join(".") || "(racine)",
    message: issue.message,
  }));

const run = (schema, value, label) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw badRequest(`Données ${label} invalides.`, formatIssues(result.error));
  }
  return result.data;
};

/** Middleware de validation du corps de requete. */
export const validateBody = (schema) => (req, _res, next) => {
  try {
    req.body = run(schema, req.body ?? {}, "du corps de la requête");
    next();
  } catch (err) {
    next(err);
  }
};

/** Middleware de validation de la query string. */
export const validateQuery = (schema) => (req, _res, next) => {
  try {
    req.validatedQuery = run(schema, req.query ?? {}, "de la requête");
    next();
  } catch (err) {
    next(err);
  }
};

/** Middleware de validation des parametres de route. */
export const validateParams = (schema) => (req, _res, next) => {
  try {
    req.params = run(schema, req.params ?? {}, "d'URL");
    next();
  } catch (err) {
    next(err);
  }
};

export const parseOrThrow = (schema, value) => run(schema, value, "fournies");
