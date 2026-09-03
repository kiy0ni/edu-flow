import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch, post } from "../lib/api";
import { Bouton, Carte, Champ, Chiffres, EnteteCarte, EntetePage, Squelette, Vide, cx } from "../components/ui";
import { Icone } from "../lib/icones";
import { duree, horodatage } from "../lib/format";

interface Session {
  id: string;
  matiere: string | null;
  dureePrevue: number;
  dureeReelle: number | null;
  interruptions: number;
  ressenti: number | null;
  debutLe: string;
  finLe: string | null;
}

interface Reponse {
  sessions: Session[];
  statistiques: {
    minutes7j: number;
    sessions7j: number;
    ressentiMoyen: number;
    parMatiere: { matiere: string; minutes: number }[];
  };
}

const DUREES = [15, 25, 45, 60];

export const ConcentrationPage = ({ sansEntete = false }: { sansEntete?: boolean } = {}) => {
  const client = useQueryClient();
  const [matiere, setMatiere] = useState("");
  const [dureePrevue, setDureePrevue] = useState(25);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [restant, setRestant] = useState(dureePrevue * 60);
  const [enPause, setEnPause] = useState(false);
  const [interruptions, setInterruptions] = useState(0);
  const [termine, setTermine] = useState(false);
  const minuteur = useRef<number | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["focus"], queryFn: () => get<Reponse>("/concentration") });

  const demarrer = useMutation({
    mutationFn: () => post<{ session: Session }>("/concentration", { matiere: matiere || undefined, dureePrevue }),
    onSuccess: (r) => {
      setSessionId(r.session.id);
      setRestant(dureePrevue * 60);
      setInterruptions(0);
      setTermine(false);
      setEnPause(false);
    },
  });

  const cloturer = useMutation({
    mutationFn: ({ ressenti }: { ressenti?: number }) =>
      patch(`/concentration/${sessionId}`, {
        dureeReelle: Math.round((dureePrevue * 60 - restant) / 60),
        interruptions,
        ressenti,
        terminer: true,
      }),
    onSuccess: () => {
      setSessionId(null);
      setTermine(false);
      client.invalidateQueries({ queryKey: ["focus"] });
      client.invalidateQueries({ queryKey: ["analyses"] });
    },
  });

  // Decompte : suspendu en pause, arrete a zero.
  useEffect(() => {
    if (!sessionId || enPause || termine) return;
    minuteur.current = window.setInterval(() => {
      setRestant((r) => {
        if (r <= 1) {
          setTermine(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (minuteur.current) window.clearInterval(minuteur.current);
    };
  }, [sessionId, enPause, termine]);

  const minutes = Math.floor(restant / 60);
  const secondes = restant % 60;
  const progression = sessionId ? 1 - restant / (dureePrevue * 60) : 0;

  const rayon = 88;
  const circonference = 2 * Math.PI * rayon;

  return (
    <div className="apparition">
      {!sansEntete && (
        <EntetePage
          titre="Concentration"
          sousTitre="Des sessions courtes et mesurées, pour savoir où passe vraiment votre temps"
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Carte className="flex flex-col items-center justify-center px-6 py-10">
          <div className="relative">
            <svg width="208" height="208" viewBox="0 0 208 208" aria-hidden="true">
              <circle cx="104" cy="104" r={rayon} fill="none" stroke="var(--surface-hover)" strokeWidth="10" />
              <circle
                cx="104"
                cy="104"
                r={rayon}
                fill="none"
                stroke={termine ? "var(--bon)" : "var(--accent)"}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circonference}
                strokeDashoffset={circonference * (1 - progression)}
                transform="rotate(-90 104 104)"
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-[2.6rem] leading-none font-semibold text-ink tabular-nums">
                  {String(minutes).padStart(2, "0")}:{String(secondes).padStart(2, "0")}
                </p>
                <p className="mt-1.5 text-[0.8rem] text-ink-muted">
                  {termine ? "Session terminée" : sessionId ? (enPause ? "En pause" : matiere || "Concentration") : "Prêt à démarrer"}
                </p>
              </div>
            </div>
          </div>

          {!sessionId ? (
            <div className="mt-8 w-full max-w-sm">
              <Champ label="Sur quoi travaillez-vous ?" value={matiere} onChange={(e) => setMatiere(e.target.value)} placeholder="Mathématiques, révision du chapitre 4..." />
              <div className="mt-3">
                <span className="mb-1.5 block text-[0.8rem] font-medium text-ink-2">Durée</span>
                <div className="grid grid-cols-4 gap-2">
                  {DUREES.map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setDureePrevue(d);
                        setRestant(d * 60);
                      }}
                      className={cx(
                        "rounded-lg border px-2 py-2 text-[0.82rem] font-medium transition-colors",
                        dureePrevue === d ? "border-accent bg-accent-doux text-accent-ink" : "border-trait bg-surface text-ink-2 hover:bg-surface-hover",
                      )}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>
              <Bouton variante="primaire" icone="lecturePlay" className="mt-4 w-full" onClick={() => demarrer.mutate()} chargement={demarrer.isPending}>
                Démarrer
              </Bouton>
            </div>
          ) : termine ? (
            <div className="mt-8 w-full max-w-sm text-center">
              <p className="text-[0.875rem] text-ink-2">Comment s'est passée cette session ?</p>
              <div className="mt-3 flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => cloturer.mutate({ ressenti: n })}
                    className="grid size-10 place-items-center rounded-lg border border-trait bg-surface text-[0.9rem] font-medium text-ink transition-colors hover:border-accent hover:bg-accent-doux"
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[0.72rem] text-ink-muted">1 = très difficile · 5 = très productive</p>
              <Bouton variante="discret" className="mt-3" onClick={() => cloturer.mutate({})}>
                Passer
              </Bouton>
            </div>
          ) : (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <Bouton
                icone={enPause ? "lecturePlay" : "pause"}
                onClick={() => {
                  if (!enPause) setInterruptions((i) => i + 1);
                  setEnPause((p) => !p);
                }}
              >
                {enPause ? "Reprendre" : "Pause"}
              </Bouton>
              <Bouton icone="arret" variante="danger" onClick={() => setTermine(true)}>
                Terminer
              </Bouton>
              {interruptions > 0 && <span className="text-[0.78rem] text-ink-muted">{interruptions} interruption(s)</span>}
            </div>
          )}
        </Carte>

        <div className="flex flex-col gap-4">
          <Chiffres
            entrees={[
              {
                libelle: "Cette semaine",
                valeur: duree(data?.statistiques.minutes7j ?? 0),
                detail: `${data?.statistiques.sessions7j ?? 0} session(s)`,
              },
              {
                libelle: "Ressenti moyen",
                valeur: data?.statistiques.ressentiMoyen ? `${data.statistiques.ressentiMoyen}/5` : "—",
              },
            ]}
          />

          <Carte>
            <EnteteCarte titre="Répartition (30 j)" icone="analyse" />
            {data?.statistiques.parMatiere.length ? (
              <ul className="flex flex-col gap-2.5 p-4">
                {data.statistiques.parMatiere.slice(0, 6).map((m) => {
                  const max = data.statistiques.parMatiere[0].minutes || 1;
                  return (
                    <li key={m.matiere}>
                      <div className="mb-1 flex items-center justify-between text-[0.78rem]">
                        <span className="truncate text-ink-2">{m.matiere}</span>
                        <span className="shrink-0 pl-2 text-ink-muted tabular-nums">{duree(m.minutes)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
                        <div className="progression-animee h-full rounded-full bg-accent" style={{ width: `${(m.minutes / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Vide titre="Aucune donnée" message="Lancez une session pour commencer à mesurer." icone="minuteur" />
            )}
          </Carte>
        </div>
      </div>

      <Carte className="mt-4">
        <EnteteCarte titre="Historique" icone="horloge" />
        {isLoading && <div className="p-4"><Squelette className="h-32" /></div>}
        {data?.sessions.length ? (
          <ul className="divide-y divide-[var(--trait)]">
            {data.sessions.slice(0, 10).map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-hover text-ink-muted">
                  <Icone nom="minuteur" taille={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.85rem] font-medium text-ink">{s.matiere ?? "Session de travail"}</p>
                  <p className="text-[0.75rem] text-ink-muted">
                    {horodatage(s.debutLe)}
                    {s.interruptions > 0 && ` · ${s.interruptions} interruption(s)`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[0.85rem] font-medium text-ink tabular-nums">{duree(s.dureeReelle ?? 0)}</p>
                  {s.ressenti && <p className="text-[0.72rem] text-ink-muted">ressenti {s.ressenti}/5</p>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          !isLoading && <Vide titre="Aucune session" message="Votre historique apparaîtra ici." icone="minuteur" />
        )}
      </Carte>
    </div>
  );
};

export default ConcentrationPage;
