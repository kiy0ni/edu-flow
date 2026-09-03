/**
 * Catalogue de matieres partage par tous les providers.
 *
 * A propos des couleurs
 * ---------------------
 * Chaque matiere porte une teinte d'identite (couple clair / sombre) utilisee
 * dans l'interface : pastilles, blocs d'emploi du temps, en-tetes de cartes.
 *
 * L'ORDRE DE DECLARATION EST SIGNIFICATIF. Les douze teintes ont ete retenues
 * puis ordonnancees pour maximiser leur separation deux a deux, y compris pour
 * les daltonismes courants. L'ordre valide obtenu est :
 *   aqua > brun > cyan > jaune > rose > violet > orange > bleu > rouge >
 *   pourpre > vert > magenta
 * Mesures sur les paires adjacentes (OKLab x100) :
 *   - clair  : pire ecart CVD 10.1, vision normale 20.7
 *   - sombre : pire ecart CVD  9.6, vision normale 19.2
 * (cibles : CVD >= 8, vision normale >= 15). Reordonner ce catalogue invalide
 * ces mesures : relancer une validation avant de le faire.
 *
 * Trois teintes claires et une sombre passent sous 3:1 de contraste avec le
 * fond. C'est acceptable ici parce que la couleur n'est jamais le seul canal
 * d'identite : le nom de la matiere est toujours affiche a cote.
 *
 * Les GRAPHIQUES n'utilisent pas ces teintes. Ils comparent l'eleve a sa classe,
 * soit deux series, et s'appuient sur une palette dediee a deux entrees
 * (bleu / orange) validee separement pour les deux themes.
 */
const teinte = (clair, sombre) => ({ clair, sombre });

export const SUBJECTS = {
  ANG: { code: "ANG", nom: "Anglais", couleur: teinte("#1baf7a", "#199e70"), coefficient: 3 },
  HG: { code: "HG", nom: "Histoire-Géographie", couleur: teinte("#b8730f", "#a5670e"), coefficient: 4 },
  PHYS: { code: "PHYS", nom: "Physique-Chimie", couleur: teinte("#0098a8", "#0d95a5"), coefficient: 6 },
  EPS: { code: "EPS", nom: "EPS", couleur: teinte("#eda100", "#c98500"), coefficient: 2 },
  SES: { code: "SES", nom: "SES", couleur: teinte("#c33b7a", "#b1356e"), coefficient: 4 },
  NSI: { code: "NSI", nom: "NSI", couleur: teinte("#6a5ae0", "#9085e9"), coefficient: 6 },
  ESP: { code: "ESP", nom: "Espagnol", couleur: teinte("#eb6834", "#d95926"), coefficient: 3 },
  MATH: { code: "MATH", nom: "Mathématiques", couleur: teinte("#2a78d6", "#3987e5"), coefficient: 6 },
  FR: { code: "FR", nom: "Francais", couleur: teinte("#e34948", "#e66767"), coefficient: 5 },
  PHILO: { code: "PHILO", nom: "Philosophie", couleur: teinte("#9c5cd4", "#8b57c0"), coefficient: 4 },
  SVT: { code: "SVT", nom: "SVT", couleur: teinte("#008300", "#0f9a0f"), coefficient: 4 },
  EMC: { code: "EMC", nom: "EMC", couleur: teinte("#e87ba4", "#d55181"), coefficient: 1 },
};

export const SUBJECT_LIST = Object.values(SUBJECTS);

const NEUTRE = teinte("#6b7280", "#8b8f99");

/**
 * Normalise un libellé pour la comparaison : sans accent ni casse.
 * Les sources amont écrivent indifféremment « Mathematiques » ou
 * « MATHÉMATIQUES » ; les deux doivent retrouver la même matière.
 */
const aplatir = (valeur) =>
  String(valeur)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

/** Couleur d'une matiere, avec repli deterministe pour les matieres hors catalogue. */
export const subjectColor = (codeOrName) => {
  if (!codeOrName) return NEUTRE;
  const cle = aplatir(codeOrName);
  if (SUBJECTS[cle]) return SUBJECTS[cle].couleur;
  const trouve = SUBJECT_LIST.find((s) => aplatir(s.nom) === cle);
  if (trouve) return trouve.couleur;

  // Repli : on reutilise une teinte du catalogue plutot que d'en generer une
  // nouvelle, qui ne serait pas validee. Le nom affiche porte l'identite.
  let hash = 0;
  for (const ch of cle) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return SUBJECT_LIST[hash % SUBJECT_LIST.length].couleur;
};

/** Normalise un libelle de matiere brut (École Directe) vers un code du catalogue. */
const ALIASES = [
  [/math/i, "MATH"],
  [/physique|chimie/i, "PHYS"],
  [/s\.?v\.?t|sciences de la vie/i, "SVT"],
  [/fran[cç]ais|lettres/i, "FR"],
  [/philo/i, "PHILO"],
  [/histoire|g[ée]o/i, "HG"],
  [/anglais|lva/i, "ANG"],
  [/espagnol|lvb/i, "ESP"],
  [/num[ée]rique|nsi|informatique/i, "NSI"],
  [/[ée]conomi|social|ses/i, "SES"],
  [/sport|eps|physique et sportive/i, "EPS"],
  [/civique|emc/i, "EMC"],
];

export const normalizeSubject = (label) => {
  if (!label) return { code: "AUTRE", nom: "Autre", couleur: NEUTRE };
  const propre = String(label).trim();

  // Correspondance exacte avec le catalogue, accents et casse ignorés.
  const cle = aplatir(propre);
  if (SUBJECTS[cle]) return SUBJECTS[cle];
  const exact = SUBJECT_LIST.find((s) => aplatir(s.nom) === cle);
  if (exact) return exact;

  for (const [motif, code] of ALIASES) {
    if (motif.test(propre)) return SUBJECTS[code];
  }
  return { code: cle.slice(0, 12), nom: propre, couleur: subjectColor(propre) };
};
