import gateway from "../../providers/gateway.js";
import { timeToMinutes, minutesToTime, eachDay, frDay, today, addDays } from "../../lib/dates.js";
import * as homework from "../homework/service.js";

/** Regroupe les cours par jour et calcule les bornes utiles a l'affichage. */
export const semaine = async (user, { from, to }) => {
  const cours = await gateway.emploiDuTemps(user, { from, to });
  const jours = eachDay(from, to).map((date) => {
    const duJour = cours
      .filter((c) => c.date === date)
      .sort((a, b) => timeToMinutes(a.debut) - timeToMinutes(b.debut));
    return {
      date,
      jour: frDay(date),
      cours: duJour,
      premierCours: duJour[0]?.debut ?? null,
      dernierCours: duJour.at(-1)?.fin ?? null,
      heuresDeCours: duJour
        .filter((c) => !c.annule)
        .reduce((acc, c) => acc + (timeToMinutes(c.fin) - timeToMinutes(c.debut)) / 60, 0),
    };
  });

  const tous = jours.flatMap((j) => j.cours);
  return {
    from,
    to,
    jours,
    bornes: {
      debut: tous.length ? minutesToTime(Math.min(...tous.map((c) => timeToMinutes(c.debut)))) : "08:00",
      fin: tous.length ? minutesToTime(Math.max(...tous.map((c) => timeToMinutes(c.fin)))) : "18:00",
    },
    resume: {
      nbCours: tous.filter((c) => !c.annule).length,
      nbAnnules: tous.filter((c) => c.annule).length,
      nbEvaluations: tous.filter((c) => c.type === "evaluation").length,
      heuresTotal: Math.round(jours.reduce((a, j) => a + j.heuresDeCours, 0) * 10) / 10,
    },
  };
};

/**
 * Creneaux libres exploitables pour travailler, en dehors des cours.
 * Sert de base au planificateur de revisions.
 */
export const creneauxLibres = async (user, { from, to, debutJournee = "17:00", finJournee = "21:00", joursOff = [] }) => {
  const cours = await gateway.emploiDuTemps(user, { from, to });
  const resultats = [];

  for (const date of eachDay(from, to)) {
    const nomJour = frDay(date);
    if (joursOff.includes(nomJour)) continue;

    const occupes = cours
      .filter((c) => c.date === date && !c.annule)
      .map((c) => [timeToMinutes(c.debut), timeToMinutes(c.fin)])
      .sort((a, b) => a[0] - b[0]);

    // Une plage de travail commence au plus tard a la fin des cours du jour.
    const finCours = occupes.length ? Math.max(...occupes.map(([, f]) => f)) : 0;
    let curseur = Math.max(timeToMinutes(debutJournee), finCours + 30);
    const limite = timeToMinutes(finJournee);

    // Cas des journées legeres : on recupere aussi les trous entre deux cours.
    const trous = [];
    for (let i = 0; i < occupes.length - 1; i += 1) {
      const gap = occupes[i + 1][0] - occupes[i][1];
      if (gap >= 60) trous.push({ debut: occupes[i][1] + 10, fin: occupes[i + 1][0] - 10 });
    }

    for (const trou of trous) {
      resultats.push({
        date,
        jour: nomJour,
        debut: minutesToTime(trou.debut),
        fin: minutesToTime(trou.fin),
        minutes: trou.fin - trou.debut,
        origine: "trou",
      });
    }

    if (curseur < limite) {
      resultats.push({
        date,
        jour: nomJour,
        debut: minutesToTime(curseur),
        fin: minutesToTime(limite),
        minutes: limite - curseur,
        origine: "soiree",
      });
    }
  }

  return resultats;
};

const echapperICS = (texte) => String(texte ?? "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

const stampICS = (date, heure) => `${date.replace(/-/g, "")}T${heure.replace(":", "")}00`;

/**
 * Export iCalendar.
 *
 * Le calendrier ne contient pas que les cours : les devoirs et les évaluations
 * y figurent comme journées entières, avec un rappel la veille au soir. C'est
 * ce qui rend l'export réellement utile une fois importé dans un téléphone.
 */
export const versICS = async (user, { from, to, avecDevoirs = true }) => {
  const [cours, travaux] = await Promise.all([
    gateway.emploiDuTemps(user, { from, to }),
    avecDevoirs
      ? homework.lister(user, { from, to }).catch(() => [])
      : Promise.resolve([]),
  ]);
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EduFlow//Emploi du temps//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:EduFlow - ${echapperICS(user.first_name)} ${echapperICS(user.last_name)}`,
    "X-WR-TIMEZONE:Europe/Paris",
  ];

  for (const c of cours) {
    if (c.annule) continue;
    lignes.push(
      "BEGIN:VEVENT",
      `UID:${c.id}@eduflow`,
      `DTSTAMP:${stampICS(today(), "00:00")}Z`,
      `DTSTART;TZID=Europe/Paris:${stampICS(c.date, c.debut)}`,
      `DTEND;TZID=Europe/Paris:${stampICS(c.date, c.fin)}`,
      `SUMMARY:${echapperICS(c.matiere)}`,
      `LOCATION:${echapperICS(c.salle ?? "")}`,
      `DESCRIPTION:${echapperICS([c.professeur, c.remarque].filter(Boolean).join(" - "))}`,
      "END:VEVENT",
    );
  }

  for (const d of travaux) {
    if (d.fait) continue;
    const evaluation = d.type === "controle";
    lignes.push(
      "BEGIN:VEVENT",
      `UID:${d.id}@eduflow`,
      `DTSTAMP:${stampICS(today(), "00:00")}Z`,
      // Journée entière : DTEND est exclusif, d'où le jour suivant.
      `DTSTART;VALUE=DATE:${d.dueDate.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${addDays(d.dueDate, 1).replace(/-/g, "")}`,
      `SUMMARY:${echapperICS(`${evaluation ? "Évaluation" : "À rendre"} · ${d.matiere}`)}`,
      `DESCRIPTION:${echapperICS([d.intitule, d.contenu].filter(Boolean).join("\n\n"))}`,
      `CATEGORIES:${evaluation ? "EVALUATION" : "DEVOIR"}`,
      "TRANSP:TRANSPARENT",
      // Rappel la veille à 18h, quand il est encore temps de s'y mettre.
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:-PT14H",
      `DESCRIPTION:${echapperICS(`${d.matiere} — ${d.intitule}`)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lignes.push("END:VCALENDAR");
  return lignes.join("\r\n");
};

/** Prochain cours a partir de maintenant. */
export const prochainCours = async (user) => {
  const cours = await gateway.emploiDuTemps(user, { from: today(), to: addDays(today(), 3) });
  const maintenant = new Date();
  const minutesActuelles = maintenant.getHours() * 60 + maintenant.getMinutes();

  const candidats = cours
    .filter((c) => !c.annule)
    .filter((c) => c.date > today() || (c.date === today() && timeToMinutes(c.debut) >= minutesActuelles))
    .sort((a, b) => (a.date === b.date ? timeToMinutes(a.debut) - timeToMinutes(b.debut) : a.date < b.date ? -1 : 1));

  return candidats[0] ?? null;
};
