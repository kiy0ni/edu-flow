import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch } from "../lib/api";
import { useTheme } from "../lib/theme";
import { Badge, Bouton, Carte, Chiffres, EnteteCarte, EntetePage, Erreur, Onglets, Pastille, Repliable, Squelette, Vide, cx, rang } from "../components/ui";
import { Icone } from "../lib/icones";
import { dateLongue, duree, relatif, aujourdhui, ajouterJours, capitaliser } from "../lib/format";
import ChargeDeTravail from "../components/charts/ChargeDeTravail";
import type { Devoir } from "../lib/types";

interface Reponse {
  devoirs: Devoir[];
  resume: { total: number; aFaire: number; enRetard: number; controles: number };
}

interface Charge {
  jours: { date: string; minutes: number; niveau: "faible" | "moyen" | "eleve"; controles: number }[];
  totalMinutes: number;
  moyenneParJour: number;
}

const TYPE_LIBELLE: Record<Devoir["type"], string> = {
  devoir: "Exercices",
  controle: "Évaluation",
  lecon: "Leçon",
};

const LigneDevoir = ({ devoir, rang: index, onBascule }: { devoir: Devoir; rang: number; onBascule: (d: Devoir) => void }) => {
  const { couleur } = useTheme();
  const [deplie, setDeplie] = useState(false);

  return (
    <li style={rang(index)} className={cx("transition-colors", devoir.fait && "opacity-60")}>
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          onClick={() => onBascule(devoir)}
          aria-label={devoir.fait ? "Marquer comme à faire" : "Marquer comme fait"}
          className={cx(
            "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors",
            devoir.fait ? "border-bon bg-bon text-white" : "border-trait-fort hover:border-accent",
          )}
        >
          {devoir.fait && <Icone nom="valide" taille={12} />}
        </button>

        <button onClick={() => setDeplie((v) => !v)} className="min-w-0 flex-1 text-left">
          <p className={cx("text-[0.875rem] font-medium text-ink", devoir.fait && "line-through")}>{devoir.intitule}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.75rem] text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <Pastille couleur={couleur(devoir.couleur)} taille={7} />
              {devoir.matiere}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icone nom="horloge" taille={12} />
              {duree(devoir.dureeEstimee)}
            </span>
            <span>{TYPE_LIBELLE[devoir.type]}</span>
            {devoir.rendreEnLigne && <span className="inline-flex items-center gap-1"><Icone nom="telecharger" taille={12} />À rendre en ligne</span>}
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {devoir.enRetard ? (
            <Badge ton="critique" icone="attention">
              {Math.abs(devoir.joursRestants)} j de retard
            </Badge>
          ) : (
            <Badge ton={devoir.joursRestants <= 1 ? "attention" : "neutre"}>{relatif(devoir.dueDate)}</Badge>
          )}
          <Icone nom={deplie ? "chevronBas" : "chevronDroit"} taille={15} className="text-ink-muted" />
        </div>
      </div>

      {deplie && (
        <div className="apparition border-t border-trait bg-surface-2 px-4 py-3 pl-[2.6rem]">
          {devoir.contenu ? (
            <p className="text-[0.82rem] leading-relaxed text-ink-2">{devoir.contenu}</p>
          ) : (
            <p className="text-[0.82rem] text-ink-muted">Aucun détail fourni par l'enseignant.</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.75rem] text-ink-muted">
            {devoir.donneLe && <span>Donné le {dateLongue(devoir.donneLe)}</span>}
            <span>· Difficulte estimee {devoir.difficulte}/5</span>
          </div>
          {devoir.documents.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {devoir.documents.map((doc) => (
                <li key={doc.id}>
                  <Badge icone="dossier">{doc.nom}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
};

export const DevoirsPage = () => {
  const client = useQueryClient();
  const naviguer = useNavigate();
  const { couleur: couleurTheme } = useTheme();
  const [filtre, setFiltre] = useState<"a-faire" | "tous" | "controles">("a-faire");
  const [matiere, setMatiere] = useState<string | null>(null);

  const from = ajouterJours(aujourdhui(), -14);
  const to = ajouterJours(aujourdhui(), 45);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["devoirs", from, to],
    queryFn: () => get<Reponse>(`/devoirs?from=${from}&to=${to}`),
  });
  const { data: charge } = useQuery({ queryKey: ["charge"], queryFn: () => get<Charge>("/devoirs/charge?jours=14") });

  const bascule = useMutation({
    mutationFn: (devoir: Devoir) => patch(`/devoirs/${encodeURIComponent(devoir.id)}`, { fait: !devoir.fait }),
    // Retour immediat : la case se coche avant l'aller-retour reseau.
    onMutate: async (devoir) => {
      await client.cancelQueries({ queryKey: ["devoirs", from, to] });
      const precedent = client.getQueryData<Reponse>(["devoirs", from, to]);
      client.setQueryData<Reponse>(["devoirs", from, to], (ancien) =>
        ancien
          ? { ...ancien, devoirs: ancien.devoirs.map((d) => (d.id === devoir.id ? { ...d, fait: !d.fait } : d)) }
          : ancien,
      );
      return { precedent };
    },
    onError: (_e, _v, contexte) => {
      if (contexte?.precedent) client.setQueryData(["devoirs", from, to], contexte.precedent);
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: ["devoirs"] });
      client.invalidateQueries({ queryKey: ["charge"] });
      client.invalidateQueries({ queryKey: ["accueil"] });
    },
  });

  // Matières réellement présentes sur la période, avec leur volume restant.
  const matieres = useMemo(() => {
    const map = new Map<string, { code: string; nom: string; couleur: Devoir["couleur"]; restants: number }>();
    for (const d of data?.devoirs ?? []) {
      const entree = map.get(d.matiereCode) ?? { code: d.matiereCode, nom: d.matiere, couleur: d.couleur, restants: 0 };
      if (!d.fait) entree.restants += 1;
      map.set(d.matiereCode, entree);
    }
    return [...map.values()].sort((a, b) => b.restants - a.restants || a.nom.localeCompare(b.nom));
  }, [data?.devoirs]);

  const groupes = useMemo(() => {
    let liste = data?.devoirs ?? [];
    if (filtre === "a-faire") liste = liste.filter((d) => !d.fait);
    if (filtre === "controles") liste = liste.filter((d) => d.type === "controle");
    if (matiere) liste = liste.filter((d) => d.matiereCode === matiere);

    const map = new Map<string, Devoir[]>();
    for (const d of liste) {
      if (!map.has(d.dueDate)) map.set(d.dueDate, []);
      map.get(d.dueDate)!.push(d);
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  }, [data?.devoirs, filtre, matiere]);

  if (isLoading) return <Squelette className="h-[32rem]" />;
  if (error || !data) return <Erreur message={(error as Error)?.message ?? "Indisponible."} onReessayer={refetch} />;

  return (
    <div className="apparition">
      <EntetePage
        titre="Devoirs"
        sousTitre="Cahier de textes et travail personnel"
        actions={
          <Onglets
            valeur={filtre}
            onChange={setFiltre}
            options={[
              { valeur: "a-faire", libelle: "À faire", compteur: data.resume.aFaire },
              { valeur: "controles", libelle: "Évaluations", compteur: data.resume.controles },
              { valeur: "tous", libelle: "Tous", compteur: data.resume.total },
            ]}
          />
        }
      />

      <Chiffres
        entrees={[
          { libelle: "À faire", valeur: data.resume.aFaire },
          {
            libelle: "En retard",
            valeur: data.resume.enRetard,
            ton: data.resume.enRetard ? "critique" : "neutre",
            detail: data.resume.enRetard ? "À traiter en priorité" : "Rien en retard",
          },
          { libelle: "Évaluations à venir", valeur: data.resume.controles, ton: data.resume.controles ? "attention" : "neutre" },
          {
            libelle: "Travail estimé",
            valeur: duree(charge?.totalMinutes ?? 0),
            detail: charge ? `${duree(charge.moyenneParJour)} par jour` : undefined,
          },
        ]}
      />

      {matieres.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          <button
            onClick={() => setMatiere(null)}
            className={cx(
              "pressable rounded-lg border px-3 py-1.5 text-[0.8rem] font-medium",
              matiere === null
                ? "border-transparent bg-accent-doux text-accent-ink"
                : "border-trait bg-surface text-ink-2 hover:bg-surface-hover",
            )}
          >
            Toutes les matières
          </button>
          {matieres.map((m) => (
            <button
              key={m.code}
              onClick={() => setMatiere(matiere === m.code ? null : m.code)}
              className={cx(
                "pressable inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[0.8rem] font-medium",
                matiere === m.code
                  ? "border-transparent bg-accent-doux text-accent-ink"
                  : "border-trait bg-surface text-ink-2 hover:bg-surface-hover",
              )}
            >
              <Pastille couleur={couleurTheme(m.couleur)} taille={7} />
              {m.nom}
              {m.restants > 0 && <span className="text-ink-muted">{m.restants}</span>}
            </button>
          ))}
        </div>
      )}

      {charge && charge.jours.length > 0 && (
        <div className="mt-4">
          <Repliable titre="Charge de travail à venir" sousTitre="Temps de travail estimé par jour d'échéance">
            <div className="p-5">
              <ChargeDeTravail jours={charge.jours} />
            </div>
          </Repliable>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {groupes.length === 0 && (
          <Carte>
            <Vide
              titre={filtre === "a-faire" ? "Tout est fait" : "Aucun devoir"}
              message={
                filtre === "a-faire"
                  ? "Aucun travail en attente sur la période. Anticipez les prochaines évaluations."
                  : undefined
              }
              icone="valide"
              action={
                filtre === "a-faire" ? (
                  <Bouton icone="boussole" onClick={() => naviguer("/planificateur")}>
                    Planifier ma semaine
                  </Bouton>
                ) : (
                  <Bouton icone="recharger" onClick={() => setFiltre("a-faire")}>
                    Voir le travail à faire
                  </Bouton>
                )
              }
            />
          </Carte>
        )}
        {groupes.map(([date, devoirs]) => (
          <Carte key={date}>
            <EnteteCarte
              titre={<span>{capitaliser(dateLongue(date))}</span>}
              sousTitre={`${devoirs.length} élément(s) · ${duree(devoirs.reduce((a, d) => a + d.dureeEstimee, 0))}`}
              action={
                date < aujourdhui() ? (
                  <Badge ton="critique">Échéance passee</Badge>
                ) : date === aujourdhui() ? (
                  <Badge ton="accent">Aujourd'hui</Badge>
                ) : null
              }
            />
            <ul className="echelonne divide-y divide-[var(--trait)]">
              {devoirs.map((d, i) => (
                <LigneDevoir key={d.id} devoir={d} rang={i} onBascule={(x) => bascule.mutate(x)} />
              ))}
            </ul>
          </Carte>
        ))}
      </div>
    </div>
  );
};

export default DevoirsPage;
