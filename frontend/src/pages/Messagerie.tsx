import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, post } from "../lib/api";
import { Bouton, Carte, Champ, EntetePage, Erreur, Modale, Squelette, Vide, cx } from "../components/ui";
import { Icone } from "../lib/icones";
import { dateLongue, horodatage, octets, capitaliser } from "../lib/format";
import type { Destinataire, DossierMessagerie, Message } from "../lib/types";

const DOSSIERS: { cle: DossierMessagerie; libelle: string; icone: string }[] = [
  { cle: "reception", libelle: "Réception", icone: "message" },
  { cle: "envoyes", libelle: "Envoyés", icone: "envoyer" },
  { cle: "archives", libelle: "Archives", icone: "dossier" },
  { cle: "corbeille", libelle: "Corbeille", icone: "corbeille" },
];

/* ------------------------------------------------------------- Rédaction */

export interface Brouillon {
  destinataireId?: string;
  destinataireNom?: string;
  sujet?: string;
  corps?: string;
}

const Redaction = ({
  ouverte,
  onFermer,
  reponseA,
  brouillon,
}: {
  ouverte: boolean;
  onFermer: () => void;
  reponseA?: Message | null;
  brouillon?: Brouillon | null;
}) => {
  const client = useQueryClient();
  const [choisis, setChoisis] = useState<Destinataire[]>([]);
  const [sujet, setSujet] = useState("");
  const [corps, setCorps] = useState("");
  const [recherche, setRecherche] = useState("");
  const [initialise, setInitialise] = useState(false);

  const { data } = useQuery({
    queryKey: ["destinataires"],
    queryFn: () => get<{ destinataires: Destinataire[] }>("/messagerie/destinataires"),
    enabled: ouverte,
  });

  // Un brouillon transmis par une autre page (justificatif d'absence,
  // question sur un devoir) pré-remplit destinataire, objet et corps.
  if (ouverte && brouillon && !initialise && data) {
    const cible =
      data.destinataires.find((d) => d.id === brouillon.destinataireId || d.nom === brouillon.destinataireNom) ??
      (brouillon.destinataireNom
        ? ({ id: brouillon.destinataireId ?? `libre:${brouillon.destinataireNom}`, nom: brouillon.destinataireNom, role: "", groupe: "" } as Destinataire)
        : null);
    if (cible) setChoisis([cible]);
    if (brouillon.sujet) setSujet(brouillon.sujet);
    if (brouillon.corps) setCorps(brouillon.corps);
    setInitialise(true);
  }

  // Une réponse pré-remplit l'expéditeur d'origine et l'objet.
  if (ouverte && reponseA && !initialise && data) {
    const cible =
      data.destinataires.find((d) => d.nom === reponseA.expediteur) ??
      ({ id: `libre:${reponseA.expediteur}`, nom: reponseA.expediteur, role: "", groupe: "" } as Destinataire);
    setChoisis([cible]);
    setSujet(reponseA.sujet.startsWith("Re :") ? reponseA.sujet : `Re : ${reponseA.sujet}`);
    setInitialise(true);
  }

  const fermer = () => {
    setChoisis([]);
    setSujet("");
    setCorps("");
    setRecherche("");
    setInitialise(false);
    onFermer();
  };

  const envoyer = useMutation({
    mutationFn: () =>
      post("/messagerie", {
        destinataires: choisis.map((d) => ({ id: d.id, nom: d.nom })),
        sujet,
        corps,
        repondA: reponseA?.id,
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["messages"] });
      client.invalidateQueries({ queryKey: ["notifications"] });
      fermer();
    },
  });

  const groupes = useMemo(() => {
    const liste = (data?.destinataires ?? []).filter(
      (d) =>
        !choisis.some((c) => c.id === d.id) &&
        (!recherche ||
          `${d.nom} ${d.role}`.toLowerCase().includes(recherche.toLowerCase())),
    );
    const map = new Map<string, Destinataire[]>();
    for (const d of liste) {
      if (!map.has(d.groupe)) map.set(d.groupe, []);
      map.get(d.groupe)!.push(d);
    }
    return [...map.entries()];
  }, [data?.destinataires, choisis, recherche]);

  const valide = choisis.length > 0 && sujet.trim() && corps.trim();

  return (
    <Modale ouverte={ouverte} onFermer={fermer} titre={reponseA ? "Répondre" : "Nouveau message"} largeur="max-w-2xl">
      <div className="flex flex-col gap-4">
        <div>
          <span className="mb-1.5 block text-[0.8rem] font-medium text-ink-2">Destinataires</span>
          {choisis.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {choisis.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setChoisis(choisis.filter((c) => c.id !== d.id))}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent-doux px-2 py-1 text-[0.78rem] text-accent-ink hover:bg-accent-doux/70"
                >
                  {d.nom}
                  <Icone nom="fermer" taille={12} />
                </button>
              ))}
            </div>
          )}
          <Champ
            placeholder="Rechercher un enseignant ou un service"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
          {recherche && (
            <div className="mt-1.5 max-h-48 overflow-y-auto rounded-lg border border-trait">
              {groupes.map(([groupe, liste]) => (
                <div key={groupe}>
                  <p className="bg-surface-2 px-3 py-1 text-[0.7rem] font-semibold tracking-wider text-ink-muted uppercase">
                    {groupe}
                  </p>
                  {liste.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        setChoisis([...choisis, d]);
                        setRecherche("");
                      }}
                      className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-surface-hover"
                    >
                      <span className="text-[0.82rem] font-medium text-ink">{d.nom}</span>
                      <span className="text-[0.75rem] text-ink-muted">{d.role}</span>
                    </button>
                  ))}
                </div>
              ))}
              {groupes.length === 0 && (
                <p className="px-3 py-4 text-center text-[0.8rem] text-ink-muted">Aucun destinataire trouvé.</p>
              )}
            </div>
          )}
        </div>

        <Champ label="Objet" value={sujet} onChange={(e) => setSujet(e.target.value)} placeholder="Objet du message" />

        <label className="block">
          <span className="mb-1.5 block text-[0.8rem] font-medium text-ink-2">Message</span>
          <textarea
            value={corps}
            onChange={(e) => setCorps(e.target.value)}
            rows={9}
            placeholder="Rédigez votre message..."
            className="w-full resize-y rounded-lg border border-trait-fort bg-surface px-3 py-2 text-[0.875rem] leading-relaxed text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
        </label>

        {envoyer.error && (
          <p className="rounded-lg bg-critique-doux px-3 py-2 text-[0.8rem] text-critique">
            {(envoyer.error as Error).message}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Bouton variante="primaire" icone="envoyer" onClick={() => envoyer.mutate()} disabled={!valide} chargement={envoyer.isPending}>
            Envoyer
          </Bouton>
          <Bouton variante="discret" onClick={fermer}>
            Annuler
          </Bouton>
        </div>
      </div>
    </Modale>
  );
};

/* ------------------------------------------------------------------ Page */

export const MessageriePage = () => {
  const client = useQueryClient();
  const [dossier, setDossier] = useState<DossierMessagerie>("reception");
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] = useState<string | null>(null);
  const [redaction, setRedaction] = useState<{ ouverte: boolean; reponseA?: Message | null; brouillon?: Brouillon | null }>({
    ouverte: false,
  });

  // Une autre page peut demander l'ouverture directe de la fenêtre de rédaction.
  const emplacement = useLocation();
  const naviguer = useNavigate();
  useEffect(() => {
    const recu = (emplacement.state as { brouillon?: Brouillon } | null)?.brouillon;
    if (recu) {
      setRedaction({ ouverte: true, brouillon: recu });
      // L'état est consommé : un rafraîchissement ne doit pas rouvrir la fenêtre.
      naviguer(emplacement.pathname, { replace: true, state: null });
    }
  }, [emplacement, naviguer]);

  const cle = ["messages", dossier, recherche] as const;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: cle,
    queryFn: () =>
      get<{ messages: Message[]; nonLus: number }>(
        `/messagerie?dossier=${dossier}${recherche ? `&recherche=${encodeURIComponent(recherche)}` : ""}`,
      ),
  });

  const { data: detail, isLoading: chargementDetail } = useQuery({
    queryKey: ["message", selection],
    queryFn: () => get<{ message: Message }>(`/messagerie/${encodeURIComponent(selection!)}`),
    enabled: Boolean(selection),
  });

  const rafraichir = () => {
    client.invalidateQueries({ queryKey: ["messages"] });
    client.invalidateQueries({ queryKey: ["message", selection] });
    client.invalidateQueries({ queryKey: ["notifications"] });
  };

  const action = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      const chemin = `/messagerie/${encodeURIComponent(id)}`;
      if (type === "favori") return post(`${chemin}/favori`);
      if (type === "archiver") return post(`${chemin}/archiver`, { archive: dossier !== "archives" });
      if (type === "supprimer") return del(chemin);
      if (type === "restaurer") return post(`${chemin}/restaurer`);
      if (type === "non-lu") return post(`${chemin}/lu`, { lu: false });
      return null;
    },
    onSuccess: (_r, { type }) => {
      if (type === "supprimer" || type === "archiver") setSelection(null);
      rafraichir();
    },
  });

  const toutLire = useMutation({
    mutationFn: () => post("/messagerie/tout-lire"),
    onSuccess: rafraichir,
  });

  if (error) return <Erreur message={(error as Error).message} onReessayer={refetch} />;

  const messages = data?.messages ?? [];
  const message = detail?.message;

  return (
    <div className="apparition">
      <EntetePage
        titre="Messagerie"
        sousTitre={data ? `${messages.length} message(s)${data.nonLus ? ` · ${data.nonLus} non lu(s)` : ""}` : undefined}
        actions={
          <>
            {dossier === "reception" && (data?.nonLus ?? 0) > 0 && (
              <Bouton icone="valide" onClick={() => toutLire.mutate()} chargement={toutLire.isPending}>
                Tout marquer comme lu
              </Bouton>
            )}
            <Bouton variante="primaire" icone="plus" onClick={() => setRedaction({ ouverte: true })}>
              Nouveau message
            </Bouton>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[10rem_22rem_1fr]">
        {/* Dossiers */}
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {DOSSIERS.map((d) => (
            <button
              key={d.cle}
              onClick={() => {
                setDossier(d.cle);
                setSelection(null);
              }}
              className={cx(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[0.82rem] font-medium transition-colors",
                dossier === d.cle ? "bg-accent-doux text-accent-ink" : "text-ink-2 hover:bg-surface-hover",
              )}
            >
              <Icone nom={d.icone} taille={15} />
              {d.libelle}
              {d.cle === "reception" && (data?.nonLus ?? 0) > 0 && dossier !== "reception" && (
                <span className="ml-auto rounded-full bg-accent px-1.5 text-[0.68rem] text-white">{data!.nonLus}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Liste */}
        <Carte className="flex max-h-[68vh] flex-col overflow-hidden">
          <div className="border-b border-trait p-2.5">
            <div className="relative">
              <Icone nom="recherche" taille={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted" />
              <Champ placeholder="Rechercher" value={recherche} onChange={(e) => setRecherche(e.target.value)} className="pl-9" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading && <div className="p-4"><Squelette className="h-40" /></div>}
            {!isLoading && !messages.length && (
              <Vide
                titre="Aucun message"
                message={recherche ? "Aucun résultat pour cette recherche." : "Ce dossier est vide."}
                icone="message"
                action={
                  recherche ? (
                    <Bouton taille="sm" icone="fermer" onClick={() => setRecherche("")}>
                      Effacer la recherche
                    </Bouton>
                  ) : dossier === "reception" ? (
                    <Bouton taille="sm" icone="plus" onClick={() => setRedaction({ ouverte: true })}>
                      Écrire un message
                    </Bouton>
                  ) : undefined
                }
              />
            )}
            {messages.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelection(m.id)}
                className={cx(
                  "flex w-full flex-col gap-1 border-b border-trait px-3.5 py-3 text-left transition-colors last:border-0",
                  selection === m.id ? "bg-accent-doux" : "hover:bg-surface-hover",
                )}
              >
                <div className="flex items-center gap-2">
                  {!m.lu && <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-label="non lu" />}
                  <span className={cx("min-w-0 flex-1 truncate text-[0.82rem]", m.lu ? "text-ink-2" : "font-semibold text-ink")}>
                    {dossier === "envoyes" ? `À ${m.destinataire}` : m.expediteur}
                  </span>
                  {m.favori && <Icone nom="epingle" taille={12} className="shrink-0 text-attention" />}
                  <span className="shrink-0 text-[0.7rem] text-ink-muted">{horodatage(m.date)}</span>
                </div>
                <p className={cx("truncate text-[0.82rem]", m.lu ? "text-ink-2" : "font-medium text-ink")}>{m.sujet}</p>
                <p className="line-clamp-1 text-[0.75rem] text-ink-muted">{m.apercu}</p>
                {m.pieces.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[0.7rem] text-ink-muted">
                    <Icone nom="dossier" taille={11} />
                    {m.pieces.length} pièce(s) jointe(s)
                  </span>
                )}
              </button>
            ))}
          </div>
        </Carte>

        {/* Lecture */}
        <Carte className="flex min-h-[24rem] flex-col">
          {!selection && <Vide titre="Sélectionnez un message" message="Son contenu s'affichera ici." icone="message" />}
          {selection && chargementDetail && <div className="p-5"><Squelette className="h-48" /></div>}
          {selection && message && (
            <article className="apparition flex min-h-0 flex-1 flex-col">
              <header className="border-b border-trait px-5 py-4">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-[1.05rem] font-semibold tracking-tight text-ink">{message.sujet}</h2>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Bouton
                      variante="discret"
                      taille="sm"
                      icone="epingle"
                      onClick={() => action.mutate({ type: "favori", id: message.id })}
                      aria-label={message.favori ? "Retirer des favoris" : "Mettre en favori"}
                      className={message.favori ? "text-attention" : undefined}
                    />
                    {!message.local && (
                      <>
                        <Bouton
                          variante="discret"
                          taille="sm"
                          icone="lecture"
                          onClick={() => action.mutate({ type: "non-lu", id: message.id })}
                          aria-label="Marquer comme non lu"
                        />
                        <Bouton
                          variante="discret"
                          taille="sm"
                          icone="dossier"
                          onClick={() => action.mutate({ type: "archiver", id: message.id })}
                          aria-label={dossier === "archives" ? "Désarchiver" : "Archiver"}
                        />
                      </>
                    )}
                    {dossier === "corbeille" ? (
                      <Bouton
                        variante="discret"
                        taille="sm"
                        icone="recharger"
                        onClick={() => action.mutate({ type: "restaurer", id: message.id })}
                        aria-label="Restaurer"
                      />
                    ) : (
                      <Bouton
                        variante="danger"
                        taille="sm"
                        icone="corbeille"
                        onClick={() => action.mutate({ type: "supprimer", id: message.id })}
                        aria-label="Supprimer"
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-ink-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Icone nom="personne" taille={13} />
                    {message.expediteur}
                    {message.roleExpediteur && <span className="text-ink-muted">· {message.roleExpediteur}</span>}
                  </span>
                  <span>{capitaliser(dateLongue(message.date))}</span>
                  {message.destinataires && message.destinataires.length > 0 && (
                    <span>à {message.destinataires.map((d) => d.nom).join(", ")}</span>
                  )}
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <p className="text-[0.875rem] leading-relaxed whitespace-pre-line text-ink-2">
                  {message.corps ?? message.apercu}
                </p>

                {message.pieces.length > 0 && (
                  <div className="mt-5 border-t border-trait pt-4">
                    <p className="mb-2 text-[0.8rem] font-medium text-ink">Pièces jointes</p>
                    <ul className="flex flex-wrap gap-2">
                      {message.pieces.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center gap-2 rounded-lg border border-trait px-2.5 py-1.5 text-[0.78rem] text-ink-2"
                        >
                          <Icone nom="dossier" taille={14} className="text-ink-muted" />
                          {p.nom}
                          <span className="text-ink-muted">{octets(p.taille)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {!message.local && (
                <footer className="border-t border-trait px-5 py-3">
                  <Bouton icone="envoyer" onClick={() => setRedaction({ ouverte: true, reponseA: message })}>
                    Répondre
                  </Bouton>
                </footer>
              )}
            </article>
          )}
        </Carte>
      </div>

      <Redaction
        ouverte={redaction.ouverte}
        reponseA={redaction.reponseA}
        brouillon={redaction.brouillon}
        onFermer={() => setRedaction({ ouverte: false })}
      />
    </div>
  );
};

export default MessageriePage;
