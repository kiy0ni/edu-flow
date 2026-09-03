import { useEffect } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Icone, type NomIcone } from "../lib/icones";
import { useCompteur } from "../hooks/useCompteur";

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ Carte */

interface CarteProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  survol?: boolean;
  /** Balise de rendu : `li` pour une carte placée dans une liste. */
  as?: "div" | "li" | "article" | "section";
}

export const Carte = ({ children, className, survol = false, as: Balise = "div", ...props }: CarteProps) => (
  <Balise
    className={cx(
      "rounded-[var(--radius-card)] border border-trait bg-surface shadow-[var(--shadow-carte)]",
      survol && "carte-survol",
      className,
    )}
    {...props}
  >
    {children}
  </Balise>
);

export const EnteteCarte = ({
  titre,
  sousTitre,
  action,
  icone,
}: {
  titre: ReactNode;
  sousTitre?: ReactNode;
  action?: ReactNode;
  icone?: NomIcone | string;
}) => (
  <div className="flex items-start justify-between gap-4 border-b border-trait px-5 py-4">
    <div className="min-w-0">
      <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight text-ink">
        {icone && <Icone nom={icone} taille={17} className="shrink-0 text-ink-muted" />}
        <span className="truncate">{titre}</span>
      </h2>
      {sousTitre && <p className="mt-0.5 text-[0.8rem] text-ink-muted">{sousTitre}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

/* ----------------------------------------------------------------- Bouton */

type Variante = "primaire" | "secondaire" | "discret" | "danger";
type Taille = "sm" | "md";

interface BoutonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  taille?: Taille;
  icone?: NomIcone | string;
  chargement?: boolean;
}

const VARIANTES: Record<Variante, string> = {
  primaire: "bg-accent text-white hover:bg-accent-fort border-transparent",
  secondaire: "bg-surface text-ink border-trait-fort hover:bg-surface-hover",
  discret: "bg-transparent text-ink-2 border-transparent hover:bg-surface-hover hover:text-ink",
  danger: "bg-transparent text-critique border-transparent hover:bg-critique-doux",
};

export const Bouton = ({
  variante = "secondaire",
  taille = "md",
  icone,
  chargement,
  children,
  className,
  disabled,
  ...props
}: BoutonProps) => (
  <button
    className={cx(
      "pressable inline-flex items-center justify-center gap-2 rounded-lg border font-medium",
      "disabled:cursor-not-allowed disabled:opacity-50",
      taille === "sm" ? "px-2.5 py-1.5 text-[0.8rem]" : "px-3.5 py-2 text-[0.875rem]",
      VARIANTES[variante],
      className,
    )}
    disabled={disabled || chargement}
    {...props}
  >
    {chargement ? (
      <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
    ) : (
      icone && <Icone nom={icone} taille={taille === "sm" ? 15 : 17} />
    )}
    {children}
  </button>
);

/** Lien presente comme un bouton (un <a> dans un <button> serait invalide). */
export const LienBouton = ({
  href,
  children,
  variante = "secondaire",
  taille = "md",
  icone,
  className,
  ...props
}: { href: string; children: ReactNode; variante?: Variante; taille?: Taille; icone?: NomIcone | string; className?: string } & Record<string, unknown>) => (
  <a
    href={href}
    className={cx(
      "inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-colors no-underline",
      taille === "sm" ? "px-2.5 py-1.5 text-[0.8rem]" : "px-3.5 py-2 text-[0.875rem]",
      VARIANTES[variante],
      className,
    )}
    {...props}
  >
    {icone && <Icone nom={icone} taille={taille === "sm" ? 15 : 17} />}
    {children}
  </a>
);

/* ------------------------------------------------------------------ Badge */

type Ton = "neutre" | "accent" | "bon" | "attention" | "critique";

const TONS: Record<Ton, string> = {
  neutre: "bg-surface-hover text-ink-2 border-trait",
  accent: "bg-accent-doux text-accent-ink border-transparent",
  bon: "bg-bon-doux text-bon border-transparent",
  attention: "bg-attention-doux text-serieux border-transparent",
  critique: "bg-critique-doux text-critique border-transparent",
};

export const Badge = ({
  children,
  ton = "neutre",
  icone,
  className,
}: {
  children: ReactNode;
  ton?: Ton;
  icone?: NomIcone | string;
  className?: string;
}) => (
  <span
    className={cx(
      "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.7rem] font-medium whitespace-nowrap",
      TONS[ton],
      className,
    )}
  >
    {icone && <Icone nom={icone} taille={12} />}
    {children}
  </span>
);

/** Pastille d'identite d'une matiere. La couleur accompagne toujours un libelle. */
export const Pastille = ({ couleur, taille = 8 }: { couleur: string; taille?: number }) => (
  <span
    aria-hidden="true"
    className="inline-block shrink-0 rounded-full"
    style={{ width: taille, height: taille, background: couleur }}
  />
);

/* ------------------------------------------------------------------ Champ */

export const Champ = ({
  label,
  indice,
  erreur,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; indice?: string; erreur?: string }) => (
  <label className="block">
    {label && <span className="mb-1.5 block text-[0.8rem] font-medium text-ink-2">{label}</span>}
    <input
      className={cx(
        "w-full rounded-lg border bg-surface px-3 py-2 text-[0.875rem] text-ink transition-colors",
        "placeholder:text-ink-muted focus:border-accent focus:outline-none",
        erreur ? "border-critique" : "border-trait-fort",
        className,
      )}
      {...props}
    />
    {erreur && <span className="mt-1 block text-[0.75rem] text-critique">{erreur}</span>}
    {indice && !erreur && <span className="mt-1 block text-[0.75rem] text-ink-muted">{indice}</span>}
  </label>
);

/* --------------------------------------------------------------- Etats UI */

export const Squelette = ({ className }: { className?: string }) => (
  <div className={cx("squelette rounded-lg", className)} aria-hidden="true" />
);

export const Vide = ({
  titre,
  message,
  icone = "info",
  action,
}: {
  titre: string;
  message?: string;
  icone?: NomIcone | string;
  action?: ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
    <div className="mb-1 grid size-11 place-items-center rounded-full bg-surface-hover text-ink-muted">
      <Icone nom={icone} taille={20} />
    </div>
    <p className="text-[0.9rem] font-medium text-ink">{titre}</p>
    {message && <p className="max-w-sm text-[0.825rem] text-ink-muted">{message}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

export const Erreur = ({ message, onReessayer }: { message: string; onReessayer?: () => void }) => (
  <Carte className="p-5">
    <div className="flex items-start gap-3">
      <Icone nom="attention" taille={18} className="mt-0.5 shrink-0 text-critique" />
      <div className="min-w-0 flex-1">
        <p className="text-[0.875rem] font-medium text-ink">Impossible de charger ces données</p>
        <p className="mt-0.5 text-[0.825rem] text-ink-muted">{message}</p>
      </div>
      {onReessayer && (
        <Bouton taille="sm" icone="recharger" onClick={onReessayer}>
          Réessayer
        </Bouton>
      )}
    </div>
  </Carte>
);

/* -------------------------------------------------------- Tuile de chiffre */

/**
 * Tuile de statistique.
 * Le chiffre porte l'information ; la variation est signalee par une icone ET
 * un libelle, jamais par la couleur seule.
 */
export const Tuile = ({
  libelle,
  valeur,
  unite,
  variation,
  detail,
  icone,
  ton = "neutre",
}: {
  libelle: string;
  valeur: ReactNode;
  unite?: string;
  variation?: { direction: "hausse" | "baisse" | "stable"; texte: string; favorable?: boolean };
  detail?: string;
  icone?: NomIcone | string;
  ton?: Ton;
}) => (
  <Carte className="p-4">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[0.78rem] font-medium text-ink-muted">{libelle}</span>
      {icone && <Icone nom={icone} taille={15} className="text-ink-muted" />}
    </div>
    <div className="mt-2 flex items-baseline gap-1">
      <span className="text-[1.65rem] leading-none font-semibold tracking-tight text-ink">{valeur}</span>
      {unite && <span className="text-[0.85rem] text-ink-muted">{unite}</span>}
    </div>
    {variation && (
      <div
        className={cx(
          "mt-2 flex items-center gap-1 text-[0.75rem]",
          variation.favorable === undefined
            ? "text-ink-muted"
            : variation.favorable
              ? "text-bon"
              : "text-critique",
        )}
      >
        <Icone
          nom={variation.direction === "hausse" ? "hausse" : variation.direction === "baisse" ? "baisse" : "stable"}
          taille={13}
        />
        <span>{variation.texte}</span>
      </div>
    )}
    {detail && !variation && <p className="mt-2 text-[0.75rem] text-ink-muted">{detail}</p>}
    {ton !== "neutre" && <span className="sr-only">{ton}</span>}
  </Carte>
);

/**
 * Fournit le rang d'un élément à l'animation d'entrée échelonnée.
 * Le délai est plafonné : au-delà d'une douzaine d'éléments, attendre
 * n'apporte plus rien et retarde la lecture.
 */
export const rang = (index: number) => ({ "--rang": Math.min(index, 12) }) as React.CSSProperties;

/* ------------------------------------------------- Bande de statistiques */

/**
 * Chiffres clés présentés en une seule bande.
 * Remplace une rangée de grandes tuiles : même information, bien moins de
 * poids visuel, ce qui laisse la place au contenu qui compte.
 */
export interface EntreeChiffre {
  libelle: string;
  valeur: ReactNode;
  unite?: string;
  detail?: string;
  ton?: "neutre" | "bon" | "attention" | "critique";
}

/**
 * Affiche la valeur en la faisant défiler jusqu'à sa cible lorsqu'elle est
 * numérique. Le format d'origine (décimales, virgule) est préservé.
 */
const ValeurAnimee = ({ valeur }: { valeur: ReactNode }) => {
  const texte = typeof valeur === "number" ? String(valeur) : String(valeur ?? "");
  const nombre = /^-?\d+(?:[.,]\d+)?$/.test(texte.trim())
    ? Number.parseFloat(texte.trim().replace(",", "."))
    : null;
  const decimales = nombre !== null && /[.,]/.test(texte) ? texte.split(/[.,]/)[1].length : 0;
  const anime = useCompteur(nombre);

  if (nombre === null || anime === null) return <>{valeur}</>;
  return <>{anime.toFixed(decimales).replace(".", ",")}</>;
};

export const Chiffres = ({ entrees }: { entrees: EntreeChiffre[] }) => (
  <dl
    className={cx(
      "grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-trait bg-trait",
      entrees.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4",
    )}
  >
    {entrees.map((e) => (
      <div key={e.libelle} className="bg-surface px-4 py-3">
        <dt className="text-[0.75rem] text-ink-muted">{e.libelle}</dt>
        <dd className="mt-1 flex items-baseline gap-1">
          <span
            className={cx(
              "text-[1.3rem] leading-none font-semibold tracking-tight tabular-nums",
              e.ton === "bon" && "text-bon",
              e.ton === "attention" && "text-serieux",
              e.ton === "critique" && "text-critique",
              (!e.ton || e.ton === "neutre") && "text-ink",
            )}
          >
            <ValeurAnimee valeur={e.valeur} />
          </span>
          {e.unite && <span className="text-[0.78rem] text-ink-muted">{e.unite}</span>}
        </dd>
        {e.detail && <p className="mt-1 truncate text-[0.72rem] text-ink-muted">{e.detail}</p>}
      </div>
    ))}
  </dl>
);

/* ------------------------------------------------------------- Repliable */

/** Section repliée par défaut : le détail reste accessible sans encombrer. */
export const Repliable = ({
  titre,
  sousTitre,
  children,
  ouvertParDefaut = false,
}: {
  titre: string;
  sousTitre?: string;
  children: ReactNode;
  ouvertParDefaut?: boolean;
}) => (
  <details className="group rounded-[var(--radius-card)] border border-trait bg-surface" open={ouvertParDefaut}>
    <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
      <div className="min-w-0 flex-1">
        <p className="text-[0.9rem] font-semibold tracking-tight text-ink">{titre}</p>
        {sousTitre && <p className="mt-0.5 text-[0.78rem] text-ink-muted">{sousTitre}</p>}
      </div>
      <Icone
        nom="chevronBas"
        taille={16}
        className="shrink-0 text-ink-muted transition-transform group-open:rotate-180"
      />
    </summary>
    <div className="border-t border-trait">{children}</div>
  </details>
);

/* --------------------------------------------------------------- Onglets */

export const Onglets = <T extends string>({
  valeur,
  onChange,
  options,
}: {
  valeur: T;
  onChange: (v: T) => void;
  options: { valeur: T; libelle: string; compteur?: number }[];
}) => (
  <div className="inline-flex gap-0.5 rounded-lg border border-trait bg-surface-2 p-0.5" role="tablist">
    {options.map((o) => (
      <button
        key={o.valeur}
        role="tab"
        aria-selected={valeur === o.valeur}
        onClick={() => onChange(o.valeur)}
        className={cx(
          "rounded-[7px] px-3 py-1.5 text-[0.8rem] font-medium transition-colors",
          valeur === o.valeur
            ? "bg-surface text-ink shadow-[var(--shadow-carte)]"
            : "text-ink-muted hover:text-ink",
        )}
      >
        {o.libelle}
        {o.compteur !== undefined && o.compteur > 0 && (
          <span className="ml-1.5 text-[0.72rem] text-ink-muted">{o.compteur}</span>
        )}
      </button>
    ))}
  </div>
);

/* ---------------------------------------------------------------- Modale */

export const Modale = ({
  ouverte,
  onFermer,
  titre,
  children,
  largeur = "max-w-lg",
}: {
  ouverte: boolean;
  onFermer: () => void;
  titre: string;
  children: ReactNode;
  largeur?: string;
}) => {
  // Échap ferme la fenêtre : attendu de toute boîte de dialogue.
  useEffect(() => {
    if (!ouverte) return;
    const surTouche = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouverte, onFermer]);

  if (!ouverte) return null;
  return (
    <div
      className="voile fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={onFermer}
      role="dialog"
      aria-modal="true"
      aria-label={titre}
    >
      <div
        className={cx(
          "surgissement max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-trait bg-surface shadow-[var(--shadow-flottant)] sm:rounded-[var(--radius-card)]",
          largeur,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between gap-4 border-b border-trait bg-surface px-5 py-4">
          <h2 className="text-[0.95rem] font-semibold text-ink">{titre}</h2>
          <Bouton variante="discret" taille="sm" icone="fermer" onClick={onFermer} aria-label="Fermer" />
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ En-tete page */

export const EntetePage = ({
  titre,
  sousTitre,
  actions,
}: {
  titre: string;
  sousTitre?: string;
  actions?: ReactNode;
}) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="text-[1.4rem] leading-tight font-semibold tracking-tight text-ink">{titre}</h1>
      {sousTitre && <p className="mt-1 text-[0.85rem] text-ink-muted">{sousTitre}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
