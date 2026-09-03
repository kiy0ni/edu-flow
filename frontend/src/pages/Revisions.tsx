import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post } from "../lib/api";
import { useTheme } from "../lib/theme";
import { Badge, Bouton, Carte, Champ, Chiffres, EntetePage, Erreur, Modale, Onglets, Pastille, Squelette, Vide, cx } from "../components/ui";
import { Icone } from "../lib/icones";
import type { Carte as CarteType, Paquet } from "../lib/types";
import ConcentrationPage from "./Concentration";

/* ---------------------------------------------------- Session de revision */

const NOTES_QUALITE = [
  { valeur: 0, libelle: "A revoir", detail: "Aucun souvenir", ton: "critique" as const },
  { valeur: 3, libelle: "Difficile", detail: "Retrouve avec effort", ton: "attention" as const },
  { valeur: 4, libelle: "Correct", detail: "Retrouve sans peine", ton: "neutre" as const },
  { valeur: 5, libelle: "Facile", detail: "Immédiat", ton: "bon" as const },
];

const SessionRevision = ({ cartes, onFin }: { cartes: CarteType[]; onFin: () => void }) => {
  const client = useQueryClient();
  const { couleur } = useTheme();
  const [index, setIndex] = useState(0);
  const [revele, setRevele] = useState(false);
  const [bilan, setBilan] = useState({ reussies: 0, total: 0 });

  const carte = cartes[index];

  const noter = useMutation({
    mutationFn: (quality: number) => post(`/revisions/cartes/${carte.id}/reviser`, { quality }),
    onSuccess: (_r, quality) => {
      setBilan((b) => ({ reussies: b.reussies + (quality >= 3 ? 1 : 0), total: b.total + 1 }));
      setRevele(false);
      if (index + 1 < cartes.length) setIndex(index + 1);
      else {
        client.invalidateQueries({ queryKey: ["paquets"] });
        client.invalidateQueries({ queryKey: ["revision-stats"] });
        client.invalidateQueries({ queryKey: ["accueil"] });
      }
    },
  });

  const termine = bilan.total >= cartes.length;

  if (termine) {
    return (
      <Carte className="p-8 text-center">
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-bon-doux text-bon">
          <Icone nom="valide" taille={24} />
        </div>
        <h2 className="text-[1.1rem] font-semibold text-ink">Session terminée</h2>
        <p className="mt-1 text-[0.875rem] text-ink-muted">
          {bilan.reussies} carte(s) reussie(s) sur {bilan.total}. Les cartes ratees reviendront des demain.
        </p>
        <Bouton variante="primaire" className="mt-5" onClick={onFin}>
          Revenir aux paquets
        </Bouton>
      </Carte>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <Bouton variante="discret" taille="sm" icone="chevronGauche" onClick={onFin}>
          Quitter
        </Bouton>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
          <div
            className="progression-animee h-full rounded-full bg-accent"
            style={{ width: `${(bilan.total / cartes.length) * 100}%` }}
          />
        </div>
        <span className="text-[0.78rem] text-ink-muted tabular-nums">
          {bilan.total + 1} / {cartes.length}
        </span>
      </div>

      <Carte className="p-6 sm:p-8">
        <div className="mb-4 flex items-center gap-2">
          {carte.matiere && <Pastille couleur={couleur(carte.couleur ?? null)} />}
          <span className="text-[0.78rem] text-ink-muted">{carte.paquet ?? carte.matiere}</span>
          <Badge className="ml-auto">{carte.etat}</Badge>
        </div>

        <p className="text-[1.15rem] leading-snug font-medium text-ink">{carte.recto}</p>

        {carte.indice && !revele && (
          <p className="mt-3 text-[0.82rem] text-ink-muted">
            <span className="font-medium">Indice :</span> {carte.indice}
          </p>
        )}

        {revele ? (
          <div className="apparition mt-5 border-t border-trait pt-5">
            <p className="text-[0.72rem] font-semibold tracking-wider text-ink-muted uppercase">Réponse</p>
            <p className="mt-2 text-[1rem] leading-relaxed text-ink">{carte.verso}</p>
          </div>
        ) : (
          <Bouton variante="primaire" className="mt-6 w-full" icone="lecture" onClick={() => setRevele(true)}>
            Afficher la réponse
          </Bouton>
        )}
      </Carte>

      {revele && (
        <div className="apparition mt-4">
          <p className="mb-2 text-center text-[0.8rem] text-ink-muted">Avec quelle facilité avez-vous retrouve la réponse ?</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {NOTES_QUALITE.map((q) => (
              <button
                key={q.valeur}
                onClick={() => noter.mutate(q.valeur)}
                disabled={noter.isPending}
                className={cx(
                  "rounded-lg border border-trait bg-surface px-3 py-2.5 text-center transition-colors hover:bg-surface-hover disabled:opacity-50",
                )}
              >
                <span
                  className={cx(
                    "block text-[0.85rem] font-medium",
                    q.ton === "critique" && "text-critique",
                    q.ton === "attention" && "text-serieux",
                    q.ton === "bon" && "text-bon",
                    q.ton === "neutre" && "text-ink",
                  )}
                >
                  {q.libelle}
                </span>
                <span className="mt-0.5 block text-[0.7rem] text-ink-muted">{q.detail}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ Page */

export const RevisionsPage = ({ vueInitiale = "cartes" }: { vueInitiale?: "cartes" | "concentration" } = {}) => {
  const client = useQueryClient();
  const { couleur } = useTheme();
  const [vue, setVue] = useState<"cartes" | "concentration">(vueInitiale);
  const [session, setSession] = useState<CarteType[] | null>(null);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [paquetOuvert, setPaquetOuvert] = useState<Paquet | null>(null);
  const [nouveauPaquet, setNouveauPaquet] = useState({ titre: "", matiere: "" });
  const [nouvelleCarte, setNouvelleCarte] = useState({ recto: "", verso: "" });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["paquets"],
    queryFn: () => get<{ paquets: Paquet[] }>("/revisions"),
  });
  const { data: stats } = useQuery({
    queryKey: ["revision-stats"],
    queryFn: () => get<{ total: number; tauxReussite: number | null; joursActifs: number }>("/revisions/statistiques"),
  });
  const { data: cartesPaquet } = useQuery({
    queryKey: ["cartes", paquetOuvert?.id],
    queryFn: () => get<{ cartes: CarteType[] }>(`/revisions/${paquetOuvert!.id}/cartes`),
    enabled: Boolean(paquetOuvert),
  });

  const demarrer = useMutation({
    mutationFn: (paquetId?: string) =>
      get<{ cartes: CarteType[] }>(`/revisions/revision?limite=20${paquetId ? `&paquet=${paquetId}` : ""}`),
    onSuccess: (r) => r.cartes.length && setSession(r.cartes),
  });

  const creer = useMutation({
    mutationFn: () => post<{ paquet: Paquet }>("/revisions", { titre: nouveauPaquet.titre, matiere: nouveauPaquet.matiere || undefined }),
    onSuccess: () => {
      setCreationOuverte(false);
      setNouveauPaquet({ titre: "", matiere: "" });
      client.invalidateQueries({ queryKey: ["paquets"] });
    },
  });

  const ajouterCarte = useMutation({
    mutationFn: () => post(`/revisions/${paquetOuvert!.id}/cartes`, { cartes: [nouvelleCarte] }),
    onSuccess: () => {
      setNouvelleCarte({ recto: "", verso: "" });
      client.invalidateQueries({ queryKey: ["cartes", paquetOuvert?.id] });
      client.invalidateQueries({ queryKey: ["paquets"] });
    },
  });

  const supprimer = useMutation({
    mutationFn: (id: string) => del(`/revisions/${id}`),
    onSuccess: () => {
      setPaquetOuvert(null);
      client.invalidateQueries({ queryKey: ["paquets"] });
    },
  });

  if (session) return <div className="apparition"><SessionRevision cartes={session} onFin={() => setSession(null)} /></div>;
  if (isLoading) return <Squelette className="h-[26rem]" />;
  if (error || !data) return <Erreur message={(error as Error)?.message ?? "Indisponible."} onReessayer={refetch} />;

  const totalDues = data.paquets.reduce((a, p) => a + p.dues, 0);

  return (
    <div className="apparition">
      <EntetePage
        titre="Révisions"
        sousTitre={
          vue === "cartes"
            ? "Répétition espacée : chaque carte revient juste avant que vous ne l'oubliiez"
            : "Des sessions courtes et mesurées, pour savoir où passe vraiment votre temps"
        }
        actions={
          <>
            <Onglets
              valeur={vue}
              onChange={setVue}
              options={[
                { valeur: "cartes", libelle: "Cartes", compteur: totalDues },
                { valeur: "concentration", libelle: "Concentration" },
              ]}
            />
            {vue === "cartes" && (
              <>
                <Bouton icone="plus" onClick={() => setCreationOuverte(true)}>
                  Nouveau paquet
                </Bouton>
                <Bouton
                  variante="primaire"
                  icone="cartes"
                  onClick={() => demarrer.mutate(undefined)}
                  disabled={!totalDues}
                  chargement={demarrer.isPending}
                >
                  Réviser {totalDues > 0 && `(${totalDues})`}
                </Bouton>
              </>
            )}
          </>
        }
      />

      {vue === "concentration" && <ConcentrationPage sansEntete />}

      {vue === "cartes" && (
        <Chiffres
          entrees={[
            { libelle: "Cartes à réviser", valeur: totalDues, detail: totalDues ? "Prêtes maintenant" : "Rien à réviser" },
            { libelle: "Paquets", valeur: data.paquets.length },
            {
              libelle: "Révisions (30 j)",
              valeur: stats?.total ?? 0,
              detail: stats?.joursActifs ? `${stats.joursActifs} jour(s) actifs` : undefined,
            },
            {
              libelle: "Taux de réussite",
              valeur: stats?.tauxReussite !== null && stats?.tauxReussite !== undefined ? `${stats.tauxReussite} %` : "—",
            },
          ]}
        />
      )}

      {vue === "cartes" && (data.paquets.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.paquets.map((p) => (
            <Carte key={p.id} survol className="flex flex-col p-4">
              <div className="flex items-start gap-2.5">
                <Pastille couleur={couleur(p.couleur)} taille={9} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9rem] font-semibold text-ink">{p.titre}</p>
                  <p className="mt-0.5 text-[0.75rem] text-ink-muted">
                    {p.matiere ?? "Sans matière"} · {p.cartes} carte(s)
                  </p>
                </div>
                {p.source === "ia" && <Badge ton="accent" icone="etincelle">IA</Badge>}
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[0.72rem] text-ink-muted">
                  <span>Progression</span>
                  <span className="tabular-nums">{p.progression} %</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
                  <div className="progression-animee h-full rounded-full bg-bon" style={{ width: `${p.progression}%` }} />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.dues > 0 && <Badge ton="attention">{p.dues} à réviser</Badge>}
                {p.nouvelles > 0 && <Badge>{p.nouvelles} nouvelle(s)</Badge>}
                {p.acquises > 0 && <Badge ton="bon">{p.acquises} acquise(s)</Badge>}
              </div>

              <div className="mt-4 flex gap-2 border-t border-trait pt-3">
                <Bouton taille="sm" variante="primaire" onClick={() => demarrer.mutate(p.id)} disabled={!p.dues} className="flex-1">
                  Réviser
                </Bouton>
                <Bouton taille="sm" onClick={() => setPaquetOuvert(p)}>
                  Gérer
                </Bouton>
              </div>
            </Carte>
          ))}
        </div>
      ) : (
        <Carte className="mt-4">
          <Vide
            titre="Aucun paquet de révision"
            message="Créez un paquet, ou laissez l'assistant en générer un à partir d'un chapitre de cours."
            icone="cartes"
            action={
              <Bouton variante="primaire" icone="plus" onClick={() => setCreationOuverte(true)}>
                Créer un paquet
              </Bouton>
            }
          />
        </Carte>
      ))}

      {/* Création */}
      <Modale ouverte={creationOuverte} onFermer={() => setCreationOuverte(false)} titre="Nouveau paquet">
        <div className="flex flex-col gap-3">
          <Champ label="Titre" value={nouveauPaquet.titre} onChange={(e) => setNouveauPaquet({ ...nouveauPaquet, titre: e.target.value })} placeholder="Suites et récurrence" />
          <Champ label="Matière (facultatif)" value={nouveauPaquet.matiere} onChange={(e) => setNouveauPaquet({ ...nouveauPaquet, matiere: e.target.value })} placeholder="Mathématiques" />
          <Bouton variante="primaire" onClick={() => creer.mutate()} chargement={creer.isPending} disabled={!nouveauPaquet.titre} className="mt-1">
            Créer
          </Bouton>
        </div>
      </Modale>

      {/* Gestion d'un paquet */}
      <Modale ouverte={Boolean(paquetOuvert)} onFermer={() => setPaquetOuvert(null)} titre={paquetOuvert?.titre ?? ""} largeur="max-w-2xl">
        <div className="flex flex-col gap-4">
          <Carte className="p-4">
            <p className="mb-3 text-[0.85rem] font-medium text-ink">Ajouter une carte</p>
            <div className="flex flex-col gap-2.5">
              <Champ label="Recto (question)" value={nouvelleCarte.recto} onChange={(e) => setNouvelleCarte({ ...nouvelleCarte, recto: e.target.value })} />
              <Champ label="Verso (réponse)" value={nouvelleCarte.verso} onChange={(e) => setNouvelleCarte({ ...nouvelleCarte, verso: e.target.value })} />
              <Bouton
                taille="sm"
                icone="plus"
                onClick={() => ajouterCarte.mutate()}
                chargement={ajouterCarte.isPending}
                disabled={!nouvelleCarte.recto || !nouvelleCarte.verso}
                className="self-start"
              >
                Ajouter
              </Bouton>
            </div>
          </Carte>

          <div>
            <p className="mb-2 text-[0.85rem] font-medium text-ink">{cartesPaquet?.cartes.length ?? 0} carte(s)</p>
            <ul className="max-h-64 divide-y divide-[var(--trait)] overflow-y-auto rounded-lg border border-trait">
              {cartesPaquet?.cartes.map((c) => (
                <li key={c.id} className="px-3 py-2.5">
                  <p className="text-[0.82rem] font-medium text-ink">{c.recto}</p>
                  <p className="mt-0.5 text-[0.78rem] text-ink-muted">{c.verso}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge>{c.etat}</Badge>
                    <span className="text-[0.7rem] text-ink-muted">Prochaine revision : {c.dueLe}</span>
                  </div>
                </li>
              ))}
              {!cartesPaquet?.cartes.length && <li className="px-3 py-6 text-center text-[0.82rem] text-ink-muted">Paquet vide.</li>}
            </ul>
          </div>

          <Bouton variante="danger" icone="corbeille" onClick={() => paquetOuvert && supprimer.mutate(paquetOuvert.id)} className="self-start">
            Supprimer ce paquet
          </Bouton>
        </div>
      </Modale>
    </div>
  );
};

export default RevisionsPage;
