/** Generateur pseudo-aleatoire deterministe : meme graine => memes donnees. */

export const hashSeed = (...parts) => {
  let h = 2166136261;
  for (const part of parts) {
    const str = String(part);
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
};

/** mulberry32 - rapide, stable, suffisant pour generer un jeu de demonstration. */
export const rng = (seed) => {
  let a = typeof seed === "number" ? seed : hashSeed(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const pick = (random, arr) => arr[Math.floor(random() * arr.length)];

export const pickMany = (random, arr, count) => {
  const pool = [...arr];
  const out = [];
  for (let i = 0; i < count && pool.length; i += 1) {
    out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return out;
};

export const intBetween = (random, min, max) => min + Math.floor(random() * (max - min + 1));

export const floatBetween = (random, min, max, decimals = 2) => {
  const value = min + random() * (max - min);
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

export const chance = (random, probability) => random() < probability;
