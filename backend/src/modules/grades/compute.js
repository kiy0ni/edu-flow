import { subjectColor } from "../../providers/subjects.js";

/**
 * Calculs de moyennes.
 * Convention : chaque note est ramenee sur 20 puis ponderee par son coefficient.
 * La moyenne generale pondere ensuite chaque matiere par son coefficient de matiere.
 */

const sur20 = (note) => (note.valeur / (note.bareme || 20)) * 20;

const arrondi = (valeur, decimales = 2) => {
  if (valeur === null || !Number.isFinite(valeur)) return null;
  const f = 10 ** decimales;
  return Math.round(valeur * f) / f;
};

const moyennePonderee = (notes, extracteur = sur20) => {
  let total = 0;
  let poids = 0;
  for (const note of notes) {
    const valeur = extracteur(note);
    if (valeur === null || !Number.isFinite(valeur)) continue;
    const coef = Number(note.coefficient) || 1;
    total += valeur * coef;
    poids += coef;
  }
  return poids === 0 ? null : total / poids;
};

/** Tendance d'une matiere : compare la moyenne de la 1re moitie a celle de la 2e. */
const tendance = (notes) => {
  const chrono = [...notes].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (chrono.length < 4) return { direction: "stable", delta: 0 };
  const pivot = Math.floor(chrono.length / 2);
  const avant = moyennePonderee(chrono.slice(0, pivot));
  const apres = moyennePonderee(chrono.slice(pivot));
  if (avant === null || apres === null) return { direction: "stable", delta: 0 };
  const delta = arrondi(apres - avant);
  return {
    direction: delta >= 0.7 ? "hausse" : delta <= -0.7 ? "baisse" : "stable",
    delta,
  };
};

const ecartType = (valeurs) => {
  if (valeurs.length < 2) return 0;
  const moyenne = valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
  const variance = valeurs.reduce((acc, v) => acc + (v - moyenne) ** 2, 0) / valeurs.length;
  return arrondi(Math.sqrt(variance));
};

/** Agrege les notes par matiere. */
export const parMatiere = (notes, matieres = []) => {
  const significatives = notes.filter((n) => !n.nonSignificatif && Number.isFinite(n.valeur));
  const groupes = new Map();

  for (const note of significatives) {
    if (!groupes.has(note.matiereCode)) groupes.set(note.matiereCode, []);
    groupes.get(note.matiereCode).push(note);
  }

  const catalogue = new Map(matieres.map((m) => [m.code, m]));

  return [...groupes.entries()]
    .map(([code, liste]) => {
      const meta = catalogue.get(code) ?? {};
      const moyenne = moyennePonderee(liste);
      const classe = moyennePonderee(
        liste.filter((n) => Number.isFinite(n.moyenneClasse)),
        (n) => (n.moyenneClasse / (n.bareme || 20)) * 20,
      );
      return {
        matiereCode: code,
        matiere: liste[0].matiere ?? meta.nom ?? code,
        couleur: liste[0].couleur ?? subjectColor(code),
        professeur: liste[0].professeur ?? meta.professeur ?? null,
        coefficient: Number(meta.coefficient) || 1,
        nbNotes: liste.length,
        moyenne: arrondi(moyenne),
        moyenneClasse: arrondi(classe),
        ecartClasse: moyenne !== null && classe !== null ? arrondi(moyenne - classe) : null,
        min: arrondi(Math.min(...liste.map(sur20)), 1),
        max: arrondi(Math.max(...liste.map(sur20)), 1),
        regularite: ecartType(liste.map(sur20)),
        tendance: tendance(liste),
      };
    })
    .sort((a, b) => (b.moyenne ?? 0) - (a.moyenne ?? 0));
};

/** Moyenne generale, ponderee par les coefficients de matiere. */
export const moyenneGenerale = (agregats) => {
  let total = 0;
  let poids = 0;
  for (const m of agregats) {
    if (m.moyenne === null) continue;
    total += m.moyenne * m.coefficient;
    poids += m.coefficient;
  }
  return poids === 0 ? null : arrondi(total / poids);
};

export const moyenneClasseGenerale = (agregats) => {
  let total = 0;
  let poids = 0;
  for (const m of agregats) {
    if (m.moyenneClasse === null) continue;
    total += m.moyenneClasse * m.coefficient;
    poids += m.coefficient;
  }
  return poids === 0 ? null : arrondi(total / poids);
};

/** Moyenne generale periode par periode, pour tracer l'evolution. */
export const evolutionParPeriode = (notes, periodes, matieres) =>
  periodes.map((periode) => {
    const duPeriode = notes.filter((n) => n.periodeCode === periode.code);
    const agregats = parMatiere(duPeriode, matieres);
    return {
      periodeCode: periode.code,
      libelle: periode.libelle,
      moyenne: moyenneGenerale(agregats),
      moyenneClasse: moyenneClasseGenerale(agregats),
      nbNotes: duPeriode.length,
    };
  });

/**
 * Simulateur "et si".
 * @param ajouts   notes hypothetiques [{matiereCode, valeur, bareme, coefficient}]
 * @param exclusions identifiants de notes reelles a retirer du calcul
 */
export const simuler = (notes, matieres, { ajouts = [], exclusions = [] } = {}) => {
  const reference = parMatiere(notes, matieres);
  const base = {
    moyenneGenerale: moyenneGenerale(reference),
    parMatiere: reference,
  };

  const conservees = notes.filter((n) => !exclusions.includes(n.id));
  const hypothetiques = ajouts.map((a, i) => ({
    id: `sim-${i}`,
    date: "9999-12-31",
    matiereCode: a.matiereCode,
    matiere: matieres.find((m) => m.code === a.matiereCode)?.nom ?? a.matiereCode,
    couleur: subjectColor(a.matiereCode),
    valeur: a.valeur,
    bareme: a.bareme ?? 20,
    coefficient: a.coefficient ?? 1,
    moyenneClasse: null,
    nonSignificatif: false,
    simulee: true,
  }));

  const agregats = parMatiere([...conservees, ...hypothetiques], matieres);
  const simulee = moyenneGenerale(agregats);

  return {
    actuel: base.moyenneGenerale,
    simule: simulee,
    delta: base.moyenneGenerale !== null && simulee !== null ? arrondi(simulee - base.moyenneGenerale) : null,
    parMatiere: agregats.map((m) => {
      const avant = reference.find((r) => r.matiereCode === m.matiereCode);
      return {
        ...m,
        moyenneAvant: avant?.moyenne ?? null,
        deltaMatiere:
          avant?.moyenne != null && m.moyenne != null ? arrondi(m.moyenne - avant.moyenne) : null,
      };
    }),
  };
};

/**
 * Note minimale a obtenir dans une matiere pour atteindre une moyenne generale cible.
 * Renvoie null si l'objectif est hors d'atteinte sur une seule evaluation.
 */
/**
 * Plus petite note qui, ajoutée dans une matière, permet d'atteindre l'objectif.
 * `cible` indique ce que vise l'objectif : la moyenne générale ou celle de la
 * matière elle-même. Renvoie null si l'objectif est hors d'atteinte.
 */
export const noteNecessaire = (
  notes,
  matieres,
  { matiereCode, objectif, coefficient = 1, bareme = 20, cible = "generale" },
) => {
  for (let valeur = 0; valeur <= bareme; valeur += 0.25) {
    const resultat = simuler(notes, matieres, {
      ajouts: [{ matiereCode, valeur, bareme, coefficient }],
    });
    const atteint =
      cible === "matiere"
        ? (resultat.parMatiere.find((m) => m.matiereCode === matiereCode)?.moyenne ?? null)
        : resultat.simule;
    if (atteint !== null && atteint >= objectif) return arrondi(valeur, 2);
  }
  return null;
};

/**
 * Meilleure moyenne atteignable en ajoutant une note maximale.
 * Permet de dire « au mieux 13,8 » plutôt qu'un simple « impossible ».
 */
export const maxAtteignable = (notes, matieres, { matiereCode, coefficient = 1, bareme = 20, cible = "generale" }) => {
  const resultat = simuler(notes, matieres, {
    ajouts: [{ matiereCode, valeur: bareme, bareme, coefficient }],
  });
  return cible === "matiere"
    ? (resultat.parMatiere.find((m) => m.matiereCode === matiereCode)?.moyenne ?? null)
    : resultat.simule;
};

/**
 * Effet de levier de chaque matière sur la moyenne générale.
 *
 * La moyenne générale étant une moyenne pondérée, gagner un point dans une
 * matière la fait varier d'exactement coefficient / somme des coefficients.
 * Deux matières à 11/20 ne se valent donc pas : celle de coefficient 6 pèse six
 * fois plus que celle de coefficient 1. C'est ce que ce calcul rend visible.
 */
export const levier = (agregats) => {
  const exploitables = agregats.filter((m) => m.moyenne !== null);
  const totalCoef = exploitables.reduce((a, m) => a + m.coefficient, 0);
  if (!totalCoef) return [];

  return exploitables
    .map((m) => {
      const impactParPoint = m.coefficient / totalCoef;
      // Gain sur la moyenne générale si la matière rejoignait la classe.
      const marge = m.moyenneClasse === null ? 0 : Math.max(0, m.moyenneClasse - m.moyenne);
      return {
        matiereCode: m.matiereCode,
        matiere: m.matiere,
        couleur: m.couleur,
        coefficient: m.coefficient,
        moyenne: m.moyenne,
        moyenneClasse: m.moyenneClasse,
        impactParPoint: arrondi(impactParPoint, 3),
        margeVersClasse: arrondi(marge, 2),
        gainPotentiel: arrondi(marge * impactParPoint, 2),
      };
    })
    .sort((a, b) => b.gainPotentiel - a.gainPotentiel || b.impactParPoint - a.impactParPoint);
};

/**
 * Projection de la moyenne de fin de période.
 *
 * Extrapolation simple : on prolonge l'écart observé entre la première et la
 * seconde moitié des évaluations. La fiabilité dépend du nombre de notes ; elle
 * est renvoyée pour que l'interface ne présente jamais ce chiffre comme certain.
 */
export const projection = (notes, matieres) => {
  const agregats = parMatiere(notes, matieres);
  const actuelle = moyenneGenerale(agregats);
  if (actuelle === null || notes.length < 4) {
    return { actuelle, projetee: actuelle, delta: 0, fiabilite: "insuffisante", nbNotes: notes.length };
  }

  const triees = [...notes].sort((a, b) => (a.date < b.date ? -1 : 1));
  const milieu = Math.floor(triees.length / 2);
  const premiere = moyenneGenerale(parMatiere(triees.slice(0, milieu), matieres));
  const seconde = moyenneGenerale(parMatiere(triees.slice(milieu), matieres));

  if (premiere === null || seconde === null) {
    return { actuelle, projetee: actuelle, delta: 0, fiabilite: "insuffisante", nbNotes: notes.length };
  }

  // On ne prolonge qu'une demi-tendance : extrapoler la totalité surestime
  // systématiquement les progressions récentes.
  const delta = (seconde - premiere) / 2;
  const projetee = Math.min(20, Math.max(0, actuelle + delta));

  return {
    actuelle,
    projetee: arrondi(projetee, 2),
    delta: arrondi(delta, 2),
    fiabilite: notes.length >= 12 ? "bonne" : notes.length >= 7 ? "moyenne" : "faible",
    nbNotes: notes.length,
  };
};

export { arrondi, sur20 };
