import { normalizeSubject, subjectColor } from "../subjects.js";
import { toISODate } from "../../lib/dates.js";

/**
 * Traduction des structures École Directe vers le modele interne EduFlow.
 * Toute la tolerance aux variations de l'API amont est concentree ici.
 */

const jour = (value) => (value ? String(value).slice(0, 10) : null);
const heure = (value) => (value ? String(value).slice(11, 16) || String(value).slice(0, 5) : null);
const nombre = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export const mapProfil = (compte) => {
  const profil = compte?.profile ?? {};
  const classe = profil.classe ?? compte?.classe ?? {};
  return {
    id: String(compte?.id ?? ""),
    prenom: compte?.prenom ?? "",
    nom: compte?.nom ?? "",
    email: compte?.email ?? profil.email ?? null,
    telephone: profil.telPortable ?? null,
    role: compte?.typeCompte === "1" ? "parent" : compte?.typeCompte === "P" ? "professeur" : "eleve",
    classe: classe.libelle ?? classe.code ?? null,
    etablissement: compte?.nomEtablissement ?? profil.nomEtablissement ?? null,
    anneeScolaire: compte?.anneeScolaireCourante ?? null,
    avatarUrl: compte?.photo ? `https:${compte.photo}` : null,
    options: (profil.options ?? []).map((o) => o.libelle ?? o).filter(Boolean),
    professeurPrincipal: (profil.professeurs ?? []).find((p) => p.principal)?.nom ?? null,
    ine: profil.ineCandidat ?? null,
  };
};

export const mapPeriodes = (periodes = []) =>
  periodes
    .filter((p) => !p.cloture || p.notes?.length)
    .map((p) => ({
      code: String(p.idPeriode ?? p.codePeriode ?? p.periode),
      libelle: p.periode ?? p.libelle ?? "Période",
      debut: jour(p.dateDebut),
      fin: jour(p.dateFin),
      cloture: Boolean(p.cloture),
    }));

export const mapEmploiDuTemps = (cours = []) =>
  cours
    .filter((c) => c.matiere || c.text)
    .map((c) => {
      const matiere = normalizeSubject(c.matiere ?? c.text);
      const annule = Boolean(c.isAnnule);
      return {
        id: `ed-${c.id ?? `${c.start_date}-${c.matiere}`}`,
        date: jour(c.start_date),
        debut: heure(c.start_date),
        fin: heure(c.end_date),
        matiereCode: matiere.code,
        matiere: matiere.nom,
        couleur: c.color || matiere.couleur,
        professeur: c.prof ?? null,
        salle: c.salle ?? null,
        type: annule ? "annule" : c.typeCours === "CONTROLE" ? "evaluation" : "cours",
        annule,
        remarque: annule ? "Cours annulé" : c.contenuDeSeance ?? null,
      };
    })
    .filter((c) => c.date);

export const mapNotes = (payload = {}) => {
  const periodes = mapPeriodes(payload.periodes ?? []);
  const notes = (payload.notes ?? []).map((n) => {
    const matiere = normalizeSubject(n.libelleMatiere ?? n.codeMatiere);
    return {
      id: `ed-note-${n.id}`,
      date: jour(n.date ?? n.dateSaisie),
      periodeCode: String(n.codePeriode ?? ""),
      matiereCode: matiere.code,
      matiere: matiere.nom,
      couleur: subjectColor(matiere.code),
      professeur: null,
      intitule: n.devoir ?? "Évaluation",
      valeur: nombre(n.valeur),
      bareme: nombre(n.noteSur) ?? 20,
      coefficient: nombre(n.coef) ?? 1,
      moyenneClasse: nombre(n.moyenneClasse),
      minClasse: nombre(n.minClasse),
      maxClasse: nombre(n.maxClasse),
      nonSignificatif: Boolean(n.nonSignificatif) || n.valeur === "Abs",
    };
  });

  const matieres = [];
  const vues = new Set();
  for (const p of payload.periodes ?? []) {
    for (const d of p.ensembleMatieres?.disciplines ?? []) {
      const matiere = normalizeSubject(d.discipline);
      if (vues.has(matiere.code)) continue;
      vues.add(matiere.code);
      matieres.push({
        ...matiere,
        coefficient: nombre(d.coef) ?? 1,
        professeur: (d.professeurs ?? [])[0]?.nom ?? null,
      });
    }
  }

  return { notes: notes.filter((n) => n.valeur !== null), periodes, matieres };
};

/** Le cahier de texte École Directe est indexe par date de rendu. */
export const mapDevoirs = (parDate = {}) => {
  const out = [];
  for (const [date, entrees] of Object.entries(parDate)) {
    for (const d of entrees ?? []) {
      const matiere = normalizeSubject(d.matiere);
      const contenu = d.aFaire?.contenu ? Buffer.from(d.aFaire.contenu, "base64").toString("utf8") : null;
      out.push({
        id: `ed-dev-${d.id}`,
        matiereCode: matiere.code,
        matiere: matiere.nom,
        couleur: matiere.couleur,
        professeur: null,
        donneLe: jour(d.aFaire?.donneLe) ?? null,
        dueDate: jour(date),
        type: d.interrogation ? "controle" : "devoir",
        intitule: d.interrogation ? `Évaluation - ${matiere.nom}` : `${matiere.nom} - travail à faire`,
        contenu: contenu ? contenu.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : null,
        dureeEstimee: null,
        difficulte: null,
        rendreEnLigne: Boolean(d.aFaire?.rendreEnLigne),
        documents: (d.aFaire?.documents ?? []).map((doc) => ({
          id: String(doc.id),
          nom: doc.libelle,
          taille: doc.taille ?? null,
        })),
        faitDistant: Boolean(d.aFaire?.effectue),
      });
    }
  }
  return out.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
};

export const mapVieScolaire = (payload = {}) =>
  (payload.absencesRetards ?? []).map((v) => ({
    id: `ed-vs-${v.id}`,
    date: jour(v.displayDate ?? v.date),
    type: v.typeElement === "Retard" ? "retard" : v.typeElement === "Absence" ? "absence" : "sanction",
    debut: heure(v.date),
    fin: heure(v.dateFin),
    duree: null,
    motif: v.motif || "Non précisé",
    justifie: Boolean(v.justifie),
    commentaire: v.commentaire || null,
  }));

export const mapMessages = (payload = {}, dossier = "reception") =>
  (payload.messages?.received ?? payload.messages?.sent ?? []).map((m) => ({
    id: `ed-msg-${m.id}`,
    date: jour(m.date),
    expediteur: m.from?.nom ? `${m.from.civilite ?? ""} ${m.from.prenom ?? ""} ${m.from.nom}`.trim() : "Établissement",
    destinataire: (m.to ?? []).map((t) => t.nom).join(", ") || "Moi",
    sujet: m.subject ?? "(sans objet)",
    apercu: (m.content ? Buffer.from(m.content, "base64").toString("utf8") : "").replace(/<[^>]+>/g, " ").trim().slice(0, 160),
    corps: m.content ? Buffer.from(m.content, "base64").toString("utf8") : null,
    lu: Boolean(m.read),
    dossier,
    pieces: (m.files ?? []).map((f) => ({ id: String(f.id), nom: f.libelle, taille: f.taille ?? null })),
  }));

export const mapDocuments = (payload = {}) => {
  const out = [];
  const categories = {
    factures: "Factures",
    notes: "Bulletins",
    viescolaire: "Vie scolaire",
    administratifs: "Administratif",
    inscriptions: "Inscriptions",
  };
  for (const [cle, libelle] of Object.entries(categories)) {
    for (const d of payload[cle] ?? []) {
      out.push({
        id: `ed-doc-${d.id}`,
        nom: d.libelle ?? d.nom ?? "Document",
        categorie: libelle,
        type: (d.type ?? "pdf").toLowerCase(),
        taille: d.taille ?? null,
        date: jour(d.date) ?? toISODate(new Date()),
        url: null,
      });
    }
  }
  return out;
};

export const mapActualites = (payload = {}) =>
  (payload.actualites ?? payload ?? []).map?.((a, i) => ({
    id: `ed-actu-${a.id ?? i}`,
    date: jour(a.date),
    titre: a.titre ?? "Actualité",
    contenu: (a.contenu ? Buffer.from(a.contenu, "base64").toString("utf8") : a.texte ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    auteur: a.createur ?? "Établissement",
    categorie: a.categorie ?? "Vie du lycée",
    epingle: false,
  })) ?? [];
