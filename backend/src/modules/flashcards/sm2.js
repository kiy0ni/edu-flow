/**
 * Repetition espacee - algorithme SM-2 (SuperMemo 2).
 *
 * `quality` va de 0 (echec total) a 5 (rappel parfait).
 * En dessous de 3, la carte repart au debut ; au-dessus, l'intervalle croit
 * selon un facteur de facilite ajuste a chaque revision.
 */
export const planifier = (carte, quality) => {
  const q = Math.max(0, Math.min(5, Math.round(quality)));

  let { ease = 2.5, interval_days: intervalle = 0, repetitions = 0, lapses = 0 } = carte;
  ease = Number(ease);

  if (q < 3) {
    repetitions = 0;
    intervalle = 1;
    lapses += 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalle = 1;
    else if (repetitions === 2) intervalle = 6;
    else intervalle = Math.round(intervalle * ease);
  }

  // Ajustement du facteur de facilite, borne a 1.3 pour eviter l'emballement.
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  intervalle = Math.max(1, Math.min(365, intervalle));

  return {
    ease: Math.round(ease * 100) / 100,
    intervalle,
    repetitions,
    lapses,
    maitrisee: repetitions >= 3 && intervalle >= 21,
  };
};

/** Etat lisible d'une carte pour l'interface. */
export const etatCarte = (carte) => {
  if (carte.repetitions === 0) return "nouvelle";
  if (carte.lapses > 0 && carte.repetitions < 2) return "difficile";
  if (carte.interval_days >= 21) return "acquise";
  return "en cours";
};
