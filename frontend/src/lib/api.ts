/**
 * Client HTTP de l'API EduFlow.
 *
 * Le jeton d'acces vit en memoire (et non dans localStorage) ; le jeton de
 * rafraichissement est un cookie httpOnly gere par le serveur. Sur 401, une
 * seule tentative de rafraichissement est faite, mutualisee entre les appels
 * concurrents.
 */

const BASE = "/api/v1";

let accessToken: string | null = null;
let rafraichissementEnCours: Promise<boolean> | null = null;
let surDeconnexion: (() => void) | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;
export const onDeconnexion = (cb: () => void) => {
  surDeconnexion = cb;
};

export class ErreurApi extends Error {
  code: string;
  status: number;
  details?: unknown;
  contexte?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown, contexte?: unknown) {
    super(message);
    this.name = "ErreurApi";
    this.status = status;
    this.code = code;
    this.details = details;
    this.contexte = contexte;
  }
}

const rafraichir = async (): Promise<boolean> => {
  rafraichissementEnCours ??= (async () => {
    try {
      const reponse = await fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" });
      if (!reponse.ok) return false;
      const data = await reponse.json();
      accessToken = data.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      // Laisse le temps aux appels concurrents de recuperer le meme resultat.
      setTimeout(() => (rafraichissementEnCours = null), 0);
    }
  })();
  return rafraichissementEnCours;
};

interface Options extends Omit<RequestInit, "body"> {
  body?: unknown;
  reessayer?: boolean;
}

export const api = async <T = unknown>(chemin: string, options: Options = {}): Promise<T> => {
  const { body, reessayer = true, headers, ...reste } = options;

  const reponse = await fetch(`${BASE}${chemin}`, {
    ...reste,
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (reponse.status === 401 && reessayer && chemin !== "/auth/login") {
    if (await rafraichir()) return api<T>(chemin, { ...options, reessayer: false });
    accessToken = null;
    surDeconnexion?.();
  }

  if (reponse.status === 204) return undefined as T;

  const type = reponse.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    if (!reponse.ok) throw new ErreurApi(reponse.status, "erreur", `Erreur ${reponse.status}`);
    return (await reponse.text()) as T;
  }

  const data = await reponse.json();
  if (!reponse.ok) {
    const e = data?.erreur ?? {};
    throw new ErreurApi(reponse.status, e.code ?? "erreur", e.message ?? `Erreur ${reponse.status}`, e.details, e.contexte);
  }
  return data as T;
};

export const get = <T>(chemin: string) => api<T>(chemin);
export const post = <T>(chemin: string, body?: unknown) => api<T>(chemin, { method: "POST", body });
export const patch = <T>(chemin: string, body?: unknown) => api<T>(chemin, { method: "PATCH", body });
export const put = <T>(chemin: string, body?: unknown) => api<T>(chemin, { method: "PUT", body });
export const del = <T>(chemin: string) => api<T>(chemin, { method: "DELETE" });

/**
 * Télécharge un fichier protégé par le jeton d'accès.
 * Un lien direct ne peut pas porter l'en-tête d'autorisation : on récupère donc
 * le contenu puis on déclenche l'enregistrement côté navigateur.
 */
export const telecharger = async (chemin: string, nomParDefaut = "document.pdf") => {
  const reponse = await fetch(`${BASE}${chemin}`, {
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (!reponse.ok) {
    let message = "Téléchargement impossible.";
    try {
      message = (await reponse.json())?.erreur?.message ?? message;
    } catch {
      /* corps non JSON */
    }
    throw new ErreurApi(reponse.status, "telechargement", message);
  }

  const entete = reponse.headers.get("content-disposition") ?? "";
  const nom = /filename="([^"]+)"/.exec(entete)?.[1] ?? nomParDefaut;
  const blob = await reponse.blob();
  const url = URL.createObjectURL(blob);

  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
};

/** Ouvre un fichier protégé dans un nouvel onglet. */
export const ouvrirFichier = async (chemin: string) => {
  const reponse = await fetch(`${BASE}${chemin}`, {
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!reponse.ok) throw new ErreurApi(reponse.status, "ouverture", "Ouverture impossible.");
  const url = URL.createObjectURL(await reponse.blob());
  window.open(url, "_blank", "noopener");
  // Le document reste accessible le temps que l'onglet le charge.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

/**
 * Flux SSE de l'assistant.
 * `fetch` est utilise plutot qu'EventSource pour pouvoir poster un corps
 * et porter l'en-tete d'autorisation.
 */
export const fluxAssistant = async (
  body: { message: string; conversationId?: string },
  gestionnaires: {
    debut?: (d: { conversationId: string }) => void;
    delta?: (d: { texte: string }) => void;
    fin?: (d: unknown) => void;
    erreur?: (d: { message: string }) => void;
  },
  signal?: AbortSignal,
) => {
  const reponse = await fetch(`${BASE}/assistant/chat`, {
    method: "POST",
    credentials: "include",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!reponse.ok || !reponse.body) {
    let message = "L'assistant est indisponible.";
    try {
      message = (await reponse.json())?.erreur?.message ?? message;
    } catch {
      /* corps non JSON */
    }
    gestionnaires.erreur?.({ message });
    return;
  }

  const lecteur = reponse.body.getReader();
  const decodeur = new TextDecoder();
  let tampon = "";

  while (true) {
    const { done, value } = await lecteur.read();
    if (done) break;
    tampon += decodeur.decode(value, { stream: true });

    // Les evenements SSE sont separes par une ligne vide.
    const blocs = tampon.split("\n\n");
    tampon = blocs.pop() ?? "";

    for (const bloc of blocs) {
      const nom = /^event: (.+)$/m.exec(bloc)?.[1];
      const brut = /^data: (.+)$/m.exec(bloc)?.[1];
      if (!nom || !brut) continue;
      const donnees = JSON.parse(brut);
      (gestionnaires as Record<string, ((d: unknown) => void) | undefined>)[nom]?.(donnees);
    }
  }
};
