import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CadreGraphique, Infobulle, SERIE_CLASSE, SERIE_ELEVE, axe, grille } from "./chrome";
import { note } from "../../lib/format";
import { Vide } from "../ui";

interface Point {
  libelle: string;
  moyenne: number | null;
  moyenneClasse: number | null;
}

/** Évolution de la moyenne generale, periode par periode. */
export const Evolution = ({ donnees, hauteur = 240 }: { donnees: Point[]; hauteur?: number }) => {
  const exploitables = donnees.filter((d) => d.moyenne !== null);

  if (exploitables.length < 2) {
    return (
      <CadreGraphique titre="Évolution de la moyenne" hauteur={hauteur}>
        <Vide
          titre="Pas encore assez de recul"
          message="L'evolution s'affiche des qu'au moins deux périodes sont notees."
          icone="analyse"
        />
      </CadreGraphique>
    );
  }

  // Echelle resserree autour des valeurs, mais jamais trompeuse : on garde
  // une amplitude minimale de 4 points et on affiche l'axe.
  const valeurs = exploitables.flatMap((d) => [d.moyenne, d.moyenneClasse].filter((v): v is number => v !== null));
  const min = Math.max(0, Math.floor(Math.min(...valeurs) - 1));
  const max = Math.min(20, Math.ceil(Math.max(...valeurs) + 1));
  const domaine: [number, number] = max - min < 4 ? [Math.max(0, min - 2), Math.min(20, min + 4)] : [min, max];

  return (
    <CadreGraphique
      titre="Évolution de la moyenne"
      sousTitre="Moyenne générale par période, comparee à la classe"
      legende={[
        { libelle: "Ma moyenne", couleur: SERIE_ELEVE },
        { libelle: "Moyenne de classe", couleur: SERIE_CLASSE },
      ]}
      hauteur={hauteur}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={donnees} margin={{ top: 12, right: 16, bottom: 4, left: -12 }}>
          <CartesianGrid {...grille} />
          <XAxis dataKey="libelle" {...axe} />
          <YAxis domain={domaine} {...axe} width={44} tickFormatter={(v) => note(v, 0)} />
          <Tooltip
            content={<Infobulle formatteur={(v) => `${note(Number(v))}/20`} />}
            cursor={{ stroke: "var(--trait-fort)", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="moyenneClasse"
            name="Moyenne de classe"
            stroke={SERIE_CLASSE}
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)" }}
            activeDot={{ r: 5, strokeWidth: 2, fill: "var(--surface)" }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="moyenne"
            name="Ma moyenne"
            stroke={SERIE_ELEVE}
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)" }}
            activeDot={{ r: 5, strokeWidth: 2, fill: "var(--surface)" }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </CadreGraphique>
  );
};

export default Evolution;
