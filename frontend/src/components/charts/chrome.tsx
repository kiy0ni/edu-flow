import type { ReactNode } from "react";

/**
 * Chrome commun a tous les graphiques.
 *
 * Les series utilisent la palette a deux entrees (--serie-1 : l'eleve,
 * --serie-2 : la classe), validee pour les deux themes et pour les
 * daltonismes courants. Les teintes de matiere ne servent jamais de couleur
 * de serie : elles restent des marqueurs d'identite dans l'interface.
 */

export const SERIE_ELEVE = "var(--serie-1)";
export const SERIE_CLASSE = "var(--serie-2)";

export const axe = {
  stroke: "var(--trait-fort)",
  tick: { fill: "var(--ink-muted)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
};

export const grille = {
  stroke: "var(--grille)",
  strokeDasharray: "0",
  vertical: false,
};

/** Infobulle : encre en jetons de texte, pastille coloree pour l'identite. */
export const Infobulle = ({
  active,
  payload,
  label,
  suffixe = "",
  formatteur,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string; dataKey?: string }[];
  label?: string | number;
  suffixe?: string;
  formatteur?: (v: number | string, nom?: string) => string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-trait bg-surface px-3 py-2 shadow-[var(--shadow-flottant)]">
      {label !== undefined && <p className="mb-1 text-[0.75rem] font-medium text-ink">{label}</p>}
      <ul className="flex flex-col gap-0.5">
        {payload
          .filter((p) => p.value !== null && p.value !== undefined)
          .map((p) => (
            <li key={p.dataKey ?? p.name} className="flex items-center gap-2 text-[0.75rem]">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />
              <span className="text-ink-2">{p.name}</span>
              <span className="ml-auto pl-3 font-medium text-ink tabular-nums">
                {formatteur ? formatteur(p.value!, p.name) : `${p.value}${suffixe}`}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
};

/** Legende explicite : toujours presente des deux series. */
export const Legende = ({ entrees }: { entrees: { libelle: string; couleur: string }[] }) => (
  <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
    {entrees.map((e) => (
      <li key={e.libelle} className="flex items-center gap-1.5 text-[0.75rem] text-ink-2">
        <span aria-hidden="true" className="size-2 rounded-full" style={{ background: e.couleur }} />
        {e.libelle}
      </li>
    ))}
  </ul>
);

export const CadreGraphique = ({
  titre,
  sousTitre,
  legende,
  actions,
  children,
  hauteur = 260,
}: {
  titre: string;
  sousTitre?: string;
  legende?: { libelle: string; couleur: string }[];
  actions?: ReactNode;
  children: ReactNode;
  hauteur?: number;
}) => (
  <figure className="m-0">
    <figcaption className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[0.9rem] font-semibold tracking-tight text-ink">{titre}</p>
        {sousTitre && <p className="mt-0.5 text-[0.78rem] text-ink-muted">{sousTitre}</p>}
      </div>
      <div className="flex items-center gap-3">
        {legende && <Legende entrees={legende} />}
        {actions}
      </div>
    </figcaption>
    <div style={{ height: hauteur }}>{children}</div>
  </figure>
);
