import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, put } from "../lib/api";
import { useTheme } from "../lib/theme";
import { Badge, Bouton, Carte, Modale, Pastille, Vide, cx } from "./ui";
import { Icone } from "../lib/icones";
import { note } from "../lib/format";

interface Objectif {
  matiereCode: string;
  matiere: string;
  couleur: { clair: string; sombre: string } | null;
  periodeCode: string;
  cible: number;
  actuel: number | null;
  ecart: number | null;
  atteint: boolean;
  noteNecessaire: number | null;
  maxAtteignable: number | null;
  coefficientHypothese: number;
}

interface Reponse {
  periodeCode: string;
  objectifs: Objectif[];
  disponibles: { code: string; nom: string; moyenne: number | null }[];
  generalDefini: boolean;
}

const CODE_GENERAL = "_GENERAL";

/** Ce qu'il reste à faire, formulé en une phrase actionnable. */
const consigne = (o: Objectif) => {
  if (o.actuel === null) return "Aucune note sur la période.";
  if (o.atteint) return `Objectif atteint : ${note(o.actuel)}/20 pour une cible de ${note(o.cible)}.`;
  if (o.matiereCode === CODE_GENERAL)
    return `Il manque ${note(Math.abs(o.ecart ?? 0))} pt. Travaillez les matières à fort coefficient en priorité.`;
  if (o.noteNecessaire !== null)
    return `Une prochaine note de ${note(o.noteNecessaire)}/20 (coefficient ${o.coefficientHypothese}) suffirait.`;
  if (o.maxAtteignable !== null)
    return `Hors de portée en une évaluation : au mieux ${note(o.maxAtteignable)}/20. Il en faudra plusieurs.`;
  return `Il manque ${note(Math.abs(o.ecart ?? 0))} pt.`;
};

export const Objectifs = ({ periodeCode }: { periodeCode: string }) => {
  const client = useQueryClient();
  const { couleur } = useTheme();
  const [ouverte, setOuverte] = useState(false);
  const [choix, setChoix] = useState({ matiereCode: CODE_GENERAL, cible: 14 });

  const { data } = useQuery({
    queryKey: ["objectifs", periodeCode],
    queryFn: () => get<Reponse>(`/objectifs?periode=${encodeURIComponent(periodeCode)}`),
  });

  const rafraichir = () => {
    client.invalidateQueries({ queryKey: ["objectifs"] });
    client.invalidateQueries({ queryKey: ["analyses"] });
  };

  const definir = useMutation({
    mutationFn: () => put("/objectifs", { ...choix, periodeCode }),
    onSuccess: () => {
      setOuverte(false);
      rafraichir();
    },
  });

  const retirer = useMutation({
    mutationFn: (matiereCode: string) =>
      del(`/objectifs/${encodeURIComponent(periodeCode)}/${encodeURIComponent(matiereCode)}`),
    onSuccess: rafraichir,
  });

  const objectifs = data?.objectifs ?? [];

  /**
   * Ouvre la fenêtre en pré-sélectionnant une cible réellement proposée.
   * Sans cela, l'objectif général resterait sélectionné alors qu'il n'apparaît
   * plus dans la liste, et l'enregistrement l'écraserait silencieusement.
   */
  const ouvrir = () => {
    const premierDisponible = data?.generalDefini ? (data.disponibles[0]?.code ?? null) : CODE_GENERAL;
    if (premierDisponible) setChoix((c) => ({ ...c, matiereCode: premierDisponible }));
    setOuverte(true);
  };

  const plusRienAAjouter = Boolean(data?.generalDefini) && (data?.disponibles.length ?? 0) === 0;

  return (
    <>
      <Carte>
        <div className="flex items-center justify-between gap-3 border-b border-trait px-5 py-3.5">
          <div>
            <h2 className="text-[0.95rem] font-semibold tracking-tight text-ink">Mes objectifs</h2>
            <p className="mt-0.5 text-[0.78rem] text-ink-muted">
              Fixez une cible : EduFlow calcule la note qu'il vous faut pour l'atteindre.
            </p>
          </div>
          <Bouton taille="sm" icone="plus" onClick={ouvrir} disabled={plusRienAAjouter} className="shrink-0">
            Ajouter
          </Bouton>
        </div>

        {objectifs.length ? (
          <ul className="divide-y divide-[var(--trait)]">
            {objectifs.map((o) => {
              const progression =
                o.actuel === null ? 0 : Math.min(100, Math.max(0, Math.round((o.actuel / o.cible) * 100)));
              return (
                <li key={o.matiereCode} className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    {o.couleur ? <Pastille couleur={couleur(o.couleur)} /> : <Icone nom="cible" taille={14} className="text-ink-muted" />}
                    <span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-ink">{o.matiere}</span>
                    <span className="shrink-0 text-[0.82rem] tabular-nums">
                      <span className="font-semibold text-ink">{note(o.actuel)}</span>
                      <span className="text-ink-muted"> / {note(o.cible)}</span>
                    </span>
                    {o.atteint && <Badge ton="bon" icone="valide">Atteint</Badge>}
                    <Bouton
                      variante="discret"
                      taille="sm"
                      icone="corbeille"
                      onClick={() => retirer.mutate(o.matiereCode)}
                      aria-label={`Retirer l'objectif ${o.matiere}`}
                      className="shrink-0"
                    />
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-hover">
                    <div
                      className={cx("progression-animee h-full rounded-full", o.atteint ? "bg-bon" : "bg-accent")}
                      style={{ width: `${progression}%` }}
                    />
                  </div>

                  <p className="mt-1.5 text-[0.78rem] text-ink-muted">{consigne(o)}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <Vide
            titre="Aucun objectif"
            message="Fixer une cible transforme une moyenne en cap : EduFlow vous dira ce qu'il faut obtenir pour l'atteindre."
            icone="cible"
            action={
              <Bouton variante="primaire" icone="plus" onClick={ouvrir}>
                Définir un objectif
              </Bouton>
            }
          />
        )}
      </Carte>

      <Modale ouverte={ouverte} onFermer={() => setOuverte(false)} titre="Nouvel objectif">
        <div className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-1.5 block text-[0.8rem] font-medium text-ink-2">Sur quoi ?</span>
            <select
              value={choix.matiereCode}
              onChange={(e) => setChoix({ ...choix, matiereCode: e.target.value })}
              className="w-full rounded-lg border border-trait-fort bg-surface px-3 py-2 text-[0.875rem] text-ink focus:border-accent focus:outline-none"
            >
              {!data?.generalDefini && <option value={CODE_GENERAL}>Moyenne générale</option>}
              {data?.disponibles.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.nom}
                  {m.moyenne !== null ? ` — actuellement ${note(m.moyenne)}/20` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-baseline justify-between text-[0.8rem] font-medium text-ink-2">
              Cible
              <span className="text-[1rem] font-semibold text-ink tabular-nums">{note(choix.cible)}/20</span>
            </span>
            <input
              type="range"
              min={5}
              max={20}
              step={0.5}
              value={choix.cible}
              onChange={(e) => setChoix({ ...choix, cible: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
          </label>

          <Bouton
            variante="primaire"
            onClick={() => definir.mutate()}
            chargement={definir.isPending}
            disabled={plusRienAAjouter}
          >
            Définir l'objectif
          </Bouton>
        </div>
      </Modale>
    </>
  );
};

export default Objectifs;
