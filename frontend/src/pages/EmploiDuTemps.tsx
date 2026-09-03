import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { get, getAccessToken } from "../lib/api";
import { useTheme } from "../lib/theme";
import { Badge, Bouton, Carte, EntetePage, Erreur, Modale, Squelette, Vide, cx, rang } from "../components/ui";
import { Icone } from "../lib/icones";
import { aujourdhui, ajouterJours, dateCourte, dateLongue, debutSemaine, finSemaine, duree, jourCourt, numeroJour, relatif, capitaliser } from "../lib/format";
import type { Cours, Devoir, JourEdt } from "../lib/types";

interface Reponse {
  from: string;
  to: string;
  jours: JourEdt[];
  bornes: { debut: string; fin: string };
  resume: { nbCours: number; nbAnnules: number; nbEvaluations: number; heuresTotal: number };
}

const enMinutes = (h: string) => {
  const [a, b] = h.split(":").map(Number);
  return a * 60 + b;
};

/** Bloc de cours positionne sur la grille horaire. */
const BlocCours = ({
  cours,
  debutGrille,
  pxParMinute,
  onOuvrir,
}: {
  cours: Cours;
  debutGrille: number;
  pxParMinute: number;
  onOuvrir: (c: Cours) => void;
}) => {
  const { couleur } = useTheme();
  const haut = (enMinutes(cours.debut) - debutGrille) * pxParMinute;
  const hauteur = Math.max(30, (enMinutes(cours.fin) - enMinutes(cours.debut)) * pxParMinute - 3);
  const teinte = couleur(cours.couleur);

  return (
    <button
      type="button"
      onClick={() => onOuvrir(cours)}
      className={cx(
        "pressable absolute inset-x-1 overflow-hidden rounded-lg border px-2 py-1.5 text-left transition-shadow hover:shadow-[var(--shadow-carte)]",
        cours.annule && "opacity-55",
      )}
      style={{
        top: haut,
        height: hauteur,
        background: cours.annule ? "var(--surface-2)" : `color-mix(in srgb, ${teinte} 10%, var(--surface))`,
        borderColor: cours.annule ? "var(--trait)" : `color-mix(in srgb, ${teinte} 32%, transparent)`,
        borderLeft: `3px solid ${teinte}`,
      }}
      title={`${cours.matiere} · ${cours.debut}-${cours.fin}${cours.salle ? ` · ${cours.salle}` : ""}`}
    >
      <p className={cx("truncate text-[0.76rem] leading-tight font-semibold text-ink", cours.annule && "line-through")}>
        {cours.matiere}
      </p>
      {hauteur > 44 && (
        <p className="mt-0.5 truncate text-[0.68rem] leading-tight text-ink-muted">
          {cours.debut}–{cours.fin}
        </p>
      )}
      {hauteur > 62 && (
        <p className="mt-0.5 truncate text-[0.68rem] leading-tight text-ink-muted">
          {[cours.salle, cours.professeur].filter(Boolean).join(" · ")}
        </p>
      )}
      {cours.type === "evaluation" && hauteur > 44 && (
        <span className="mt-1 inline-block rounded bg-attention-doux px-1 py-px text-[0.62rem] font-medium text-serieux">
          Évaluation
        </span>
      )}
    </button>
  );
};

/** Détail d'un cours : ce qu'on veut savoir en le regardant. */
const DetailCours = ({
  cours,
  devoirs,
  onFermer,
}: {
  cours: Cours | null;
  devoirs: Devoir[];
  onFermer: () => void;
}) => {
  const { couleur } = useTheme();
  const naviguer = useNavigate();
  if (!cours) return null;

  // Travail rattaché à cette matière, à venir.
  const lies = devoirs
    .filter((d) => d.matiereCode === cours.matiereCode && !d.fait && d.dueDate >= aujourdhui())
    .slice(0, 4);

  return (
    <Modale ouverte titre={cours.matiere} onFermer={onFermer}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: couleur(cours.couleur) }} />
          <div>
            <p className="text-[0.95rem] font-semibold text-ink">
              {cours.debut} – {cours.fin}
            </p>
            <p className="text-[0.82rem] text-ink-muted">{capitaliser(dateLongue(cours.date))}</p>
          </div>
          {cours.annule && <Badge ton="critique" className="ml-auto">Annulé</Badge>}
          {cours.type === "evaluation" && !cours.annule && (
            <Badge ton="attention" className="ml-auto">Évaluation</Badge>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-lg bg-surface-2 p-3 text-[0.82rem]">
          <div>
            <dt className="text-ink-muted">Salle</dt>
            <dd className="mt-0.5 font-medium text-ink">{cours.salle ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Enseignant</dt>
            <dd className="mt-0.5 font-medium text-ink">{cours.professeur ?? "—"}</dd>
          </div>
        </dl>

        {cours.remarque && (
          <p className="rounded-lg bg-attention-doux px-3 py-2 text-[0.82rem] text-serieux">{cours.remarque}</p>
        )}

        <div>
          <p className="mb-2 text-[0.8rem] font-medium text-ink">
            Travail à venir en {cours.matiere}
          </p>
          {lies.length ? (
            <ul className="flex flex-col gap-1.5">
              {lies.map((d) => (
                <li key={d.id} className="flex items-center gap-2 rounded-lg border border-trait px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[0.82rem] text-ink">{d.intitule}</span>
                  <span className="shrink-0 text-[0.75rem] text-ink-muted">{relatif(d.dueDate)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.82rem] text-ink-muted">Rien à rendre dans cette matière.</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {cours.professeur && (
            <Bouton
              icone="envoyer"
              onClick={() =>
                naviguer("/messagerie", {
                  state: {
                    brouillon: {
                      destinataireNom: cours.professeur,
                      sujet: `${cours.matiere} — question`,
                      corps: `Bonjour,\n\nÀ propos du cours du ${dateLongue(cours.date)} :\n\n\nCordialement.`,
                    },
                  },
                })
              }
            >
              Écrire à l'enseignant
            </Bouton>
          )}
          <Bouton variante="discret" icone="devoirs" onClick={() => naviguer("/devoirs")}>
            Voir les devoirs
          </Bouton>
        </div>
      </div>
    </Modale>
  );
};

export const EmploiDuTempsPage = () => {
  const { couleur } = useTheme();
  const [ancre, setAncre] = useState(aujourdhui());
  const [coursOuvert, setCoursOuvert] = useState<Cours | null>(null);
  const [vue, setVue] = useState<"semaine" | "liste">("semaine");

  const from = debutSemaine(ancre);
  const to = finSemaine(ancre);

  // Le travail à venir alimente le détail d'un cours : on le charge une fois.
  const { data: travaux } = useQuery({
    queryKey: ["devoirs-edt"],
    queryFn: () => get<{ devoirs: Devoir[] }>(`/devoirs?from=${aujourdhui()}&to=${ajouterJours(aujourdhui(), 30)}`),
    staleTime: 60_000,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["edt", from, to],
    queryFn: () => get<Reponse>(`/emploi-du-temps?from=${from}&to=${to}`),
  });

  // La grille couvre l'amplitude réelle de la semaine, arrondie a l'heure.
  const grille = useMemo(() => {
    const debut = Math.floor(enMinutes(data?.bornes.debut ?? "08:00") / 60) * 60;
    const fin = Math.ceil(enMinutes(data?.bornes.fin ?? "18:00") / 60) * 60;
    const heures = [];
    for (let m = debut; m <= fin; m += 60) heures.push(m);
    return { debut, fin, heures, hauteur: (fin - debut) * 1.05 };
  }, [data?.bornes.debut, data?.bornes.fin]);

  const joursOuvres = (data?.jours ?? []).filter((j) => j.cours.length > 0 || !["samedi", "dimanche"].includes(j.jour));

  const exporter = () => {
    // Le telechargement passe par une URL signee : on ajoute le jeton en query.
    const url = `/api/v1/emploi-du-temps/export.ics?from=${from}&to=${ajouterJours(from, 120)}`;
    fetch(url, { headers: { Authorization: `Bearer ${getAccessToken()}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const lien = document.createElement("a");
        lien.href = URL.createObjectURL(blob);
        lien.download = "eduflow-emploi-du-temps.ics";
        lien.click();
        URL.revokeObjectURL(lien.href);
      });
  };

  return (
    <div className="apparition">
      <DetailCours cours={coursOuvert} devoirs={travaux?.devoirs ?? []} onFermer={() => setCoursOuvert(null)} />

      <EntetePage
        titre="Emploi du temps"
        sousTitre={data ? `${dateCourte(from)} – ${dateCourte(to)} · ${duree(data.resume.heuresTotal * 60)} de cours` : undefined}
        actions={
          <>
            <div className="flex items-center gap-0.5 rounded-lg border border-trait bg-surface p-0.5">
              <Bouton variante="discret" taille="sm" icone="chevronGauche" onClick={() => setAncre(ajouterJours(ancre, -7))} aria-label="Semaine précédente" />
              <button
                onClick={() => setAncre(aujourdhui())}
                className="rounded-[7px] px-2.5 py-1.5 text-[0.8rem] font-medium text-ink hover:bg-surface-hover"
              >
                Aujourd'hui
              </button>
              <Bouton variante="discret" taille="sm" icone="chevronDroit" onClick={() => setAncre(ajouterJours(ancre, 7))} aria-label="Semaine suivante" />
            </div>
            <div className="hidden gap-0.5 rounded-lg border border-trait bg-surface-2 p-0.5 sm:flex">
              {(["semaine", "liste"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVue(v)}
                  className={cx(
                    "rounded-[7px] px-3 py-1.5 text-[0.8rem] font-medium capitalize transition-colors",
                    vue === v ? "bg-surface text-ink shadow-[var(--shadow-carte)]" : "text-ink-muted hover:text-ink",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <Bouton taille="sm" icone="telecharger" onClick={exporter}>
              Exporter
            </Bouton>
          </>
        }
      />

      {isLoading && <Squelette className="h-[32rem]" />}
      {error && <Erreur message={(error as Error).message} onReessayer={refetch} />}

      {data && (
        <>
          {data.resume.nbCours === 0 ? (
            <Carte>
              <Vide
                titre="Aucun cours cette semaine"
                message="Vacances scolaires, ou emploi du temps non encore publié."
                icone="calendrier"
                action={
                  ancre !== aujourdhui() ? (
                    <Bouton icone="calendrier" onClick={() => setAncre(aujourdhui())}>
                      Revenir à aujourd'hui
                    </Bouton>
                  ) : undefined
                }
              />
            </Carte>
          ) : vue === "semaine" ? (
            <Carte className="overflow-hidden">
              {/* En-tetes de jours */}
              <div className="flex border-b border-trait bg-surface-2">
                <div className="w-12 shrink-0 sm:w-14" />
                {joursOuvres.map((j) => {
                  const estAujourdhui = j.date === aujourdhui();
                  return (
                    <div key={j.date} className="min-w-0 flex-1 px-1 py-2.5 text-center">
                      <p className="text-[0.7rem] text-ink-muted capitalize">{jourCourt(j.date)}</p>
                      <p
                        className={cx(
                          "mx-auto mt-0.5 grid size-6 place-items-center rounded-full text-[0.82rem] font-semibold tabular-nums",
                          estAujourdhui ? "bg-accent text-white" : "text-ink",
                        )}
                      >
                        {numeroJour(j.date)}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Grille horaire */}
              <div className="relative flex overflow-x-auto py-2.5">
                <div className="relative w-12 shrink-0 sm:w-14" style={{ height: grille.hauteur }}>
                  {grille.heures.map((m) => (
                    <div
                      key={m}
                      className="absolute right-2 -translate-y-1/2 text-[0.68rem] text-ink-muted tabular-nums"
                      style={{ top: (m - grille.debut) * 1.05 }}
                    >
                      {String(Math.floor(m / 60)).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>
                {joursOuvres.map((j) => (
                  <div key={j.date} className="relative min-w-[7.5rem] flex-1 border-l border-trait" style={{ height: grille.hauteur }}>
                    {grille.heures.map((m) => (
                      <div
                        key={m}
                        className="absolute inset-x-0 border-t border-[var(--grille)]"
                        style={{ top: (m - grille.debut) * 1.05 }}
                        aria-hidden="true"
                      />
                    ))}
                    {j.cours.map((c) => (
                      <BlocCours key={c.id} cours={c} debutGrille={grille.debut} pxParMinute={1.05} onOuvrir={setCoursOuvert} />
                    ))}
                  </div>
                ))}
              </div>
            </Carte>
          ) : (
            <div className="flex flex-col gap-3">
              {joursOuvres
                .filter((j) => j.cours.length)
                .map((j) => (
                  <Carte key={j.date}>
                    <div className="flex items-center justify-between border-b border-trait px-4 py-2.5">
                      <p className="text-[0.85rem] font-semibold text-ink">{capitaliser(dateLongue(j.date))}</p>
                      <span className="text-[0.75rem] text-ink-muted">{duree(j.heuresDeCours * 60)}</span>
                    </div>
                    <ul className="echelonne divide-y divide-[var(--trait)]">
                      {j.cours.map((c, i) => (
                        <li key={c.id} style={rang(i)} className={cx(c.annule && "opacity-55")}>
                          <button
                            type="button"
                            onClick={() => setCoursOuvert(c)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-hover"
                          >
                          <span className="w-[5.6rem] shrink-0 text-[0.78rem] text-ink-muted tabular-nums">
                            {c.debut} – {c.fin}
                          </span>
                          <span className="h-7 w-[3px] shrink-0 rounded-full" style={{ background: couleur(c.couleur) }} aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className={cx("truncate text-[0.85rem] font-medium text-ink", c.annule && "line-through")}>{c.matiere}</p>
                            <p className="truncate text-[0.75rem] text-ink-muted">
                              {[c.salle, c.professeur].filter(Boolean).join(" · ") || "—"}
                            </p>
                          </div>
                            {c.annule && <Badge ton="critique">Annulé</Badge>}
                            {c.type === "evaluation" && !c.annule && <Badge ton="attention">Évaluation</Badge>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Carte>
                ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.78rem] text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <Icone nom="calendrier" taille={14} /> {data.resume.nbCours} cours
            </span>
            {data.resume.nbEvaluations > 0 && (
              <span className="inline-flex items-center gap-1.5 text-serieux">
                <Icone nom="attention" taille={14} /> {data.resume.nbEvaluations} evaluation(s)
              </span>
            )}
            {data.resume.nbAnnules > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Icone nom="fermer" taille={14} /> {data.resume.nbAnnules} annule(s)
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default EmploiDuTempsPage;
