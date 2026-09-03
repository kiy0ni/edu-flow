import { getProvider, buildContext } from "./index.js";
import { cached, invalidate } from "../lib/cache.js";
import { today, addDays } from "../lib/dates.js";

/**
 * Passerelle unique vers les donnees de l'etablissement.
 * Tout le reste de l'application passe par ici : les modules metier ignorent
 * quel provider est actif et beneficient automatiquement du cache.
 */

const TTL = {
  profil: 3600,
  periodes: 3600,
  matieres: 3600,
  emploiDuTemps: 900,
  notes: 600,
  devoirs: 600,
  vieScolaire: 1800,
  messages: 300,
  documents: 3600,
  actualites: 1800,
  vacances: 86_400,
};

const appel = (user, ressource, cle, fn) =>
  cached(user.id, `${user.provider}:${cle}`, TTL[ressource], async () => {
    const provider = getProvider(user.provider);
    return fn(provider, buildContext(user));
  });

export const gateway = {
  profil: (user) => appel(user, "profil", "profil", (p, ctx) => p.getProfil(ctx)),

  periodes: (user) => appel(user, "periodes", "periodes", (p, ctx) => p.getPeriodes(ctx)),

  matieres: (user) => appel(user, "matieres", "matieres", (p, ctx) => p.getMatieres(ctx)),

  vacances: (user) => appel(user, "vacances", "vacances", (p, ctx) => p.getVacances(ctx)),

  emploiDuTemps: (user, { from = today(), to = addDays(today(), 7) } = {}) =>
    appel(user, "emploiDuTemps", `edt:${from}:${to}`, (p, ctx) => p.getEmploiDuTemps(ctx, { from, to })),

  notes: (user, { periode = "annee" } = {}) =>
    appel(user, "notes", `notes:${periode}`, (p, ctx) => p.getNotes(ctx, { periode })),

  devoirs: (user, { from = addDays(today(), -14), to = addDays(today(), 30) } = {}) =>
    appel(user, "devoirs", `devoirs:${from}:${to}`, (p, ctx) => p.getDevoirs(ctx, { from, to })),

  vieScolaire: (user, { from, to } = {}) =>
    appel(user, "vieScolaire", `viescolaire:${from ?? "*"}:${to ?? "*"}`, (p, ctx) =>
      p.getVieScolaire(ctx, { from, to }),
    ),

  messages: (user, { dossier = "reception" } = {}) =>
    appel(user, "messages", `messages:${dossier}`, (p, ctx) => p.getMessages(ctx, { dossier })),

  message: (user, id) => appel(user, "messages", `message:${id}`, (p, ctx) => p.getMessage(ctx, id)),

  documents: (user) => appel(user, "documents", "documents", (p, ctx) => p.getDocuments(ctx)),

  actualites: (user) => appel(user, "actualites", "actualites", (p, ctx) => p.getActualites(ctx)),

  /** Force le rechargement d'une famille de donnees. */
  rafraichir: (user, prefixe = "") => invalidate(user.id, `${user.provider}:${prefixe}`),
};

export default gateway;
