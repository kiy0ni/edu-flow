/** Formatage des dates, durees et nombres, en francais. */

export const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const versDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const ajouterJours = (iso: string, jours: number) => {
  const d = versDate(iso);
  d.setDate(d.getDate() + jours);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const debutSemaine = (iso: string) => ajouterJours(iso, -((versDate(iso).getDay() + 6) % 7));
export const finSemaine = (iso: string) => ajouterJours(debutSemaine(iso), 6);

export const ecartJours = (a: string, b: string) =>
  Math.round((versDate(b).getTime() - versDate(a).getTime()) / 86_400_000);

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", options);

export const dateCourte = (iso: string) => fmt({ day: "numeric", month: "short" }).format(versDate(iso));
export const dateLongue = (iso: string) =>
  fmt({ weekday: "long", day: "numeric", month: "long" }).format(versDate(iso));
export const dateComplete = (iso: string) =>
  fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(versDate(iso));
export const jourCourt = (iso: string) => fmt({ weekday: "short" }).format(versDate(iso));
export const numeroJour = (iso: string) => versDate(iso).getDate();

/** "dans 3 jours", "hier", "aujourd'hui"... */
export const relatif = (iso: string) => {
  const delta = ecartJours(aujourdhui(), iso);
  if (delta === 0) return "aujourd'hui";
  if (delta === 1) return "demain";
  if (delta === -1) return "hier";
  if (delta > 1 && delta <= 7) return `dans ${delta} jours`;
  if (delta < -1 && delta >= -7) return `il y a ${-delta} jours`;
  return dateCourte(iso);
};

export const horodatage = (iso: string) => {
  const d = new Date(iso);
  const minutes = Math.round((Date.now() - d.getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 1440) return `il y a ${Math.floor(minutes / 60)} h`;
  return fmt({ day: "numeric", month: "short" }).format(d);
};

export const duree = (minutes: number) => {
  if (!minutes) return "0 min";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
};

export const octets = (n: number | null) => {
  if (!n) return "-";
  const unites = ["o", "Ko", "Mo", "Go"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < unites.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${unites[i]}`;
};

export const note = (v: number | null, decimales = 2) =>
  v === null || v === undefined ? "—" : v.toFixed(decimales).replace(/\.?0+$/, "").replace(".", ",");

export const signe = (v: number | null) => {
  if (v === null || v === undefined) return "—";
  const s = note(Math.abs(v), 2);
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : "0";
};

export const initiales = (prenom: string, nom: string) =>
  `${prenom?.[0] ?? ""}${nom?.[0] ?? ""}`.toUpperCase() || "?";

/**
 * Majuscule sur la première lettre seulement.
 * `capitalize` en CSS met une majuscule à chaque mot (« Mardi 1 Septembre »),
 * et `::first-letter` ne s'applique qu'aux éléments de type bloc : aucun des
 * deux ne convient pour une date insérée dans une phrase.
 */
export const capitaliser = (texte: string) => (texte ? texte.charAt(0).toUpperCase() + texte.slice(1) : texte);
