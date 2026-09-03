import { useMemo } from "react";

/**
 * Rendu Markdown minimal (titres, listes, gras, code, liens).
 * Volontairement sans dependance : le modele produit du Markdown simple, et
 * tout est echappe avant d'être transforme - aucun HTML brut n'est injecte.
 */
const echapper = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const enLigne = (t: string) =>
  echapper(t)
    .replace(/`([^`]+)`/g, '<code class="rounded bg-surface-hover px-1 py-0.5 text-[0.85em]">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");

export const Markdown = ({ texte }: { texte: string }) => {
  const html = useMemo(() => {
    const lignes = texte.split("\n");
    const sortie: string[] = [];
    let listeOuverte: "ul" | "ol" | null = null;

    const fermerListe = () => {
      if (listeOuverte) {
        sortie.push(`</${listeOuverte}>`);
        listeOuverte = null;
      }
    };

    for (const ligne of lignes) {
      const titre = /^(#{1,4})\s+(.*)$/.exec(ligne);
      const puce = /^\s*[-*]\s+(.*)$/.exec(ligne);
      const numero = /^\s*\d+[.)]\s+(.*)$/.exec(ligne);

      if (titre) {
        fermerListe();
        const niveau = Math.min(4, titre[1].length);
        const tailles = ["text-[1.02rem]", "text-[0.95rem]", "text-[0.9rem]", "text-[0.875rem]"];
        sortie.push(`<p class="mt-3 mb-1 font-semibold text-ink ${tailles[niveau - 1]}">${enLigne(titre[2])}</p>`);
      } else if (puce) {
        if (listeOuverte !== "ul") {
          fermerListe();
          sortie.push('<ul class="my-1.5 ml-4 list-disc space-y-1">');
          listeOuverte = "ul";
        }
        sortie.push(`<li>${enLigne(puce[1])}</li>`);
      } else if (numero) {
        if (listeOuverte !== "ol") {
          fermerListe();
          sortie.push('<ol class="my-1.5 ml-4 list-decimal space-y-1">');
          listeOuverte = "ol";
        }
        sortie.push(`<li>${enLigne(numero[1])}</li>`);
      } else if (ligne.trim() === "") {
        fermerListe();
      } else {
        fermerListe();
        sortie.push(`<p class="my-1.5">${enLigne(ligne)}</p>`);
      }
    }
    fermerListe();
    return sortie.join("");
  }, [texte]);

  return (
    <div
      className="text-[0.875rem] leading-relaxed text-ink-2 [&_code]:font-mono [&_strong]:text-ink"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default Markdown;
