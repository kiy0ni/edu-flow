import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import Connexion from "./pages/Connexion";

/**
 * Chargement differe des pages.
 * Les ecrans porteurs de graphiques embarquent la bibliotheque de rendu :
 * les isoler evite de la charger pour ceux qui n'en ont pas besoin.
 */
const Accueil = lazy(() => import("./pages/Accueil"));
const EmploiDuTemps = lazy(() => import("./pages/EmploiDuTemps"));
const Notes = lazy(() => import("./pages/Notes"));
const Devoirs = lazy(() => import("./pages/Devoirs"));
const VieScolaire = lazy(() => import("./pages/VieScolaire"));
const Messagerie = lazy(() => import("./pages/Messagerie"));
const Documents = lazy(() => import("./pages/Documents"));
const Actualites = lazy(() => import("./pages/Actualites"));
const Planificateur = lazy(() => import("./pages/Planificateur"));
const Revisions = lazy(() => import("./pages/Revisions"));
const Analyses = lazy(() => import("./pages/Analyses"));
const Assistant = lazy(() => import("./pages/Assistant"));
const Parametres = lazy(() => import("./pages/Parametres"));

const Chargement = ({ pleinEcran = false }: { pleinEcran?: boolean }) => (
  <div className={pleinEcran ? "grid min-h-full place-items-center" : "grid min-h-[24rem] place-items-center"}>
    <div className="flex flex-col items-center gap-3">
      <div className="size-7 animate-spin rounded-full border-2 border-trait-fort border-t-accent" />
      <p className="text-[0.825rem] text-ink-muted">Chargement...</p>
    </div>
  </div>
);

export const App = () => {
  const { utilisateur, chargement } = useAuth();

  if (chargement) return <Chargement pleinEcran />;
  if (!utilisateur) return <Connexion />;

  return (
    <Routes>
      <Route element={<Layout />}>
        {(
          [
            ["/", Accueil],
            ["/emploi-du-temps", EmploiDuTemps],
            ["/notes", Notes],
            ["/devoirs", Devoirs],
            ["/vie-scolaire", VieScolaire],
            ["/messagerie", Messagerie],
            ["/documents", Documents],
            ["/actualites", Actualites],
            ["/planificateur", Planificateur],
            ["/revisions", Revisions],
            ["/analyses", Analyses],
            ["/assistant", Assistant],
            ["/parametres", Parametres],
          ] as const
        ).map(([chemin, Page]) => (
          <Route
            key={chemin}
            path={chemin}
            element={
              <Suspense fallback={<Chargement />}>
                <Page />
              </Suspense>
            }
          />
        ))}
        {/* La concentration est un onglet des révisions ; l'ancienne adresse reste valide. */}
        <Route
          path="/concentration"
          element={
            <Suspense fallback={<Chargement />}>
              <Revisions vueInitiale="concentration" />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
