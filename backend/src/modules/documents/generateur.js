import { creerDocument } from "../../lib/pdf.js";
import * as compute from "../grades/compute.js";
import { dateFr } from "../../lib/dates.js";

/**
 * Fabrique le contenu réel des documents mis à disposition par l'établissement.
 *
 * Les pièces qui dépendent du dossier de l'élève (bulletins, attestations,
 * relevés) sont construites à partir de ses données réelles : le bulletin
 * téléchargé contient bien ses notes, ses moyennes et son rang.
 */

// Appréciations courtes : elles doivent tenir dans la colonne du bulletin.
const APPRECIATIONS = {
  excellent: [
    "Excellent trimestre, rigoureux et régulier.",
    "Très bon niveau, participation constante.",
    "Maîtrise solide des notions abordées.",
  ],
  bon: [
    "Trimestre satisfaisant, travail sérieux.",
    "Bon ensemble, la progression est là.",
    "Acquis réels. Approfondir la préparation.",
  ],
  moyen: [
    "Résultats justes. Reprendre le cours plus souvent.",
    "Bases présentes, travail à intensifier.",
    "Demi-teinte. Participer davantage en classe.",
  ],
  faible: [
    "Trimestre difficile, accompagnement conseillé.",
    "Résultats insuffisants. Reprendre les bases.",
    "Lacunes persistantes. Solliciter le professeur.",
  ],
};

// Commentaire développé, réservé à l'appréciation générale.
const SYNTHESES = {
  excellent: "Excellent trimestre. Le travail est rigoureux et régulier, et les résultats suivent dans l'ensemble des disciplines.",
  bon: "Trimestre satisfaisant. Le travail est sérieux et les résultats réguliers ; quelques évaluations restent en retrait.",
  moyen: "Trimestre en demi-teinte. Les bases sont là, mais un travail plus régulier en amont des évaluations est nécessaire.",
  faible: "Trimestre difficile. Un accompagnement méthodologique et un travail de reprise des fondamentaux sont vivement conseillés.",
};

const synthetiser = (moyenne) =>
  SYNTHESES[moyenne >= 15 ? "excellent" : moyenne >= 12.5 ? "bon" : moyenne >= 10 ? "moyen" : "faible"];

/** Choisit une appréciation cohérente avec la moyenne, de façon stable. */
const apprecier = (moyenne, graine) => {
  const niveau = moyenne >= 15 ? "excellent" : moyenne >= 12.5 ? "bon" : moyenne >= 10 ? "moyen" : "faible";
  const liste = APPRECIATIONS[niveau];
  let hash = 0;
  for (const c of String(graine)) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return liste[hash % liste.length];
};

const nb = (valeur, decimales = 2) =>
  valeur === null || valeur === undefined ? "—" : valeur.toFixed(decimales).replace(".", ",");

/** Bulletin trimestriel complet, construit à partir des notes réelles. */
export const bulletin = ({ profil, periode, notes, matieres }) => {
  const duPeriode = notes.filter((n) => n.periodeCode === periode.code);
  const agregats = compute.parMatiere(duPeriode, matieres);
  const moyenne = compute.moyenneGenerale(agregats);
  const moyenneClasse = compute.moyenneClasseGenerale(agregats);

  const doc = creerDocument({
    titre: `Bulletin — ${periode.libelle}`,
    sousTitre: `${profil.etablissement} · Année scolaire ${profil.anneeScolaire}`,
    pied: profil.etablissement,
  });

  doc.section("Élève");
  doc.champ("Nom et prénom", `${profil.nom.toUpperCase()} ${profil.prenom}`);
  doc.champ("Classe", profil.classe);
  doc.champ("Professeur principal", profil.professeurPrincipal);
  doc.champ("Période", `${dateFr(periode.debut)} au ${dateFr(periode.fin)}`);
  doc.espace(8);

  doc.section("Résultats par discipline");
  doc.tableau(
    [
      { titre: "Discipline", largeur: 30 },
      { titre: "Coef.", largeur: 8, alignement: "droite" },
      { titre: "Moyenne", largeur: 12, alignement: "droite" },
      { titre: "Classe", largeur: 12, alignement: "droite" },
      { titre: "Appréciation du professeur", largeur: 58 },
    ],
    agregats.map((m) => [
      m.matiere,
      String(m.coefficient),
      nb(m.moyenne),
      nb(m.moyenneClasse),
      apprecier(m.moyenne ?? 10, `${periode.code}${m.matiereCode}`),
    ]),
  );

  doc.espace(10);
  doc.section("Synthèse");
  doc.champ("Moyenne générale", `${nb(moyenne)} / 20`);
  doc.champ("Moyenne de la classe", `${nb(moyenneClasse)} / 20`);
  doc.champ("Nombre d'évaluations", String(duPeriode.length));
  doc.espace(6);

  doc.section("Appréciation générale du conseil de classe");
  doc.paragraphe(
    moyenne === null
      ? "Aucune évaluation enregistrée sur la période."
      : `${synthetiser(moyenne)} ${
          moyenneClasse !== null && moyenne > moyenneClasse
            ? "L'élève se situe au-dessus de la moyenne de la classe."
            : "Un travail plus régulier permettrait de se rapprocher de la moyenne de la classe."
        }`,
  );

  doc.espace(20);
  doc.paragraphe(
    "Document établi par l'établissement et mis à disposition dans l'espace numérique de travail. " +
      "Le chef d'établissement.",
    9,
  );

  return doc.rendre();
};

/** Relevé de toutes les notes d'une période. */
export const releveDeNotes = ({ profil, periode, notes }) => {
  const duPeriode = notes
    .filter((n) => n.periodeCode === periode.code)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const doc = creerDocument({
    titre: `Relevé de notes — ${periode.libelle}`,
    sousTitre: `${profil.prenom} ${profil.nom} · ${profil.classe}`,
    pied: profil.etablissement,
  });

  doc.section(`${duPeriode.length} évaluation(s)`);
  doc.tableau(
    [
      { titre: "Date", largeur: 12 },
      { titre: "Discipline", largeur: 24 },
      { titre: "Évaluation", largeur: 40 },
      { titre: "Coef.", largeur: 8, alignement: "droite" },
      { titre: "Note", largeur: 10, alignement: "droite" },
      { titre: "Classe", largeur: 10, alignement: "droite" },
    ],
    duPeriode.map((n) => [
      dateFr(n.date, "court"),
      n.matiere,
      n.intitule,
      String(n.coefficient),
      `${nb(n.valeur, 1)}/${n.bareme}`,
      nb(n.moyenneClasse, 1),
    ]),
  );

  return doc.rendre();
};

/** Attestation de scolarité. */
export const attestation = ({ profil }) => {
  const doc = creerDocument({
    titre: "Attestation de scolarité",
    sousTitre: profil.etablissement,
    pied: profil.etablissement,
  });

  doc.espace(16);
  doc.paragraphe("Le chef d'établissement soussigné atteste que :", 11);
  doc.espace(10);
  doc.champ("Nom et prénom", `${profil.nom.toUpperCase()} ${profil.prenom}`, 11);
  doc.champ("Né(e) le", "—", 11);
  doc.champ("Numéro INE", profil.ine, 11);
  doc.espace(10);
  doc.paragraphe(
    `est régulièrement inscrit(e) en classe de ${profil.classe} au sein de l'établissement ` +
      `pour l'année scolaire ${profil.anneeScolaire}, et y suit l'ensemble des enseignements ` +
      "obligatoires ainsi que les enseignements de spécialité suivants :",
    11,
  );
  doc.espace(6);
  for (const option of profil.options ?? []) doc.paragraphe(`— ${option}`, 11);
  doc.espace(18);
  doc.paragraphe(
    "Cette attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.",
    10,
  );
  doc.espace(24);
  doc.paragraphe(`Fait le ${dateFr(new Date().toISOString().slice(0, 10))}.`, 10);
  doc.espace(30);
  doc.paragraphe("Le chef d'établissement", 10);

  return doc.rendre();
};

/** Emploi du temps de la semaine, en tableau. */
export const emploiDuTempsPdf = ({ profil, jours }) => {
  const doc = creerDocument({
    titre: "Emploi du temps",
    sousTitre: `${profil.prenom} ${profil.nom} · ${profil.classe}`,
    pied: profil.etablissement,
  });

  for (const jour of jours) {
    if (!jour.cours.length) continue;
    doc.section(`${jour.jour.charAt(0).toUpperCase()}${jour.jour.slice(1)} ${dateFr(jour.date)}`, 11);
    doc.tableau(
      [
        { titre: "Horaire", largeur: 16 },
        { titre: "Discipline", largeur: 34 },
        { titre: "Salle", largeur: 16 },
        { titre: "Enseignant", largeur: 34 },
      ],
      jour.cours.map((c) => [
        `${c.debut} – ${c.fin}`,
        c.annule ? `${c.matiere} (annulé)` : c.matiere,
        c.salle ?? "—",
        c.professeur ?? "—",
      ]),
    );
    doc.espace(6);
  }

  return doc.rendre();
};

/** Documents statiques de l'établissement, au contenu rédigé. */
const STATIQUES = {
  reglement: {
    titre: "Règlement intérieur",
    sections: [
      ["Préambule", "Le règlement intérieur définit les règles de vie collective de l'établissement. L'inscription vaut adhésion à ses dispositions, pour l'élève comme pour sa famille."],
      ["Horaires et ponctualité", "Les cours débutent à 8h00. L'accès aux salles est autorisé cinq minutes avant la sonnerie. Tout élève arrivant après le début du cours se présente au bureau de la vie scolaire avant de rejoindre sa classe. Trois retards non justifiés entraînent une heure de retenue."],
      ["Absences", "Toute absence doit être signalée par la famille dès le premier jour, puis justifiée par écrit au retour de l'élève. Les absences aux évaluations doivent faire l'objet d'un justificatif sous 48 heures, faute de quoi la note de zéro peut être appliquée."],
      ["Travail scolaire", "Les élèves sont tenus d'effectuer le travail demandé et de se présenter aux évaluations avec le matériel requis. Le cahier de textes numérique fait foi."],
      ["Usage du numérique", "L'usage du téléphone portable est interdit dans l'enceinte de l'établissement, hors espaces expressément autorisés. Les équipements informatiques sont réservés à un usage pédagogique."],
      ["Vie collective", "Le respect mutuel entre élèves et personnels est la règle. Toute forme de harcèlement, de discrimination ou de violence fait l'objet d'une procédure disciplinaire immédiate."],
      ["Sanctions", "Les manquements donnent lieu, selon leur gravité, à une observation écrite, une retenue, une mesure de responsabilisation, une exclusion temporaire ou une saisine du conseil de discipline."],
    ],
  },
  methode: {
    titre: "Fiche méthode — la dissertation",
    sections: [
      ["Analyser le sujet", "Repérez les termes clés et interrogez-les un à un. Un sujet n'est jamais une invitation à réciter le cours : il pose une tension qu'il faut identifier avant d'écrire la moindre ligne. Reformulez le sujet avec vos propres mots pour vérifier que vous l'avez compris."],
      ["Construire la problématique", "La problématique n'est pas une reformulation du sujet, mais la question précise qui rend le sujet problématique. Elle doit faire apparaître un paradoxe, une opposition ou une difficulté à résoudre."],
      ["Élaborer le plan", "Trois parties, chacune répondant à un moment de la problématique. Le plan progresse : la deuxième partie ne contredit pas la première, elle la dépasse. Chaque partie comporte deux ou trois sous-parties, chacune appuyée sur un exemple précis."],
      ["Rédiger l'introduction", "Amorce, présentation du sujet, analyse des termes, problématique, annonce du plan. Cinq mouvements, une quinzaine de lignes. Rédigez-la au brouillon, intégralement."],
      ["Développer", "Une sous-partie = une idée + un argument + un exemple analysé. L'exemple ne se contente pas d'illustrer : il doit être exploité, c'est-à-dire commenté au regard de l'argument."],
      ["Conclure", "Récapitulez le trajet parcouru, répondez explicitement à la problématique, puis ouvrez sur une question voisine. Évitez l'ouverture artificielle."],
      ["Gérer le temps", "Sur quatre heures : une heure d'analyse et de plan, deux heures trente de rédaction, trente minutes de relecture. La relecture n'est pas facultative : elle rattrape une part importante des points perdus."],
    ],
  },
  formulaire: {
    titre: "Formulaire de mathématiques — Terminale",
    sections: [
      ["Suites", "Suite arithmétique : u(n) = u(0) + n·r, somme des n premiers termes S = n·(u(0)+u(n-1))/2. Suite géométrique : u(n) = u(0)·q^n, S = u(0)·(1-q^n)/(1-q) pour q different de 1."],
      ["Dérivation", "(u·v)' = u'v + uv'. (u/v)' = (u'v - uv')/v². (u o v)' = v'·(u' o v). Dérivée de exp(u) : u'·exp(u). Dérivée de ln(u) : u'/u."],
      ["Fonction exponentielle", "exp(a+b) = exp(a)·exp(b). exp(a-b) = exp(a)/exp(b). exp(na) = exp(a)^n. La fonction exponentielle est strictement croissante sur R et à valeurs dans ]0 ; +inf[."],
      ["Logarithme népérien", "ln(ab) = ln a + ln b. ln(a/b) = ln a - ln b. ln(a^n) = n·ln a. ln x = y équivaut à x = exp(y), pour x strictement positif."],
      ["Intégration", "Si F est une primitive de f, l'intégrale de a à b de f vaut F(b) - F(a). Primitive de x^n : x^(n+1)/(n+1) pour n different de -1. Primitive de 1/x : ln|x|."],
      ["Probabilités", "P(A sachant B) = P(A inter B)/P(B). Formule des probabilités totales : P(A) = somme des P(A sachant Bi)·P(Bi). Loi binomiale de paramètres n et p : P(X=k) = C(n,k)·p^k·(1-p)^(n-k), espérance np, variance np(1-p)."],
      ["Géométrie dans l'espace", "Produit scalaire : u·v = x·x' + y·y' + z·z'. Deux vecteurs sont orthogonaux si et seulement si leur produit scalaire est nul. Équation cartésienne d'un plan : ax + by + cz + d = 0, de vecteur normal (a ; b ; c)."],
    ],
  },
  parcoursup: {
    titre: "Guide Parcoursup — calendrier et conseils",
    sections: [
      ["Le calendrier", "Décembre à janvier : découverte des formations sur la plateforme. Janvier à mars : formulation des vœux, dix au maximum, sans ordre de préférence. Avril : finalisation du dossier et confirmation des vœux. Juin à juillet : phase d'admission, réponses progressives."],
      ["Formuler ses vœux", "Un vœu peut comporter plusieurs sous-vœux, notamment pour les formations présentes dans plusieurs établissements. Diversifiez : associez des formations sélectives et non sélectives, et n'écartez pas les formations de proximité."],
      ["Le projet de formation motivé", "Une page maximum. Expliquez ce qui vous attire dans la formation, ce que vous en connaissez concrètement, et en quoi votre parcours vous y prépare. Évitez les formules toutes faites : les commissions en lisent des milliers."],
      ["La fiche Avenir", "Renseignée par l'établissement, elle comporte vos moyennes, l'appréciation de chaque professeur et l'avis du chef d'établissement. Elle pèse dans l'examen des dossiers : votre régularité tout au long de l'année compte."],
      ["Phase d'admission", "Vous pouvez recevoir quatre types de réponse : oui, oui si (avec parcours d'accompagnement), en attente, non. Répondez dans les délais, sous peine de perdre la proposition. Conservez au maximum un vœu en attente si vous acceptez une proposition."],
      ["Où se faire aider", "Le professeur principal, le psychologue de l'éducation nationale présent au CDI, et les journées portes ouvertes des établissements. Les ateliers Parcoursup ont lieu le mercredi après-midi au CDI."],
    ],
  },
  evaluations: {
    titre: "Calendrier des évaluations communes",
    sections: [
      ["Organisation", "Les évaluations communes se déroulent sur quatre demi-journées. Les élèves sont convoqués quinze minutes avant le début de chaque épreuve, munis de leur convocation et d'une pièce d'identité."],
      ["Épreuves écrites", "Mathématiques : 4 heures. Physique-Chimie : 3 h 30. Philosophie : 4 heures. Histoire-Géographie : 2 heures. Les calculatrices sont autorisées uniquement lorsque le sujet le précise."],
      ["Épreuves orales", "Les oraux de langues vivantes se déroulent sur deux semaines, par créneaux de vingt minutes, dont dix de préparation. Le planning individuel est communiqué une semaine avant."],
      ["Absences", "Toute absence à une épreuve doit être justifiée sous 48 heures par un certificat. Une session de rattrapage est organisée pour les absences justifiées."],
      ["Matériel", "Stylos, règle, équerre et compas sont à prévoir. Le papier de composition et les brouillons sont fournis. Les téléphones sont déposés à l'entrée de la salle."],
    ],
  },
};

export const documentStatique = (cle, profil) => {
  const modele = STATIQUES[cle];
  if (!modele) return null;

  const doc = creerDocument({
    titre: modele.titre,
    sousTitre: profil?.etablissement ?? "",
    pied: profil?.etablissement ?? "EduFlow",
  });

  for (const [titre, corps] of modele.sections) {
    doc.section(titre, 11);
    doc.paragraphe(corps);
    doc.espace(6);
  }

  return doc.rendre();
};

export const clesStatiques = Object.keys(STATIQUES);
