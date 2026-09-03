/**
 * Générateur de PDF minimal, sans dépendance.
 *
 * Produit un document réellement ouvrable (police Helvetica, texte, filets)
 * suffisant pour les pièces que l'établissement met à disposition : bulletins,
 * attestations, règlements, fiches méthode.
 *
 * Le format PDF impose une table de références croisées contenant le décalage
 * en octets de chaque objet : tout est donc assemblé sur un Buffer unique dont
 * on mesure les positions au fur et à mesure.
 */

const A4 = { largeur: 595.28, hauteur: 841.89 };
const MARGE = 56;

/** Échappe les caractères réservés d'une chaîne littérale PDF. */
const echapper = (texte) => String(texte).replace(/([\\()])/g, "\\$1");

/**
 * Le jeu de caractères par défaut (WinAnsi) couvre le français.
 * Les caractères hors de cette table sont translittérés plutôt que perdus.
 */
const WINANSI = (texte) =>
  String(texte)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/—/g, "-")
    .replace(/–/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/€/g, "EUR")
    .replace(/[^\x00-\xff]/g, "?");

const versLatin1 = (texte) => Buffer.from(WINANSI(texte), "latin1");

/** Largeur approchée d'une chaîne, pour centrer et couper les lignes. */
const largeurTexte = (texte, taille) => WINANSI(texte).length * taille * 0.5;

/** Raccourcit une chaîne pour qu'elle tienne dans la largeur donnée. */
const tronquer = (texte, largeur, taille) => {
  if (largeurTexte(texte, taille) <= largeur) return texte;
  const maxi = Math.max(1, Math.floor(largeur / (taille * 0.5)) - 1);
  return `${texte.slice(0, maxi).trimEnd()}…`;
};

/**
 * Construit un document.
 * @param {{titre?: string, sousTitre?: string, pied?: string}} options
 */
export const creerDocument = ({ titre = "", sousTitre = "", pied = "" } = {}) => {
  const pages = [];
  let courante = [];
  let y = A4.hauteur - MARGE;

  const nouvellePage = () => {
    if (courante.length) pages.push(courante);
    courante = [];
    y = A4.hauteur - MARGE;
  };

  const place = (hauteur) => {
    if (y - hauteur < MARGE + 30) nouvellePage();
    y -= hauteur;
    return y;
  };

  const api = {
    /** Titre principal, centré. */
    titre(texte, taille = 18) {
      const py = place(taille + 12);
      courante.push({
        type: "texte",
        texte,
        taille,
        gras: true,
        x: (A4.largeur - largeurTexte(texte, taille)) / 2,
        y: py,
      });
      return api;
    },

    /** Intertitre aligné à gauche. */
    section(texte, taille = 12) {
      const py = place(taille + 16);
      courante.push({ type: "texte", texte, taille, gras: true, x: MARGE, y: py });
      courante.push({ type: "filet", y: py - 5, x1: MARGE, x2: A4.largeur - MARGE, epaisseur: 0.6 });
      return api;
    },

    /** Paragraphe, avec retour à la ligne automatique. */
    paragraphe(texte, taille = 10, interligne = 14) {
      const largeurUtile = A4.largeur - MARGE * 2;
      const mots = String(texte).split(/\s+/);
      let ligne = "";
      for (const mot of mots) {
        const essai = ligne ? `${ligne} ${mot}` : mot;
        if (largeurTexte(essai, taille) > largeurUtile && ligne) {
          courante.push({ type: "texte", texte: ligne, taille, x: MARGE, y: place(interligne) });
          ligne = mot;
        } else {
          ligne = essai;
        }
      }
      if (ligne) courante.push({ type: "texte", texte: ligne, taille, x: MARGE, y: place(interligne) });
      return api;
    },

    /** Ligne « libellé : valeur ». */
    champ(libelle, valeur, taille = 10) {
      const py = place(15);
      courante.push({ type: "texte", texte: `${libelle} :`, taille, gras: true, x: MARGE, y: py });
      courante.push({ type: "texte", texte: String(valeur ?? "—"), taille, x: MARGE + 150, y: py });
      return api;
    },

    /**
     * Tableau simple.
     * @param colonnes [{ titre, largeur, alignement }]
     * @param lignes   tableau de tableaux de valeurs
     */
    tableau(colonnes, lignes, taille = 9) {
      const total = colonnes.reduce((a, c) => a + c.largeur, 0);
      const echelle = (A4.largeur - MARGE * 2) / total;

      const dessinerLigne = (valeurs, gras) => {
        const py = place(16);
        let x = MARGE;
        valeurs.forEach((valeur, i) => {
          const largeur = colonnes[i].largeur * echelle;
          // Une cellule ne doit jamais déborder sur sa voisine ni sur la marge.
          const texte = tronquer(String(valeur ?? ""), largeur - 6, taille);
          const decalage =
            colonnes[i].alignement === "droite" ? largeur - largeurTexte(texte, taille) - 4 : 2;
          courante.push({ type: "texte", texte, taille, gras, x: x + decalage, y: py });
          x += largeur;
        });
        return py;
      };

      const yEntete = dessinerLigne(colonnes.map((c) => c.titre), true);
      courante.push({ type: "filet", y: yEntete - 4, x1: MARGE, x2: A4.largeur - MARGE, epaisseur: 0.8 });
      for (const ligne of lignes) dessinerLigne(ligne, false);
      return api;
    },

    espace(hauteur = 12) {
      place(hauteur);
      return api;
    },

    saut() {
      nouvellePage();
      return api;
    },

    /** Assemble le PDF et renvoie son contenu binaire. */
    rendre() {
      if (courante.length) pages.push(courante);
      if (!pages.length) pages.push([]);
      return assembler(pages, { titre, sousTitre, pied });
    },
  };

  if (titre) api.titre(titre);
  if (sousTitre) {
    const py = place(20);
    courante.push({
      type: "texte",
      texte: sousTitre,
      taille: 10,
      gris: true,
      x: (A4.largeur - largeurTexte(sousTitre, 10)) / 2,
      y: py,
    });
    api.espace(10);
  }

  return api;
};

/** Traduit les éléments d'une page en flux de contenu PDF. */
const fluxDePage = (elements, pied, numero, total) => {
  const morceaux = [];
  for (const el of elements) {
    if (el.type === "filet") {
      morceaux.push(
        `q ${el.epaisseur ?? 0.5} w 0.78 0.78 0.76 RG ${el.x1} ${el.y} m ${el.x2} ${el.y} l S Q`,
      );
    } else {
      const police = el.gras ? "/F2" : "/F1";
      const gris = el.gris ? "0.42 0.42 0.40 rg" : "0.08 0.08 0.06 rg";
      morceaux.push(`BT ${gris} ${police} ${el.taille} Tf ${el.x} ${el.y} Td (${echapper(WINANSI(el.texte))}) Tj ET`);
    }
  }
  const bas = pied ? `${pied}  ·  page ${numero}/${total}` : `page ${numero}/${total}`;
  morceaux.push(
    `BT 0.55 0.55 0.53 rg /F1 8 Tf ${(A4.largeur - largeurTexte(bas, 8)) / 2} ${MARGE - 24} Td (${echapper(WINANSI(bas))}) Tj ET`,
  );
  return morceaux.join("\n");
};

const assembler = (pages, { pied }) => {
  const objets = [];
  const ajouter = (contenu) => {
    objets.push(contenu);
    return objets.length; // les numéros d'objet commencent à 1
  };

  const idCatalogue = ajouter(null); // réservé
  const idPages = ajouter(null); // réservé
  const idPolice = ajouter("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const idPoliceGrasse = ajouter(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );

  const idsPages = [];
  pages.forEach((elements, index) => {
    const flux = fluxDePage(elements, pied, index + 1, pages.length);
    const octets = versLatin1(flux);
    const idFlux = ajouter({ flux: octets });
    const idPage = ajouter(
      `<< /Type /Page /Parent ${idPages} 0 R /MediaBox [0 0 ${A4.largeur} ${A4.hauteur}] ` +
        `/Resources << /Font << /F1 ${idPolice} 0 R /F2 ${idPoliceGrasse} 0 R >> >> /Contents ${idFlux} 0 R >>`,
    );
    idsPages.push(idPage);
  });

  objets[idCatalogue - 1] = `<< /Type /Catalog /Pages ${idPages} 0 R >>`;
  objets[idPages - 1] =
    `<< /Type /Pages /Count ${idsPages.length} /Kids [${idsPages.map((i) => `${i} 0 R`).join(" ")}] >>`;

  // Assemblage : on mémorise le décalage de chaque objet pour la table xref.
  const morceaux = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  let position = morceaux[0].length;
  const decalages = [];

  objets.forEach((contenu, index) => {
    decalages.push(position);
    const numero = index + 1;
    let bloc;
    if (contenu && typeof contenu === "object" && contenu.flux) {
      bloc = Buffer.concat([
        Buffer.from(`${numero} 0 obj\n<< /Length ${contenu.flux.length} >>\nstream\n`, "latin1"),
        contenu.flux,
        Buffer.from("\nendstream\nendobj\n", "latin1"),
      ]);
    } else {
      bloc = Buffer.from(`${numero} 0 obj\n${contenu}\nendobj\n`, "latin1");
    }
    morceaux.push(bloc);
    position += bloc.length;
  });

  const debutXref = position;
  const lignes = ["xref", `0 ${objets.length + 1}`, "0000000000 65535 f "];
  for (const decalage of decalages) lignes.push(`${String(decalage).padStart(10, "0")} 00000 n `);
  lignes.push(
    "trailer",
    `<< /Size ${objets.length + 1} /Root ${idCatalogue} 0 R >>`,
    "startxref",
    String(debutXref),
    "%%EOF",
  );
  morceaux.push(Buffer.from(`${lignes.join("\n")}\n`, "latin1"));

  return Buffer.concat(morceaux);
};

export default creerDocument;
