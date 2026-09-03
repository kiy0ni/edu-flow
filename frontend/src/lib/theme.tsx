import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Teinte } from "./types";

type Theme = "light" | "dark" | "system";
const CLE = "eduflow:thème";

interface ContexteTheme {
  theme: Theme;
  sombre: boolean;
  setTheme: (t: Theme) => void;
  /** Resout un couple de teintes vers la valeur du theme actif. */
  couleur: (t: Teinte | string | null | undefined) => string;
}

const Contexte = createContext<ContexteTheme | null>(null);

const lireTheme = (): Theme => {
  try {
    const v = localStorage.getItem(CLE);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeEtat] = useState<Theme>(lireTheme);
  const [systemeSombre, setSystemeSombre] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const surChangement = (e: MediaQueryListEvent) => setSystemeSombre(e.matches);
    mq.addEventListener("change", surChangement);
    return () => mq.removeEventListener("change", surChangement);
  }, []);

  useEffect(() => {
    const racine = document.documentElement;
    if (theme === "system") delete racine.dataset.theme;
    else racine.dataset.theme = theme;
    try {
      localStorage.setItem(CLE, theme);
    } catch {
      /* stockage indisponible : le theme reste valable pour la session */
    }
  }, [theme]);

  const sombre = theme === "dark" || (theme === "system" && systemeSombre);

  const valeur = useMemo<ContexteTheme>(
    () => ({
      theme,
      sombre,
      setTheme: setThemeEtat,
      couleur: (t) => {
        if (!t) return "var(--ink-muted)";
        if (typeof t === "string") return t;
        return sombre ? t.sombre : t.clair;
      },
    }),
    [theme, sombre],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(Contexte);
  if (!ctx) throw new Error("useTheme doit être utilisé dans ThemeProvider.");
  return ctx;
};
