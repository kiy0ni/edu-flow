import test from "node:test";
import assert from "node:assert/strict";
import * as d from "../src/lib/dates.js";

test("addDays franchit correctement les fins de mois et d'année", () => {
  assert.equal(d.addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(d.addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(d.addDays("2026-03-01", -1), "2026-02-28");
});

test("la semaine commence le lundi", () => {
  assert.equal(d.startOfWeek("2026-08-28"), "2026-08-24"); // un vendredi
  assert.equal(d.startOfWeek("2026-08-24"), "2026-08-24"); // le lundi lui-même
  assert.equal(d.startOfWeek("2026-08-30"), "2026-08-24"); // le dimanche
  assert.equal(d.endOfWeek("2026-08-28"), "2026-08-30");
});

test("daysBetween est signé et symétrique", () => {
  assert.equal(d.daysBetween("2026-01-01", "2026-01-11"), 10);
  assert.equal(d.daysBetween("2026-01-11", "2026-01-01"), -10);
});

test("eachDay est inclusif aux deux bornes", () => {
  assert.deepEqual(d.eachDay("2026-01-01", "2026-01-03"), ["2026-01-01", "2026-01-02", "2026-01-03"]);
  assert.deepEqual(d.eachDay("2026-01-01", "2026-01-01"), ["2026-01-01"]);
});

test("les conversions horaires sont réciproques", () => {
  assert.equal(d.timeToMinutes("08:30"), 510);
  assert.equal(d.minutesToTime(510), "08:30");
  assert.equal(d.minutesToTime(d.timeToMinutes("17:45")), "17:45");
});

test("l'année scolaire bascule au mois d'août", () => {
  assert.equal(d.schoolYearStart("2026-09-15"), 2026);
  assert.equal(d.schoolYearStart("2027-03-15"), 2026);
  assert.equal(d.schoolYearStart("2026-07-15"), 2025);
});

test("frDay nomme le bon jour", () => {
  assert.equal(d.frDay("2026-08-28"), "vendredi");
  assert.equal(d.frDay("2026-08-30"), "dimanche");
});
