import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch, post, put } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { Badge, Bouton, Carte, Champ, EnteteCarte, EntetePage, Squelette, cx } from "../components/ui";
import { Icone } from "../lib/icones";
import { horodatage } from "../lib/format";
import type { Preferences, Utilisateur } from "../lib/types";

interface Profil {
  utilisateur: Utilisateur;
  profil: Record<string, unknown> | null;
  preferences: Preferences | null;
}

const LIBELLES_NOTIFS: Record<string, string> = {
  nouvelleNote: "Nouvelle note publiee",
  devoirProche: "Devoir dont l'échéance approche",
  absence: "Absence ou retard à justifier",
  message: "Nouveau message",
  briefQuotidien: "Brief quotidien",
};

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

export const ParametresPage = () => {
  const client = useQueryClient();
  const { utilisateur, deconnexion } = useAuth();
  const { theme, setTheme } = useTheme();
  const [message, setMessage] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["profil"], queryFn: () => get<Profil>("/moi") });
  const { data: sessions } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => get<{ sessions: { id: string; user_agent: string | null; created_at: string; last_used_at: string }[] }>("/moi/sessions"),
  });

  const [contact, setContact] = useState({ email: "", telephone: "" });
  const [etude, setEtude] = useState({ debut: "17:00", fin: "20:30", dureeBloc: 45, pause: 10, joursOff: ["dimanche"] as string[] });
  const [notifs, setNotifs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!data) return;
    setContact({ email: data.utilisateur.email ?? "", telephone: data.utilisateur.telephone ?? "" });
    if (data.preferences) {
      setEtude(data.preferences.study);
      setNotifs(data.preferences.notifications);
    }
  }, [data]);

  const annoncer = (texte: string) => {
    setMessage(texte);
    setTimeout(() => setMessage(null), 3500);
  };

  const majContact = useMutation({
    mutationFn: () => patch("/moi", contact),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["profil"] });
      annoncer("Vos informations ont été mises à jour.");
    },
  });

  const majPreferences = useMutation({
    mutationFn: (patchPrefs: Partial<Preferences>) => put<{ preferences: Preferences }>("/moi/preferences", patchPrefs),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["profil"] });
      annoncer("Préférences enregistrées.");
    },
  });

  const rafraichirDonnees = useMutation({
    mutationFn: () => post("/moi/rafraichir"),
    onSuccess: () => {
      client.invalidateQueries();
      annoncer("Données rechargees depuis l'établissement.");
    },
  });

  const fermerSessions = useMutation({
    mutationFn: () => post("/auth/logout-all"),
    onSuccess: () => deconnexion(),
  });

  if (isLoading) return <Squelette className="h-[30rem]" />;

  return (
    <div className="apparition max-w-3xl">
      <EntetePage titre="Paramètres" sousTitre="Compte, apparence et fonctionnement des outils" />

      {message && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-bon-doux px-3 py-2 text-[0.82rem] text-bon" role="status">
          <Icone nom="valide" taille={15} />
          {message}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {/* Compte */}
        <Carte>
          <EnteteCarte titre="Mon compte" icone="personne" />
          <div className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-full bg-accent-doux text-[1rem] font-semibold text-accent-ink">
                {(utilisateur?.prenom?.[0] ?? "") + (utilisateur?.nom?.[0] ?? "")}
              </div>
              <div>
                <p className="text-[0.95rem] font-semibold text-ink">
                  {utilisateur?.prenom} {utilisateur?.nom}
                </p>
                <p className="text-[0.8rem] text-ink-muted">
                  {[utilisateur?.classe, utilisateur?.etablissement].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Badge className="ml-auto" ton={utilisateur?.source === "demo" ? "attention" : "accent"}>
                {utilisateur?.source === "demo" ? "Compte de démonstration" : "École Directe"}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Champ label="Adresse e-mail" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
              <Champ label="Téléphone" value={contact.telephone} onChange={(e) => setContact({ ...contact, telephone: e.target.value })} />
            </div>
            <Bouton variante="primaire" className="mt-4" onClick={() => majContact.mutate()} chargement={majContact.isPending}>
              Enregistrer
            </Bouton>
          </div>
        </Carte>

        {/* Apparence */}
        <Carte>
          <EnteteCarte titre="Apparence" icone="ecran" />
          <div className="p-5">
            <p className="mb-2 text-[0.8rem] font-medium text-ink-2">Thème</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["light", "Clair", "soleil"],
                  ["dark", "Sombre", "lune"],
                  ["system", "Système", "ecran"],
                ] as const
              ).map(([v, l, i]) => (
                <button
                  key={v}
                  onClick={() => {
                    setTheme(v);
                    majPreferences.mutate({ theme: v });
                  }}
                  className={cx(
                    "flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-[0.82rem] font-medium transition-colors",
                    theme === v ? "border-accent bg-accent-doux text-accent-ink" : "border-trait bg-surface text-ink-2 hover:bg-surface-hover",
                  )}
                >
                  <Icone nom={i} taille={17} />
                  {l}
                </button>
              ))}
            </div>
          </div>
        </Carte>

        {/* Planificateur */}
        <Carte>
          <EnteteCarte
            titre="Mes plages de travail"
            icone="boussole"
            sousTitre="Le planificateur ne place des blocs que dans ces créneaux, hors cours"
          />
          <div className="p-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <Champ label="Debut" type="time" value={etude.debut} onChange={(e) => setEtude({ ...etude, debut: e.target.value })} />
              <Champ label="Fin" type="time" value={etude.fin} onChange={(e) => setEtude({ ...etude, fin: e.target.value })} />
              <Champ
                label="Durée d'un bloc"
                type="number"
                min={15}
                max={120}
                step={5}
                value={etude.dureeBloc}
                onChange={(e) => setEtude({ ...etude, dureeBloc: Number(e.target.value) })}
              />
              <Champ
                label="Pause"
                type="number"
                min={0}
                max={60}
                step={5}
                value={etude.pause}
                onChange={(e) => setEtude({ ...etude, pause: Number(e.target.value) })}
              />
            </div>

            <p className="mt-4 mb-2 text-[0.8rem] font-medium text-ink-2">Jours sans travail</p>
            <div className="flex flex-wrap gap-1.5">
              {JOURS.map((j) => {
                const off = etude.joursOff.includes(j);
                return (
                  <button
                    key={j}
                    onClick={() =>
                      setEtude({ ...etude, joursOff: off ? etude.joursOff.filter((x) => x !== j) : [...etude.joursOff, j] })
                    }
                    className={cx(
                      "rounded-lg border px-3 py-1.5 text-[0.8rem] font-medium capitalize transition-colors",
                      off ? "border-transparent bg-accent-doux text-accent-ink" : "border-trait bg-surface text-ink-muted hover:bg-surface-hover",
                    )}
                  >
                    {j}
                  </button>
                );
              })}
            </div>

            <Bouton
              variante="primaire"
              className="mt-4"
              onClick={() => majPreferences.mutate({ study: etude })}
              chargement={majPreferences.isPending}
            >
              Enregistrer
            </Bouton>
          </div>
        </Carte>

        {/* Notifications */}
        <Carte>
          <EnteteCarte titre="Notifications" icone="cloche" />
          <ul className="divide-y divide-[var(--trait)]">
            {Object.entries(LIBELLES_NOTIFS).map(([cle, libelle]) => {
              const actif = notifs[cle] ?? true;
              return (
                <li key={cle} className="flex items-center justify-between gap-4 px-5 py-3">
                  <span className="text-[0.85rem] text-ink">{libelle}</span>
                  <button
                    role="switch"
                    aria-checked={actif}
                    aria-label={libelle}
                    onClick={() => {
                      const suivant = { ...notifs, [cle]: !actif };
                      setNotifs(suivant);
                      majPreferences.mutate({ notifications: suivant });
                    }}
                    className={cx(
                      "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                      actif ? "bg-accent" : "bg-trait-fort",
                    )}
                  >
                    <span
                      className={cx(
                        "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
                        actif ? "translate-x-[1.375rem]" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </Carte>

        {/* Donnees et sessions */}
        <Carte>
          <EnteteCarte titre="Données et sécurité" icone="reglages" />
          <div className="divide-y divide-[var(--trait)]">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="text-[0.85rem] font-medium text-ink">Recharger les données</p>
                <p className="mt-0.5 text-[0.8rem] text-ink-muted">Vide le cache et interroge à nouveau l'établissement.</p>
              </div>
              <Bouton icone="recharger" onClick={() => rafraichirDonnees.mutate()} chargement={rafraichirDonnees.isPending}>
                Recharger
              </Bouton>
            </div>

            <div className="px-5 py-4">
              <p className="text-[0.85rem] font-medium text-ink">Sessions actives</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {sessions?.sessions.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-[0.78rem] text-ink-muted">
                    <Icone nom="ecran" taille={13} />
                    <span className="min-w-0 flex-1 truncate">{s.user_agent ?? "Appareil inconnu"}</span>
                    <span className="shrink-0">{horodatage(s.last_used_at)}</span>
                  </li>
                ))}
              </ul>
              <Bouton variante="danger" icone="deconnexion" className="mt-3" onClick={() => fermerSessions.mutate()}>
                Fermer toutes les sessions
              </Bouton>
            </div>
          </div>
        </Carte>

        <p className="px-1 pb-4 text-[0.75rem] leading-relaxed text-ink-muted">
          EduFlow ne conserve jamais votre mot de passe d'établissement en clair. Le jeton d'accès fourni par Ecole
          Directe est chiffré au repos et n'est utilisé que pour récupérer vos données.
        </p>
      </div>
    </div>
  );
};

export default ParametresPage;
