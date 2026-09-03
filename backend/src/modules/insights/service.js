import gateway from "../../providers/gateway.js";
import * as compute from "../grades/compute.js";
import * as homework from "../homework/service.js";
import { queryAll } from "../../lib/db.js";
import { today, addDays, daysBetween, startOfWeek } from "../../lib/dates.js";
import * as activite from "../activite/service.js";
import * as objectifs from "../objectifs/service.js";

/**
 * Moteur d'analyse.
 *
 * Il croise notes, assiduite, devoirs et temps de travail pour produire des
 * constats *explicables* : chaque signal porte la donnee qui le declenche.
 * Aucune IA ici - les regles sont deterministes et verifiables.
 */

const SEUILS = {
  matiereFragile: 10,
  ecartMatiere: 1.5,
  baisseSignificative: -0.7,
  irregularite: 3.5,
  absencesAlerte: 4,
  retardsAlerte: 4,
  tauxDevoirsFaible: 60,
};

const signal = (niveau, categorie, titre, message, donnees = {}) => ({
  id: `${categorie}-${titre.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
  niveau,
  categorie,
  titre,
  message,
  donnees,
});

export const analyser = async (user) => {
  const [notesData, vieScolaire, devoirs, travail, serie, semaineActivite, comparaison, objectifsSuivis] =
    await Promise.all([
      gateway.notes(user, { periode: "annee" }),
      gateway.vieScolaire(user).catch(() => []),
      homework.lister(user, { from: addDays(today(), -30), to: addDays(today(), 14) }),
      statistiquesTravail(user.id),
      activite.serie(user.id).catch(() => ({ courante: 0, meilleure: 0, actifAujourdhui: false, joursActifs30: 0 })),
      activite.semaine(user.id).catch(() => []),
      activite.comparaisonHebdomadaire(user.id).catch(() => null),
      objectifs.lister(user).catch(() => ({ objectifs: [] })),
    ]);

  const agregats = compute.parMatiere(notesData.notes ?? [], notesData.matieres ?? []);
  const moyenne = compute.moyenneGenerale(agregats);
  const moyenneClasse = compute.moyenneClasseGenerale(agregats);
  const evolution = compute.evolutionParPeriode(notesData.notes ?? [], notesData.periodes ?? [], notesData.matieres ?? []);

  const levier = compute.levier(agregats);
  const projection = compute.projection(notesData.notes ?? [], notesData.matieres ?? []);

  const signaux = [
    ...signauxNotes(agregats, moyenne, moyenneClasse, evolution),
    ...signauxAssiduite(vieScolaire),
    ...signauxDevoirs(devoirs),
    ...signauxTravail(travail, agregats),
    ...signauxLevier(levier),
    ...signauxObjectifs(objectifsSuivis.objectifs ?? []),
    ...signauxSerie(serie),
  ];

  const ordre = { urgent: 0, attention: 1, info: 2, succes: 3 };
  signaux.sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);

  return {
    genereLe: new Date().toISOString(),
    synthese: {
      moyenneGenerale: moyenne,
      moyenneClasse,
      ecartClasse: moyenne !== null && moyenneClasse !== null ? compute.arrondi(moyenne - moyenneClasse) : null,
      tendance: tendanceGlobale(evolution),
      nbMatieres: agregats.length,
      scoreAssiduite: scoreAssiduite(vieScolaire),
      tauxDevoirsFaits: tauxDevoirs(devoirs),
      minutesTravail7j: travail.minutes7j,
    },
    evolution,
    parMatiere: agregats,
    levier: levier.slice(0, 6),
    projection,
    serie,
    bilanSemaine: {
      jours: semaineActivite,
      comparaison,
      devoirsTermines: devoirs.filter((d) => d.fait && daysBetween(startOfWeek(today()), d.dueDate) >= 0).length,
    },
    objectifs: objectifsSuivis.objectifs ?? [],
    signaux,
    recommandations: recommandations(signaux, agregats, devoirs, levier),
  };
};

/**
 * L'effet de levier : toutes les matières faibles ne se valent pas.
 * Une matière à coefficient élevé légèrement sous la classe pèse plus lourd
 * qu'une matière à coefficient 1 nettement en dessous.
 */
const signauxLevier = (levier) => {
  const meilleur = levier[0];
  if (!meilleur || meilleur.gainPotentiel < 0.1) return [];

  const out = [
    signal(
      "info",
      "notes",
      `${meilleur.matiere} est votre meilleur levier`,
      `Coefficient ${meilleur.coefficient} et ${meilleur.margeVersClasse} pt sous la classe : y revenir au niveau ` +
        `de la classe ferait gagner ${meilleur.gainPotentiel} pt de moyenne générale, ` +
        `soit plus que n'importe quelle autre matière.`,
      { matiere: meilleur.matiereCode, gain: meilleur.gainPotentiel },
    ),
  ];

  // Cas contre-intuitif : la matière la plus faible n'est pas la plus rentable.
  const plusFaible = [...levier].sort((a, b) => a.moyenne - b.moyenne)[0];
  if (plusFaible && plusFaible.matiereCode !== meilleur.matiereCode && plusFaible.gainPotentiel < meilleur.gainPotentiel) {
    out.push(
      signal(
        "info",
        "notes",
        `${plusFaible.matiere} pèse peu dans la moyenne`,
        `C'est votre note la plus basse (${plusFaible.moyenne}/20), mais son coefficient ${plusFaible.coefficient} ` +
          `limite son effet : la remonter au niveau de la classe ne rapporterait que ${plusFaible.gainPotentiel} pt.`,
        { matiere: plusFaible.matiereCode },
      ),
    );
  }

  return out;
};

/** Suivi des objectifs que l'élève s'est fixés. */
const signauxObjectifs = (liste) =>
  liste
    .filter((o) => o.actuel !== null)
    .map((o) =>
      o.atteint
        ? signal("succes", "notes", `Objectif atteint en ${o.matiere}`, `${o.actuel}/20 pour une cible de ${o.cible}.`, {
            matiere: o.matiereCode,
          })
        : signal(
            Math.abs(o.ecart) > 2 ? "attention" : "info",
            "notes",
            `Objectif en ${o.matiere} : ${Math.abs(o.ecart)} pt à combler`,
            o.noteNecessaire !== null
              ? `Actuellement ${o.actuel}/20 pour une cible de ${o.cible}. ` +
                `Une prochaine note de ${o.noteNecessaire}/20 (coefficient ${o.coefficientHypothese}) suffirait.`
              : `Actuellement ${o.actuel}/20 pour une cible de ${o.cible}. ` +
                `L'objectif n'est plus atteignable avec une seule évaluation.`,
            { matiere: o.matiereCode },
          ),
    )
    .slice(0, 4);

/** Régularité du travail, mesurée et non déclarée. */
const signauxSerie = (serie) => {
  if (serie.courante >= 3) {
    return [
      signal(
        "succes",
        "travail",
        `${serie.courante} jours de travail d'affilée`,
        serie.courante >= serie.meilleure
          ? "C'est votre meilleure série. La régularité est le facteur qui pèse le plus sur les résultats."
          : `Votre record est de ${serie.meilleure} jours.`,
        { serie: serie.courante },
      ),
    ];
  }
  if (serie.joursActifs30 > 0 && serie.courante === 0) {
    return [
      signal(
        "attention",
        "travail",
        "Série interrompue",
        `Aucun travail enregistré aujourd'hui ni hier. Vous avez travaillé ${serie.joursActifs30} jour(s) ` +
          "sur les 30 derniers : une session courte suffit à relancer la série.",
        { serie: 0 },
      ),
    ];
  }
  return [];
};

const tendanceGlobale = (evolution) => {
  const valides = evolution.filter((e) => e.moyenne !== null);
  if (valides.length < 2) return { direction: "stable", delta: 0 };
  const delta = compute.arrondi(valides.at(-1).moyenne - valides[0].moyenne);
  return { direction: delta >= 0.4 ? "hausse" : delta <= -0.4 ? "baisse" : "stable", delta };
};

const signauxNotes = (agregats, moyenne, moyenneClasse, evolution) => {
  const out = [];

  for (const m of agregats) {
    if (m.moyenne === null) continue;

    if (m.moyenne < SEUILS.matiereFragile) {
      out.push(
        signal("urgent", "notes", `${m.matiere} sous la moyenne`,
          `Moyenne de ${m.moyenne}/20 sur ${m.nbNotes} note(s). Cette matière pese un coefficient ${m.coefficient}.`,
          { matiereCode: m.matiereCode, moyenne: m.moyenne, coefficient: m.coefficient }),
      );
    } else if (moyenne !== null && m.moyenne < moyenne - SEUILS.ecartMatiere) {
      out.push(
        signal("attention", "notes", `${m.matiere} en retrait`,
          `${m.moyenne}/20 contre ${moyenne}/20 de moyenne générale, soit ${compute.arrondi(moyenne - m.moyenne)} pt d'écart.`,
          { matiereCode: m.matiereCode, ecart: compute.arrondi(moyenne - m.moyenne) }),
      );
    }

    if (m.tendance.direction === "baisse" && m.tendance.delta <= SEUILS.baisseSignificative) {
      out.push(
        signal("attention", "notes", `Baisse en ${m.matiere}`,
          `Les dernières notes sont en recul de ${Math.abs(m.tendance.delta)} pt par rapport au debut de période.`,
          { matiereCode: m.matiereCode, delta: m.tendance.delta }),
      );
    }

    if (m.tendance.direction === "hausse" && m.tendance.delta >= 1) {
      out.push(
        signal("succes", "notes", `Progression en ${m.matiere}`,
          `+${m.tendance.delta} pt sur la période. Ce qui a été mis en place fonctionne.`,
          { matiereCode: m.matiereCode, delta: m.tendance.delta }),
      );
    }

    if (m.regularite >= SEUILS.irregularite && m.nbNotes >= 3) {
      out.push(
        signal("info", "notes", `Résultats irreguliers en ${m.matiere}`,
          `Écart-type de ${m.regularite} pt (de ${m.min} a ${m.max}/20). Des révisions plus régulières lisseraient les résultats.`,
          { matiereCode: m.matiereCode, ecartType: m.regularite }),
      );
    }
  }

  const global = tendanceGlobale(evolution);
  if (global.direction === "hausse") {
    out.push(signal("succes", "notes", "Moyenne générale en progression",
      `+${global.delta} pt depuis la première période.`, { delta: global.delta }));
  } else if (global.direction === "baisse") {
    out.push(signal("attention", "notes", "Moyenne générale en recul",
      `${global.delta} pt depuis la première période.`, { delta: global.delta }));
  }

  if (moyenne !== null && moyenneClasse !== null && moyenne > moyenneClasse + 1) {
    out.push(signal("succes", "notes", "Au-dessus de la classe",
      `${compute.arrondi(moyenne - moyenneClasse)} pt au-dessus de la moyenne de classe.`));
  }

  return out;
};

const signauxAssiduite = (evenements) => {
  const out = [];
  const absences = evenements.filter((e) => e.type === "absence");
  const retards = evenements.filter((e) => e.type === "retard");
  const nonJustifiees = absences.filter((a) => !a.justifie);

  if (nonJustifiees.length > 0) {
    out.push(
      signal("urgent", "assiduite", "Absences non justifiées",
        `${nonJustifiees.length} absence(s) sans justificatif. Un justificatif est attendu par la vie scolaire.`,
        { nombre: nonJustifiees.length, dates: nonJustifiees.map((a) => a.date).slice(0, 5) }),
    );
  }

  if (absences.length >= SEUILS.absencesAlerte) {
    const heures = Math.round((absences.reduce((a, e) => a + (e.duree ?? 0), 0) / 60) * 10) / 10;
    out.push(
      signal("attention", "assiduite", "Volume d'absences élève",
        `${absences.length} absences cumulees, soit environ ${heures} h de cours manquées.`,
        { nombre: absences.length, heures }),
    );
  }

  if (retards.length >= SEUILS.retardsAlerte) {
    out.push(
      signal("attention", "assiduite", "Retards repetes",
        `${retards.length} retards enregistrés. Les retards du matin sont les plus pénalisants.`,
        { nombre: retards.length }),
    );
  }

  if (absences.length === 0 && retards.length === 0) {
    out.push(signal("succes", "assiduite", "Assiduité exemplaire", "Aucune absence ni retard enregistré."));
  }

  return out;
};

const signauxDevoirs = (devoirs) => {
  const out = [];
  const enRetard = devoirs.filter((d) => d.enRetard);
  const proches = devoirs.filter((d) => !d.fait && d.joursRestants >= 0 && d.joursRestants <= 2);
  const controles = devoirs.filter((d) => d.type === "controle" && !d.fait && d.joursRestants >= 0 && d.joursRestants <= 7);
  const taux = tauxDevoirs(devoirs);

  if (enRetard.length) {
    out.push(
      signal("urgent", "devoirs", "Travail en retard",
        `${enRetard.length} devoir(s) dont l'échéance est dépassée.`,
        { nombre: enRetard.length, matieres: [...new Set(enRetard.map((d) => d.matiere))] }),
    );
  }

  if (proches.length >= 3) {
    out.push(
      signal("attention", "devoirs", "Échéances rapprochees",
        `${proches.length} devoirs à rendre dans les 48 h. Le planificateur peut répartir la charge.`,
        { nombre: proches.length }),
    );
  }

  if (controles.length >= 2) {
    out.push(
      signal("attention", "devoirs", "Plusieurs évaluations cette semaine",
        `${controles.length} évaluations prevues sous 7 jours (${[...new Set(controles.map((c) => c.matiere))].join(", ")}).`,
        { nombre: controles.length }),
    );
  }

  if (taux !== null && taux < SEUILS.tauxDevoirsFaible) {
    out.push(
      signal("attention", "devoirs", "Taux de complétion faible",
        `${taux} % des devoirs échus ont été marques comme faits.`, { taux }),
    );
  } else if (taux !== null && taux >= 90) {
    out.push(signal("succes", "devoirs", "Travail suivi", `${taux} % des devoirs sont à jour.`, { taux }));
  }

  return out;
};

const signauxTravail = (travail, agregats) => {
  const out = [];

  if (travail.minutes7j === 0 && travail.revisions7j === 0) {
    out.push(
      signal("info", "travail", "Aucun temps de travail enregistré",
        "Lancer une session de concentration permet de mesurer le temps réellement passe et d'affiner le planificateur."),
    );
  } else if (travail.minutes7j > 0) {
    out.push(
      signal("info", "travail", "Temps de travail hebdomadaire",
        `${Math.round(travail.minutes7j / 6) / 10} h de travail concentré enregistrées sur 7 jours, réparties sur ${travail.jours7j} jour(s).`,
        { minutes: travail.minutes7j }),
    );
  }

  // Matiere fragile qui ne recoit aucun temps de travail : angle mort typique.
  const fragiles = agregats.filter((m) => m.moyenne !== null && m.moyenne < SEUILS.matiereFragile);
  const travaillees = new Set(travail.parMatiere.map((m) => m.matiere));
  const negligees = fragiles.filter((m) => !travaillees.has(m.matiere));
  if (negligees.length && travail.parMatiere.length) {
    out.push(
      signal("attention", "travail", "Matière fragile peu travaillee",
        `${negligees.map((m) => m.matiere).join(", ")} : aucune session de travail enregistrée malgre une moyenne sous 10.`,
        { matieres: negligees.map((m) => m.matiereCode) }),
    );
  }

  return out;
};

const tauxDevoirs = (devoirs) => {
  const echus = devoirs.filter((d) => d.joursRestants < 0);
  if (!echus.length) return null;
  return Math.round((echus.filter((d) => d.fait).length / echus.length) * 100);
};

const scoreAssiduite = (evenements) => {
  const penalites =
    evenements.filter((e) => e.type === "absence" && !e.justifie).length * 8 +
    evenements.filter((e) => e.type === "absence" && e.justifie).length * 2 +
    evenements.filter((e) => e.type === "retard").length * 3 +
    evenements.filter((e) => e.type === "sanction").length * 5;
  return Math.max(0, 100 - penalites);
};

const statistiquesTravail = async (userId) => {
  const [focus] = await queryAll(
    `SELECT coalesce(sum(actual_minutes),0)::int AS "minutes7j",
            count(DISTINCT started_at::date)::int AS "jours7j"
     FROM focus_sessions WHERE user_id = $1 AND started_at > now() - interval '7 days'`,
    [userId],
  );
  const [srs] = await queryAll(
    `SELECT count(*)::int AS "revisions7j"
     FROM card_reviews WHERE user_id = $1 AND reviewed_at > now() - interval '7 days'`,
    [userId],
  );
  const parMatiere = await queryAll(
    `SELECT subject AS matiere, coalesce(sum(actual_minutes),0)::int AS minutes
     FROM focus_sessions WHERE user_id = $1 AND subject IS NOT NULL
       AND started_at > now() - interval '30 days'
     GROUP BY subject`,
    [userId],
  );
  return { ...focus, ...srs, parMatiere };
};

/** Recommandations actionnables, deduites des signaux les plus prioritaires. */
const recommandations = (signaux, agregats, devoirs, levier = []) => {
  const out = [];

  const urgent = signaux.find((s) => s.niveau === "urgent" && s.categorie === "devoirs");
  if (urgent) {
    out.push({
      titre: "Traiter le travail en retard",
      detail: "Commencer par les devoirs dont l'échéance est dépassée : ce sont ceux qui pénalisent le plus.",
      action: { type: "naviguer", cible: "/devoirs" },
    });
  }

  const fragile = agregats.find((m) => m.moyenne !== null && m.moyenne < SEUILS.matiereFragile);
  if (fragile) {
    out.push({
      titre: `Remonter la moyenne en ${fragile.matiere}`,
      detail: `Créer un paquet de révision sur les chapitres recents et planifier deux sessions courtes par semaine.`,
      action: { type: "creerPaquet", matiere: fragile.matiere },
    });
  }

  const controlesProches = devoirs.filter((d) => d.type === "controle" && !d.fait && d.joursRestants >= 0 && d.joursRestants <= 7);
  if (controlesProches.length) {
    out.push({
      titre: "Preparer les évaluations de la semaine",
      detail: `Générer un plan de révisions réparti sur les créneaux libres avant ${controlesProches[0].dueDate}.`,
      action: { type: "genererPlan", horizon: 7 },
    });
  }

  const levierUtile = levier.find((l) => l.gainPotentiel >= 0.15);
  if (levierUtile) {
    out.push({
      titre: `Concentrer vos efforts sur ${levierUtile.matiere}`,
      detail:
        `Coefficient ${levierUtile.coefficient} : c'est la matière où un point gagné rapporte le plus ` +
        `(+${levierUtile.gainPotentiel} pt de moyenne générale en rejoignant la classe).`,
      action: { type: "genererPlan", horizon: 7 },
    });
  }

  if (out.length < 3) {
    const irregulier = agregats.find((m) => m.regularite >= SEUILS.irregularite);
    if (irregulier) {
      out.push({
        titre: `Stabiliser les résultats en ${irregulier.matiere}`,
        detail: "La répétition espacée est le levier le plus efficace contre l'irregularite : 10 minutes de flashcards par jour.",
        action: { type: "naviguer", cible: "/revisions" },
      });
    }
  }

  // Une section d'actions vide n'aide personne : à défaut d'urgence, on propose
  // le levier le plus rentable, qui reste vrai même quand tout va bien.
  if (!out.length) {
    const meilleur = levier[0];
    if (meilleur) {
      out.push({
        titre: `Viser plus haut en ${meilleur.matiere}`,
        detail:
          `Rien d'urgent en ce moment. ${meilleur.matiere} est de coefficient ${meilleur.coefficient} : ` +
          `chaque point gagné y rapporte ${meilleur.impactParPoint} pt de moyenne générale, ` +
          "plus que dans toute autre matière.",
        action: { type: "genererPlan", horizon: 7 },
      });
    }
    out.push({
      titre: "Entretenir vos révisions",
      detail: "Quelques minutes de répétition espacée par jour suffisent à consolider ce qui est déjà acquis.",
      action: { type: "naviguer", cible: "/revisions" },
    });
  }

  return out.slice(0, 4);
};
