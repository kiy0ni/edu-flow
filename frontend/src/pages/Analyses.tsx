import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post } from "../lib/api";
import { useTheme } from "../lib/theme";
import { Badge, Bouton, Carte, Chiffres, EntetePage, Erreur, Pastille, Repliable, Squelette, Vide, cx } from "../components/ui";
import { Icone } from "../lib/icones";
import { duree, note, signe } from "../lib/format";
import Evolution from "../components/charts/Evolution";
import MoyennesParMatiere from "../components/charts/MoyennesParMatiere";
import type { Analyses, MatiereLevier, Signal } from "../lib/types";

const STYLE_NIVEAU: Record<Signal["niveau"], { classe: string; icone: string; libelle: string }> = {
  urgent: { classe: "text-critique", icone: "attention", libelle: "À traiter" },
  attention: { classe: "text-serieux", icone: "attention", libelle: "À surveiller" },
  info: { classe: "text-ink-muted", icone: "info", libelle: "Information" },
  succes: { classe: "text-bon", icone: "valide", libelle: "Point fort" },
};

const CATEGORIES = [
  { cle: "toutes", libelle: "Tous" },
  { cle: "notes", libelle: "Résultats" },
  { cle: "devoirs", libelle: "Travail" },
  { cle: "assiduite", libelle: "Assiduité" },
  { cle: "travail", libelle: "Temps de travail" },
];

export const AnalysesPage = () => {
  const navigate = useNavigate();
  const client = useQueryClient();
  const { couleur } = useTheme();
  const [categorie, setCategorie] = useState("toutes");
  const [vueGraphique, setVueGraphique] = useState<"evolution" | "matieres">("evolution");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["analyses"],
    queryFn: () => get<Analyses>("/analyses"),
  });

  const genererPlan = useMutation({
    mutationFn: (horizon: number) => post("/planificateur/generer", { horizon }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["plan"] });
      navigate("/planificateur");
    },
  });

  if (isLoading) return <Squelette className="h-[34rem]" />;
  if (error || !data) return <Erreur message={(error as Error)?.message ?? "Indisponible."} onReessayer={refetch} />;

  const { synthese } = data;
  const signaux = categorie === "toutes" ? data.signaux : data.signaux.filter((s) => s.categorie === categorie);

  const executer = (action: Record<string, unknown>) => {
    if (action.type === "naviguer") navigate(String(action.cible));
    else if (action.type === "genererPlan") genererPlan.mutate(Number(action.horizon ?? 7));
    else if (action.type === "creerPaquet") navigate("/revisions");
  };

  const aTraiter = data.signaux.filter((s) => s.niveau === "urgent").length;

  return (
    <div className="apparition flex flex-col gap-5">
      <EntetePage
        titre="Analyses"
        sousTitre="Chaque constat cite la donnée qui le déclenche."
        actions={
          <Bouton icone="recharger" onClick={() => refetch()}>
            Actualiser
          </Bouton>
        }
      />

      <Chiffres
        entrees={[
          {
            libelle: "Moyenne générale",
            valeur: note(synthese.moyenneGenerale),
            unite: "/20",
            detail:
              data.projection.fiabilite === "insuffisante"
                ? "Pas assez de notes pour projeter"
                : `Fin de période estimée à ${note(data.projection.projetee)}`,
          },
          {
            libelle: "Écart à la classe",
            valeur: signe(synthese.ecartClasse),
            unite: "pt",
            ton: (synthese.ecartClasse ?? 0) >= 0 ? "bon" : "critique",
            detail: synthese.moyenneClasse !== null ? `Classe : ${note(synthese.moyenneClasse)}` : undefined,
          },
          {
            libelle: "Assiduité",
            valeur: synthese.scoreAssiduite,
            unite: "/100",
            ton: synthese.scoreAssiduite >= 90 ? "bon" : synthese.scoreAssiduite >= 70 ? "neutre" : "attention",
            detail: synthese.scoreAssiduite >= 90 ? "Excellente" : synthese.scoreAssiduite >= 70 ? "Correcte" : "À améliorer",
          },
          {
            libelle: "Série de travail",
            valeur: data.serie.courante === 0 ? "—" : `${data.serie.courante} j`,
            ton: data.serie.courante >= 3 ? "bon" : "neutre",
            detail:
              data.serie.courante === 0
                ? "Aucune activité récente"
                : data.serie.courante >= data.serie.meilleure
                  ? "Votre meilleure série"
                  : `Record : ${data.serie.meilleure} j`,
          },
        ]}
      />

      {/* Ce qui est actionnable vient en premier. */}
      {data.recommandations.length > 0 && (
        <Carte>
          <div className="border-b border-trait px-5 py-3.5">
            <h2 className="text-[0.95rem] font-semibold tracking-tight text-ink">Que faire maintenant</h2>
            <p className="mt-0.5 text-[0.78rem] text-ink-muted">Déduit de vos signaux les plus prioritaires</p>
          </div>
          <ul className="divide-y divide-[var(--trait)]">
            {data.recommandations.map((r) => (
              <li key={r.titre} className="flex items-start gap-3 px-5 py-3.5">
                <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-accent-doux text-accent-ink">
                  <Icone nom="etincelle" taille={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.875rem] font-medium text-ink">{r.titre}</p>
                  <p className="mt-0.5 text-[0.82rem] leading-relaxed text-ink-2">{r.detail}</p>
                </div>
                <Bouton taille="sm" onClick={() => executer(r.action)} chargement={genererPlan.isPending} className="shrink-0">
                  Ouvrir
                </Bouton>
              </li>
            ))}
          </ul>
        </Carte>
      )}

      {/* Un seul graphique à la fois, choisi par l'utilisateur. */}
      <Carte className="p-5">
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
          <Evolution donnees={data.evolution} />
        ) : (
          <MoyennesParMatiere matieres={data.parMatiere} hauteur={Math.max(220, data.parMatiere.length * 32)} />
        )}
      </Carte>

      {/* Le levier : toutes les matières faibles ne se valent pas. */}
      {data.levier.length > 0 && <Levier matieres={data.levier} />}

      {/* Bilan d'activité de la semaine, replié par défaut. */}
      <Repliable
        titre="Ce que j'ai fait cette semaine"
        sousTitre={
          data.bilanSemaine.comparaison
            ? `${data.bilanSemaine.comparaison.devoirs.semaine} devoir(s), ${data.bilanSemaine.comparaison.cartes.semaine} carte(s), ${duree(data.bilanSemaine.comparaison.minutes.semaine)} de concentration`
            : "Activité des sept derniers jours"
        }
      >
        <BilanSemaine bilan={data.bilanSemaine} serie={data.serie} />
      </Repliable>

      {/* Tous les constats dans une seule liste, filtrable. */}
      <Carte>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-trait px-5 py-3.5">
          <div>
            <h2 className="text-[0.95rem] font-semibold tracking-tight text-ink">Constats</h2>
            <p className="mt-0.5 text-[0.78rem] text-ink-muted">
              {data.signaux.length} constat(s){aTraiter > 0 && ` · ${aTraiter} à traiter en priorité`}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((c) => {
              const nombre =
                c.cle === "toutes" ? data.signaux.length : data.signaux.filter((s) => s.categorie === c.cle).length;
              if (!nombre) return null;
              return (
                <button
                  key={c.cle}
                  onClick={() => setCategorie(c.cle)}
                  className={cx(
                    "rounded-md px-2.5 py-1 text-[0.76rem] font-medium transition-colors",
                    categorie === c.cle ? "bg-accent-doux text-accent-ink" : "text-ink-muted hover:bg-surface-hover",
                  )}
                >
                  {c.libelle} <span className="text-ink-muted">{nombre}</span>
                </button>
              );
            })}
          </div>
        </div>

        {signaux.length ? (
          <ul className="divide-y divide-[var(--trait)]">
            {signaux.map((s) => {
              const style = STYLE_NIVEAU[s.niveau];
              return (
                <li key={s.id} className="flex items-start gap-3 px-5 py-3">
                  <Icone nom={style.icone} taille={16} className={cx("mt-0.5 shrink-0", style.classe)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[0.865rem] font-medium text-ink">{s.titre}</p>
                      <Badge
                        ton={
                          s.niveau === "urgent"
                            ? "critique"
                            : s.niveau === "attention"
                              ? "attention"
                              : s.niveau === "succes"
                                ? "bon"
                                : "neutre"
                        }
                      >
                        {style.libelle}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[0.82rem] leading-relaxed text-ink-2">{s.message}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Vide titre="Rien à signaler" message="Aucun constat sur cette dimension." icone="valide" />
        )}
      </Carte>

      {/* Le détail chiffré reste accessible, sans peser sur la page. */}
      <Repliable titre="Détail par matière" sousTitre="Moyenne, écart à la classe, régularité et tendance">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-[0.82rem]">
            <thead>
              <tr className="border-b border-trait text-left text-[0.72rem] text-ink-muted">
                <th className="px-5 py-2.5 font-medium">Matière</th>
                <th className="px-2 py-2.5 text-center font-medium">Coef.</th>
                <th className="px-2 py-2.5 text-right font-medium">Moyenne</th>
                <th className="px-2 py-2.5 text-right font-medium">Classe</th>
                <th className="px-2 py-2.5 text-right font-medium">Écart</th>
                <th className="px-2 py-2.5 text-right font-medium">Régularité</th>
                <th className="px-5 py-2.5 text-right font-medium">Tendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--trait)]">
              {data.parMatiere.map((m) => (
                <tr key={m.matiereCode}>
                  <td className="px-5 py-2.5">
                    <span className="flex items-center gap-2">
                      <Pastille couleur={couleur(m.couleur)} taille={7} />
                      <span className="text-ink">{m.matiere}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-center text-ink-muted tabular-nums">{m.coefficient}</td>
                  <td className="px-2 py-2.5 text-right font-medium text-ink tabular-nums">{note(m.moyenne)}</td>
                  <td className="px-2 py-2.5 text-right text-ink-muted tabular-nums">{note(m.moyenneClasse)}</td>
                  <td
                    className={cx(
                      "px-2 py-2.5 text-right tabular-nums",
                      (m.ecartClasse ?? 0) > 0 ? "text-bon" : (m.ecartClasse ?? 0) < 0 ? "text-critique" : "text-ink-muted",
                    )}
                  >
                    {signe(m.ecartClasse)}
                  </td>
                  <td className="px-2 py-2.5 text-right text-ink-muted tabular-nums">±{note(m.regularite, 1)}</td>
                  <td className="px-5 py-2.5 text-right">
                    <span className="inline-flex items-center gap-1 text-ink-muted">
                      <Icone
                        nom={m.tendance.direction === "hausse" ? "hausse" : m.tendance.direction === "baisse" ? "baisse" : "stable"}
                        taille={13}
                        className={
                          m.tendance.direction === "hausse"
                            ? "text-bon"
                            : m.tendance.direction === "baisse"
                              ? "text-critique"
                              : "text-ink-muted"
                        }
                      />
                      {m.tendance.direction === "stable" ? "stable" : `${signe(m.tendance.delta)} pt`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Repliable>
    </div>
  );
};

/* ------------------------------------------------------------ Sous-vues */

/**
 * Effet de levier par matière.
 *
 * La moyenne générale étant pondérée, un point gagné ne vaut pas la même chose
 * partout. Cette vue classe les matières par ce qu'un effort y rapporterait
 * réellement, ce qu'aucun classement par moyenne ne montre.
 */
const Levier = ({ matieres }: { matieres: MatiereLevier[] }) => {
  const { couleur } = useTheme();
  const maxImpact = Math.max(...matieres.map((m) => m.impactParPoint), 0.001);

  return (
    <Carte>
      <div className="border-b border-trait px-5 py-3.5">
        <h2 className="text-[0.95rem] font-semibold tracking-tight text-ink">Où mettre vos efforts</h2>
        <p className="mt-0.5 text-[0.78rem] text-ink-muted">
          Ce qu'un point gagné dans chaque matière rapporterait à votre moyenne générale.
        </p>
      </div>
      <ul className="divide-y divide-[var(--trait)]">
        {matieres.map((m) => (
          <li key={m.matiereCode} className="flex items-center gap-3 px-5 py-3">
            <Pastille couleur={couleur(m.couleur)} />
            <div className="min-w-0 w-32 shrink-0 sm:w-44">
              <p className="truncate text-[0.85rem] font-medium text-ink">{m.matiere}</p>
              <p className="text-[0.72rem] text-ink-muted">
                coef. {m.coefficient} · {note(m.moyenne)}/20
              </p>
            </div>

            <div className="min-w-0 flex-1">
              <div className="h-2 overflow-hidden rounded-full bg-surface-hover">
                <div
                  className="progression-animee h-full rounded-full bg-accent"
                  style={{ width: `${(m.impactParPoint / maxImpact) * 100}%` }}
                />
              </div>
            </div>

            <div className="w-24 shrink-0 text-right sm:w-32">
              <p className="text-[0.85rem] font-semibold text-ink tabular-nums">
                +{note(m.impactParPoint, 2)} pt
              </p>
              <p className="text-[0.7rem] text-ink-muted">par point gagné</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-trait px-5 py-2.5 text-[0.75rem] text-ink-muted">
        Exemple : gagner 1 point en {matieres[0].matiere} fait monter votre moyenne générale de{" "}
        {note(matieres[0].impactParPoint, 2)} pt
        {matieres.length > 1 && (
          <>
            , contre {note(matieres[matieres.length - 1].impactParPoint, 2)} pt en{" "}
            {matieres[matieres.length - 1].matiere}
          </>
        )}
        .
      </p>
    </Carte>
  );
};

/** Activité réelle des sept derniers jours. */
const BilanSemaine = ({
  bilan,
  serie,
}: {
  bilan: Analyses["bilanSemaine"];
  serie: Analyses["serie"];
}) => {
  const maxMinutes = Math.max(...bilan.jours.map((j) => j.minutes), 30);
  const jourCourt = (iso: string) =>
    new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(new Date(`${iso}T12:00:00`));

  const evolutions = bilan.comparaison
    ? [
        { libelle: "Devoirs terminés", ...bilan.comparaison.devoirs, format: (n: number) => String(n) },
        { libelle: "Cartes révisées", ...bilan.comparaison.cartes, format: (n: number) => String(n) },
        { libelle: "Concentration", ...bilan.comparaison.minutes, format: (n: number) => duree(n) },
      ]
    : [];

  return (
    <div className="p-5">
      <div className="flex items-end justify-between gap-2">
        {bilan.jours.map((j) => (
          <div key={j.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="flex h-24 w-full items-end justify-center">
              <div
                className={cx(
                  "w-full max-w-8 rounded-t-[3px] transition-[height]",
                  j.actif ? "bg-accent" : "bg-surface-hover",
                )}
                style={{ height: `${Math.max(j.actif ? 8 : 4, (j.minutes / maxMinutes) * 96)}%` }}
                title={`${j.minutes} min · ${j.devoirs} devoir(s) · ${j.cartes} carte(s)`}
              />
            </div>
            <span className="text-[0.7rem] text-ink-muted capitalize">{jourCourt(j.date)}</span>
          </div>
        ))}
      </div>

      {evolutions.length > 0 && (
        <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-trait pt-4">
          {evolutions.map((e) => (
            <div key={e.libelle}>
              <dt className="text-[0.72rem] text-ink-muted">{e.libelle}</dt>
              <dd className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-[1.05rem] font-semibold text-ink tabular-nums">{e.format(e.semaine)}</span>
                {e.precedente > 0 && (
                  <span
                    className={cx(
                      "text-[0.72rem] tabular-nums",
                      e.evolution > 0 ? "text-bon" : e.evolution < 0 ? "text-critique" : "text-ink-muted",
                    )}
                  >
                    {e.evolution > 0 ? "+" : ""}
                    {e.evolution} %
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <p className="mt-4 text-[0.78rem] text-ink-muted">
        {serie.courante > 0
          ? `Vous travaillez depuis ${serie.courante} jour(s) d'affilée. La régularité pèse davantage sur les résultats que le volume ponctuel.`
          : "Aucune activité enregistrée récemment. Une session courte suffit à relancer la série."}
      </p>
    </div>
  );
};

export default AnalysesPage;
