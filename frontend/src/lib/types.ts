/** Types partages avec l'API EduFlow. */

export type Teinte = { clair: string; sombre: string };

export interface Utilisateur {
  id: string;
  source: "ecoledirecte" | "demo" | "local";
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  role: string;
  classe: string | null;
  etablissement: string | null;
  avatarUrl: string | null;
  derniereConnexion: string | null;
}

export interface Cours {
  id: string;
  date: string;
  debut: string;
  fin: string;
  matiereCode: string;
  matiere: string;
  couleur: Teinte;
  professeur: string | null;
  salle: string | null;
  type: "cours" | "evaluation" | "annule";
  annule: boolean;
  remarque: string | null;
}

export interface JourEdt {
  date: string;
  jour: string;
  cours: Cours[];
  premierCours: string | null;
  dernierCours: string | null;
  heuresDeCours: number;
}

export interface Note {
  id: string;
  date: string;
  periodeCode: string;
  matiereCode: string;
  matiere: string;
  couleur: Teinte;
  professeur: string | null;
  intitule: string;
  valeur: number;
  bareme: number;
  coefficient: number;
  moyenneClasse: number | null;
  minClasse: number | null;
  maxClasse: number | null;
  nonSignificatif: boolean;
}

export interface MoyenneMatiere {
  matiereCode: string;
  matiere: string;
  couleur: Teinte;
  professeur: string | null;
  coefficient: number;
  nbNotes: number;
  moyenne: number | null;
  moyenneClasse: number | null;
  ecartClasse: number | null;
  min: number | null;
  max: number | null;
  regularite: number;
  tendance: { direction: "hausse" | "baisse" | "stable"; delta: number };
}

export interface Devoir {
  id: string;
  matiereCode: string;
  matiere: string;
  couleur: Teinte;
  professeur: string | null;
  donneLe: string | null;
  dueDate: string;
  type: "devoir" | "controle" | "lecon";
  intitule: string;
  contenu: string | null;
  dureeEstimee: number;
  difficulte: number;
  rendreEnLigne: boolean;
  documents: { id: string; nom: string; taille: number | null }[];
  fait: boolean;
  joursRestants: number;
  enRetard: boolean;
  urgence: number;
}

export interface EvenementVieScolaire {
  id: string;
  date: string;
  type: "absence" | "retard" | "sanction";
  debut: string | null;
  fin: string | null;
  duree: number | null;
  motif: string;
  justifie: boolean;
  commentaire: string | null;
}

export interface PieceJointe {
  id: string;
  nom: string;
  taille: number | null;
}

export interface Message {
  id: string;
  date: string;
  expediteur: string;
  roleExpediteur?: string | null;
  destinataire: string;
  destinataires?: { id: string; nom: string }[];
  sujet: string;
  apercu: string;
  corps?: string | null;
  lu: boolean;
  favori: boolean;
  archive: boolean;
  dossier: string;
  repondA?: string | null;
  local?: boolean;
  pieces: PieceJointe[];
}

export interface Destinataire {
  id: string;
  nom: string;
  role: string;
  groupe: string;
}

export type DossierMessagerie = "reception" | "envoyes" | "archives" | "corbeille";

export interface DocumentEtablissement {
  id: string;
  nom: string;
  categorie: string;
  description?: string | null;
  type: string;
  taille: number | null;
  date: string;
  url: string | null;
  genere: boolean;
  telechargeable: boolean;
  ouvertLe: string | null;
  favori: boolean;
}

export interface Actualite {
  id: string;
  date: string;
  titre: string;
  contenu: string;
  auteur: string;
  categorie: string;
  epingle: boolean;
  lectureMinutes?: number;
}

export interface Notification {
  id: string;
  type: string;
  severite: "info" | "succes" | "attention" | "urgent";
  titre: string;
  corps: string | null;
  lien: string | null;
  luLe: string | null;
  creeLe: string;
}

export interface BlocPlan {
  id: string;
  date: string;
  debut: string;
  fin: string;
  kind: "revision" | "devoir" | "controle" | "pause" | "autre";
  subject: string | null;
  titre: string;
  detail: string | null;
  homeworkId: string | null;
  priorite: number;
  status: "planifie" | "fait" | "reporte" | "annule";
  auto: boolean;
}

export interface Paquet {
  id: string;
  titre: string;
  matiere: string | null;
  description: string | null;
  source: string;
  cartes: number;
  dues: number;
  nouvelles: number;
  acquises: number;
  couleur: Teinte;
  progression: number;
}

export interface Carte {
  id: string;
  recto: string;
  verso: string;
  indice: string | null;
  deckId?: string;
  paquet?: string;
  matiere?: string | null;
  couleur?: Teinte;
  etat: string;
  dueLe: string;
}

export interface Signal {
  id: string;
  niveau: "urgent" | "attention" | "info" | "succes";
  categorie: string;
  titre: string;
  message: string;
  donnees: Record<string, unknown>;
}

export interface Analyses {
  genereLe: string;
  synthese: {
    moyenneGenerale: number | null;
    moyenneClasse: number | null;
    ecartClasse: number | null;
    tendance: { direction: string; delta: number };
    nbMatieres: number;
    scoreAssiduite: number;
    tauxDevoirsFaits: number | null;
    minutesTravail7j: number;
  };
  evolution: { periodeCode: string; libelle: string; moyenne: number | null; moyenneClasse: number | null; nbNotes: number }[];
  parMatiere: MoyenneMatiere[];
  levier: MatiereLevier[];
  projection: Projection;
  serie: Serie;
  bilanSemaine: BilanSemaine;
  objectifs: {
    matiereCode: string;
    matiere: string;
    cible: number;
    actuel: number | null;
    atteint: boolean;
  }[];
  signaux: Signal[];
  recommandations: { titre: string; detail: string; action: Record<string, unknown> }[];
}

export interface Conversation {
  id: string;
  titre: string;
  portee: string;
  majLe: string;
  messages?: number;
}

export interface MessageIA {
  id: string;
  role: "user" | "assistant";
  contenu: string;
  creeLe: string;
}

export interface Preferences {
  theme: "light" | "dark" | "system";
  accent: string;
  locale: string;
  aiOptIn: boolean;
  notifications: Record<string, boolean>;
  study: { debut: string; fin: string; dureeBloc: number; pause: number; joursOff: string[] };
}

export interface MatiereLevier {
  matiereCode: string;
  matiere: string;
  couleur: Teinte;
  coefficient: number;
  moyenne: number;
  moyenneClasse: number | null;
  /** Variation de la moyenne générale pour un point gagné dans cette matière. */
  impactParPoint: number;
  margeVersClasse: number;
  gainPotentiel: number;
}

export interface Projection {
  actuelle: number | null;
  projetee: number | null;
  delta: number;
  fiabilite: "bonne" | "moyenne" | "faible" | "insuffisante";
  nbNotes: number;
}

export interface Serie {
  courante: number;
  meilleure: number;
  actifAujourdhui: boolean;
  joursActifs30: number;
}

export interface JourActivite {
  date: string;
  devoirs: number;
  cartes: number;
  minutes: number;
  blocs: number;
  actif: boolean;
}

export interface BilanSemaine {
  jours: JourActivite[];
  comparaison: {
    devoirs: { semaine: number; precedente: number; evolution: number };
    cartes: { semaine: number; precedente: number; evolution: number };
    minutes: { semaine: number; precedente: number; evolution: number };
  } | null;
  devoirsTermines: number;
}
