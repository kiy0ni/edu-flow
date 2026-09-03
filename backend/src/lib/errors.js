/** Erreur applicative portant un code HTTP et un code metier stable. */
export class AppError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.expected = true;
  }
}

export const badRequest = (msg, details) => new AppError(400, "bad_request", msg, details);
export const unauthorized = (msg = "Authentification requise.") => new AppError(401, "unauthorized", msg);
export const forbidden = (msg = "Accès refuse.") => new AppError(403, "forbidden", msg);
export const notFound = (msg = "Ressource introuvable.") => new AppError(404, "not_found", msg);
export const conflict = (msg) => new AppError(409, "conflict", msg);
export const tooManyRequests = (msg) => new AppError(429, "too_many_requests", msg);
export const upstreamError = (msg, details) => new AppError(502, "upstream_error", msg, details);
export const unavailable = (msg) => new AppError(503, "service_unavailable", msg);

/** Enrobe un handler async pour router les rejets vers le middleware d'erreur. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
