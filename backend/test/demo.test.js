import test from "node:test";
import assert from "node:assert/strict";
import { buildDataset, COMPTE_DEMO } from "../src/providers/demo/dataset.js";
import { today, daysBetween, startOfWeek, addDays, eachDay } from "../src/lib/dates.js";

const jeu = buildDataset(COMPTE_DEMO);

test("le jeu de démonstration est déterministe", () => {
  const second = buildDataset({ ...COMPTE_DEMO });
  assert.equal(JSON.stringify(jeu.notes), JSON.stringify(second.notes));
  assert.equal(JSON.stringify(jeu.emploiDuTemps), JSON.stringify(second.emploiDuTemps));
});

test("la date du jour tombe toujours dans l'année scolaire simulée", () => {
  assert.ok(daysBetween(jeu.annee.debut, today()) >= 0);
  assert.ok(daysBetween(today(), jeu.annee.fin) >= 0);
});

/** Jours ouvrés de la semaine en cours qui tombent dans l'année scolaire. */
const ouvresDeLaSemaine = () => {
  const lundi = startOfWeek(today());
  return eachDay(lundi, addDays(lundi, 4)).filter(
    (j) => daysBetween(jeu.annee.debut, j) >= 0 && daysBetween(j, jeu.annee.fin) >= 0,
  );
};

test("les jours ouvrés de la semaine en cours comportent des cours", () => {
  // Un jour hors année scolaire (rentrée en cours de semaine, vacances) est
  // légitimement vide : on ne teste que les jours réellement scolaires.
  const ouvres = ouvresDeLaSemaine();
  const vides = ouvres.filter((j) => !jeu.emploiDuTemps.some((c) => c.date === j));
  assert.equal(vides.length, 0, `jour(s) ouvré(s) sans cours : ${vides.join(", ")}`);
});

test("la semaine en cours reste exploitable", () => {
  const ouvres = ouvresDeLaSemaine();
  assert.ok(ouvres.length >= 1, "aucun jour scolaire dans la semaine en cours");
  const total = jeu.emploiDuTemps.filter((c) => ouvres.includes(c.date)).length;
  assert.ok(total >= 4, `seulement ${total} cours sur la semaine`);
});

test("les trois trimestres se suivent sans trou ni chevauchement", () => {
  const [t1, t2, t3] = jeu.periodes;
  assert.equal(daysBetween(t1.fin, t2.debut), 1);
  assert.equal(daysBetween(t2.fin, t3.debut), 1);
});

test("toutes les notes sont valides et rattachées à une période", () => {
  const codes = new Set(jeu.periodes.map((p) => p.code));
  for (const note of jeu.notes) {
    assert.ok(note.valeur >= 0 && note.valeur <= note.bareme, `note hors barème : ${note.valeur}`);
    assert.ok(codes.has(note.periodeCode));
    assert.ok(note.couleur.clair && note.couleur.sombre, "teinte de matière incomplète");
  }
});

test("chaque devoir est à rendre après avoir été donné", () => {
  for (const devoir of jeu.devoirs) {
    assert.ok(daysBetween(devoir.donneLe, devoir.dueDate) > 0);
  }
});

test("aucun cours n'est placé un week-end ou pendant les vacances", () => {
  for (const cours of jeu.emploiDuTemps.slice(0, 200)) {
    const jour = new Date(`${cours.date}T12:00:00`).getDay();
    assert.ok(jour !== 0 && jour !== 6, `cours un week-end : ${cours.date}`);
    for (const v of jeu.vacances) {
      const dedans = daysBetween(v.debut, cours.date) >= 0 && daysBetween(cours.date, v.fin) >= 0;
      assert.ok(!dedans, `cours pendant les vacances de ${v.nom} : ${cours.date}`);
    }
  }
});
