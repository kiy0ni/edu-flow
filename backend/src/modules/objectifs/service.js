import gateway from "../../providers/gateway.js";
import * as compute from "../grades/compute.js";
import { queryAll, queryOne, query } from "../../lib/db.js";
import { notFound } from "../../lib/errors.js";

export const CODE_GENERAL = "_GENERAL";

/** Coefficient de note habituel dans une matière : hypothèse de calcul crédible. */
const coefficientUsuel = (notes, matiereCode) => {
  const duSujet = notes.filter((n) => n.matiereCode === matiereCode);
  if (!duSujet.length) return 1;
  const moyen = duSujet.reduce((a, n) => a + n.coefficient, 0) / duSujet.length;
  return Math.max(1, Math.round(moyen));
};

/**
 * Objectifs de moyenne.
 *
 * Un objectif n'a d'intérêt que s'il dit quoi faire : chacun est donc renvoyé
 * avec l'écart restant et **la note nécessaire à la prochaine évaluation** pour
 * l'atteindre, coefficients compris.
 */
export const lister = async (user, { periode } = {}) => {
  const [{ notes, periodes, matieres }, lignes] = await Promise.all([
    gateway.notes(user, { periode: "annee" }),
    queryAll("SELECT * FROM objectifs WHERE user_id = $1", [user.id]),
  ]);

  const codePeriode = periode ?? periodes.at(-1)?.code ?? "annee";
  const duPeriode = codePeriode === "annee" ? notes : notes.filter((n) => n.periodeCode === codePeriode);
  const agregats = compute.parMatiere(duPeriode, matieres);
  const moyenne = compute.moyenneGenerale(agregats);
  const pertinents = lignes.filter((l) => l.periode_code === codePeriode);

  const objectifs = pertinents.map((ligne) => {
    const general = ligne.matiere_code === CODE_GENERAL;
    const agregat = general ? null : agregats.find((a) => a.matiereCode === ligne.matiere_code);
    const actuel = general ? moyenne : (agregat?.moyenne ?? null);
    const cible = Number(ligne.cible);
    const coefficient = general ? 1 : coefficientUsuel(duPeriode, ligne.matiere_code);

    return {
      matiereCode: ligne.matiere_code,
      matiere: general ? "Moyenne générale" : (agregat?.matiere ?? ligne.matiere_code),
      couleur: general ? null : (agregat?.couleur ?? null),
      periodeCode: ligne.periode_code,
      cible,
      actuel,
      ecart: actuel === null ? null : Math.round((actuel - cible) * 100) / 100,
      atteint: actuel !== null && actuel >= cible,
      // Pour un objectif de matière on vise la moyenne de la matière ;
      // pour l'objectif général, aucune note unique ne suffit à le garantir.
      noteNecessaire: general
        ? null
        : compute.noteNecessaire(duPeriode, matieres, {
            matiereCode: ligne.matiere_code,
            objectif: cible,
            coefficient,
            cible: "matiere",
          }),
      coefficientHypothese: coefficient,
      // Ce que donnerait au mieux une note maximale : évite un « impossible » sec.
      maxAtteignable: general
        ? null
        : compute.maxAtteignable(duPeriode, matieres, { matiereCode: ligne.matiere_code, coefficient, cible: "matiere" }),
      note: ligne.note,
    };
  });

  return {
    periodeCode: codePeriode,
    periodes,
    objectifs: objectifs.sort((a, b) =>
      a.matiereCode === CODE_GENERAL ? -1 : b.matiereCode === CODE_GENERAL ? 1 : a.matiere.localeCompare(b.matiere),
    ),
    disponibles: agregats
      .filter((a) => !pertinents.some((l) => l.matiere_code === a.matiereCode))
      .map((a) => ({ code: a.matiereCode, nom: a.matiere, moyenne: a.moyenne, couleur: a.couleur })),
    generalDefini: pertinents.some((l) => l.matiere_code === CODE_GENERAL),
    moyenneGenerale: moyenne,
  };
};

export const definir = (user, { matiereCode, periodeCode, cible, note = null }) =>
  queryOne(
    `INSERT INTO objectifs (user_id, matiere_code, periode_code, cible, note)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, matiere_code, periode_code)
       DO UPDATE SET cible = $4, note = $5, updated_at = now()
     RETURNING *`,
    [user.id, matiereCode, periodeCode, cible, note],
  );

export const supprimer = async (user, matiereCode, periodeCode) => {
  const { rowCount } = await query(
    "DELETE FROM objectifs WHERE user_id = $1 AND matiere_code = $2 AND periode_code = $3",
    [user.id, matiereCode, periodeCode],
  );
  if (!rowCount) throw notFound("Objectif introuvable.");
};
