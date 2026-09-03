/** Utilitaires de dates - tout est manipule en "YYYY-MM-DD" (heure locale scolaire). */

export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const toISODate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const parseISODate = (iso) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (iso, days) => {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

export const today = () => toISODate(new Date());

/** Lundi de la semaine contenant `iso`. */
export const startOfWeek = (iso) => {
  const d = parseISODate(iso);
  const shift = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - shift);
  return toISODate(d);
};

export const endOfWeek = (iso) => addDays(startOfWeek(iso), 6);

/** Nombre de jours entiers entre deux dates ISO (b - a). */
export const daysBetween = (a, b) =>
  Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);

export const eachDay = (from, to) => {
  const out = [];
  for (let d = from; daysBetween(d, to) >= 0; d = addDays(d, 1)) out.push(d);
  return out;
};

/** "HH:MM" -> minutes depuis minuit. */
export const timeToMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + (m || 0);
};

export const minutesToTime = (minutes) => {
  const m = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Annee scolaire courante, ex: 2025 pour l'annee 2025-2026. */
export const schoolYearStart = (iso = today()) => {
  const d = parseISODate(iso);
  return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
};

export const frDay = (iso) =>
  ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"][parseISODate(iso).getDay()];

/**
 * Date en toutes lettres, pour les libellés et les documents.
 * `format` vaut "long" (12 septembre 2026) ou "court" (12 sept.).
 */
export const dateFr = (iso, format = "long") =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: format === "court" ? "short" : "long",
    ...(format === "long" ? { year: "numeric" } : {}),
  }).format(parseISODate(iso));
