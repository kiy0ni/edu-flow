import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { Icone, type NomIcone } from "../lib/icones";
import { initiales, horodatage } from "../lib/format";
import { Bouton, cx, Vide } from "./ui";
import type { Notification } from "../lib/types";
import Recherche, { useRaccourciRecherche } from "./Recherche";

interface Entree {
  vers: string;
  libelle: string;
  icone: NomIcone;
}

const GROUPES: { titre: string; entrees: Entree[] }[] = [
  {
    titre: "Scolarité",
    entrees: [
      { vers: "/", libelle: "Accueil", icone: "accueil" },
      { vers: "/emploi-du-temps", libelle: "Emploi du temps", icone: "calendrier" },
      { vers: "/notes", libelle: "Notes", icone: "notes" },
      { vers: "/devoirs", libelle: "Devoirs", icone: "devoirs" },
      { vers: "/vie-scolaire", libelle: "Vie scolaire", icone: "presence" },
    ],
  },
  {
    titre: "Établissement",
    entrees: [
      { vers: "/messagerie", libelle: "Messagerie", icone: "message" },
      { vers: "/documents", libelle: "Documents", icone: "dossier" },
      { vers: "/actualites", libelle: "Actualités", icone: "megaphone" },
    ],
  },
  {
    titre: "Mon travail",
    entrees: [
      { vers: "/planificateur", libelle: "Planificateur", icone: "boussole" },
      { vers: "/revisions", libelle: "Révisions", icone: "cartes" },
      { vers: "/analyses", libelle: "Analyses", icone: "analyse" },
      { vers: "/assistant", libelle: "Assistant", icone: "etincelle" },
    ],
  },
];

const Logo = () => (
  <div className="flex items-center gap-2.5">
    <div className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-accent text-white">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 8.5 12 4.5l8 4-8 4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M7.5 10.8v4.4c0 1.5 2 2.8 4.5 2.8s4.5-1.3 4.5-2.8v-4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
    <span className="text-[1.02rem] font-semibold tracking-tight text-ink">EduFlow</span>
  </div>
);

/* ------------------------------------------------------------ Notifications */

const PanneauNotifications = ({ onFermer }: { onFermer: () => void }) => {
  const client = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => get<{ notifications: Notification[]; nonLues: number }>("/notifications?limite=30"),
  });

  const marquer = async (n: Notification) => {
    if (!n.luLe) await post(`/notifications/${n.id}/lue`).catch(() => {});
    client.invalidateQueries({ queryKey: ["notifications"] });
    if (n.lien) {
      navigate(n.lien);
      onFermer();
    }
  };

  const TONS: Record<string, string> = {
    urgent: "text-critique",
    attention: "text-serieux",
    succes: "text-bon",
    info: "text-ink-muted",
  };

  return (
    <div className="absolute top-full right-0 z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius-card)] border border-trait bg-surface shadow-[var(--shadow-flottant)]">
      <div className="flex items-center justify-between border-b border-trait px-4 py-3">
        <span className="text-[0.875rem] font-semibold text-ink">Notifications</span>
        {(data?.nonLues ?? 0) > 0 && (
          <button
            className="text-[0.78rem] text-accent-ink hover:underline"
            onClick={async () => {
              await post("/notifications/tout-lire");
              client.invalidateQueries({ queryKey: ["notifications"] });
            }}
          >
            Tout marquer comme lu
          </button>
        )}
      </div>
      <div className="max-h-[24rem] overflow-y-auto">
        {isLoading && <div className="px-4 py-8 text-center text-[0.825rem] text-ink-muted">Chargement...</div>}
        {!isLoading && !data?.notifications.length && (
          <Vide titre="Rien de neuf" message="Les nouveautés apparaîtront ici." icone="cloche" />
        )}
        {data?.notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => marquer(n)}
            className={cx(
              "flex w-full gap-3 border-b border-trait px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface-hover",
              !n.luLe && "bg-accent-doux/40",
            )}
          >
            <Icone
              nom={n.severite === "urgent" || n.severite === "attention" ? "attention" : n.severite === "succes" ? "valide" : "info"}
              taille={16}
              className={cx("mt-0.5 shrink-0", TONS[n.severite])}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[0.825rem] font-medium text-ink">{n.titre}</p>
              {n.corps && <p className="mt-0.5 line-clamp-2 text-[0.78rem] text-ink-2">{n.corps}</p>}
              <p className="mt-1 text-[0.7rem] text-ink-muted">{horodatage(n.creeLe)}</p>
            </div>
            {!n.luLe && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-label="non lue" />}
          </button>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ Layout */

export const Layout = () => {
  const { utilisateur, deconnexion } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [notifsOuvertes, setNotifsOuvertes] = useState(false);
  const [rechercheOuverte, setRechercheOuverte] = useState(false);

  useRaccourciRecherche(() => setRechercheOuverte(true));

  const { data: notifs } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => get<{ notifications: Notification[]; nonLues: number }>("/notifications?limite=30"),
    refetchInterval: 120_000,
  });

  // Toute navigation referme les panneaux mobiles.
  useEffect(() => {
    setMenuOuvert(false);
    setNotifsOuvertes(false);
  }, [location.pathname]);

  const prochainTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const iconeTheme = theme === "light" ? "soleil" : theme === "dark" ? "lune" : "ecran";

  const navigation = (
    <nav className="flex flex-col gap-4">
      {GROUPES.map((groupe) => (
        <div key={groupe.titre}>
          <p className="mb-1 px-3 text-[0.66rem] font-medium tracking-wider text-ink-muted/80 uppercase">
            {groupe.titre}
          </p>
          <ul className="flex flex-col gap-0.5">
            {groupe.entrees.map((entree) => (
              <li key={entree.vers}>
                <NavLink
                  to={entree.vers}
                  end={entree.vers === "/"}
                  className={({ isActive }) =>
                    cx(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.85rem] font-medium transition-colors",
                      isActive
                        ? "bg-accent-doux text-accent-ink"
                        : "text-ink-2 hover:bg-surface-hover hover:text-ink",
                    )
                  }
                >
                  <Icone nom={entree.icone} taille={17} className="shrink-0" />
                  {entree.libelle}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-full">
      {/* Barre laterale - poste de travail */}
      <aside className="fixed inset-y-0 left-0 hidden w-[16rem] flex-col border-r border-trait bg-surface lg:flex">
        <div className="px-5 py-5">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">{navigation}</div>
        <div className="border-t border-trait p-3">
          <NavLink
            to="/parametres"
            className={({ isActive }) =>
              cx(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.85rem] font-medium transition-colors",
                isActive ? "bg-accent-doux text-accent-ink" : "text-ink-2 hover:bg-surface-hover hover:text-ink",
              )
            }
          >
            <Icone nom="reglages" taille={17} />
            Paramètres
          </NavLink>
        </div>
      </aside>

      {/* Tiroir mobile */}
      {menuOuvert && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMenuOuvert(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside
            className="apparition absolute inset-y-0 left-0 flex w-[17rem] flex-col border-r border-trait bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-5">
              <Logo />
              <Bouton variante="discret" taille="sm" icone="fermer" onClick={() => setMenuOuvert(false)} aria-label="Fermer le menu" />
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-4">{navigation}</div>
            <div className="flex flex-col gap-0.5 border-t border-trait p-3">
              <NavLink
                to="/parametres"
                onClick={() => setMenuOuvert(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.85rem] font-medium text-ink-2 hover:bg-surface-hover"
              >
                <Icone nom="reglages" taille={17} />
                Paramètres
              </NavLink>
              <button
                onClick={deconnexion}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[0.85rem] font-medium text-ink-2 hover:bg-surface-hover"
              >
                <Icone nom="deconnexion" taille={17} />
                Se déconnecter
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Zone principale */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[16rem]">
        <Recherche ouverte={rechercheOuverte} onFermer={() => setRechercheOuverte(false)} />

        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-trait bg-surface/85 px-4 backdrop-blur-md sm:px-6">
          <Bouton variante="discret" taille="sm" icone="menu" className="lg:hidden" onClick={() => setMenuOuvert(true)} aria-label="Ouvrir le menu" />

          <div className="lg:hidden">
            <Logo />
          </div>

          {/* Point d'entrée visible de la recherche : le raccourci clavier seul
              resterait invisible pour la plupart des utilisateurs. */}
          <button
            onClick={() => setRechercheOuverte(true)}
            className="ml-2 hidden min-w-0 flex-1 items-center gap-2 rounded-lg border border-trait bg-surface-2 px-3 py-1.5 text-left text-[0.82rem] text-ink-muted transition-colors hover:border-trait-fort hover:bg-surface-hover sm:flex sm:max-w-xs"
          >
            <Icone nom="recherche" taille={15} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">Rechercher...</span>
            <kbd className="shrink-0 rounded border border-trait px-1 text-[0.68rem]">⌘K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <Bouton
              variante="discret"
              taille="sm"
              icone="recherche"
              className="sm:hidden"
              onClick={() => setRechercheOuverte(true)}
              aria-label="Rechercher"
            />
            <Bouton
              variante="discret"
              taille="sm"
              icone={iconeTheme}
              onClick={() => setTheme(prochainTheme)}
              aria-label={`Thème : ${theme}. Passer a ${prochainTheme}.`}
              title={`Thème : ${theme === "system" ? "systeme" : theme === "dark" ? "sombre" : "clair"}`}
            />

            <div className="relative">
              <Bouton
                variante="discret"
                taille="sm"
                icone="cloche"
                onClick={() => setNotifsOuvertes((v) => !v)}
                aria-label="Notifications"
                className="relative"
              >
                {(notifs?.nonLues ?? 0) > 0 && (
                  <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-critique text-[0.6rem] font-semibold text-white">
                    {notifs!.nonLues > 9 ? "9+" : notifs!.nonLues}
                  </span>
                )}
              </Bouton>
              {notifsOuvertes && <PanneauNotifications onFermer={() => setNotifsOuvertes(false)} />}
            </div>

            <div className="mx-1 hidden h-5 w-px bg-trait sm:block" />

            <div className="flex items-center gap-2 pl-1">
              <div className="hidden text-right sm:block">
                <p className="text-[0.8rem] leading-tight font-medium text-ink">
                  {utilisateur?.prenom} {utilisateur?.nom}
                </p>
                <p className="text-[0.72rem] leading-tight text-ink-muted">{utilisateur?.classe ?? utilisateur?.role}</p>
              </div>
              <div className="grid size-8 place-items-center rounded-full bg-accent-doux text-[0.78rem] font-semibold text-accent-ink">
                {initiales(utilisateur?.prenom ?? "", utilisateur?.nom ?? "")}
              </div>
              <Bouton
                variante="discret"
                taille="sm"
                icone="deconnexion"
                onClick={deconnexion}
                aria-label="Se déconnecter"
                className="hidden sm:inline-flex"
              />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[80rem] flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {/* La clé sur le chemin relance l'animation d'entrée à chaque
              changement de page : la transition signale que le contenu a
              bien changé, ce qu'un remplacement instantané ne montre pas. */}
          <div key={location.pathname} className="apparition">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Fermeture du panneau notifications au clic exterieur */}
      {notifsOuvertes && <div className="fixed inset-0 z-20" onClick={() => setNotifsOuvertes(false)} />}
    </div>
  );
};

export default Layout;
