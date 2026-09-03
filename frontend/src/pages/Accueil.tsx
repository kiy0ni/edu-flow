import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { get } from "../lib/api";
import { useTheme } from "../lib/theme";
import { Badge, Carte, Chiffres, Erreur, Pastille, Squelette, Vide, cx } from "../components/ui";
import { Icone } from "../lib/icones";
import { dateComplete, duree, note, relatif, capitaliser } from "../lib/format";
import type { Cours, Devoir, Note, Notification } from "../lib/types";

interface Accueil {
  date: string;
  jour: string;
  salutation: { prenom: string; classe: string | null; etablissement: string | null };
  journee: { cours: Cours[]; prochainCours: Cours | null; demain: Cours[]; heuresDeCours: number };
  devoirs: { aFaire: Devoir[]; pourDemain: number; enRetard: number; controlesSemaine: number };
  notes: { moyenneGenerale: number | null; moyenneClasse: number | null; dernieres: Note[] };
  revisions: {
    cartesDues: number;
    blocsDuJour: { id: string; titre: string; debut: string; fin: string; status: string }[];
    minutesPlanifiees: number;
  };
  serie: { courante: number; meilleure: number; actifAujourdhui: boolean; joursActifs30: number };
  notifications: { notifications: Notification[]; nonLues: number };
}

const salutation = () => {
  const h = new Date().getHours();
  if (h < 6) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
};

const LigneCours = ({ cours, prochain }: { cours: Cours; prochain?: boolean }) => {
  const { couleur } = useTheme();
  return (
    <li
      className={cx(
        "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
        prochain && "bg-accent-doux",
        cours.annule && "opacity-55",
      )}
    >
      <div className="w-[3rem] shrink-0 text-right">
        <p className="text-[0.8rem] font-medium text-ink tabular-nums">{cours.debut}</p>
        <p className="text-[0.7rem] text-ink-muted tabular-nums">{cours.fin}</p>
      </div>
      <span className="h-8 w-[3px] shrink-0 rounded-full" style={{ background: couleur(cours.couleur) }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={cx("truncate text-[0.85rem] font-medium text-ink", cours.annule && "line-through")}>
          {cours.matiere}
        </p>
        <p className="truncate text-[0.74rem] text-ink-muted">
          {[cours.salle, cours.professeur].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>
      {cours.annule && <Badge ton="critique">Annulé</Badge>}
      {cours.type === "evaluation" && !cours.annule && <Badge ton="attention">Évaluation</Badge>}
    </li>
  );
};

export const AccueilPage = () => {
  const { couleur } = useTheme();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["accueil"],
    queryFn: () => get<Accueil>("/accueil"),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <Squelette className="h-14 w-72" />
        <Squelette className="h-[5.5rem]" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Squelette className="h-80" />
          <Squelette className="h-80" />
        </div>
      </div>
    );
  }

  if (error || !data) return <Erreur message={(error as Error)?.message ?? "Données indisponibles."} onReessayer={refetch} />;

  const { journee, devoirs, notes, revisions } = data;
  const coursRestants = journee.cours.filter((c) => !c.annule);
  const blocsRestants = revisions.blocsDuJour.filter((b) => b.status !== "fait");

  // Un dimanche ou un jour férié, afficher un grand vide n'apporte rien :
  // la carte montre alors la journée suivante.
  const journeeVide = journee.cours.length === 0;
  const aAfficher = journeeVide ? journee.demain : journee.cours;

  // Une phrase suffit à résumer la journée : elle évite d'avoir à lire quatre tuiles.
  const resume = [
    coursRestants.length ? `${coursRestants.length} cours` : "aucun cours",
    devoirs.aFaire.length ? `${devoirs.aFaire.length} devoir(s) à faire` : "aucun devoir en attente",
    revisions.cartesDues ? `${revisions.cartesDues} carte(s) à réviser` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="apparition flex flex-col gap-5">
      <header>
        <h1 className="text-[1.5rem] leading-tight font-semibold tracking-tight text-ink">
          {salutation()}, {data.salutation.prenom}
        </h1>
        <p className="mt-1 text-[0.875rem] text-ink-muted">
          {capitaliser(dateComplete(data.date))} — {resume}.
        </p>
      </header>

      <Chiffres
        entrees={[
          {
            libelle: "Moyenne générale",
            valeur: note(notes.moyenneGenerale),
            unite: "/20",
            detail:
              notes.moyenneGenerale !== null && notes.moyenneClasse !== null
                ? `Classe : ${note(notes.moyenneClasse)}`
                : undefined,
          },
          {
            libelle: "Cours aujourd'hui",
            valeur: coursRestants.length,
            detail: journee.heuresDeCours ? duree(journee.heuresDeCours * 60) : "Journée libre",
          },
          {
            libelle: "Devoirs à faire",
            valeur: devoirs.aFaire.length,
            ton: devoirs.enRetard ? "critique" : "neutre",
            detail: devoirs.enRetard
              ? `${devoirs.enRetard} en retard`
              : devoirs.pourDemain
                ? `${devoirs.pourDemain} pour demain`
                : "Rien d'urgent",
          },
          {
            // La série ne motive que si elle est visible chaque jour.
            libelle: "Série de travail",
            valeur: data.serie.courante === 0 ? "—" : `${data.serie.courante} j`,
            ton: data.serie.courante >= 3 ? "bon" : "neutre",
            detail: data.serie.actifAujourdhui
              ? "Déjà travaillé aujourd'hui"
              : data.serie.courante > 0
                ? "À entretenir aujourd'hui"
                : revisions.minutesPlanifiees
                  ? `${duree(revisions.minutesPlanifiees)} planifiées`
                  : "Aucune activité récente",
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Journée — bascule sur demain les jours sans cours. */}
        <Carte className="flex flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-trait px-5 py-3.5">
            <div>
              <h2 className="text-[0.95rem] font-semibold tracking-tight text-ink">
                {journeeVide ? "Demain" : "Ma journée"}
              </h2>
              <p className="mt-0.5 text-[0.78rem] text-ink-muted">
                {journeeVide
                  ? journee.demain.length
                    ? `${journee.demain.length} cours à partir de ${journee.demain[0].debut}`
                    : "Aucun cours prévu"
                  : journee.prochainCours
                    ? `Prochain : ${journee.prochainCours.matiere} à ${journee.prochainCours.debut}`
                    : "Les cours de la journée sont terminés"}
              </p>
            </div>
            <Link
              to="/emploi-du-temps"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[0.78rem] font-medium text-accent-ink hover:bg-surface-hover"
            >
              Semaine <Icone nom="chevronDroit" taille={14} />
            </Link>
          </div>

          {aAfficher.length ? (
            <ul className="flex flex-col gap-0.5 p-2">
              {aAfficher.map((c) => (
                <LigneCours key={c.id} cours={c} prochain={!journeeVide && journee.prochainCours?.id === c.id} />
              ))}
            </ul>
          ) : (
            <Vide titre="Aucun cours prévu" message="Profitez-en pour prendre de l'avance." icone="calendrier" />
          )}
        </Carte>

        {/* Ce qu'il y a à faire — devoirs et plan réunis */}
        <Carte className="flex flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-trait px-5 py-3.5">
            <h2 className="text-[0.95rem] font-semibold tracking-tight text-ink">À faire</h2>
            <Link
              to="/devoirs"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[0.78rem] font-medium text-accent-ink hover:bg-surface-hover"
            >
              Tout voir <Icone nom="chevronDroit" taille={14} />
            </Link>
          </div>

          {devoirs.aFaire.length === 0 && blocsRestants.length === 0 ? (
            <Vide
              titre="Rien à faire"
              message="Tout est à jour. C'est le bon moment pour réviser ou prendre de l'avance."
              icone="valide"
              action={
                <Link
                  to="/revisions"
                  className="pressable inline-flex items-center gap-2 rounded-lg border border-trait bg-surface px-3.5 py-2 text-[0.875rem] font-medium text-ink hover:bg-surface-hover"
                >
                  <Icone nom="cartes" taille={15} />
                  Réviser mes cartes
                </Link>
              }
            />
          ) : (
            <div className="flex flex-col divide-y divide-[var(--trait)]">
              {devoirs.aFaire.slice(0, 4).map((d) => (
                <div key={d.id} className="flex items-start gap-2.5 px-5 py-3">
                  <Pastille couleur={couleur(d.couleur)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.82rem] font-medium text-ink">{d.intitule}</p>
                    <p className="mt-0.5 text-[0.74rem] text-ink-muted">
                      {d.matiere} · {relatif(d.dueDate)}
                    </p>
                  </div>
                  {d.enRetard ? (
                    <Badge ton="critique">Retard</Badge>
                  ) : d.type === "controle" ? (
                    <Badge ton="attention">Éval.</Badge>
                  ) : null}
                </div>
              ))}

              {blocsRestants.length > 0 && (
                <div className="px-5 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[0.72rem] font-semibold tracking-wider text-ink-muted uppercase">
                      Mon plan du jour
                    </p>
                    <Link to="/planificateur" className="text-[0.75rem] text-accent-ink hover:underline">
                      Ouvrir
                    </Link>
                  </div>
                  <ul className="flex flex-col gap-1">
                    {blocsRestants.slice(0, 3).map((b) => (
                      <li key={b.id} className="flex items-center gap-3 text-[0.8rem]">
                        <span className="w-[5rem] shrink-0 text-ink-muted tabular-nums">{b.debut} – {b.fin}</span>
                        <span className="min-w-0 flex-1 truncate text-ink-2">{b.titre}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Carte>
      </div>

      {/* Dernières notes */}
      <Carte>
        <div className="flex items-center justify-between gap-3 border-b border-trait px-5 py-3.5">
          <h2 className="text-[0.95rem] font-semibold tracking-tight text-ink">Dernières notes</h2>
          <Link
            to="/notes"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[0.78rem] font-medium text-accent-ink hover:bg-surface-hover"
          >
            Toutes mes notes <Icone nom="chevronDroit" taille={14} />
          </Link>
        </div>

        {notes.dernieres.length ? (
          <ul className="divide-y divide-[var(--trait)]">
            {notes.dernieres.map((n) => (
              <li key={n.id} className="flex items-center gap-3 px-5 py-2.5">
                <Pastille couleur={couleur(n.couleur)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.82rem] font-medium text-ink">{n.intitule}</p>
                  <p className="text-[0.74rem] text-ink-muted">
                    {n.matiere} · {relatif(n.date)}
                    {n.coefficient !== 1 && ` · coef. ${n.coefficient}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[0.92rem] font-semibold text-ink tabular-nums">
                    {note(n.valeur)}
                    <span className="text-[0.72rem] font-normal text-ink-muted">/{n.bareme}</span>
                  </p>
                  {n.moyenneClasse !== null && (
                    <p className="text-[0.7rem] text-ink-muted tabular-nums">classe {note(n.moyenneClasse)}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Vide titre="Aucune note" message="Les notes apparaîtront dès leur publication." icone="notes" />
        )}
      </Carte>
    </div>
  );
};

export default AccueilPage;
