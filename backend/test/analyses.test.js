import test from "node:test";
import assert from "node:assert/strict";
import * as compute from "../src/modules/grades/compute.js";

const matieres = [
  { code: "MATH", nom: "Mathématiques", coefficient: 6 },
  { code: "EMC", nom: "EMC", coefficient: 1 },
];

const note = (id, matiereCode, valeur, moyenneClasse = null, date = "2026-01-01") => ({
  id,
  date,
  periodeCode: "T1",
  matiereCode,
  matiere: matiereCode,
  valeur,
  bareme: 20,
  coefficient: 1,
  moyenneClasse,
  nonSignificatif: false,
});

test("l'impact d'un point est proportionnel au coefficient de la matière", () => {
  const notes = [note("a", "MATH", 10), note("b", "EMC", 10)];
  const levier = compute.levier(compute.parMatiere(notes, matieres));
  const math = levier.find((l) => l.matiereCode === "MATH");
  const emc = levier.find((l) => l.matiereCode === "EMC");
  // 6 / 7 et 1 / 7
  assert.equal(math.impactParPoint, 0.857);
  assert.equal(emc.impactParPoint, 0.143);
  // La somme des impacts vaut 1 : un point partout monte la moyenne d'un point.
  assert.equal(Math.round((math.impactParPoint + emc.impactParPoint) * 100) / 100, 1);
});

test("le levier classe par gain réel, pas par note la plus basse", () => {
  // EMC est plus bas et plus loin de la classe, mais pèse six fois moins.
  const notes = [note("a", "MATH", 11, 13), note("b", "EMC", 8, 15)];
  const [premier] = compute.levier(compute.parMatiere(notes, matieres));
  assert.equal(premier.matiereCode, "MATH", "la matière à fort coefficient doit primer");
});

test("le gain potentiel est nul pour une matière déjà au-dessus de la classe", () => {
  const notes = [note("a", "MATH", 16, 12)];
  const [math] = compute.levier(compute.parMatiere(notes, matieres));
  assert.equal(math.gainPotentiel, 0);
  assert.equal(math.margeVersClasse, 0);
});

test("la projection prolonge une progression, sans l'exagérer", () => {
  const notes = [
    note("a", "MATH", 8, null, "2026-01-01"),
    note("b", "MATH", 8, null, "2026-01-15"),
    note("c", "MATH", 12, null, "2026-02-01"),
    note("d", "MATH", 12, null, "2026-02-15"),
  ];
  const p = compute.projection(notes, matieres);
  assert.equal(p.actuelle, 10);
  // Écart de +4 entre les deux moitiés, prolongé de moitié.
  assert.equal(p.delta, 2);
  assert.equal(p.projetee, 12);
});

test("la projection reste bornée par le barème", () => {
  const notes = [
    note("a", "MATH", 2, null, "2026-01-01"),
    note("b", "MATH", 2, null, "2026-01-15"),
    note("c", "MATH", 20, null, "2026-02-01"),
    note("d", "MATH", 20, null, "2026-02-15"),
  ];
  const p = compute.projection(notes, matieres);
  assert.ok(p.projetee <= 20);
});

test("la projection s'abstient quand les notes sont trop peu nombreuses", () => {
  const p = compute.projection([note("a", "MATH", 12)], matieres);
  assert.equal(p.fiabilite, "insuffisante");
  assert.equal(p.projetee, p.actuelle, "sans données, on ne projette rien");
});

test("la fiabilité de la projection croît avec le nombre de notes", () => {
  const beaucoup = Array.from({ length: 14 }, (_, i) =>
    note(`n${i}`, "MATH", 10 + (i % 3), null, `2026-0${1 + (i % 9)}-01`),
  );
  assert.equal(compute.projection(beaucoup, matieres).fiabilite, "bonne");
});

test("maxAtteignable dit jusqu'où une seule note peut mener", () => {
  const notes = [note("a", "MATH", 8), note("b", "MATH", 8)];
  const max = compute.maxAtteignable(notes, matieres, { matiereCode: "MATH", coefficient: 1, cible: "matiere" });
  // (8 + 8 + 20) / 3 = 12
  assert.equal(max, 12);
});

test("noteNecessaire vise bien la matière et non la moyenne générale", () => {
  const notes = [note("a", "MATH", 10), note("b", "EMC", 10)];
  const requise = compute.noteNecessaire(notes, matieres, {
    matiereCode: "MATH",
    objectif: 12,
    coefficient: 1,
    cible: "matiere",
  });
  // (10 + x) / 2 >= 12  =>  x >= 14
  assert.equal(requise, 14);
});
