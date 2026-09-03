import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { get, post } from "../lib/api";
import { useTheme } from "../lib/theme";
import { Badge, Bouton, Carte, Champ, Chiffres, EnteteCarte, EntetePage, Erreur, Modale, Onglets, Pastille, Squelette, Vide, cx } from "../components/ui";
import { Icone } from "../lib/icones";
import { note, signe, dateCourte } from "../lib/format";
import Evolution from "../components/charts/Evolution";
import MoyennesParMatiere from "../components/charts/MoyennesParMatiere";
import type { MoyenneMatiere, Note } from "../lib/types";
import Objectifs from "../components/Objectifs";

interface ReponseNotes {
  periode: string;
  periodes: { code: string; libelle: string }[];
  notes: Note[];
  parMatiere: MoyenneMatiere[];
  moyenneGenerale: number | null;
  moyenneClasse: number | null;
}

interface Synthese {
  moyenneGenerale: number | null;
  moyenneClasse: number | null;
  positionRelative: number | null;
  nbNotes: number;
  evolution: { periodeCode: string; libelle: string; moyenne: number | null; moyenneClasse: number | null }[];
  meilleures: MoyenneMatiere[];
  fragiles: MoyenneMatiere[];
}

const IconeTendance = ({ direction }: { direction: string }) => (
  <Icone
    nom={direction === "hausse" ? "hausse" : direction === "baisse" ? "baisse" : "stable"}
    taille={13}
    className={direction === "hausse" ? "text-bon" : direction === "baisse" ? "text-critique" : "text-ink-muted"}
  />
);

/* ---------------------------------------------------------- Simulateur */

const Simulateur = ({
  ouvert,
  onFermer,
  matieres,
  periode,
}: {
  ouvert: boolean;
  onFermer: () => void;
  matieres: MoyenneMatiere[];
  periode: string;
}) => {
  const [matiereCode, setMatiereCode] = useState(matieres[0]?.matiereCode ?? "");
  const [valeur, setValeur] = useState("15");
  const [coefficient, setCoefficient] = useState("1");
  const [resultat, setResultat] = useState<{ actuel: number | null; simule: number | null; delta: number | null } | null>(null);
  const [objectif, setObjectif] = useState("14");
  const [reponseObjectif, setReponseObjectif] = useState<{ noteNecessaire: number | null; message: string } | null>(null);
  const [occupe, setOccupe] = useState(false);

  const simuler = async () => {
    setOccupe(true);
    try {
      setResultat(
        await post("/notes/simulation", {
          periode,
          ajouts: [{ matiereCode, valeur: Number(valeur), coefficient: Number(coefficient) }],
        }),
      );
    } finally {
      setOccupe(false);
    }
  };

  const calculerObjectif = async () => {
    setOccupe(true);
    try {
      setReponseObjectif(
        await post("/notes/objectif", {
          periode,
          matiereCode,
          objectif: Number(objectif),
          coefficient: Number(coefficient),
        }),
      );
    } finally {
      setOccupe(false);
    }
  };

  return (
    <Modale ouverte={ouvert} onFermer={onFermer} titre="Simulateur de moyenne" largeur="max-w-xl">
      <p className="text-[0.85rem] text-ink-2">
        Ajoutez une note hypothetique pour voir son effet réel sur votre moyenne générale, coefficients compris.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-3">
          <span className="mb-1.5 block text-[0.8rem] font-medium text-ink-2">Matière</span>
          <select
            value={matiereCode}
            onChange={(e) => setMatiereCode(e.target.value)}
            className="w-full rounded-lg border border-trait-fort bg-surface px-3 py-2 text-[0.875rem] text-ink"
          >
            {matieres.map((m) => (
              <option key={m.matiereCode} value={m.matiereCode}>
                {m.matiere} — actuellement {note(m.moyenne)}/20
              </option>
            ))}
          </select>
        </label>
        <Champ label="Note /20" type="number" min={0} max={20} step={0.25} value={valeur} onChange={(e) => setValeur(e.target.value)} />
        <Champ label="Coefficient" type="number" min={0.5} max={10} step={0.5} value={coefficient} onChange={(e) => setCoefficient(e.target.value)} />
        <div className="flex items-end">
          <Bouton variante="primaire" onClick={simuler} chargement={occupe} className="w-full">
            Simuler
          </Bouton>
        </div>
      </div>

      {resultat && (
        <Carte className="mt-4 p-4">
          <div className="flex items-center justify-around gap-4 text-center">
            <div>
              <p className="text-[0.72rem] text-ink-muted">Actuellement</p>
              <p className="mt-1 text-[1.3rem] font-semibold text-ink tabular-nums">{note(resultat.actuel)}</p>
            </div>
            <Icone nom="chevronDroit" taille={18} className="text-ink-muted" />
            <div>
              <p className="text-[0.72rem] text-ink-muted">Avec cette note</p>
              <p className="mt-1 text-[1.3rem] font-semibold text-accent-ink tabular-nums">{note(resultat.simule)}</p>
            </div>
            <div>
              <p className="text-[0.72rem] text-ink-muted">Variation</p>
              <p
                className={cx(
                  "mt-1 flex items-center gap-1 text-[1.05rem] font-semibold tabular-nums",
                  (resultat.delta ?? 0) > 0 ? "text-bon" : (resultat.delta ?? 0) < 0 ? "text-critique" : "text-ink-muted",
                )}
              >
                <IconeTendance direction={(resultat.delta ?? 0) > 0 ? "hausse" : (resultat.delta ?? 0) < 0 ? "baisse" : "stable"} />
                {signe(resultat.delta)}
              </p>
            </div>
          </div>
        </Carte>
      )}

      <div className="mt-6 border-t border-trait pt-5">
        <p className="text-[0.85rem] font-medium text-ink">Objectif inverse</p>
        <p className="mt-1 text-[0.8rem] text-ink-muted">
          Quelle note faut-il obtenir dans cette matière pour atteindre une moyenne générale donnée ?
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Champ label="Moyenne visee" type="number" min={0} max={20} step={0.25} value={objectif} onChange={(e) => setObjectif(e.target.value)} className="w-28" />
          <Bouton onClick={calculerObjectif} chargement={occupe} icone="cible">
            Calculer
          </Bouton>
        </div>
        {reponseObjectif && (
          <p
            className={cx(
              "mt-3 rounded-lg px-3 py-2 text-[0.82rem]",
              reponseObjectif.noteNecessaire === null ? "bg-attention-doux text-serieux" : "bg-accent-doux text-accent-ink",
            )}
          >
            {reponseObjectif.message}
          </p>
        )}
      </div>
    </Modale>
  );
};

/* --------------------------------------------------------------- Page */

export const NotesPage = () => {
  const { couleur } = useTheme();
  const [periode, setPeriode] = useState("annee");
  const [matiereOuverte, setMatiereOuverte] = useState<string | null>(null);
  const [simulateurOuvert, setSimulateurOuvert] = useState(false);
  const [vueGraphique, setVueGraphique] = useState<"evolution" | "matieres">("evolution");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["notes", periode],
    queryFn: () => get<ReponseNotes>(`/notes?periode=${periode}`),
  });
  const { data: synthese } = useQuery({ queryKey: ["notes-synthese"], queryFn: () => get<Synthese>("/notes/synthese") });

  const notesParMatiere = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const n of data?.notes ?? []) {
      if (!map.has(n.matiereCode)) map.set(n.matiereCode, []);
      map.get(n.matiereCode)!.push(n);
    }
    return map;
  }, [data?.notes]);

  if (isLoading) return <Squelette className="h-[36rem]" />;
  if (error || !data) return <Erreur message={(error as Error)?.message ?? "Indisponible."} onReessayer={refetch} />;

  return (
    <div className="apparition">
      <EntetePage
        titre="Notes"
        sousTitre={`${data.notes.length} note(s) · ${data.parMatiere.length} matière(s)`}
        actions={
          <>
            <Onglets
              valeur={periode}
              onChange={setPeriode}
              options={[{ valeur: "annee", libelle: "Année" }, ...data.periodes.map((p) => ({ valeur: p.code, libelle: p.libelle.replace("Trimestre", "T") }))]}
            />
            <Bouton icone="cible" onClick={() => setSimulateurOuvert(true)}>
              Simuler
            </Bouton>
          </>
        }
      />

      <Chiffres
        entrees={[
          {
            libelle: "Moyenne générale",
            valeur: note(data.moyenneGenerale),
            unite: "/20",
            detail:
              data.moyenneGenerale !== null && data.moyenneClasse !== null
                ? `${signe(data.moyenneGenerale - data.moyenneClasse)} pt vs classe`
                : undefined,
          },
          { libelle: "Moyenne de classe", valeur: note(data.moyenneClasse), unite: "/20" },
          {
            libelle: "Meilleure matière",
            valeur: synthese?.meilleures[0]?.matiere ?? "—",
            detail: synthese?.meilleures[0] ? `${note(synthese.meilleures[0].moyenne)}/20` : undefined,
          },
          {
            libelle: "À consolider",
            valeur: synthese?.fragiles[0]?.matiere ?? "—",
            ton: "attention",
            detail: synthese?.fragiles[0] ? `${note(synthese.fragiles[0].moyenne)}/20` : undefined,
          },
        ]}
      />

      <Carte className="mt-4 p-5">
        <div className="mb-1 flex justify-end">
          <div className="inline-flex gap-0.5 rounded-lg border border-trait bg-surface-2 p-0.5">
            {(
              [
                ["evolution", "Évolution"],
                ["matieres", "Par matière"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setVueGraphique(v)}
                className={cx(
                  "rounded-[7px] px-3 py-1 text-[0.78rem] font-medium transition-colors",
                  vueGraphique === v ? "bg-surface text-ink shadow-[var(--shadow-carte)]" : "text-ink-muted hover:text-ink",
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        {vueGraphique === "evolution" ? (
          <Evolution donnees={synthese?.evolution ?? []} />
        ) : (
          <MoyennesParMatiere matieres={data.parMatiere} hauteur={Math.max(220, data.parMatiere.length * 32)} />
        )}
      </Carte>

      <div className="mt-4">
        <Objectifs periodeCode={periode} />
      </div>

      <Carte className="mt-4">
        <EnteteCarte titre="Détail par matière" icone="notes" sousTitre="Cliquez sur une matière pour voir ses notes" />
        <ul className="divide-y divide-[var(--trait)]">
          {data.parMatiere.map((m) => {
            const ouverte = matiereOuverte === m.matiereCode;
            const notes = notesParMatiere.get(m.matiereCode) ?? [];
            return (
              <li key={m.matiereCode}>
                <button
                  onClick={() => setMatiereOuverte(ouverte ? null : m.matiereCode)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                  aria-expanded={ouverte}
                >
                  <Pastille couleur={couleur(m.couleur)} taille={9} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.875rem] font-medium text-ink">{m.matiere}</p>
                    <p className="mt-0.5 text-[0.75rem] text-ink-muted">
                      {m.nbNotes} note(s) · coef. {m.coefficient}
                      {m.professeur && ` · ${m.professeur}`}
                    </p>
                  </div>

                  <div className="hidden w-24 text-right sm:block">
                    <p className="text-[0.72rem] text-ink-muted">Classe</p>
                    <p className="text-[0.82rem] text-ink-2 tabular-nums">{note(m.moyenneClasse)}</p>
                  </div>

                  <div className="w-20 text-right">
                    <p className="text-[1rem] font-semibold text-ink tabular-nums">{note(m.moyenne)}</p>
                    <p className="flex items-center justify-end gap-1 text-[0.7rem] text-ink-muted">
                      <IconeTendance direction={m.tendance.direction} />
                      {m.tendance.direction === "stable" ? "stable" : signe(m.tendance.delta)}
                    </p>
                  </div>

                  <Icone nom={ouverte ? "chevronBas" : "chevronDroit"} taille={15} className="shrink-0 text-ink-muted" />
                </button>

                {ouverte && (
                  <div className="apparition bg-surface-2 px-4 pb-3">
                    {notes.length ? (
                      <table className="w-full text-[0.8rem]">
                        <thead>
                          <tr className="text-left text-[0.72rem] text-ink-muted">
                            <th className="py-2 font-medium">Évaluation</th>
                            <th className="py-2 font-medium">Date</th>
                            <th className="py-2 text-center font-medium">Coef.</th>
                            <th className="py-2 text-right font-medium">Classe</th>
                            <th className="py-2 text-right font-medium">Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--trait)]">
                          {notes.map((n) => (
                            <tr key={n.id}>
                              <td className="py-2 pr-3 text-ink">{n.intitule}</td>
                              <td className="py-2 pr-3 whitespace-nowrap text-ink-muted">{dateCourte(n.date)}</td>
                              <td className="py-2 text-center text-ink-muted tabular-nums">{n.coefficient}</td>
                              <td className="py-2 text-right text-ink-muted tabular-nums">{note(n.moyenneClasse)}</td>
                              <td className="py-2 text-right font-semibold text-ink tabular-nums">
                                {note(n.valeur)}
                                <span className="text-[0.7rem] font-normal text-ink-muted">/{n.bareme}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="py-3 text-[0.8rem] text-ink-muted">Aucune note sur cette période.</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge>Min {note(m.min, 1)}</Badge>
                      <Badge>Max {note(m.max, 1)}</Badge>
                      <Badge ton={m.regularite > 3.5 ? "attention" : "neutre"}>Regularite ±{note(m.regularite, 1)} pt</Badge>
                      {m.ecartClasse !== null && (
                        <Badge ton={m.ecartClasse >= 0 ? "bon" : "critique"}>{signe(m.ecartClasse)} pt vs classe</Badge>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {!data.parMatiere.length && <Vide
              titre="Aucune note sur cette période"
              message="Les évaluations de cette période ne sont pas encore publiées."
              icone="notes"
              action={
                periode !== "annee" ? (
                  <Bouton icone="recharger" onClick={() => setPeriode("annee")}>
                    Voir toute l'année
                  </Bouton>
                ) : undefined
              }
            />}
      </Carte>

      <Simulateur ouvert={simulateurOuvert} onFermer={() => setSimulateurOuvert(false)} matieres={data.parMatiere} periode={periode} />
    </div>
  );
};

export default NotesPage;
