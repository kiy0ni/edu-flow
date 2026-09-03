import test from "node:test";
import assert from "node:assert/strict";
import * as compute from "../src/modules/grades/compute.js";

const matieres = [
  { code: "MATH", nom: "Mathématiques", coefficient: 6 },
  { code: "ANG", nom: "Anglais", coefficient: 3 },
];

const note = (id, matiereCode, valeur, coefficient = 1, extra = {}) => ({
  id,
  date: "2026-01-01",
  periodeCode: "T1",
  matiereCode,
  matiere: matiereCode,
  valeur,
  bareme: 20,
  coefficient,
  moyenneClasse: null,
  nonSignificatif: false,
  ...extra,
});

test("la moyenne d'une matière pondère par le coefficient de chaque note", () => {
  const notes = [note("a", "MATH", 10, 1), note("b", "MATH", 16, 3)];
  const [math] = compute.parMatiere(notes, matieres);
  // (10*1 + 16*3) / 4 = 14.5
  assert.equal(math.moyenne, 14.5);
  assert.equal(math.nbNotes, 2);
});

test("les notes sont ramenées sur 20 quel que soit le barème", () => {
  const notes = [note("a", "MATH", 5, 1, { bareme: 10 })];
  const [math] = compute.parMatiere(notes, matieres);
  assert.equal(math.moyenne, 10);
});

test("les notes non significatives sont exclues", () => {
  const notes = [note("a", "MATH", 20), note("b", "MATH", 2, 1, { nonSignificatif: true })];
  const [math] = compute.parMatiere(notes, matieres);
  assert.equal(math.moyenne, 20);
  assert.equal(math.nbNotes, 1);
});

test("la moyenne générale pondère par le coefficient de la matière", () => {
  const notes = [note("a", "MATH", 10), note("b", "ANG", 20)];
  const agregats = compute.parMatiere(notes, matieres);
  // (10*6 + 20*3) / 9 = 13.33
  assert.equal(compute.moyenneGenerale(agregats), 13.33);
});

test("la moyenne générale vaut null sans aucune note exploitable", () => {
  assert.equal(compute.moyenneGenerale([]), null);
});

test("la tendance compare la première moitié des notes à la seconde", () => {
  const monter = [
    { ...note("a", "MATH", 8), date: "2026-01-01" },
    { ...note("b", "MATH", 9), date: "2026-02-01" },
    { ...note("c", "MATH", 15), date: "2026-03-01" },
    { ...note("d", "MATH", 16), date: "2026-04-01" },
  ];
  const [math] = compute.parMatiere(monter, matieres);
  assert.equal(math.tendance.direction, "hausse");
  assert.ok(math.tendance.delta > 0);
});

test("la simulation mesure l'effet réel d'une note hypothétique", () => {
  const notes = [note("a", "MATH", 10), note("b", "ANG", 10)];
  const resultat = compute.simuler(notes, matieres, {
    ajouts: [{ matiereCode: "MATH", valeur: 20, coefficient: 1 }],
  });
  assert.equal(resultat.actuel, 10);
  assert.ok(resultat.simule > resultat.actuel);
  assert.equal(resultat.delta, Math.round((resultat.simule - resultat.actuel) * 100) / 100);
});

test("une exclusion retire bien la note du calcul", () => {
  const notes = [note("a", "MATH", 4), note("b", "MATH", 16)];
  const resultat = compute.simuler(notes, matieres, { exclusions: ["a"] });
  assert.equal(resultat.actuel, 10);
  assert.equal(resultat.simule, 16);
});

test("noteNecessaire renvoie null quand l'objectif est hors d'atteinte", () => {
  const notes = [note("a", "MATH", 2), note("b", "ANG", 2)];
  const requise = compute.noteNecessaire(notes, matieres, {
    matiereCode: "ANG",
    objectif: 19,
    coefficient: 1,
  });
  assert.equal(requise, null);
});

test("noteNecessaire trouve la note minimale atteignant l'objectif", () => {
  const notes = [note("a", "MATH", 12), note("b", "ANG", 12)];
  const requise = compute.noteNecessaire(notes, matieres, {
    matiereCode: "MATH",
    objectif: 13,
    coefficient: 2,
  });
  assert.ok(requise !== null && requise > 12 && requise <= 20);
});
