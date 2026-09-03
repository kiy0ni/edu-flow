import test from "node:test";
import assert from "node:assert/strict";
import { planifier, etatCarte } from "../src/modules/flashcards/sm2.js";

const neuve = { ease: 2.5, interval_days: 0, repetitions: 0, lapses: 0 };

test("une première réussite programme la carte au lendemain", () => {
  const suivant = planifier(neuve, 5);
  assert.equal(suivant.intervalle, 1);
  assert.equal(suivant.repetitions, 1);
  assert.ok(suivant.ease > 2.5);
});

test("la deuxième réussite porte l'intervalle à six jours", () => {
  const suivant = planifier({ ...neuve, repetitions: 1, interval_days: 1 }, 4);
  assert.equal(suivant.intervalle, 6);
  assert.equal(suivant.repetitions, 2);
});

test("au-delà, l'intervalle est multiplié par le facteur de facilité", () => {
  const suivant = planifier({ ease: 2.5, interval_days: 6, repetitions: 2, lapses: 0 }, 4);
  assert.equal(suivant.intervalle, 15); // 6 * 2.5
});

test("un échec réinitialise la progression et compte une rechute", () => {
  const suivant = planifier({ ease: 2.5, interval_days: 30, repetitions: 5, lapses: 0 }, 1);
  assert.equal(suivant.intervalle, 1);
  assert.equal(suivant.repetitions, 0);
  assert.equal(suivant.lapses, 1);
  assert.ok(suivant.ease < 2.5);
});

test("le facteur de facilité ne descend jamais sous 1.3", () => {
  let carte = { ...neuve };
  for (let i = 0; i < 20; i += 1) carte = { ...carte, ...renommer(planifier(carte, 0)) };
  assert.ok(carte.ease >= 1.3);
});

test("l'intervalle reste borné à un an", () => {
  const suivant = planifier({ ease: 2.5, interval_days: 300, repetitions: 9, lapses: 0 }, 5);
  assert.ok(suivant.intervalle <= 365);
});

test("une note hors bornes est ramenée dans l'échelle 0-5", () => {
  assert.deepEqual(planifier(neuve, 99), planifier(neuve, 5));
  assert.deepEqual(planifier(neuve, -4), planifier(neuve, 0));
});

test("l'état lisible reflète la progression", () => {
  assert.equal(etatCarte({ repetitions: 0, lapses: 0, interval_days: 0 }), "nouvelle");
  assert.equal(etatCarte({ repetitions: 1, lapses: 2, interval_days: 1 }), "difficile");
  assert.equal(etatCarte({ repetitions: 6, lapses: 0, interval_days: 40 }), "acquise");
  assert.equal(etatCarte({ repetitions: 3, lapses: 0, interval_days: 10 }), "en cours");
});

/** Adapte la sortie de planifier() au format d'une ligne de carte. */
const renommer = ({ ease, intervalle, repetitions, lapses }) => ({
  ease,
  interval_days: intervalle,
  repetitions,
  lapses,
});
