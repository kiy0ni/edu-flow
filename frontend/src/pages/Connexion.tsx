import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { ErreurApi } from "../lib/api";
import { Bouton, Carte, Champ, cx } from "../components/ui";
import { Icone } from "../lib/icones";

const ATOUTS = [
  { icone: "boussole", titre: "Planificateur autonome", texte: "Votre travail est réparti tout seul dans vos créneaux réellement libres." },
  { icone: "cartes", titre: "Révisions espacées", texte: "Des cartes qui reviennent au bon moment, juste avant l'oubli." },
  { icone: "analyse", titre: "Analyses explicables", texte: "Chaque alerte cite la donnée qui la déclenche. Rien n'est deviné." },
  { icone: "etincelle", titre: "Assistant contextuel", texte: "Il connaît vos notes, vos devoirs et votre emploi du temps." },
] as const;

/** Identifiant et mot de passe du compte de démonstration. */
const COMPTE_DEMO = "demo";

export const Connexion = () => {
  const { connexion, defi, repondreDefi, annulerDefi } = useAuth();
  const { theme, setTheme } = useTheme();

  const [source, setSource] = useState<"ecoledirecte" | "demo">("ecoledirecte");
  const [identifiant, setIdentifiant] = useState("");
  const [motdepasse, setMotdepasse] = useState("");
  const [reponseDefi, setReponseDefi] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  /**
   * Bascule de source.
   * L'onglet démonstration pré-remplit les identifiants : les afficher en
   * simple texte d'aide laissait les champs vides, et le formulaire refusait
   * silencieusement de partir.
   */
  const choisirSource = (v: "ecoledirecte" | "demo") => {
    setSource(v);
    setErreur(null);
    if (v === "demo") {
      setIdentifiant(COMPTE_DEMO);
      setMotdepasse(COMPTE_DEMO);
    } else if (identifiant === COMPTE_DEMO && motdepasse === COMPTE_DEMO) {
      setIdentifiant("");
      setMotdepasse("");
    }
  };

  const soumettre = async (e: FormEvent) => {
    e.preventDefault();
    setErreur(null);

    // Les identifiants de démonstration saisis sous École Directe partiraient
    // vers le vrai serveur et échoueraient : on les reconnaît ici.
    const veutLaDemo =
      source === "ecoledirecte" &&
      identifiant.trim().toLowerCase() === COMPTE_DEMO &&
      motdepasse === COMPTE_DEMO;

    setEnvoi(true);
    try {
      await connexion(
        veutLaDemo
          ? { source: "demo", identifiant: COMPTE_DEMO, motdepasse: COMPTE_DEMO }
          : { source, identifiant, motdepasse },
      );
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : "Connexion impossible. Réessayez.");
    } finally {
      setEnvoi(false);
    }
  };

  const soumettreDefi = async (e: FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      await repondreDefi(reponseDefi);
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : "Réponse refusee.");
    } finally {
      setEnvoi(false);
    }
  };

  const essayerDemo = async () => {
    setSource("demo");
    setIdentifiant("demo");
    setMotdepasse("demo");
    setErreur(null);
    setEnvoi(true);
    try {
      await connexion({ source: "demo", identifiant: "demo", motdepasse: "demo" });
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : "Le compte de démonstration est indisponible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      {/* Colonne formulaire */}
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-[10px] bg-accent text-white">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 8.5 12 4.5l8 4-8 4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M7.5 10.8v4.4c0 1.5 2 2.8 4.5 2.8s4.5-1.3 4.5-2.8v-4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-[1.05rem] font-semibold tracking-tight">EduFlow</span>
          </div>
          <Bouton
            variante="discret"
            taille="sm"
            icone={theme === "light" ? "soleil" : theme === "dark" ? "lune" : "ecran"}
            onClick={() => setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")}
            aria-label="Changer de thème"
          />
        </div>

        <div className="mx-auto flex w-full max-w-[24rem] flex-1 flex-col justify-center py-10">
          {defi ? (
            <form onSubmit={soumettreDefi} className="apparition">
              <h1 className="text-[1.5rem] leading-tight font-semibold tracking-tight">Vérification</h1>
              <p className="mt-2 text-[0.875rem] text-ink-2">
                École Directe demande une vérification supplémentaire avant d'ouvrir la session.
              </p>

              <Carte className="mt-5 p-4">
                <p className="text-[0.875rem] font-medium text-ink">{defi.question}</p>
                <div className="mt-3 flex flex-col gap-1.5">
                  {defi.propositions.map((p) => (
                    <label
                      key={p.valeur}
                      className={cx(
                        "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-[0.85rem] transition-colors",
                        reponseDefi === p.valeur
                          ? "border-accent bg-accent-doux text-accent-ink"
                          : "border-trait hover:bg-surface-hover",
                      )}
                    >
                      <input
                        type="radio"
                        name="qcm"
                        className="accent-[var(--accent)]"
                        checked={reponseDefi === p.valeur}
                        onChange={() => setReponseDefi(p.valeur)}
                      />
                      {p.libelle}
                    </label>
                  ))}
                </div>
              </Carte>

              {erreur && (
                <p className="mt-4 flex items-start gap-2 rounded-lg bg-critique-doux px-3 py-2 text-[0.8rem] text-critique">
                  <Icone nom="attention" taille={15} className="mt-0.5 shrink-0" />
                  {erreur}
                </p>
              )}

              <div className="mt-5 flex gap-2">
                <Bouton type="submit" variante="primaire" chargement={envoi} disabled={!reponseDefi} className="flex-1">
                  Valider
                </Bouton>
                <Bouton type="button" onClick={annulerDefi}>
                  Annuler
                </Bouton>
              </div>
            </form>
          ) : (
            <form onSubmit={soumettre}>
              <h1 className="text-[1.65rem] leading-tight font-semibold tracking-tight">Bonjour</h1>
              <p className="mt-2 text-[0.9rem] text-ink-2">Connectez-vous à votre espace de travail.</p>

              <div className="mt-6 flex gap-0.5 rounded-lg border border-trait bg-surface-2 p-0.5">
                {(
                  [
                    ["ecoledirecte", "École Directe"],
                    ["demo", "Démonstration"],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => choisirSource(v)}
                    className={cx(
                      "flex-1 rounded-[7px] px-3 py-1.5 text-[0.8rem] font-medium transition-colors",
                      source === v ? "bg-surface text-ink shadow-[var(--shadow-carte)]" : "text-ink-muted hover:text-ink",
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <Champ
                  label="Identifiant"
                  value={identifiant}
                  onChange={(e) => setIdentifiant(e.target.value)}
                  autoComplete="username"
                  placeholder={source === "demo" ? "demo" : "Votre identifiant École Directe"}
                  required
                />
                <Champ
                  label="Mot de passe"
                  type="password"
                  value={motdepasse}
                  onChange={(e) => setMotdepasse(e.target.value)}
                  autoComplete="current-password"
                  placeholder={source === "demo" ? "demo" : "Votre mot de passe"}
                  required
                />
              </div>

              {erreur && (
                <p className="mt-4 flex items-start gap-2 rounded-lg bg-critique-doux px-3 py-2 text-[0.8rem] text-critique">
                  <Icone nom="attention" taille={15} className="mt-0.5 shrink-0" />
                  {erreur}
                </p>
              )}

              <Bouton type="submit" variante="primaire" chargement={envoi} className="mt-5 w-full">
                Se connecter
              </Bouton>

              {/* Le raccourci reste offert sur les deux onglets. */}
              {(
                <>
                  <div className="my-5 flex items-center gap-3 text-[0.75rem] text-ink-muted">
                    <span className="h-px flex-1 bg-trait" />
                    ou
                    <span className="h-px flex-1 bg-trait" />
                  </div>
                  <Bouton type="button" onClick={essayerDemo} disabled={envoi} className="w-full" icone="lecture">
                    Explorer avec un compte de démonstration
                  </Bouton>
                  <p className="mt-3 text-center text-[0.75rem] text-ink-muted">
                    Identifiants <code className="rounded bg-surface-hover px-1">demo</code> /{" "}
                    <code className="rounded bg-surface-hover px-1">demo</code> · données fictives, aucune information réelle.
                  </p>
                </>
              )}

              <p className="mt-8 text-center text-[0.75rem] leading-relaxed text-ink-muted">
                {source === "demo"
                  ? "Le compte de démonstration ne s'appuie sur aucune donnée réelle et n'appelle aucun service externe."
                  : "Vos identifiants sont transmis à École Directe pour ouvrir la session. Ils ne sont jamais conservés en clair par EduFlow."}
              </p>
            </form>
          )}
        </div>
      </div>

      {/* Colonne presentation */}
      <div className="relative hidden overflow-hidden border-l border-trait bg-surface lg:block">
        <div
          className="absolute inset-0 opacity-[0.55]"
          style={{
            background:
              "radial-gradient(60rem 40rem at 80% -10%, var(--accent-doux), transparent 60%), radial-gradient(40rem 30rem at 10% 110%, var(--accent-doux), transparent 60%)",
          }}
          aria-hidden="true"
        />
        <div className="relative flex h-full flex-col justify-center px-12 py-16">
          <p className="text-[0.72rem] font-semibold tracking-wider text-accent-ink uppercase">
            Espace numérique de travail
          </p>
          <h2 className="mt-3 max-w-md text-[2rem] leading-[1.15] font-semibold tracking-tight text-ink">
            Tout votre lycée, et ce qu'il vous manquait pour vous organiser.
          </h2>
          <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-ink-2">
            EduFlow reprend l'ensemble des services de votre établissement et y ajoute les outils
            qui transforment une liste de devoirs en un plan de travail réaliste.
          </p>

          <ul className="mt-10 grid max-w-lg grid-cols-2 gap-x-6 gap-y-6">
            {ATOUTS.map((a) => (
              <li key={a.titre}>
                <div className="mb-2 grid size-8 place-items-center rounded-lg bg-surface text-accent-ink shadow-[var(--shadow-carte)]">
                  <Icone nom={a.icone} taille={16} />
                </div>
                <p className="text-[0.85rem] font-medium text-ink">{a.titre}</p>
                <p className="mt-0.5 text-[0.8rem] leading-relaxed text-ink-muted">{a.texte}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Connexion;
