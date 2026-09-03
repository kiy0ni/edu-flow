import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, patch, post } from "../lib/api";
import { Badge, Bouton, Carte, Champ, Chiffres, EnteteCarte, EntetePage, Erreur, Modale, Squelette, Vide, cx } from "../components/ui";
import { Icone } from "../lib/icones";
import { aujourdhui, ajouterJours, dateLongue, duree, capitaliser } from "../lib/format";
import type { BlocPlan } from "../lib/types";

interface Plan {
  from: string;
  to: string;
  jours: { date: string; jour: string; blocs: BlocPlan[]; minutes: number }[];
  total: { blocs: number; faits: number; minutes: number };
}

interface Generation {
  horizon: number;
  parametres: { debut: string; fin: string; dureeBloc: number; pause: number; joursOff: string[] };
  statistiques: {
    blocsPlanifies: number;
    minutesPlanifiees: number;
    creneauxDisponibles: number;
    creneauxLibresRestants: number;
    tachesIdentifiees: number;
    couverture: number;
  };
}

const COULEUR_KIND: Record<BlocPlan["kind"], string> = {
  controle: "var(--critique)",
  devoir: "var(--accent)",
  revision: "var(--bon)",
  pause: "var(--ink-muted)",
  autre: "var(--ink-muted)",
};

const LIBELLE_KIND: Record<BlocPlan["kind"], string> = {
  controle: "Évaluation",
  devoir: "Devoir",
  revision: "Révision",
  pause: "Pause",
  autre: "Autre",
};

export const PlanificateurPage = () => {
  const client = useQueryClient();
  const [horizon, setHorizon] = useState(7);
  const [rapport, setRapport] = useState<Generation | null>(null);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [nouveau, setNouveau] = useState({ date: aujourdhui(), debut: "18:00", fin: "19:00", titre: "" });

  const from = aujourdhui();
  const to = ajouterJours(from, horizon);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["plan", from, to],
    queryFn: () => get<Plan>(`/planificateur?from=${from}&to=${to}`),
  });

  const invalider = () => {
    client.invalidateQueries({ queryKey: ["plan"] });
    client.invalidateQueries({ queryKey: ["accueil"] });
  };

  const generer = useMutation({
    mutationFn: () => post<Generation>("/planificateur/generer", { horizon }),
    onSuccess: (r) => {
      setRapport(r);
      invalider();
    },
  });

  const majStatut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BlocPlan["status"] }) =>
      patch(`/planificateur/blocs/${id}`, { status }),
    onSuccess: invalider,
  });

  const supprimer = useMutation({
    mutationFn: (id: string) => del(`/planificateur/blocs/${id}`),
    onSuccess: invalider,
  });

  const ajouter = useMutation({
    mutationFn: () => post("/planificateur/blocs", nouveau),
    onSuccess: () => {
      setAjoutOuvert(false);
      setNouveau({ date: aujourdhui(), debut: "18:00", fin: "19:00", titre: "" });
      invalider();
    },
  });

  if (isLoading) return <Squelette className="h-[30rem]" />;
  if (error || !data) return <Erreur message={(error as Error)?.message ?? "Indisponible."} onReessayer={refetch} />;

  const progression = data.total.blocs ? Math.round((data.total.faits / data.total.blocs) * 100) : 0;

  return (
    <div className="apparition">
      <EntetePage
        titre="Planificateur"
        sousTitre="Votre travail réparti automatiquement dans vos créneaux réellement libres"
        actions={
          <>
            <select
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
              className="rounded-lg border border-trait-fort bg-surface px-3 py-2 text-[0.8rem] text-ink"
            >
              {[3, 7, 14, 21].map((h) => (
                <option key={h} value={h}>
                  {h} prochains jours
                </option>
              ))}
            </select>
            <Bouton icone="plus" onClick={() => setAjoutOuvert(true)}>
              Ajouter
            </Bouton>
            <Bouton variante="primaire" icone="boussole" onClick={() => generer.mutate()} chargement={generer.isPending}>
              Générer le plan
            </Bouton>
          </>
        }
      />

      <Chiffres
        entrees={[
          { libelle: "Blocs planifiés", valeur: data.total.blocs },
          { libelle: "Temps planifié", valeur: duree(data.total.minutes) },
          {
            libelle: "Terminés",
            valeur: `${progression} %`,
            ton: progression >= 60 ? "bon" : "neutre",
            detail: `${data.total.faits} sur ${data.total.blocs}`,
          },
          {
            libelle: "Créneaux restants",
            valeur: rapport?.statistiques.creneauxLibresRestants ?? "—",
            detail: rapport ? "Encore disponibles" : "Générez un plan pour l'estimer",
          },
        ]}
      />

      {rapport && (
        <Carte className="mt-4 p-4">
          <div className="flex items-start gap-3">
            <Icone nom="valide" taille={18} className="mt-0.5 shrink-0 text-bon" />
            <div className="min-w-0 flex-1">
              <p className="text-[0.875rem] font-medium text-ink">
                {rapport.statistiques.blocsPlanifies} bloc(s) placés, soit {duree(rapport.statistiques.minutesPlanifiees)} de travail.
              </p>
              <p className="mt-1 text-[0.82rem] leading-relaxed text-ink-muted">
                {rapport.statistiques.tachesIdentifiees} tâche(s) identifiées à partir de vos devoirs, des évaluations
                annoncées, de vos cartes à réviser et de vos matières fragiles. Elles ont été réparties sur{" "}
                {rapport.statistiques.creneauxDisponibles} créneaux libres détectés entre {rapport.parametres.debut} et{" "}
                {rapport.parametres.fin}, en blocs de {rapport.parametres.dureeBloc} min.
              </p>
            </div>
            <Bouton variante="discret" taille="sm" icone="fermer" onClick={() => setRapport(null)} aria-label="Masquer" />
          </div>
        </Carte>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {data.jours.length === 0 && (
          <Carte>
            <Vide
              titre="Aucun plan pour l'instant"
              message="Le planificateur croise vos devoirs, vos évaluations et vos créneaux libres pour construire un programme réaliste."
              icone="boussole"
              action={
                <Bouton variante="primaire" icone="boussole" onClick={() => generer.mutate()} chargement={generer.isPending}>
                  Générer mon plan
                </Bouton>
              }
            />
          </Carte>
        )}

        {data.jours.map((jour) => (
          <Carte key={jour.date}>
            <EnteteCarte
              titre={<span>{capitaliser(dateLongue(jour.date))}</span>}
              sousTitre={`${jour.blocs.length} bloc(s) · ${duree(jour.minutes)}`}
              action={jour.date === aujourdhui() ? <Badge ton="accent">Aujourd'hui</Badge> : null}
            />
            <ul className="divide-y divide-[var(--trait)]">
              {jour.blocs.map((b) => (
                <li key={b.id} className={cx("flex items-start gap-3 px-4 py-3", b.status === "fait" && "opacity-60")}>
                  <button
                    onClick={() => majStatut.mutate({ id: b.id, status: b.status === "fait" ? "planifie" : "fait" })}
                    aria-label={b.status === "fait" ? "Marquer à faire" : "Marquer comme fait"}
                    className={cx(
                      "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors",
                      b.status === "fait" ? "border-bon bg-bon text-white" : "border-trait-fort hover:border-accent",
                    )}
                  >
                    {b.status === "fait" && <Icone nom="valide" taille={12} />}
                  </button>

                  <span className="w-[5.6rem] shrink-0 pt-px text-[0.78rem] text-ink-muted tabular-nums">
                    {b.debut} – {b.fin}
                  </span>

                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: COULEUR_KIND[b.kind] }} aria-hidden="true" />

                  <div className="min-w-0 flex-1">
                    <p className={cx("text-[0.85rem] font-medium text-ink", b.status === "fait" && "line-through")}>{b.titre}</p>
                    {b.detail && <p className="mt-0.5 line-clamp-2 text-[0.78rem] text-ink-muted">{b.detail}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-[0.72rem] text-ink-muted">{LIBELLE_KIND[b.kind]}</span>
                      {b.subject && <span className="text-[0.72rem] text-ink-muted">· {b.subject}</span>}
                      {!b.auto && <Badge>Ajout manuel</Badge>}
                    </div>
                  </div>

                  <Bouton
                    variante="discret"
                    taille="sm"
                    icone="corbeille"
                    onClick={() => supprimer.mutate(b.id)}
                    aria-label="Supprimer ce bloc"
                    className="shrink-0"
                  />
                </li>
              ))}
            </ul>
          </Carte>
        ))}
      </div>

      <Modale ouverte={ajoutOuvert} onFermer={() => setAjoutOuvert(false)} titre="Ajouter un bloc">
        <div className="flex flex-col gap-3">
          <Champ label="Intitule" value={nouveau.titre} onChange={(e) => setNouveau({ ...nouveau, titre: e.target.value })} placeholder="Revoir le chapitre 4" />
          <Champ label="Date" type="date" value={nouveau.date} onChange={(e) => setNouveau({ ...nouveau, date: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Champ label="Debut" type="time" value={nouveau.debut} onChange={(e) => setNouveau({ ...nouveau, debut: e.target.value })} />
            <Champ label="Fin" type="time" value={nouveau.fin} onChange={(e) => setNouveau({ ...nouveau, fin: e.target.value })} />
          </div>
          <Bouton
            variante="primaire"
            onClick={() => ajouter.mutate()}
            chargement={ajouter.isPending}
            disabled={!nouveau.titre || nouveau.fin <= nouveau.debut}
            className="mt-1"
          >
            Ajouter au plan
          </Bouton>
          {nouveau.fin <= nouveau.debut && <p className="text-[0.78rem] text-critique">L'heure de fin doit suivre l'heure de début.</p>}
        </div>
      </Modale>
    </div>
  );
};

export default PlanificateurPage;
