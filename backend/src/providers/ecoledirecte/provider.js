import { call, decodeB64, encodeB64 } from "./client.js";
import * as map from "./mappers.js";
import { addDays, today } from "../../lib/dates.js";
import { unauthorized, notFound } from "../../lib/errors.js";

/**
 * Provider École Directe.
 *
 * `ctx` contient { compteId, token, meta } ; comme le jeton tourne a chaque
 * appel, chaque methode remonte le nouveau jeton via `ctx.onToken`.
 */

const withToken = async (ctx, path, options = {}) => {
  if (!ctx?.token) throw unauthorized("Session École Directe absente.");
  const res = await call(path, { ...options, token: ctx.token });
  if (res.token && res.token !== ctx.token) {
    ctx.token = res.token;
    await ctx.onToken?.(res.token);
  }
  return res.data;
};

const base = (ctx) => `/v3/Eleves/${ctx.compteId}`;

export const ecoleDirecteProvider = {
  nom: "ecoledirecte",
  libelle: "École Directe",

  /**
   * Connexion. Gere la double authentification par QCM :
   *  - sans reponse memorisee, remonte une erreur `double_auth_requise`
   *    accompagnee de la question a poser a l'utilisateur ;
   *  - avec un couple {cn, cv} memorise, l'injecte directement.
   */
  async authenticate({ identifiant, motdepasse, doubleAuth = null }) {
    const data = {
      identifiant,
      motdepasse,
      isReLogin: false,
      uuid: "",
      ...(doubleAuth ? { fa: [{ cn: doubleAuth.cn, cv: doubleAuth.cv }] } : {}),
    };

    const res = await call("/v3/login.awp", { data, params: { verbe: "post" } });
    const compte = res.data?.accounts?.[0];
    if (!compte || !res.token) throw unauthorized("Réponse inattendue d'École Directe.");

    return {
      compteId: String(compte.id),
      token: res.token,
      profil: map.mapProfil(compte),
      meta: {
        typeCompte: compte.typeCompte ?? null,
        idLogin: compte.idLogin ?? null,
        ...(doubleAuth ? { doubleAuth } : {}),
      },
    };
  },

  /** Recupere le QCM de double authentification (question + propositions). */
  async getQcm(tokenTemporaire) {
    const res = await call("/v3/connexion/doubleauth.awp", {
      data: {},
      params: { verbe: "get" },
      token: tokenTemporaire,
    });
    return {
      token: res.token,
      question: decodeB64(res.data?.question),
      propositions: (res.data?.propositions ?? []).map((p) => ({ valeur: p, libelle: decodeB64(p) })),
    };
  },

  /** Valide une reponse au QCM et renvoie le couple {cn, cv} a memoriser. */
  async postQcm(tokenTemporaire, propositionEncodee) {
    const res = await call("/v3/connexion/doubleauth.awp", {
      data: { choix: propositionEncodee },
      params: { verbe: "post" },
      token: tokenTemporaire,
    });
    if (!res.data?.cn || !res.data?.cv) throw unauthorized("Réponse au QCM incorrecte.");
    return { cn: res.data.cn, cv: res.data.cv };
  },

  async getProfil(ctx) {
    const data = await withToken(ctx, `/v3/E/${ctx.compteId}/infosgenerales.awp`, {
      data: {},
      params: { verbe: "get" },
    });
    return map.mapProfil(data ?? {});
  },

  async getPeriodes(ctx) {
    const data = await withToken(ctx, `${base(ctx)}/notes.awp`, {
      data: { anneeScolaire: "" },
      params: { verbe: "get" },
    });
    return map.mapPeriodes(data?.periodes ?? []);
  },

  async getMatieres(ctx) {
    const data = await withToken(ctx, `${base(ctx)}/notes.awp`, {
      data: { anneeScolaire: "" },
      params: { verbe: "get" },
    });
    return map.mapNotes(data ?? {}).matieres;
  },

  async getVacances() {
    // Non expose par l'API : les trous de l'emploi du temps suffisent cote client.
    return [];
  },

  async getEmploiDuTemps(ctx, { from = today(), to = addDays(today(), 7) } = {}) {
    const data = await withToken(ctx, `/v3/E/${ctx.compteId}/emploidutemps.awp`, {
      data: { dateDebut: from, dateFin: to, avecTrous: false },
      params: { verbe: "get" },
    });
    return map.mapEmploiDuTemps(data ?? []);
  },

  async getNotes(ctx) {
    const data = await withToken(ctx, `${base(ctx)}/notes.awp`, {
      data: { anneeScolaire: "" },
      params: { verbe: "get" },
    });
    return map.mapNotes(data ?? {});
  },

  /**
   * Le cahier de texte se recupere en deux temps : la liste des dates ayant du
   * travail, puis le detail jour par jour. On limite la fenetre demandee.
   */
  async getDevoirs(ctx, { from = today(), to = addDays(today(), 21) } = {}) {
    const index = await withToken(ctx, `${base(ctx)}/cahierdetexte.awp`, {
      data: {},
      params: { verbe: "get" },
    });

    const dates = Object.keys(index ?? {})
      .filter((d) => d >= from && d <= to)
      .sort()
      .slice(0, 30);

    const details = await Promise.all(
      dates.map(async (date) => {
        try {
          const jour = await withToken(ctx, `${base(ctx)}/cahierdetexte/${date}.awp`, {
            data: {},
            params: { verbe: "get" },
          });
          return [date, jour?.matieres ?? []];
        } catch {
          return [date, index[date] ?? []];
        }
      }),
    );

    return map.mapDevoirs(Object.fromEntries(details));
  },

  async getVieScolaire(ctx) {
    const data = await withToken(ctx, `${base(ctx)}/viescolaire.awp`, {
      data: {},
      params: { verbe: "get" },
    });
    return map.mapVieScolaire(data ?? {});
  },

  async getMessages(ctx, { dossier = "reception" } = {}) {
    const data = await withToken(ctx, `${base(ctx)}/messages.awp`, {
      data: {},
      params: {
        verbe: "get",
        typeRecuperation: dossier === "envoyes" ? "sent" : "received",
        orderBy: "date",
        order: "desc",
        page: 0,
        itemsPerPage: 50,
      },
    });
    return map.mapMessages(data ?? {}, dossier).map(({ corps, ...reste }) => reste);
  },

  async getMessage(ctx, id) {
    const brut = String(id).replace(/^ed-msg-/, "");
    const data = await withToken(ctx, `${base(ctx)}/messages/${brut}.awp`, {
      data: {},
      params: { verbe: "get", mode: "destinataire" },
    });
    if (!data) throw notFound("Message introuvable.");
    const [message] = map.mapMessages({ messages: { received: [data] } });
    return message;
  },

  async getDocuments(ctx) {
    const data = await withToken(ctx, `/v3/elicencesbrowse/${ctx.compteId}/documents.awp`, {
      data: {},
      params: { verbe: "get" },
    });
    return map.mapDocuments(data ?? {});
  },

  async getActualites(ctx) {
    const data = await withToken(ctx, `/v3/E/${ctx.compteId}/viedeletablissement.awp`, {
      data: {},
      params: { verbe: "get" },
    });
    return map.mapActualites(data ?? {});
  },
};

export { encodeB64 };
export default ecoleDirecteProvider;
