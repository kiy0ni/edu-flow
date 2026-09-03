import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { get } from "../lib/api";
import { useTheme } from "../lib/theme";
import { Pastille, cx } from "./ui";
import { Icone } from "../lib/icones";

interface Resultat {
  type: "devoir" | "note" | "cours" | "message" | "document" | "actualite";
  id: string;
  titre: string;
  detail: string;
  couleur?: { clair: string; sombre: string } | null;
  cible: string;
}

const LIBELLES: Record<Resultat["type"], string> = {
  devoir: "Devoirs",
  note: "Notes",
  cours: "Emploi du temps",
  message: "Messages",
  document: "Documents",
  actualite: "Actualités",
};

const ICONES: Record<Resultat["type"], string> = {
  devoir: "devoirs",
  note: "notes",
  cours: "calendrier",
  message: "message",
  document: "dossier",
  actualite: "megaphone",
};

/** Raccourcis proposés quand le champ est vide. */
const RACCOURCIS = [
  { libelle: "Emploi du temps", cible: "/emploi-du-temps", icone: "calendrier" },
  { libelle: "Mes devoirs", cible: "/devoirs", icone: "devoirs" },
  { libelle: "Mes notes", cible: "/notes", icone: "notes" },
  { libelle: "Planifier ma semaine", cible: "/planificateur", icone: "boussole" },
  { libelle: "Réviser mes cartes", cible: "/revisions", icone: "cartes" },
  { libelle: "Analyses", cible: "/analyses", icone: "analyse" },
];

export const Recherche = ({ ouverte, onFermer }: { ouverte: boolean; onFermer: () => void }) => {
  const navigate = useNavigate();
  const { couleur } = useTheme();
  const [terme, setTerme] = useState("");
  const [actif, setActif] = useState(0);
  const champ = useRef<HTMLInputElement>(null);

  // La requête n'est lancée qu'à partir de deux caractères, et temporisée :
  // inutile d'interroger le serveur à chaque frappe.
  const [differe, setDiffere] = useState("");
  useEffect(() => {
    const minuteur = setTimeout(() => setDiffere(terme.trim()), 180);
    return () => clearTimeout(minuteur);
  }, [terme]);

  const { data, isFetching } = useQuery({
    queryKey: ["recherche", differe],
    queryFn: () => get<{ resultats: Resultat[]; total: number }>(`/recherche?q=${encodeURIComponent(differe)}`),
    enabled: ouverte && differe.length >= 2,
    staleTime: 30_000,
  });

  const resultats = differe.length >= 2 ? (data?.resultats ?? []) : [];

  const groupes = useMemo(() => {
    const map = new Map<Resultat["type"], Resultat[]>();
    for (const r of resultats) {
      if (!map.has(r.type)) map.set(r.type, []);
      map.get(r.type)!.push(r);
    }
    return [...map.entries()];
  }, [resultats]);

  const aplati = useMemo(() => groupes.flatMap(([, liste]) => liste), [groupes]);
  const nbChoix = differe.length >= 2 ? aplati.length : RACCOURCIS.length;

  useEffect(() => {
    if (ouverte) {
      setTerme("");
      setDiffere("");
      setActif(0);
      setTimeout(() => champ.current?.focus(), 30);
    }
  }, [ouverte]);

  useEffect(() => setActif(0), [differe]);

  const ouvrir = (cible: string) => {
    navigate(cible);
    onFermer();
  };

  const auClavier = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActif((i) => (nbChoix ? (i + 1) % nbChoix : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActif((i) => (nbChoix ? (i - 1 + nbChoix) % nbChoix : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cible = differe.length >= 2 ? aplati[actif]?.cible : RACCOURCIS[actif]?.cible;
      if (cible) ouvrir(cible);
    } else if (e.key === "Escape") {
      onFermer();
    }
  };

  if (!ouverte) return null;

  let index = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[color-mix(in_srgb,var(--ink)_28%,transparent)] px-4 pt-[10vh] backdrop-blur-[2px]"
      onClick={onFermer}
      role="dialog"
      aria-modal="true"
      aria-label="Recherche"
    >
      <div
        className="apparition w-full max-w-xl overflow-hidden rounded-[var(--radius-card)] border border-trait bg-surface shadow-[var(--shadow-modale)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-trait px-4">
          <Icone nom="recherche" taille={17} className="shrink-0 text-ink-muted" />
          <input
            ref={champ}
            value={terme}
            onChange={(e) => setTerme(e.target.value)}
            onKeyDown={auClavier}
            placeholder="Rechercher un devoir, une note, un message, un document..."
            className="flex-1 bg-transparent py-3.5 text-[0.9rem] text-ink placeholder:text-ink-muted focus:outline-none"
          />
          {isFetching && <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-trait-fort border-t-accent" />}
          <kbd className="shrink-0 rounded border border-trait px-1.5 py-0.5 text-[0.68rem] text-ink-muted">esc</kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-1.5">
          {differe.length < 2 ? (
            <>
              <p className="px-2.5 py-1.5 text-[0.68rem] font-semibold tracking-wider text-ink-muted uppercase">
                Accès rapide
              </p>
              {RACCOURCIS.map((r, i) => (
                <button
                  key={r.cible}
                  onMouseEnter={() => setActif(i)}
                  onClick={() => ouvrir(r.cible)}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left",
                    actif === i ? "bg-accent-doux" : "hover:bg-surface-hover",
                  )}
                >
                  <Icone nom={r.icone} taille={15} className="shrink-0 text-ink-muted" />
                  <span className="text-[0.85rem] text-ink">{r.libelle}</span>
                </button>
              ))}
            </>
          ) : resultats.length === 0 ? (
            <p className="px-3 py-8 text-center text-[0.85rem] text-ink-muted">
              {isFetching ? "Recherche..." : `Aucun résultat pour « ${differe} ».`}
            </p>
          ) : (
            groupes.map(([type, liste]) => (
              <div key={type}>
                <p className="px-2.5 pt-2 pb-1 text-[0.68rem] font-semibold tracking-wider text-ink-muted uppercase">
                  {LIBELLES[type]}
                </p>
                {liste.map((r) => {
                  index += 1;
                  const i = index;
                  return (
                    <button
                      key={`${r.type}-${r.id}`}
                      onMouseEnter={() => setActif(i)}
                      onClick={() => ouvrir(r.cible)}
                      className={cx(
                        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left",
                        actif === i ? "bg-accent-doux" : "hover:bg-surface-hover",
                      )}
                    >
                      {r.couleur ? (
                        <Pastille couleur={couleur(r.couleur)} />
                      ) : (
                        <Icone nom={ICONES[r.type]} taille={15} className="shrink-0 text-ink-muted" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.85rem] text-ink">{r.titre}</span>
                        <span className="block truncate text-[0.75rem] text-ink-muted">{r.detail}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-trait px-4 py-2 text-[0.72rem] text-ink-muted">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-trait px-1">↑</kbd>
            <kbd className="rounded border border-trait px-1">↓</kbd> naviguer
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-trait px-1">↵</kbd> ouvrir
          </span>
          {data && differe.length >= 2 && <span className="ml-auto">{data.total} résultat(s)</span>}
        </div>
      </div>
    </div>
  );
};

/** Ouvre la palette avec Cmd+K / Ctrl+K depuis n'importe quel écran. */
export const useRaccourciRecherche = (ouvrir: () => void) => {
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ouvrir();
      }
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouvrir]);
};

export default Recherche;
