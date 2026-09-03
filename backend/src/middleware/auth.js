import { verifyToken } from "../lib/tokens.js";
import { queryOne } from "../lib/db.js";
import { unauthorized, forbidden } from "../lib/errors.js";

/** Exige un jeton d'accès valide et charge l'utilisateur correspondant. */
export const requireAuth = async (req, _res, next) => {
  try {
    const header = req.headers.authorization ?? "";
    if (!header.startsWith("Bearer ")) throw unauthorized("Jeton d'accès manquant.");

    const payload = verifyToken(header.slice(7), "access");
    const user = await queryOne("SELECT * FROM users WHERE id = $1", [payload.sub]);
    if (!user) throw unauthorized("Compte introuvable.");

    req.user = user;
    req.auth = payload;
    next();
  } catch (err) {
    next(err);
  }
};

/** Restreint une route a certains roles. */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.role)) return next(forbidden("Rôle insuffisant pour cette action."));
  next();
};
