import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { get } from "../lib/api";
import { Badge, Bouton, Carte, Chiffres, EnteteCarte, EntetePage, Erreur, Onglets, Squelette, Vide, rang } from "../components/ui";
import { Icone } from "../lib/icones";
import { dateLongue, duree, capitaliser } from "../lib/format";
import type { Brouillon } from "./Messagerie";
import type { EvenementVieScolaire } from "../lib/types";

interface Reponse {
  evenements: EvenementVieScolaire[];
  synthese: {
    absences: number;
    absencesNonJustifiees: number;
    heuresManquees: number;
    retards: number;
    retardsNonJustifies: number;
    sanctions: number;
  };
}

const LIBELLE: Record<EvenementVieScolaire["type"], string> = {
  absence: "Absence",
  retard: "Retard",
  sanction: "Observation",
};

const ICONE: Record<EvenementVieScolaire["type"], string> = {
  absence: "presence",
  retard: "horloge",
  sanction: "attention",
};

export const VieScolairePage = () => {
  const naviguer = useNavigate();
  const [filtre, setFiltre] = useState<"tous" | "absence" | "retard" | "sanction">("tous");

  /**
   * Ouvre la messagerie avec un justificatif déjà rédigé.
   * Sans cela, l'écran se contentait d'indiquer qu'un justificatif était
   * attendu, sans offrir aucun moyen de le transmettre.
   */
  const justifier = (evenements: EvenementVieScolaire[]) => {
    const liste = evenements
      .map((e) => `— ${LIBELLE[e.type].toLowerCase()} du ${dateLongue(e.date)}${e.debut ? ` (${e.debut}${e.fin ? `–${e.fin}` : ""})` : ""}`)
      .join("\n");
    const brouillon: Brouillon = {
      destinataireId: "svc:vie-scolaire",
      destinataireNom: "Vie scolaire",
      sujet: evenements.length > 1 ? "Justificatifs d'absence" : "Justificatif d'absence",
      corps:
        `Bonjour,\n\nJe vous transmets le motif ${evenements.length > 1 ? "des événements suivants" : "de l'événement suivant"} :\n\n${liste}\n\n` +
        "Motif : \n\nCordialement.",
    };
    naviguer("/messagerie", { state: { brouillon } });
  };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["vie-scolaire"],
    queryFn: () => get<Reponse>("/vie-scolaire"),
  });

  if (isLoading) return <Squelette className="h-[28rem]" />;
  if (error || !data) return <Erreur message={(error as Error)?.message ?? "Indisponible."} onReessayer={refetch} />;

  const { synthese } = data;
  const evenements = filtre === "tous" ? data.evenements : data.evenements.filter((e) => e.type === filtre);
  const aJustifier = data.evenements.filter((e) => !e.justifie && e.type !== "sanction");

  return (
    <div className="apparition">
      <EntetePage
        titre="Vie scolaire"
        sousTitre="Absences, retards et observations"
        actions={
          <Onglets
            valeur={filtre}
            onChange={setFiltre}
            options={[
              { valeur: "tous", libelle: "Tout", compteur: data.evenements.length },
              { valeur: "absence", libelle: "Absences", compteur: synthese.absences },
              { valeur: "retard", libelle: "Retards", compteur: synthese.retards },
              { valeur: "sanction", libelle: "Observations", compteur: synthese.sanctions },
            ]}
          />
        }
      />

      <Chiffres
        entrees={[
          { libelle: "Absences", valeur: synthese.absences, detail: `${duree(synthese.heuresManquees * 60)} de cours manqués` },
          {
            libelle: "Non justifiées",
            valeur: synthese.absencesNonJustifiees,
            ton: synthese.absencesNonJustifiees ? "attention" : "bon",
            detail: synthese.absencesNonJustifiees ? "Justificatif attendu" : "Tout est justifié",
          },
          { libelle: "Retards", valeur: synthese.retards, detail: `dont ${synthese.retardsNonJustifies} non justifié(s)` },
          { libelle: "Observations", valeur: synthese.sanctions },
        ]}
      />

      {aJustifier.length > 0 && (
        <Carte className="mt-4 border-[color-mix(in_srgb,var(--serieux)_35%,transparent)] p-4">
          <div className="flex flex-wrap items-start gap-3">
            <Icone nom="attention" taille={18} className="mt-0.5 shrink-0 text-serieux" />
            <div className="min-w-0 flex-1">
              <p className="text-[0.875rem] font-medium text-ink">
                {aJustifier.length} événement(s) en attente de justificatif
              </p>
              <p className="mt-0.5 text-[0.82rem] text-ink-muted">
                Transmettez le motif à la vie scolaire : le message part depuis votre messagerie.
              </p>
            </div>
            <Bouton icone="envoyer" onClick={() => justifier(aJustifier)} className="shrink-0">
              Tout justifier
            </Bouton>
          </div>
        </Carte>
      )}

      <Carte className="mt-4">
        <EnteteCarte titre="Historique" icone="presence" sousTitre={`${evenements.length} événement(s)`} />
        {evenements.length ? (
          <ul className="echelonne divide-y divide-[var(--trait)]">
            {evenements.map((e, i) => (
              <li key={e.id} style={rang(i)} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-hover text-ink-muted">
                  <Icone nom={ICONE[e.type]} taille={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.875rem] font-medium text-ink">
                    {LIBELLE[e.type]}
                    {e.duree ? ` · ${duree(e.duree)}` : ""}
                  </p>
                  <p className="mt-0.5 text-[0.78rem] text-ink-muted">
                    {capitaliser(dateLongue(e.date))}
                    {e.debut && ` · ${e.debut}${e.fin ? `–${e.fin}` : ""}`}
                  </p>
                  <p className="mt-1 text-[0.8rem] text-ink-2">Motif : {e.motif}</p>
                  {e.commentaire && <p className="mt-0.5 text-[0.78rem] text-ink-muted">{e.commentaire}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge ton={e.justifie ? "bon" : "attention"} icone={e.justifie ? "valide" : "attention"}>
                    {e.justifie ? "Justifié" : "À justifier"}
                  </Badge>
                  {!e.justifie && e.type !== "sanction" && (
                    <Bouton
                      variante="discret"
                      taille="sm"
                      icone="envoyer"
                      onClick={() => justifier([e])}
                      aria-label={`Justifier ${LIBELLE[e.type].toLowerCase()} du ${dateLongue(e.date)}`}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Vide titre="Aucun événement" message="Rien à signaler sur cette catégorie." icone="valide" />
        )}
      </Carte>
    </div>
  );
};

export default VieScolairePage;
