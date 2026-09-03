import { useQuery } from "@tanstack/react-query";
import { get } from "../lib/api";
import { Badge, Carte, EntetePage, Erreur, Squelette, Vide, rang } from "../components/ui";
import { Icone } from "../lib/icones";
import { dateLongue, capitaliser } from "../lib/format";
import type { Actualite } from "../lib/types";

export const ActualitesPage = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["actualites"],
    queryFn: () => get<{ actualites: Actualite[]; categories: string[] }>("/actualites"),
  });

  if (isLoading) return <Squelette className="h-[26rem]" />;
  if (error || !data) return <Erreur message={(error as Error)?.message ?? "Indisponible."} onReessayer={refetch} />;

  return (
    <div className="apparition">
      <EntetePage titre="Actualités" sousTitre="Informations publiées par l'établissement" />

      {data.actualites.length ? (
        <div className="echelonne flex flex-col gap-3">
          {data.actualites.map((a, i) => (
            <Carte key={a.id} style={rang(i)} className="p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge ton="accent">{a.categorie}</Badge>
                {a.epingle && (
                  <Badge ton="attention" icone="epingle">
                    Epingle
                  </Badge>
                )}
                <span className="text-[0.75rem] text-ink-muted">{capitaliser(dateLongue(a.date))}</span>
              </div>
              <h2 className="text-[1.02rem] font-semibold tracking-tight text-ink">{a.titre}</h2>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-2">{a.contenu}</p>
              <p className="mt-3 flex items-center gap-1.5 text-[0.78rem] text-ink-muted">
                <Icone nom="personne" taille={13} />
                {a.auteur}
              </p>
            </Carte>
          ))}
        </div>
      ) : (
        <Carte>
          <Vide titre="Aucune actualité" message="Rien de publié pour le moment." icone="megaphone" />
        </Carte>
      )}
    </div>
  );
};

export default ActualitesPage;
