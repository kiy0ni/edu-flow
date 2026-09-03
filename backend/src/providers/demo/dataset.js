import { SUBJECTS } from "../subjects.js";
import { rng, pick, pickMany, intBetween, floatBetween, chance, hashSeed } from "../random.js";
import { toISODate, addDays, parseISODate, eachDay, schoolYearStart, daysBetween, today, startOfWeek } from "../../lib/dates.js";

/**
 * Jeu de donnees de demonstration entierement deterministe.
 * Sert de bac a sable complet (aucune donnee reelle) et de reference pour
 * le contrat de donnees que doit respecter tout autre provider.
 */

const PROFESSEURS = {
  MATH: "Mme Renaud",
  PHYS: "M. Delcourt",
  SVT: "Mme Ferrand",
  FR: "Mme Ollivier",
  PHILO: "M. Bassot",
  HG: "M. Nguyen",
  ANG: "Mrs. Harding",
  ESP: "Sra. Molina",
  NSI: "M. Aubert",
  SES: "Mme Charrier",
  EPS: "M. Tavares",
  EMC: "M. Nguyen",
};

const SALLES = {
  MATH: "B204", PHYS: "Labo 3", SVT: "Labo 1", FR: "A112", PHILO: "A118",
  HG: "A203", ANG: "C007", ESP: "C009", NSI: "Info 2", SES: "A210",
  EPS: "Gymnase", EMC: "A203",
};

/** Grille hebdomadaire type d'une Terminale generale (spe Maths / NSI / Physique). */
const GRILLE = [
  { jour: 1, debut: "08:00", fin: "10:00", code: "MATH" },
  { jour: 1, debut: "10:15", fin: "12:15", code: "NSI" },
  { jour: 1, debut: "13:30", fin: "15:30", code: "PHYS" },
  { jour: 1, debut: "15:45", fin: "16:45", code: "ANG" },

  { jour: 2, debut: "08:00", fin: "10:00", code: "PHILO" },
  { jour: 2, debut: "10:15", fin: "12:15", code: "MATH" },
  { jour: 2, debut: "13:30", fin: "15:30", code: "NSI" },
  { jour: 2, debut: "15:45", fin: "17:45", code: "EPS" },

  { jour: 3, debut: "08:00", fin: "10:00", code: "PHYS" },
  { jour: 3, debut: "10:15", fin: "12:15", code: "HG" },

  { jour: 4, debut: "08:00", fin: "10:00", code: "MATH" },
  { jour: 4, debut: "10:15", fin: "12:15", code: "NSI" },
  { jour: 4, debut: "13:30", fin: "14:30", code: "ANG" },
  { jour: 4, debut: "14:30", fin: "15:30", code: "ESP" },
  { jour: 4, debut: "15:45", fin: "16:45", code: "EMC" },

  { jour: 5, debut: "08:00", fin: "09:00", code: "PHILO" },
  { jour: 5, debut: "09:00", fin: "11:00", code: "PHYS" },
  { jour: 5, debut: "11:15", fin: "12:15", code: "HG" },
  { jour: 5, debut: "13:30", fin: "15:30", code: "MATH" },
  { jour: 5, debut: "15:45", fin: "16:45", code: "ESP" },
];

const MATIERES_ACTIVES = [...new Set(GRILLE.map((c) => c.code))];

const FRACTIONS_VACANCES = [
  ["Toussaint", 0.154, 0.203],
  ["Noel", 0.361, 0.41],
  ["Hiver", 0.544, 0.593],
  ["Printemps", 0.728, 0.777],
];

/** Position d'une date-cle dans l'annee, exprimee en fraction de sa duree. */
const atFraction = (debut, fin, fraction) => addDays(debut, Math.round(daysBetween(debut, fin) * fraction));

const construireVacances = (debut, fin) =>
  FRACTIONS_VACANCES.map(([nom, d, f]) => ({
    nom,
    debut: atFraction(debut, fin, d),
    fin: atFraction(debut, fin, f),
  }));

const estJourDeCours = (iso, debut, fin) => {
  const jour = parseISODate(iso).getDay();
  if (jour === 0 || jour === 6) return false;
  if (daysBetween(debut, iso) < 0 || daysBetween(iso, fin) < 0) return false;
  return !construireVacances(debut, fin).some(
    (v) => daysBetween(v.debut, iso) >= 0 && daysBetween(iso, v.fin) >= 0,
  );
};

/**
 * Bornes de l'annee scolaire de demonstration.
 * De septembre a juin on suit le calendrier reel. En juillet-aout on decale la
 * periode - en calant le decalage pour que la date du jour tombe sur un jour de
 * cours - afin que le compte de demonstration reste exploitable toute l'annee.
 */
export const anneeDemo = () => {
  const now = new Date();
  const mois = now.getMonth();
  if (mois >= 8 || mois <= 5) {
    const y = mois >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return { debut: `${y}-09-01`, fin: `${y + 1}-07-03`, libelle: `${y}-${y + 1}`, reelle: true };
  }

  // On cale le décalage pour que la semaine affichée à l'ouverture — et la
  // suivante — soient entièrement travaillées. Se contenter du jour courant ne
  // suffit pas : un dimanche, l'emploi du temps ouvrirait sur une semaine de
  // vacances.
  const maintenant = today();
  const lundi = startOfWeek(maintenant);
  const aValider = eachDay(lundi, addDays(lundi, 11)).filter(
    (j) => ![0, 6].includes(parseISODate(j).getDay()),
  );

  let debut = addDays(maintenant, -170);
  for (let essai = 0; essai < 120; essai += 1) {
    const candidat = addDays(maintenant, -170 - essai);
    const fin = addDays(candidat, 305);
    if (aValider.every((j) => estJourDeCours(j, candidat, fin))) {
      debut = candidat;
      break;
    }
  }

  return {
    debut,
    fin: addDays(debut, 305),
    libelle: `${schoolYearStart(debut)}-${schoolYearStart(debut) + 1}`,
    reelle: false,
  };
};

const vacances = (annee) => construireVacances(annee.debut, annee.fin);

const periodes = (annee) => [
  { code: "T1", libelle: "Trimestre 1", debut: annee.debut, fin: atFraction(annee.debut, annee.fin, 0.33) },
  {
    code: "T2",
    libelle: "Trimestre 2",
    debut: addDays(atFraction(annee.debut, annee.fin, 0.33), 1),
    fin: atFraction(annee.debut, annee.fin, 0.66),
  },
  {
    code: "T3",
    libelle: "Trimestre 3",
    debut: addDays(atFraction(annee.debut, annee.fin, 0.66), 1),
    fin: annee.fin,
  },
];

const enVacances = (iso, liste) =>
  liste.find((v) => daysBetween(v.debut, iso) >= 0 && daysBetween(iso, v.fin) >= 0) ?? null;

const CHAPITRES = {
  MATH: ["Suites et récurrence", "Limites de fonctions", "Dérivation et convexité", "Fonction exponentielle", "Logarithme népérien", "Primitives et intégrales", "Géométrie dans l'espace", "Probabilités conditionnelles", "Loi binomiale et échantillonnage"],
  PHYS: ["Cinématique et dynamique", "Mouvement dans un champ uniforme", "Ondes mécaniques", "Lunettes et telescopes", "Reactions acide-base", "Titrage colorimétrique", "Evolution temporelle d'un système", "Énergie et bilan thermique", "Circuit RC"],
  NSI: ["Structures de données lineaires", "Arbres binaires de recherche", "Graphes et parcours", "Programmation dynamique", "Bases de données relationnelles", "SQL avance", "Architecture réseau", "Systèmes d'exploitation", "Récursivité et complexité"],
  PHILO: ["La conscience", "Le désir", "La liberté", "Le travail", "L'art", "La vérité", "La justice", "L'État", "Le temps"],
  HG: ["Fragmentations et recompositions", "Les puissances internationales", "La guerre froide", "Environnement et sociétés", "Frontières et mondialisation", "Le patrimoine", "La France depuis 1945"],
  ANG: ["Identities and exchanges", "Art and power", "Citizenship and virtual worlds", "Fictions and realities", "Space and exchanges"],
  ESP: ["Ficciones y realidades", "Territorio y memoria", "Diversidad e inclusion", "Innovaciones cientificas"],
  EPS: ["Demi-fond", "Escalade", "Badminton", "Musculation", "Natation"],
  EMC: ["La bioéthique", "Les libertés fondamentales", "Démocratie et citoyenneté"],
};

const TYPES_EVAL = ["Devoir surveillé", "Interrogation", "Devoir maison", "Oral", "TP noté", "Bac blanc"];

const buildProfil = (seed, compte, annee) => {
  const r = rng(hashSeed(seed, "profil"));
  return {
    id: compte.id,
    prenom: compte.prenom,
    nom: compte.nom,
    email: compte.email,
    telephone: "06 12 34 56 78",
    role: "eleve",
    classe: "Terminale G2",
    etablissement: "Lycée Marie Curie",
    anneeScolaire: annee.libelle,
    avatarUrl: null,
    options: ["Spe Mathématiques", "Spé NSI", "Spé Physique-Chimie", "Maths expertes"],
    professeurPrincipal: PROFESSEURS.MATH,
    ine: `${intBetween(r, 10, 99)}${intBetween(r, 1000000, 9999999)}AB`,
  };
};

const buildEmploiDuTemps = (seed, annee) => {
  const vac = vacances(annee);
  const jours = eachDay(annee.debut, annee.fin);
  const events = [];

  for (const iso of jours) {
    const date = parseISODate(iso);
    const jour = date.getDay();
    if (jour === 0 || jour === 6) continue;
    if (enVacances(iso, vac)) continue;

    for (const creneau of GRILLE.filter((c) => c.jour === jour)) {
      const r = rng(hashSeed(seed, iso, creneau.debut, creneau.code));
      const matiere = SUBJECTS[creneau.code];
      const annule = chance(r, 0.035);
      const estDS = chance(r, 0.06);

      events.push({
        id: `edt-${iso}-${creneau.debut.replace(":", "")}-${creneau.code}`,
        date: iso,
        debut: creneau.debut,
        fin: creneau.fin,
        matiereCode: matiere.code,
        matiere: matiere.nom,
        couleur: matiere.couleur,
        professeur: PROFESSEURS[creneau.code],
        salle: SALLES[creneau.code],
        type: annule ? "annule" : estDS ? "evaluation" : "cours",
        annule,
        remarque: annule ? "Professeur absent - cours annulé" : estDS ? "Devoir surveillé" : null,
      });
    }
  }
  return events;
};

const buildNotes = (seed, listePeriodes) => {
  const notes = [];
  // Niveau de base par matiere : donne un profil d'eleve credible et stable.
  const niveaux = {};
  for (const code of MATIERES_ACTIVES) {
    niveaux[code] = floatBetween(rng(hashSeed(seed, "niveau", code)), 9.5, 16.5, 1);
  }

  for (const periode of listePeriodes) {
    for (const code of MATIERES_ACTIVES) {
      const r = rng(hashSeed(seed, "notes", periode.code, code));
      const nb = code === "EMC" ? 1 : intBetween(r, 3, 5);
      const span = daysBetween(periode.debut, periode.fin);

      for (let i = 0; i < nb; i += 1) {
        const date = addDays(periode.debut, Math.round(((i + 1) / (nb + 1)) * span) + intBetween(r, -6, 6));
        // Legere progression au fil de l'annee + bruit.
        const progression = listePeriodes.indexOf(periode) * 0.6;
        const brut = niveaux[code] + progression + floatBetween(r, -3.2, 3.2, 2);
        const valeur = Math.min(20, Math.max(2, Math.round(brut * 2) / 2));
        const moyenneClasse = Math.min(18, Math.max(6, Math.round((valeur + floatBetween(r, -2.5, 2.5, 1)) * 10) / 10));

        notes.push({
          id: `note-${periode.code}-${code}-${i}`,
          date,
          periodeCode: periode.code,
          matiereCode: code,
          matiere: SUBJECTS[code].nom,
          couleur: SUBJECTS[code].couleur,
          professeur: PROFESSEURS[code],
          intitule: `${pick(r, TYPES_EVAL)} - ${pick(r, CHAPITRES[code] ?? ["Evaluation"])}`,
          valeur,
          bareme: 20,
          coefficient: chance(r, 0.25) ? 1 : SUBJECTS[code].coefficient >= 5 ? 2 : 1,
          moyenneClasse,
          minClasse: Math.max(0, Math.round((moyenneClasse - floatBetween(r, 3, 7, 1)) * 10) / 10),
          maxClasse: Math.min(20, Math.round((moyenneClasse + floatBetween(r, 2.5, 5, 1)) * 10) / 10),
          nonSignificatif: false,
        });
      }
    }
  }
  return notes.sort((a, b) => (a.date < b.date ? 1 : -1));
};

const buildDevoirs = (seed, edt) => {
  const devoirs = [];
  const seen = new Set();

  for (const cours of edt) {
    if (cours.annule) continue;
    const r = rng(hashSeed(seed, "devoir", cours.id));
    if (!chance(r, 0.34)) continue;

    // Le devoir est donne pendant ce cours, a rendre pour le prochain cours de la matiere.
    const rendrePour = addDays(cours.date, intBetween(r, 2, 9));
    const cle = `${rendrePour}-${cours.matiereCode}`;
    if (seen.has(cle)) continue;
    seen.add(cle);

    const chapitre = pick(r, CHAPITRES[cours.matiereCode] ?? ["Révisions"]);
    const type = chance(r, 0.18) ? "controle" : chance(r, 0.3) ? "lecon" : "devoir";

    devoirs.push({
      id: `dev-${cle}`,
      matiereCode: cours.matiereCode,
      matiere: cours.matiere,
      couleur: cours.couleur,
      professeur: cours.professeur,
      donneLe: cours.date,
      dueDate: rendrePour,
      type,
      intitule:
        type === "controle"
          ? `Évaluation : ${chapitre}`
          : type === "lecon"
            ? `Apprendre : ${chapitre}`
            : `${chapitre} - exercices`,
      contenu:
        type === "controle"
          ? `Évaluation sur le chapitre "${chapitre}". Revoir le cours, les exercices types et la fiche méthode.`
          : type === "lecon"
            ? `Apprendre le cours sur "${chapitre}" et savoir refaire les exemples traités en classe.`
            : `Exercices ${intBetween(r, 12, 48)} a ${intBetween(r, 49, 72)} page ${intBetween(r, 84, 260)}, chapitre "${chapitre}".`,
      dureeEstimee: type === "controle" ? intBetween(r, 60, 120) : intBetween(r, 20, 75),
      difficulte: intBetween(r, 2, 5),
      rendreEnLigne: chance(r, 0.22),
      documents: chance(r, 0.25) ? [{ id: `doc-${cle}`, nom: `${chapitre}.pdf`, taille: intBetween(r, 80, 2400) * 1024 }] : [],
    });
  }
  return devoirs.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
};

const buildVieScolaire = (seed, edt) => {
  const r = rng(hashSeed(seed, "viescolaire"));
  const joursCours = [...new Set(edt.map((e) => e.date))];
  const items = [];

  const motifsAbsence = ["Maladie", "Rendez-vous médical", "Raison familiale", "Non justifié"];
  const motifsRetard = ["Transports", "Réveil tardif", "Rendez-vous", "Non justifié"];

  for (const date of pickMany(r, joursCours, 7)) {
    const justifie = chance(r, 0.72);
    items.push({
      id: `abs-${date}`,
      date,
      type: "absence",
      debut: "08:00",
      fin: chance(r, 0.5) ? "10:00" : "12:15",
      duree: chance(r, 0.5) ? 120 : 255,
      motif: justifie ? pick(r, motifsAbsence.slice(0, 3)) : "Non justifié",
      justifie,
      commentaire: null,
    });
  }

  for (const date of pickMany(r, joursCours, 9)) {
    const justifie = chance(r, 0.5);
    items.push({
      id: `ret-${date}`,
      date,
      type: "retard",
      debut: "08:00",
      fin: null,
      duree: intBetween(r, 5, 25),
      motif: justifie ? pick(r, motifsRetard.slice(0, 3)) : "Non justifié",
      justifie,
      commentaire: null,
    });
  }

  for (const date of pickMany(r, joursCours, 2)) {
    items.push({
      id: `sanc-${date}`,
      date,
      type: "sanction",
      debut: null,
      fin: null,
      duree: null,
      motif: pick(r, ["Bavardages répétés", "Devoir non rendu", "Oubli de matériel"]),
      justifie: true,
      commentaire: "Observation inscrite dans le carnet.",
    });
  }

  return items.sort((a, b) => (a.date < b.date ? 1 : -1));
};

const buildMessages = (seed) => {
  const r = rng(hashSeed(seed, "messages"));

  // Fils de discussion crédibles : chaque message a un expéditeur identifiable,
  // un objet explicite et un corps rédigé comme le ferait l'établissement.
  const modeles = [
    {
      exp: "Direction",
      role: "Chef d'établissement",
      sujet: "Réunion parents-professeurs du 2e trimestre",
      jours: 2,
      corps: "Madame, Monsieur,\n\nLa réunion parents-professeurs du deuxième trimestre se tiendra le jeudi 12 de 17h00 à 20h00 dans les salles du bâtiment A.\n\nLes inscriptions aux créneaux de quinze minutes sont ouvertes depuis votre espace, rubrique « Rendez-vous ». Nous vous invitons à privilégier les enseignants des disciplines de spécialité.\n\nEn cas d'indisponibilité, un entretien téléphonique peut être organisé sur demande auprès du secrétariat.\n\nBien cordialement,\nLa direction",
      pieces: [{ nom: "Plan des salles.pdf", taille: 214_000 }],
    },
    {
      exp: PROFESSEURS.MATH,
      role: "Professeure de mathématiques",
      sujet: "Rattrapage du devoir surveillé",
      jours: 3,
      corps: "Bonjour Anastasia,\n\nVous étiez absente lors du devoir surveillé sur les suites. Le rattrapage aura lieu mardi de 13h30 à 15h30 en salle B204.\n\nLe sujet portera sur le même chapitre : pensez à revoir la démonstration par récurrence et les exercices types corrigés en classe.\n\nVenez me voir à la fin du cours de lundi si quelque chose reste flou.\n\nCordialement,\nMme Renaud",
    },
    {
      exp: "Vie scolaire",
      role: "Bureau de la vie scolaire",
      sujet: "Justificatif d'absence en attente",
      jours: 4,
      corps: "Bonjour,\n\nUne absence a été enregistrée la semaine dernière sur la matinée du jeudi et reste à ce jour sans justificatif.\n\nMerci de déposer le document au bureau de la vie scolaire, ou de le transmettre par retour de message, sous 48 heures.\n\nPassé ce délai, l'absence sera comptabilisée comme non justifiée et signalée à la famille.\n\nLa vie scolaire",
    },
    {
      exp: PROFESSEURS.NSI,
      role: "Professeur de NSI",
      sujet: "Projet de fin d'année — rendu et soutenance",
      jours: 5,
      corps: "Bonjour à tous,\n\nQuelques précisions sur le rendu final du projet :\n\n— dépôt du code sur le Git de l'établissement avant le 15 à 23h59 ;\n— rapport de 5 pages maximum au format PDF, structure imposée rappelée en pièce jointe ;\n— vidéo de démonstration de 3 minutes, sans montage ;\n— soutenance de 10 minutes suivie de 5 minutes de questions.\n\nLes groupes qui n'ont pas encore validé leur sujet doivent me le soumettre avant vendredi.\n\nM. Aubert",
      pieces: [{ nom: "Structure du rapport.pdf", taille: 96_400 }, { nom: "Grille d'évaluation.pdf", taille: 142_000 }],
    },
    {
      exp: "Pôle orientation",
      role: "Psychologue de l'éducation nationale",
      sujet: "Parcoursup : atelier de rédaction",
      jours: 6,
      corps: "Bonjour,\n\nUn atelier consacré à la rédaction du projet de formation motivé est proposé mercredi de 13h00 à 14h00 au CDI.\n\nApportez une première version, même incomplète : le travail se fait sur vos textes, pas sur des exemples génériques.\n\nL'atelier est ouvert sans inscription, dans la limite de vingt places.\n\nLe pôle orientation",
    },
    {
      exp: PROFESSEURS.PHILO,
      role: "Professeur de philosophie",
      sujet: "Corrigé de la dissertation sur la liberté",
      jours: 7,
      corps: "Bonjour,\n\nLe corrigé de la dissertation est déposé dans l'espace documents.\n\nDeux remarques valables pour la classe entière : les introductions restent trop longues et trop générales, et les exemples sont cités sans être analysés. Un exemple qui n'est pas exploité ne vaut aucun point.\n\nJe vous conseille de reprendre votre copie avec le corrigé à côté et de réécrire uniquement l'introduction. Je les relirai volontiers.\n\nM. Bassot",
    },
    {
      exp: PROFESSEURS.ANG,
      role: "Professeure d'anglais",
      sujet: "Mock oral exam — schedule",
      jours: 9,
      corps: "Hello everyone,\n\nYour mock oral exam will take place next week during our usual slot.\n\nYou will be asked to present one of the four themes studied this year for five minutes, followed by a short discussion. You may bring a single sheet of notes, but reading it aloud will be penalised.\n\nThe order of passage is posted on the classroom door.\n\nBest regards,\nMrs. Harding",
    },
    {
      exp: "CDI",
      role: "Professeure documentaliste",
      sujet: "Retour de documents emprunté",
      jours: 11,
      corps: "Bonjour,\n\nDeux ouvrages empruntés le mois dernier sont à rendre avant vendredi :\n\n— « La condition humaine », A. Malraux ;\n— « Petite histoire de l'informatique », E. Lazard.\n\nLe CDI est ouvert de 8h00 à 18h00 du lundi au jeudi, et jusqu'à 16h00 le vendredi.\n\nMerci d'avance,\nLe CDI",
    },
    {
      exp: PROFESSEURS.PHYS,
      role: "Professeur de physique-chimie",
      sujet: "Compte rendu de TP à rendre",
      jours: 12,
      corps: "Bonjour,\n\nJe n'ai pas reçu votre compte rendu du TP sur le titrage colorimétrique.\n\nRappel des attendus : protocole, tableau de mesures, exploitation avec calcul d'incertitude, et conclusion critique sur la concentration trouvée.\n\nMerci de le déposer avant la fin de la semaine.\n\nM. Delcourt",
    },
    {
      exp: "Secrétariat",
      role: "Secrétariat des élèves",
      sujet: "Mise à jour du dossier scolaire",
      jours: 14,
      corps: "Bonjour,\n\nDans le cadre de la mise à jour annuelle des dossiers, merci de vérifier les informations suivantes depuis votre espace : adresse postale, numéros de téléphone des responsables légaux et adresse électronique.\n\nToute modification doit être signalée avant la fin du mois.\n\nLe secrétariat",
    },
    {
      exp: PROFESSEURS.HG,
      role: "Professeur d'histoire-géographie",
      sujet: "Sortie pédagogique — mémorial",
      jours: 16,
      corps: "Bonjour,\n\nLa sortie au mémorial est confirmée pour le jeudi 21. Départ à 8h00 devant l'établissement, retour prévu vers 17h30.\n\nL'autorisation de sortie signée est à rapporter avant lundi. Prévoyez un pique-nique et une tenue adaptée : une partie de la visite se déroule en extérieur.\n\nM. Nguyen",
      pieces: [{ nom: "Autorisation de sortie.pdf", taille: 78_200 }],
    },
    {
      exp: "Infirmerie",
      role: "Infirmière scolaire",
      sujet: "Permanence bien-être et sommeil",
      jours: 18,
      corps: "Bonjour,\n\nUne permanence consacrée au sommeil et à la gestion du stress est ouverte à tous les élèves de terminale, le mardi de 12h00 à 14h00.\n\nAucune prise de rendez-vous n'est nécessaire, l'accueil est confidentiel.\n\nL'infirmerie",
    },
    {
      exp: PROFESSEURS.ESP,
      role: "Professeure d'espagnol",
      sujet: "Devoir maison — rendu décalé",
      jours: 21,
      corps: "Buenos días,\n\nEl plazo para entregar el trabajo sobre « Ficciones y realidades » se aplaza al lunes siguiente.\n\nRecuerden citar al menos dos documentos del expediente y estructurar la respuesta en tres partes.\n\nUn saludo,\nSra. Molina",
    },
    {
      exp: "Direction",
      role: "Chef d'établissement",
      sujet: "Modalités des évaluations communes",
      jours: 24,
      corps: "Madame, Monsieur,\n\nLes évaluations communes se dérouleront sur quatre demi-journées. Le calendrier détaillé par épreuve est disponible dans l'espace documents.\n\nLes élèves sont convoqués quinze minutes avant chaque épreuve, munis de leur convocation et d'une pièce d'identité. Les téléphones sont déposés à l'entrée de la salle.\n\nLa direction",
      pieces: [{ nom: "Convocation.pdf", taille: 121_000 }],
    },
    {
      exp: PROFESSEURS.EPS,
      role: "Professeur d'EPS",
      sujet: "Dispense et évaluation adaptée",
      jours: 27,
      corps: "Bonjour,\n\nSuite à votre dispense partielle, l'évaluation de demi-fond sera adaptée : vous serez évaluée sur la partie théorique (analyse d'une séance et projet d'entraînement) plutôt que sur la performance chronométrée.\n\nPassez me voir en début de cours pour en discuter.\n\nM. Tavares",
    },
  ];

  return modeles
    .map((m, i) => ({
      id: `msg-${i}`,
      date: addDays(toISODate(new Date()), -m.jours),
      expediteur: m.exp,
      roleExpediteur: m.role,
      destinataire: "Moi",
      sujet: m.sujet,
      apercu: m.corps.split("\n").filter(Boolean)[1]?.replace(/\s+/g, " ").slice(0, 150) ?? "",
      corps: m.corps,
      lu: i > 3,
      dossier: "reception",
      pieces: (m.pieces ?? []).map((p, j) => ({ id: `pj-${i}-${j}`, nom: p.nom, taille: p.taille })),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
};

const buildDocuments = (seed) => {
  const r = rng(hashSeed(seed, "documents"));

  // Les pièces rédigées portent une clé `statique` : le PDF téléchargé est
  // réellement produit à partir de ce contenu.
  const docs = [
    { nom: "Règlement intérieur.pdf", categorie: "Établissement", statique: "reglement", jours: 210,
      description: "Règles de vie collective, absences, sanctions." },
    { nom: "Calendrier des évaluations communes.pdf", categorie: "Établissement", statique: "evaluations", jours: 42,
      description: "Organisation, épreuves et matériel autorisé." },
    { nom: "Fiche méthode — la dissertation.pdf", categorie: "Ressources", statique: "methode", jours: 63,
      description: "De l'analyse du sujet à la relecture, étape par étape." },
    { nom: "Formulaire de mathématiques — Terminale.pdf", categorie: "Ressources", statique: "formulaire", jours: 96,
      description: "Suites, dérivation, exponentielle, intégration, probabilités." },
    { nom: "Guide Parcoursup.pdf", categorie: "Orientation", statique: "parcoursup", jours: 28,
      description: "Calendrier, vœux, projet motivé et phase d'admission." },
  ];

  return docs.map((d, i) => ({
    id: `doc-${i}`,
    nom: d.nom,
    categorie: d.categorie,
    description: d.description,
    statique: d.statique,
    type: "pdf",
    taille: intBetween(r, 90, 640) * 1024,
    date: addDays(toISODate(new Date()), -d.jours),
    url: null,
  }));
};

const buildActualites = (seed) => {
  const r = rng(hashSeed(seed, "actus"));
  const items = [
    {
      titre: "Semaine de l'orientation : le programme",
      contenu: "Du lundi au vendredi, le CDI accueille ateliers, témoignages d'anciens élèves et rencontres avec des professionnels. Au programme : rédaction du projet de formation motivé, découverte des classes préparatoires et des BUT, table ronde avec trois anciens élèves aujourd'hui en école d'ingénieurs. Le planning détaillé est affiché à l'entrée du CDI et disponible dans vos documents.",
      auteur: "Pôle orientation", categorie: "Orientation", jours: 1, epingle: true,
    },
    {
      titre: "Résultats du cross du lycée",
      contenu: "Bravo aux 240 participants pour cette édition disputée sous un beau soleil. Les résultats détaillés par niveau sont affichés dans le hall et disponibles en téléchargement. Les huit premiers de chaque catégorie sont qualifiés pour le cross départemental du mois prochain ; les inscriptions se font auprès de l'équipe EPS.",
      auteur: "Équipe EPS", categorie: "Vie du lycée", jours: 3,
    },
    {
      titre: "Évaluations communes : calendrier définitif",
      contenu: "Les évaluations communes se dérouleront sur quatre demi-journées. Aucun cours n'est assuré pendant les épreuves pour les classes concernées. Le calendrier détaillé par épreuve, les salles et les horaires de convocation sont disponibles dans l'espace documents.",
      auteur: "Direction", categorie: "Examens", jours: 5,
    },
    {
      titre: "Club robotique : les inscriptions sont ouvertes",
      contenu: "Le club se réunit le mercredi de 13h à 15h en salle Info 2. Aucun prérequis n'est demandé, le matériel est fourni. Le projet de l'année : concevoir un robot suiveur de ligne et participer à la rencontre inter-établissements du printemps. Une dizaine de places restent disponibles.",
      auteur: "M. Aubert", categorie: "Clubs", jours: 8,
    },
    {
      titre: "Nouvelle plage d'ouverture du CDI",
      contenu: "Le CDI reste désormais ouvert jusqu'à 18h du lundi au jeudi pour le travail en autonomie. Deux salles de travail en groupe sont réservables sur place. Le fonds documentaire a par ailleurs été enrichi d'une centaine d'ouvrages en sciences et en sciences humaines.",
      auteur: "CDI", categorie: "Vie du lycée", jours: 12,
    },
    {
      titre: "Concours général : inscriptions avant la fin du mois",
      contenu: "Les élèves de terminale souhaitant se présenter au concours général des lycées doivent se manifester auprès de leur professeur de discipline avant la fin du mois. Les épreuves ont lieu au printemps et représentent un investissement de travail conséquent, mais une expérience formatrice reconnue dans les dossiers.",
      auteur: "Direction", categorie: "Examens", jours: 15,
    },
    {
      titre: "Collecte de fournitures scolaires",
      contenu: "Le foyer socio-éducatif organise une collecte de fournitures au profit d'une association locale. Cahiers, stylos, calculatrices et cartables en bon état peuvent être déposés dans le hall jusqu'à la fin du mois. Un grand merci à celles et ceux qui participeront.",
      auteur: "Foyer socio-éducatif", categorie: "Solidarité", jours: 19,
    },
    {
      titre: "Théâtre : représentation de fin d'année",
      contenu: "L'atelier théâtre présentera sa création le vendredi 26 à 19h dans l'amphithéâtre. Entrée libre dans la limite des places disponibles. La troupe, composée de quinze élèves de la seconde à la terminale, travaille depuis septembre sur une adaptation contemporaine d'Antigone.",
      auteur: "Atelier théâtre", categorie: "Culture", jours: 23,
    },
  ];

  return items
    .map((a, i) => ({
      id: `actu-${i}`,
      titre: a.titre,
      contenu: a.contenu,
      auteur: a.auteur,
      categorie: a.categorie,
      date: addDays(toISODate(new Date()), -a.jours),
      epingle: Boolean(a.epingle),
      lectureMinutes: Math.max(1, Math.round(a.contenu.split(/\s+/).length / 180)),
    }))
    .sort((a, b) => (a.epingle !== b.epingle ? (a.epingle ? -1 : 1) : a.date < b.date ? 1 : -1));
};

const cache = new Map();

/** Construit (et memoise) l'intégralité du jeu de données de démonstration d'un compte. */
export const buildDataset = (compte) => {
  const seed = `eduflow:${compte.id}`;
  if (cache.has(seed)) return cache.get(seed);

  const annee = anneeDemo();
  const listePeriodes = periodes(annee);
  const edt = buildEmploiDuTemps(seed, annee);

  const dataset = {
    profil: buildProfil(seed, compte, annee),
    annee,
    periodes: listePeriodes,
    vacances: vacances(annee),
    matieres: MATIERES_ACTIVES.map((code) => ({
      ...SUBJECTS[code],
      professeur: PROFESSEURS[code],
      salle: SALLES[code],
    })),
    emploiDuTemps: edt,
    notes: buildNotes(seed, listePeriodes),
    devoirs: buildDevoirs(seed, edt),
    vieScolaire: buildVieScolaire(seed, edt),
    messages: buildMessages(seed),
    documents: buildDocuments(seed),
    actualites: buildActualites(seed),
  };

  cache.set(seed, dataset);
  return dataset;
};

export const COMPTE_DEMO = {
  id: "demo-élève-1",
  identifiant: "demo",
  motdepasse: "demo",
  prenom: "Anastasia",
  nom: "Moreau",
  email: "anastasia.moreau@exemple.fr",
};
