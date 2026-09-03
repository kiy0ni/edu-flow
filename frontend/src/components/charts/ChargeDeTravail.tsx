import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CadreGraphique, Infobulle, axe, grille } from "./chrome";
import { dateCourte, duree } from "../../lib/format";
import { Vide } from "../ui";

interface Jour {
  date: string;
  minutes: number;
  niveau: "faible" | "moyen" | "eleve";
  controles: number;
}

/**
 * Charge de travail a venir.
 * Mesure unique : la couleur encode ici un *etat* (charge faible / moyenne /
 * elevee) et provient donc de la palette de statut, jamais de la palette de
 * series. L'état est aussi ecrit dans la legende et dans l'infobulle.
 */
const COULEUR_NIVEAU: Record<Jour["niveau"], string> = {
  faible: "var(--bon)",
  moyen: "var(--attention)",
  eleve: "var(--critique)",
};

const LIBELLE_NIVEAU: Record<Jour["niveau"], string> = {
  faible: "Charge légère",
  moyen: "Charge moyenne",
  eleve: "Charge élevée",
};

export const ChargeDeTravail = ({ jours, hauteur = 200 }: { jours: Jour[]; hauteur?: number }) => {
  if (!jours.length) {
    return (
      <CadreGraphique titre="Charge de travail" hauteur={hauteur}>
        <Vide titre="Rien de prévu" message="Aucun devoir à rendre sur la période." icone="devoirs" />
      </CadreGraphique>
    );
  }

  const donnees = jours.map((j) => ({ ...j, libelle: dateCourte(j.date) }));
  const niveauxPresents = (["faible", "moyen", "eleve"] as const).filter((n) => jours.some((j) => j.niveau === n));

  return (
    <CadreGraphique
      titre="Charge de travail à venir"
      sousTitre="Temps de travail estimé par jour d'échéance"
      legende={niveauxPresents.map((n) => ({ libelle: LIBELLE_NIVEAU[n], couleur: COULEUR_NIVEAU[n] }))}
      hauteur={hauteur}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={donnees} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
          <CartesianGrid {...grille} />
          <XAxis dataKey="libelle" {...axe} />
          <YAxis {...axe} width={48} tickFormatter={(v) => (v >= 60 ? `${Math.round(v / 60)} h` : `${v} m`)} />
          <Tooltip
            cursor={{ fill: "var(--surface-hover)" }}
            content={
              <Infobulle
                formatteur={(v, nom) => (nom === "Travail estimé" ? duree(Number(v)) : String(v))}
              />
            }
          />
          <Bar dataKey="minutes" name="Travail estimé" radius={[4, 4, 0, 0]} maxBarSize={34}>
            {donnees.map((j) => (
              <Cell key={j.date} fill={COULEUR_NIVEAU[j.niveau]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </CadreGraphique>
  );
};

export default ChargeDeTravail;
