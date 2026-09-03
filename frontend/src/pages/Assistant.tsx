import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, fluxAssistant, get, post } from "../lib/api";
import { Badge, Bouton, Carte, Champ, EnteteCarte, EntetePage, Modale, Onglets, Squelette, Vide, cx } from "../components/ui";
import { Icone } from "../lib/icones";
import { horodatage } from "../lib/format";
import Markdown from "../components/Markdown";
import type { Conversation, MessageIA } from "../lib/types";
import { Link } from "react-router-dom";

interface Statut {
  disponible: boolean;
  modele: string | null;
  quotaRestant: number;
}

interface Artefact {
  id: string;
  kind: "fiche" | "quiz" | "brief" | "plan" | "resume";
  titre: string;
  matiere: string | null;
  contenu: Record<string, unknown>;
  creeLe: string;
}

const SUGGESTIONS = [
  "Explique-moi ce que je dois réviser en priorité cette semaine.",
  "Aide-moi à comprendre ma dernière note la plus faible.",
  "Donne-moi une méthode pour mieux organiser mes soirees.",
  "Quels chapitres dois-je revoir avant ma prochaine évaluation ?",
];

/* ------------------------------------------------------------------- Chat */

const Discussion = () => {
  const client = useQueryClient();
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [saisie, setSaisie] = useState("");
  const [messages, setMessages] = useState<Pick<MessageIA, "role" | "contenu">[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => get<{ conversations: Conversation[] }>("/assistant/conversations"),
  });

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const ouvrir = async (id: string) => {
    const c = await get<{ messages: MessageIA[] }>(`/assistant/conversations/${id}`);
    setConversationId(id);
    setMessages(c.messages.map((m) => ({ role: m.role, contenu: m.contenu })));
    setErreur(null);
  };

  const envoyer = async (texte: string) => {
    if (!texte.trim() || enCours) return;
    setErreur(null);
    setSaisie("");
    setMessages((m) => [...m, { role: "user", contenu: texte }, { role: "assistant", contenu: "" }]);
    setEnCours(true);

    await fluxAssistant(
      { message: texte, conversationId },
      {
        debut: (d) => setConversationId(d.conversationId),
        delta: (d) =>
          setMessages((m) => {
            const copie = [...m];
            copie[copie.length - 1] = { role: "assistant", contenu: copie[copie.length - 1].contenu + d.texte };
            return copie;
          }),
        fin: () => {
          client.invalidateQueries({ queryKey: ["conversations"] });
          client.invalidateQueries({ queryKey: ["assistant-statut"] });
        },
        erreur: (d) => {
          setErreur(d.message);
          setMessages((m) => m.slice(0, -1));
        },
      },
    );
    setEnCours(false);
  };

  const supprimer = useMutation({
    mutationFn: (id: string) => del(`/assistant/conversations/${id}`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["conversations"] });
      setConversationId(undefined);
      setMessages([]);
    },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <Carte className="hidden max-h-[70vh] flex-col overflow-hidden lg:flex">
        <div className="border-b border-trait p-3">
          <Bouton
            icone="plus"
            className="w-full"
            onClick={() => {
              setConversationId(undefined);
              setMessages([]);
              setErreur(null);
            }}
          >
            Nouvelle discussion
          </Bouton>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations?.conversations.map((c) => (
            <div
              key={c.id}
              className={cx(
                "group flex items-center gap-2 border-b border-trait px-3 py-2.5 transition-colors last:border-0",
                conversationId === c.id ? "bg-accent-doux" : "hover:bg-surface-hover",
              )}
            >
              <button onClick={() => ouvrir(c.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-[0.8rem] font-medium text-ink">{c.titre}</p>
                <p className="text-[0.7rem] text-ink-muted">{horodatage(c.majLe)}</p>
              </button>
              <button
                onClick={() => supprimer.mutate(c.id)}
                className="shrink-0 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-critique"
                aria-label="Supprimer la conversation"
              >
                <Icone nom="corbeille" taille={14} />
              </button>
            </div>
          ))}
          {!conversations?.conversations.length && (
            <p className="px-3 py-8 text-center text-[0.78rem] text-ink-muted">Aucune discussion.</p>
          )}
        </div>
      </Carte>

      <Carte className="flex h-[70vh] flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 grid size-11 place-items-center rounded-full bg-accent-doux text-accent-ink">
                <Icone nom="etincelle" taille={20} />
              </div>
              <p className="text-[0.95rem] font-medium text-ink">Que puis-je faire pour vous ?</p>
              <p className="mt-1 max-w-md text-[0.82rem] text-ink-muted">
                J'ai accès à vos notes, vos devoirs et votre emploi du temps. Je m'appuie dessus plutot que de deviner.
              </p>
              <div className="mt-5 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => envoyer(s)}
                    className="rounded-lg border border-trait bg-surface px-3 py-2.5 text-left text-[0.8rem] text-ink-2 transition-colors hover:border-trait-fort hover:bg-surface-hover"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((m, i) => (
                <div key={i} className={cx("flex gap-3", m.role === "user" && "justify-end")}>
                  {m.role === "assistant" && (
                    <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-accent-doux text-accent-ink">
                      <Icone nom="etincelle" taille={14} />
                    </div>
                  )}
                  <div
                    className={cx(
                      "max-w-[min(42rem,85%)] rounded-[var(--radius-card)] px-4 py-2.5",
                      m.role === "user" ? "bg-accent text-white" : "bg-surface-2",
                    )}
                  >
                    {m.role === "user" ? (
                      <p className="text-[0.875rem] leading-relaxed whitespace-pre-line">{m.contenu}</p>
                    ) : m.contenu ? (
                      <Markdown texte={m.contenu} />
                    ) : (
                      <span className="flex gap-1 py-1">
                        {[0, 1, 2].map((d) => (
                          <span
                            key={d}
                            className="size-1.5 animate-bounce rounded-full bg-ink-muted"
                            style={{ animationDelay: `${d * 0.15}s` }}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={finRef} />
            </div>
          )}
        </div>

        {erreur && (
          <p className="border-t border-trait bg-critique-doux px-4 py-2 text-[0.8rem] text-critique">{erreur}</p>
        )}

        <form
          className="flex items-end gap-2 border-t border-trait p-3"
          onSubmit={(e) => {
            e.preventDefault();
            envoyer(saisie);
          }}
        >
          <textarea
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                envoyer(saisie);
              }
            }}
            rows={1}
            placeholder="Posez votre question... (Entrée pour envoyer)"
            className="max-h-40 flex-1 resize-none rounded-lg border border-trait-fort bg-surface px-3 py-2.5 text-[0.875rem] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
          <Bouton type="submit" variante="primaire" icone="envoyer" disabled={!saisie.trim() || enCours} chargement={enCours} aria-label="Envoyer" />
        </form>
      </Carte>
    </div>
  );
};

/* -------------------------------------------------------------- Generation */

const RenduArtefact = ({ artefact }: { artefact: Artefact }) => {
  const c = artefact.contenu as Record<string, never>;

  if (artefact.kind === "fiche") {
    const f = c as unknown as {
      resumeCourt: string;
      notionsCles: { terme: string; definition: string }[];
      pointsEssentiels: string[];
      formulesOuDates: string[];
      piegesFrequents: string[];
      methode: string[];
    };
    return (
      <div className="flex flex-col gap-4 text-[0.85rem]">
        <p className="leading-relaxed text-ink-2">{f.resumeCourt}</p>
        {[
          { titre: "Notions clés", contenu: f.notionsCles?.map((n) => `**${n.terme}** — ${n.definition}`) },
          { titre: "À retenir absolument", contenu: f.pointsEssentiels },
          { titre: "Formules et repères", contenu: f.formulesOuDates },
          { titre: "Pièges fréquents", contenu: f.piegesFrequents },
          { titre: "Méthode", contenu: f.methode },
        ]
          .filter((s) => s.contenu?.length)
          .map((s) => (
            <div key={s.titre}>
              <p className="mb-1.5 text-[0.72rem] font-semibold tracking-wider text-ink-muted uppercase">{s.titre}</p>
              <ul className="ml-4 list-disc space-y-1 text-ink-2">
                {s.contenu!.map((x, i) => (
                  <li key={i}>
                    <Markdown texte={x} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    );
  }

  if (artefact.kind === "quiz") {
    const q = c as unknown as {
      questions: { enonce: string; propositions: string[]; indexBonneReponse: number; explication: string }[];
    };
    return <Quiz questions={q.questions} />;
  }

  const b = c as unknown as {
    resume: string;
    priorites: { intitule: string; pourquoi: string; duree: string }[];
    aNePasOublier: string[];
    encouragement: string;
  };
  return (
    <div className="flex flex-col gap-4 text-[0.85rem]">
      <p className="leading-relaxed text-ink-2">{b.resume}</p>
      {b.priorites?.length > 0 && (
        <ol className="flex flex-col gap-2">
          {b.priorites.map((p, i) => (
            <li key={i} className="flex gap-3 rounded-lg border border-trait p-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-doux text-[0.75rem] font-semibold text-accent-ink">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="font-medium text-ink">{p.intitule}</p>
                <p className="mt-0.5 text-ink-2">{p.pourquoi}</p>
                <Badge className="mt-1.5" icone="horloge">
                  {p.duree}
                </Badge>
              </div>
            </li>
          ))}
        </ol>
      )}
      {b.aNePasOublier?.length > 0 && (
        <div>
          <p className="mb-1.5 text-[0.72rem] font-semibold tracking-wider text-ink-muted uppercase">À ne pas oublier</p>
          <ul className="ml-4 list-disc space-y-1 text-ink-2">
            {b.aNePasOublier.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {b.encouragement && <p className="rounded-lg bg-accent-doux px-3 py-2 text-accent-ink">{b.encouragement}</p>}
    </div>
  );
};

const Quiz = ({ questions }: { questions: { enonce: string; propositions: string[]; indexBonneReponse: number; explication: string }[] }) => {
  const [reponses, setReponses] = useState<Record<number, number>>({});
  const score = questions.reduce((a, q, i) => a + (reponses[i] === q.indexBonneReponse ? 1 : 0), 0);
  const repondues = Object.keys(reponses).length;

  return (
    <div className="flex flex-col gap-4">
      {repondues > 0 && (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-[0.82rem] text-ink-2">
          Score : <span className="font-semibold text-ink">{score}</span> / {repondues} répondue(s) sur {questions.length}
        </p>
      )}
      {questions.map((q, i) => {
        const choix = reponses[i];
        const repondu = choix !== undefined;
        return (
          <div key={i}>
            <p className="text-[0.85rem] font-medium text-ink">
              {i + 1}. {q.enonce}
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {q.propositions.map((p, j) => {
                const correcte = j === q.indexBonneReponse;
                return (
                  <button
                    key={j}
                    disabled={repondu}
                    onClick={() => setReponses((r) => ({ ...r, [i]: j }))}
                    className={cx(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[0.82rem] transition-colors",
                      !repondu && "border-trait hover:bg-surface-hover",
                      repondu && correcte && "border-bon bg-bon-doux text-bon",
                      repondu && !correcte && choix === j && "border-critique bg-critique-doux text-critique",
                      repondu && !correcte && choix !== j && "border-trait text-ink-muted",
                    )}
                  >
                    {repondu && correcte && <Icone nom="valide" taille={14} className="shrink-0" />}
                    {repondu && !correcte && choix === j && <Icone nom="fermer" taille={14} className="shrink-0" />}
                    {p}
                  </button>
                );
              })}
            </div>
            {repondu && <p className="mt-2 text-[0.8rem] text-ink-muted">{q.explication}</p>}
          </div>
        );
      })}
    </div>
  );
};

const Outils = () => {
  const client = useQueryClient();
  const [sujet, setSujet] = useState("");
  const [matiere, setMatiere] = useState("");
  const [ouvert, setOuvert] = useState<Artefact | null>(null);
  const [messageOutil, setMessageOutil] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["artefacts"],
    queryFn: () => get<{ documents: Artefact[] }>("/assistant/documents"),
  });

  const rafraichir = () => client.invalidateQueries({ queryKey: ["artefacts"] });

  const fiche = useMutation({
    mutationFn: () => post<{ fiche: Artefact }>("/assistant/fiche", { sujet, matiere: matiere || undefined }),
    onSuccess: (r) => {
      setOuvert(r.fiche);
      rafraichir();
    },
  });
  const quiz = useMutation({
    mutationFn: () => post<{ quiz: Artefact }>("/assistant/quiz", { sujet, matiere: matiere || undefined, nbQuestions: 8 }),
    onSuccess: (r) => {
      setOuvert(r.quiz);
      rafraichir();
    },
  });
  const cartes = useMutation({
    mutationFn: () => post<{ nombre: number }>("/assistant/cartes", { sujet, matiere: matiere || undefined, nombre: 12 }),
    onSuccess: (r) => {
      setMessageOutil(`${r.nombre} carte(s) créées et ajoutees à un nouveau paquet, pretes à être révisées.`);
      client.invalidateQueries({ queryKey: ["paquets"] });
    },
  });
  const brief = useMutation({
    mutationFn: () => post<{ brief: Artefact }>("/assistant/brief"),
    onSuccess: (r) => {
      setOuvert(r.brief);
      rafraichir();
    },
  });

  const occupe = fiche.isPending || quiz.isPending || cartes.isPending || brief.isPending;
  const echec = [fiche, quiz, cartes, brief].find((m) => m.error)?.error as Error | undefined;

  return (
    <div className="flex flex-col gap-4">
      <Carte className="p-5">
        <p className="text-[0.9rem] font-semibold text-ink">Produire un support de révision</p>
        <p className="mt-1 text-[0.82rem] text-ink-muted">
          Indiquez un chapitre ou une notion. Le contenu est adapté à votre classe et à vos résultats.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr]">
          <Champ label="Sujet" value={sujet} onChange={(e) => setSujet(e.target.value)} placeholder="Les suites géométriques" />
          <Champ label="Matière (facultatif)" value={matiere} onChange={(e) => setMatiere(e.target.value)} placeholder="Mathématiques" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Bouton variante="primaire" icone="notes" onClick={() => fiche.mutate()} disabled={!sujet || occupe} chargement={fiche.isPending}>
            Fiche de révision
          </Bouton>
          <Bouton icone="cible" onClick={() => quiz.mutate()} disabled={!sujet || occupe} chargement={quiz.isPending}>
            Quiz
          </Bouton>
          <Bouton icone="cartes" onClick={() => cartes.mutate()} disabled={!sujet || occupe} chargement={cartes.isPending}>
            Flashcards
          </Bouton>
          <div className="ml-auto">
            <Bouton icone="etincelle" onClick={() => brief.mutate()} disabled={occupe} chargement={brief.isPending}>
              Brief du jour
            </Bouton>
          </div>
        </div>
        {messageOutil && <p className="mt-3 rounded-lg bg-bon-doux px-3 py-2 text-[0.82rem] text-bon">{messageOutil}</p>}
        {echec && <p className="mt-3 rounded-lg bg-critique-doux px-3 py-2 text-[0.82rem] text-critique">{echec.message}</p>}
      </Carte>

      <Carte>
        <EnteteCarte titre="Mes documents générés" icone="dossier" sousTitre={`${data?.documents.length ?? 0} document(s)`} />
        {data?.documents.length ? (
          <ul className="divide-y divide-[var(--trait)]">
            {data.documents.map((a) => (
              <li key={a.id}>
                <button onClick={() => setOuvert(a)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-doux text-accent-ink">
                    <Icone nom={a.kind === "quiz" ? "cible" : a.kind === "brief" ? "etincelle" : "notes"} taille={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.85rem] font-medium text-ink">{a.titre}</p>
                    <p className="text-[0.75rem] text-ink-muted">
                      {a.matiere ? `${a.matiere} · ` : ""}
                      {horodatage(a.creeLe)}
                    </p>
                  </div>
                  <Badge>{a.kind}</Badge>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Vide titre="Aucun document" message="Vos fiches, quiz et briefs générés s'archivent ici." icone="dossier" />
        )}
      </Carte>

      <Modale ouverte={Boolean(ouvert)} onFermer={() => setOuvert(null)} titre={ouvert?.titre ?? ""} largeur="max-w-2xl">
        {ouvert && <RenduArtefact artefact={ouvert} />}
      </Modale>
    </div>
  );
};

/* ------------------------------------------------------------------ Page */

export const AssistantPage = () => {
  const [vue, setVue] = useState<"discussion" | "outils">("discussion");
  const { data: statut, isLoading } = useQuery({
    queryKey: ["assistant-statut"],
    queryFn: () => get<Statut>("/assistant/statut"),
  });

  if (isLoading) return <Squelette className="h-[30rem]" />;

  if (!statut?.disponible) {
    return (
      <div className="apparition">
        <EntetePage titre="Assistant" sousTitre="Un accompagnement qui s'appuie sur vos données scolaires réelles" />
        <Carte className="p-6">
          <div className="mx-auto max-w-lg text-center">
            <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-surface-hover text-ink-muted">
              <Icone nom="etincelle" taille={20} />
            </div>
            <p className="text-[0.95rem] font-medium text-ink">Assistant non configuré</p>
            <p className="mt-1 text-[0.85rem] leading-relaxed text-ink-muted">
              Cette instance n'a pas de clé API renseignée. Les outils ci-dessous n'en dépendent pas et
              couvrent l'essentiel de ce que l'assistant apporterait.
            </p>
          </div>

          <ul className="mx-auto mt-6 grid max-w-2xl gap-2 sm:grid-cols-3">
            {[
              { titre: "Planificateur", detail: "Répartit votre travail dans vos créneaux libres", cible: "/planificateur", icone: "boussole" },
              { titre: "Révisions espacées", detail: "Ramène chaque carte avant l'oubli", cible: "/revisions", icone: "cartes" },
              { titre: "Analyses", detail: "Où mettre vos efforts, chiffres à l'appui", cible: "/analyses", icone: "analyse" },
            ].map((o) => (
              <li key={o.cible}>
                <Link
                  to={o.cible}
                  className="carte-survol flex h-full flex-col gap-1.5 rounded-[var(--radius-card)] border border-trait bg-surface p-4"
                >
                  <Icone nom={o.icone} taille={17} className="text-accent-ink" />
                  <span className="text-[0.85rem] font-medium text-ink">{o.titre}</span>
                  <span className="text-[0.78rem] leading-snug text-ink-muted">{o.detail}</span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-center text-[0.75rem] text-ink-muted">
            Pour l'activer : renseignez <code className="rounded bg-surface-hover px-1 py-0.5">ANTHROPIC_API_KEY</code>{" "}
            dans <code className="rounded bg-surface-hover px-1 py-0.5">backend/.env</code>, puis redémarrez l'API.
          </p>
        </Carte>
      </div>
    );
  }

  return (
    <div className="apparition">
      <EntetePage
        titre="Assistant"
        sousTitre="Il connaît vos notes, vos devoirs et votre emploi du temps"
        actions={
          <>
            <Onglets
              valeur={vue}
              onChange={setVue}
              options={[
                { valeur: "discussion", libelle: "Discussion" },
                { valeur: "outils", libelle: "Générer" },
              ]}
            />
            <Badge icone="etincelle">{statut.quotaRestant} requetes restantes</Badge>
          </>
        }
      />
      {vue === "discussion" ? <Discussion /> : <Outils />}
    </div>
  );
};

export default AssistantPage;
