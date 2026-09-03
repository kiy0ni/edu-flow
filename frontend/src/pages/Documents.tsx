import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, ouvrirFichier, post, telecharger } from "../lib/api";
import { Badge, Bouton, Carte, EntetePage, Erreur, Squelette, Vide, cx, rang } from "../components/ui";
import { Icone } from "../lib/icones";
import { dateCourte, octets } from "../lib/format";
import type { DocumentEtablissement } from "../lib/types";

export const DocumentsPage = () => {
  const client = useQueryClient();
  const [categorie, setCategorie] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["documents"],
    queryFn: () => get<{ documents: DocumentEtablissement[]; categories: string[] }>("/documents"),
  });

  const favori = useMutation({
    mutationFn: (id: string) => post(`/documents/${encodeURIComponent(id)}/favori`),
    onSuccess: () => client.invalidateQueries({ queryKey: ["documents"] }),
  });

  const agir = async (document: DocumentEtablissement, mode: "ouvrir" | "telecharger") => {
    setErreur(null);
    setEnCours(`${document.id}:${mode}`);
    const chemin = `/documents/${encodeURIComponent(document.id)}/telecharger`;
    try {
      if (mode === "ouvrir") await ouvrirFichier(chemin);
      else await telecharger(chemin, document.nom);
      client.invalidateQueries({ queryKey: ["documents"] });
    } catch (err) {
      setErreur((err as Error).message);
    } finally {
      setEnCours(null);
    }
  };

  if (isLoading) return <Squelette className="h-[26rem]" />;
  if (error || !data) return <Erreur message={(error as Error)?.message ?? "Indisponible."} onReessayer={refetch} />;

  const documents = categorie ? data.documents.filter((d) => d.categorie === categorie) : data.documents;

  return (
    <div className="apparition">
      <EntetePage
        titre="Documents"
        sousTitre={`${data.documents.length} document(s) mis à disposition par l'établissement`}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {[null, ...data.categories].map((c) => (
          <button
            key={c ?? "tous"}
            onClick={() => setCategorie(c)}
            className={cx(
              "rounded-lg border px-3 py-1.5 text-[0.8rem] font-medium transition-colors",
              categorie === c
                ? "border-transparent bg-accent-doux text-accent-ink"
                : "border-trait bg-surface text-ink-2 hover:bg-surface-hover",
            )}
          >
            {c ?? "Tous"}
          </button>
        ))}
      </div>

      {erreur && (
        <p className="mb-4 rounded-lg bg-critique-doux px-3 py-2 text-[0.82rem] text-critique">{erreur}</p>
      )}

      {documents.length ? (
        <ul className="echelonne flex flex-col gap-2">
          {documents.map((d, i) => (
            <Carte key={d.id} as="li" survol style={rang(i)} className="flex items-center gap-3 px-4 py-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-doux text-accent-ink">
                <Icone nom="dossier" taille={18} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[0.875rem] font-medium text-ink" title={d.nom}>
                    {d.nom}
                  </p>
                  {d.ouvertLe && <Badge>Consulté</Badge>}
                </div>
                {d.description && <p className="mt-0.5 line-clamp-1 text-[0.78rem] text-ink-muted">{d.description}</p>}
                <p className="mt-0.5 text-[0.75rem] text-ink-muted">
                  {d.categorie} · {dateCourte(d.date)}
                  {d.taille ? ` · ${octets(d.taille)}` : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Bouton
                  variante="discret"
                  taille="sm"
                  icone="epingle"
                  onClick={() => favori.mutate(d.id)}
                  aria-label={d.favori ? "Retirer des favoris" : "Mettre en favori"}
                  className={d.favori ? "text-attention" : undefined}
                />
                <Bouton
                  taille="sm"
                  icone="lecture"
                  onClick={() => agir(d, "ouvrir")}
                  chargement={enCours === `${d.id}:ouvrir`}
                  disabled={!d.telechargeable}
                >
                  Ouvrir
                </Bouton>
                <Bouton
                  taille="sm"
                  variante="discret"
                  icone="telecharger"
                  onClick={() => agir(d, "telecharger")}
                  chargement={enCours === `${d.id}:telecharger`}
                  disabled={!d.telechargeable}
                  aria-label="Télécharger"
                />
              </div>
            </Carte>
          ))}
        </ul>
      ) : (
        <Carte>
          <Vide
            titre="Aucun document"
            message="Cette catégorie ne contient aucun document."
            icone="dossier"
            action={
              categorie ? (
                <Bouton icone="recharger" onClick={() => setCategorie(null)}>
                  Voir tous les documents
                </Bouton>
              ) : undefined
            }
          />
        </Carte>
      )}
    </div>
  );
};

export default DocumentsPage;
