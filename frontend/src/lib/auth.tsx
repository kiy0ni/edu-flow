import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, post, setAccessToken, onDeconnexion, ErreurApi } from "./api";
import type { Utilisateur } from "./types";

interface Propositions {
  question: string;
  propositions: { valeur: string; libelle: string }[];
  challenge: string;
}

interface ContexteAuth {
  utilisateur: Utilisateur | null;
  chargement: boolean;
  defi: Propositions | null;
  connexion: (id: { source: string; identifiant: string; motdepasse: string }) => Promise<void>;
  repondreDefi: (reponse: string) => Promise<void>;
  annulerDefi: () => void;
  deconnexion: () => Promise<void>;
  rafraichirUtilisateur: () => Promise<void>;
}

const Contexte = createContext<ContexteAuth | null>(null);

/**
 * Marqueur de session.
 * Le jeton de rafraîchissement est un cookie httpOnly, donc invisible depuis
 * le script. Ce drapeau évite de tenter une restauration - et de provoquer une
 * 401 inutile - lorsque l'utilisateur n'a jamais ouvert de session ici.
 */
const MARQUEUR = "eduflow:session";
const aUneSession = () => {
  try {
    return localStorage.getItem(MARQUEUR) === "1";
  } catch {
    return true; // stockage indisponible : on tente quand même.
  }
};
const marquerSession = (actif: boolean) => {
  try {
    if (actif) localStorage.setItem(MARQUEUR, "1");
    else localStorage.removeItem(MARQUEUR);
  } catch {
    /* sans stockage, on se contente de la session en cours */
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(true);
  const [defi, setDefi] = useState<Propositions | null>(null);

  // Au demarrage, on tente de restaurer la session depuis le cookie de refresh.
  useEffect(() => {
    if (!aUneSession()) {
      setChargement(false);
      return;
    }
    let annule = false;
    (async () => {
      try {
        const data = await api<{ accessToken: string; utilisateur: Utilisateur }>("/auth/refresh", {
          method: "POST",
          reessayer: false,
        });
        if (annule) return;
        setAccessToken(data.accessToken);
        setUtilisateur(data.utilisateur);
      } catch {
        if (!annule) {
          setUtilisateur(null);
          marquerSession(false);
        }
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  useEffect(() => {
    onDeconnexion(() => {
      setUtilisateur(null);
      marquerSession(false);
    });
  }, []);

  const appliquer = (data: { accessToken: string; utilisateur: Utilisateur }) => {
    setAccessToken(data.accessToken);
    setUtilisateur(data.utilisateur);
    setDefi(null);
    marquerSession(true);
  };

  const connexion = useCallback(async (identifiants: { source: string; identifiant: string; motdepasse: string }) => {
    try {
      appliquer(await post("/auth/login", identifiants));
    } catch (err) {
      // École Directe peut exiger une verification supplementaire par QCM.
      if (err instanceof ErreurApi && err.code === "double_auth_requise" && err.contexte) {
        setDefi(err.contexte as Propositions);
        return;
      }
      throw err;
    }
  }, []);

  const repondreDefi = useCallback(
    async (reponse: string) => {
      if (!defi) return;
      appliquer(await post("/auth/double-auth", { challenge: defi.challenge, reponse }));
    },
    [defi],
  );

  const deconnexion = useCallback(async () => {
    await post("/auth/logout").catch(() => {});
    setAccessToken(null);
    setUtilisateur(null);
    marquerSession(false);
  }, []);

  const rafraichirUtilisateur = useCallback(async () => {
    const data = await api<{ utilisateur: Utilisateur }>("/auth/me");
    setUtilisateur(data.utilisateur);
  }, []);

  const valeur = useMemo(
    () => ({
      utilisateur,
      chargement,
      defi,
      connexion,
      repondreDefi,
      annulerDefi: () => setDefi(null),
      deconnexion,
      rafraichirUtilisateur,
    }),
    [utilisateur, chargement, defi, connexion, repondreDefi, deconnexion, rafraichirUtilisateur],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(Contexte);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider.");
  return ctx;
};
