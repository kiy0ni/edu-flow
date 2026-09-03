import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CadreGraphique, Infobulle, SERIE_CLASSE, SERIE_ELEVE, axe } from "./chrome";
import { note } from "../../lib/format";
import { Vide } from "../ui";
import type { MoyenneMatiere } from "../../lib/types";

/**
 * Comparaison matiere par matiere.
 * Deux series seulement (l'eleve / la classe) : la matiere est portee par
 * l'etiquette d'axe, pas par une couleur - une couleur par matiere serait
 * decorative et impossible a distinguer au-dela de quelques entrees.
 */
export const MoyennesParMatiere = ({
  matieres,
  hauteur,
}: {
  matieres: MoyenneMatiere[];
  hauteur?: number;
}) => {
  const donnees = matieres
    .filter((m) => m.moyenne !== null)
    .map((m) => ({
      matiere: m.matiere.length > 18 ? `${m.matiere.slice(0, 17)}.` : m.matiere,
      complet: m.matiere,
      moyenne: m.moyenne,
      moyenneClasse: m.moyenneClasse,
    }));

  if (!donnees.length) {
    return (
      <CadreGraphique titre="Moyennes par matière" hauteur={200}>
        <Vide titre="Aucune note" message="Les moyennes apparaitront des la première note." icone="notes" />
      </CadreGraphique>
    );
  }

  return (
    <CadreGraphique
      titre="Moyennes par matière"
      sousTitre="Comparaison avec la moyenne de la classe"
      legende={[
        { libelle: "Ma moyenne", couleur: SERIE_ELEVE },
        { libelle: "Moyenne de classe", couleur: SERIE_CLASSE },
      ]}
      hauteur={hauteur ?? Math.max(220, donnees.length * 38)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={donnees} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 8 }} barGap={2}>
          <CartesianGrid stroke="var(--grille)" horizontal={false} />
          <XAxis type="number" domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} {...axe} />
          <YAxis type="category" dataKey="matiere" width={124} {...axe} />
          <Tooltip
            content={<Infobulle formatteur={(v) => `${note(Number(v))}/20`} />}
            cursor={{ fill: "var(--surface-hover)" }}
          />
          <Bar dataKey="moyenne" name="Ma moyenne" fill={SERIE_ELEVE} radius={[0, 4, 4, 0]} maxBarSize={11} />
          <Bar dataKey="moyenneClasse" name="Moyenne de classe" fill={SERIE_CLASSE} radius={[0, 4, 4, 0]} maxBarSize={11} />
        </BarChart>
      </ResponsiveContainer>
    </CadreGraphique>
  );
};

export default MoyennesParMatiere;
