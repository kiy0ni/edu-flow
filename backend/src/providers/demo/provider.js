import { buildDataset, COMPTE_DEMO } from "./dataset.js";
import { daysBetween } from "../../lib/dates.js";
import { unauthorized, notFound } from "../../lib/errors.js";

const inRange = (iso, from, to) =>
  (!from || daysBetween(from, iso) >= 0) && (!to || daysBetween(iso, to) >= 0);

/**
 * Provider de demonstration.
 * Expose exactement le meme contrat que le provider École Directe, sur des
 * donnees fictives deterministes : l'application est utilisable de bout en bout
 * sans aucun identifiant reel.
 */
export const demoProvider = {
  nom: "demo",
  libelle: "Compte de démonstration",

  /** Authentifie le compte de demonstration. */
  async authenticate({ identifiant, motdepasse }) {
    const idOk = String(identifiant).trim().toLowerCase() === COMPTE_DEMO.identifiant;
    if (!idOk || motdepasse !== COMPTE_DEMO.motdepasse) {
      throw unauthorized("Identifiants de démonstration invalides (essayez demo / demo).");
    }
    const { profil } = buildDataset(COMPTE_DEMO);
    return {
      compteId: COMPTE_DEMO.id,
      token: null,
      profil,
      meta: { demo: true },
    };
  },

  async getProfil(ctx) {
    return buildDataset(this._compte(ctx)).profil;
  },

  async getPeriodes(ctx) {
    return buildDataset(this._compte(ctx)).periodes;
  },

  async getMatieres(ctx) {
    return buildDataset(this._compte(ctx)).matieres;
  },

  async getVacances(ctx) {
    return buildDataset(this._compte(ctx)).vacances;
  },

  async getEmploiDuTemps(ctx, { from, to } = {}) {
    return buildDataset(this._compte(ctx)).emploiDuTemps.filter((e) => inRange(e.date, from, to));
  },

  async getNotes(ctx, { periode } = {}) {
    const data = buildDataset(this._compte(ctx));
    const notes = periode && periode !== "annee"
      ? data.notes.filter((n) => n.periodeCode === periode)
      : data.notes;
    return { notes, periodes: data.periodes, matieres: data.matieres };
  },

  async getDevoirs(ctx, { from, to } = {}) {
    return buildDataset(this._compte(ctx)).devoirs.filter((d) => inRange(d.dueDate, from, to));
  },

  async getVieScolaire(ctx, { from, to } = {}) {
    return buildDataset(this._compte(ctx)).vieScolaire.filter((v) => inRange(v.date, from, to));
  },

  async getMessages(ctx, { dossier = "reception" } = {}) {
    return buildDataset(this._compte(ctx))
      .messages.filter((m) => m.dossier === dossier)
      .map(({ corps, ...reste }) => reste);
  },

  async getMessage(ctx, id) {
    const message = buildDataset(this._compte(ctx)).messages.find((m) => m.id === id);
    if (!message) throw notFound("Message introuvable.");
    return message;
  },

  async getDocuments(ctx) {
    return buildDataset(this._compte(ctx)).documents;
  },

  async getActualites(ctx) {
    return buildDataset(this._compte(ctx)).actualites;
  },

  /** Le compte de demonstration est unique ; on garde la signature pour l'homogeneite. */
  _compte() {
    return COMPTE_DEMO;
  },
};

export default demoProvider;
