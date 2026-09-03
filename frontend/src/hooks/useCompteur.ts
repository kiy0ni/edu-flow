import { useEffect, useRef, useState } from "react";

const mouvementReduit = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Fait défiler une valeur numérique jusqu'à sa cible.
 *
 * Le chiffre qui monte donne à voir l'ordre de grandeur avant même de lire :
 * une moyenne qui grimpe jusqu'à 16 se distingue d'une qui s'arrête à 11.
 * L'animation est court-circuitée si l'utilisateur a demandé moins de
 * mouvement, ou si la valeur n'est pas exploitable.
 */
export const useCompteur = (cible: number | null, duree = 550) => {
  const [valeur, setValeur] = useState(cible ?? 0);
  const depart = useRef(cible ?? 0);
  const image = useRef<number>(0);

  useEffect(() => {
    if (cible === null || Number.isNaN(cible)) return;
    if (mouvementReduit() || duree <= 0) {
      setValeur(cible);
      return;
    }

    const initial = depart.current;
    const ecart = cible - initial;
    if (ecart === 0) {
      setValeur(cible);
      return;
    }

    const debut = performance.now();
    const animer = (instant: number) => {
      const progression = Math.min(1, (instant - debut) / duree);
      // Décélération : la valeur arrive doucement plutôt que de s'arrêter net.
      const adouci = 1 - (1 - progression) ** 3;
      setValeur(initial + ecart * adouci);
      if (progression < 1) image.current = requestAnimationFrame(animer);
      else depart.current = cible;
    };

    image.current = requestAnimationFrame(animer);
    return () => cancelAnimationFrame(image.current);
  }, [cible, duree]);

  return cible === null ? null : valeur;
};

export default useCompteur;
