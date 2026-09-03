# EduFlow

Espace numérique de travail scolaire : il reprend l'ensemble des services d'un ENT
classique (type École Directe) et y ajoute les outils qui transforment une liste de
devoirs en un plan de travail réaliste.

L'application est utilisable **de bout en bout sans aucun identifiant réel** grâce à
un compte de démonstration alimenté par des données fictives déterministes.

---

## Ce que fait EduFlow

### Les services d'un ENT

| Module | Contenu |
|---|---|
| **Accueil** | La journée en cours, le prochain cours, le travail à faire, les dernières notes, le plan du jour |
| **Emploi du temps** | Grille hebdomadaire, vue liste, cours annulés et évaluations signalés, **export iCalendar incluant les échéances de devoirs et leurs rappels** |
| **Notes** | Notes par matière et par période, moyennes pondérées, comparaison à la classe, évolution |
| **Devoirs** | Cahier de textes, état « fait », estimation de durée, **courbe de charge de travail** |
| **Vie scolaire** | Absences, retards, observations, suivi des justificatifs |
| **Messagerie** | Réception, envoyés, archives, corbeille · lecture, rédaction, réponse, favoris, suppression et restauration |
| **Documents** | Bulletins, relevés, attestations et ressources — **réellement téléchargeables en PDF** |
| **Actualités** | Informations publiées par l'établissement |
| **Notifications** | Détection automatique des nouveautés (note, échéance, absence, message) |

### Ce qui va au-delà

| Outil | Principe |
|---|---|
| **Planificateur** | Croise devoirs, évaluations annoncées, cartes à réviser et matières fragiles, puis **place ce travail dans les créneaux réellement libres** de l'élève. Entièrement déterministe. |
| **Révisions espacées** | Paquets de cartes pilotés par l'algorithme **SM-2** : chaque carte revient juste avant l'oubli. |
| **Concentration** | Sessions de travail minutées ; le temps mesuré alimente les analyses. |
| **Analyses** | Constats **explicables** : chaque signal cite la donnée qui le déclenche (moyenne, écart à la classe, régularité, assiduité, taux de complétion). |
| **Simulateur de moyenne** | Effet réel d'une note hypothétique, coefficients compris, et calcul inverse « quelle note pour atteindre X ? ». |
| **Objectifs** | Une cible par matière ou pour la moyenne générale. EduFlow calcule **la note qu'il faut obtenir** à la prochaine évaluation — et dit franchement quand l'objectif n'est plus atteignable en une fois. |
| **Effet de levier** | Classe les matières par ce qu'un point gagné y rapporterait **réellement** à la moyenne générale. Un 11/20 en coefficient 6 pèse six fois plus qu'un 8/20 en coefficient 1 : aucun classement par moyenne ne le montre. |
| **Projection** | Moyenne estimée en fin de période, extrapolée avec prudence et assortie d'un indice de fiabilité. |
| **Série de travail** | Jours consécutifs d'activité réelle — devoir terminé, cartes révisées, session de concentration ou bloc mené à terme. |
| **Bilan hebdomadaire** | Ce qui a été fait cette semaine, comparé à la précédente. |
| **Recherche globale** | `⌘K` depuis n'importe quel écran : devoirs, notes, cours, messages, documents et actualités, classés par pertinence. |
| **Assistant** | Discussion contextualisée sur les données scolaires réelles ; génération de fiches de révision, de quiz et de cartes prêtes à réviser. **Optionnel.** |

### Le suivi repose sur des faits, pas sur des déclarations

Le journal d'activité n'enregistre que du travail réellement effectué : un devoir
coché, une carte notée, une session de concentration close, un bloc du plan mené à
terme. La série de jours consécutifs, le bilan hebdomadaire et les constats sur la
régularité en découlent — rien n'est déclaratif.

### Des documents réellement produits

Les bulletins, relevés de notes, attestations et emplois du temps ne sont pas des
fichiers d'exemple : ils sont **fabriqués à la demande à partir du dossier de
l'élève** par un générateur PDF sans dépendance (`backend/src/lib/pdf.js`). Le
bulletin téléchargé contient ses notes, ses moyennes, la moyenne de la classe et
une appréciation par discipline cohérente avec chaque résultat.

Les pièces rédigées par l'établissement (règlement intérieur, fiches méthode,
formulaire de mathématiques, guide Parcoursup) ont un contenu complet, lui aussi
rendu en PDF.

---

## Architecture

```
edu-flow/
├── backend/                 API Node.js (ESM) + Express + PostgreSQL
│   └── src/
│       ├── config/          configuration validée au démarrage
│       ├── lib/             base technique (base de données, journal, jetons, cache, dates)
│       ├── db/migrations/   migrations SQL versionnées
│       ├── middleware/      authentification, erreurs, limitation de débit
│       ├── providers/       ← abstraction des sources de données
│       │   ├── ecoledirecte/  client, correspondances, provider
│       │   ├── demo/          jeu de données fictives déterministe
│       │   └── gateway.js     passerelle unique + cache par utilisateur
│       ├── modules/         un dossier par domaine métier
│       └── routes/          assemblage de l'API
└── frontend/                React + TypeScript + Vite + Tailwind
    └── src/
        ├── lib/             client HTTP, authentification, thème, formats
        ├── components/      bibliothèque d'interface et graphiques
        └── pages/           un écran par module
```

### L'abstraction « provider »

Tout le code métier ignore d'où viennent les données. Un provider expose un contrat
unique (`getProfil`, `getEmploiDuTemps`, `getNotes`, `getDevoirs`…) et deux
implémentations existent :

- **`ecoledirecte`** — client de l'API réelle, avec rotation du jeton à chaque appel
  et prise en charge de la double authentification par QCM ;
- **`demo`** — jeu de données fictives, déterministe, calé pour que la date du jour
  tombe toujours sur un jour de cours.

Ajouter un autre ENT revient donc à écrire un seul fichier.

La passerelle (`providers/gateway.js`) place un cache par utilisateur devant chaque
ressource et, si la source distante tombe, **sert la dernière valeur connue plutôt
que d'échouer** : l'ENT reste consultable.

---

## Installation

### Prérequis

- Node.js 20 ou plus
- PostgreSQL 13 ou plus (`gen_random_uuid()` est natif depuis la 13)

### Démarrage rapide

```bash
git clone https://github.com/kiy0ni/edu-flow.git
cd edu-flow
npm install

# Base de données
createdb eduflow

# Configuration de l'API
cp backend/.env.example backend/.env
# puis renseignez au minimum DATABASE_URL, JWT_SECRET et ENCRYPTION_KEY :
#   openssl rand -hex 48   → JWT_SECRET
#   openssl rand -hex 32   → ENCRYPTION_KEY

npm run migrate      # applique les migrations SQL
npm run dev          # API sur :4000, interface sur :5173
```

Rendez-vous sur <http://localhost:5173> et cliquez sur **« Explorer avec un compte de
démonstration »** (ou connectez-vous avec `demo` / `demo`).

### Avec Docker

```bash
cp .env.example .env     # renseignez JWT_SECRET et ENCRYPTION_KEY
docker compose up --build
```

L'interface est servie sur <http://localhost:8080>, l'API sur le port 4000.

---

## Configuration

Les variables sont validées au démarrage : une configuration incomplète arrête le
serveur avec un message explicite plutôt que de produire des erreurs à l'exécution.

| Variable | Rôle | Défaut |
|---|---|---|
| `DATABASE_URL` | Connexion PostgreSQL | *(requis)* |
| `JWT_SECRET` | Signature des jetons d'accès | *(requis)* |
| `ENCRYPTION_KEY` | Clé AES-256 (64 caractères hex) chiffrant les jetons amont | *(requis en production)* |
| `CORS_ORIGINS` | Origines autorisées, séparées par des virgules | `http://localhost:5173` |
| `ALLOW_DEMO_ACCOUNTS` | Autorise le compte de démonstration | `true` |
| `ANTHROPIC_API_KEY` | Active l'assistant. **Sans clé, tout le reste fonctionne.** | *(vide)* |
| `AI_MODEL` | Modèle utilisé | `claude-opus-5` |
| `AI_DAILY_MESSAGE_LIMIT` | Quota d'assistant par utilisateur et par jour | `80` |

---

## Sécurité

- Le mot de passe d'établissement **n'est jamais stocké**. Il sert uniquement à ouvrir
  la session auprès de la source, puis est oublié.
- Le jeton renvoyé par l'établissement est **chiffré au repos** (AES-256-GCM) et
  renouvelé automatiquement à chaque appel, comme l'exige l'API amont.
- L'authentification repose sur un jeton d'accès court en mémoire et un jeton de
  rafraîchissement en cookie `httpOnly`, **avec rotation** : un jeton réutilisé est
  refusé et la session close.
- Les routes de connexion sont protégées contre le bourrage d'identifiants, l'API est
  limitée en débit, et les en-têtes de sécurité usuels sont posés.
- Toutes les entrées sont validées par schéma ; toutes les requêtes SQL sont
  paramétrées.

---

## L'assistant IA

L'assistant est **facultatif et cloisonné**. Sans `ANTHROPIC_API_KEY`, les routes
concernées répondent proprement et l'interface indique que la fonction est inactive :
le planificateur, la répétition espacée et les analyses n'en dépendent pas.

Quand il est actif :

- le contexte transmis est un **résumé factuel et compact** des données de l'élève, et
  non un déversement de JSON ;
- le prompt système est stable et mis en cache, ce qui réduit nettement le coût des
  échanges suivants ;
- les générations structurées (fiche, quiz, cartes, brief) sont contraintes par un
  schéma, ce qui supprime l'analyse fragile de texte libre ;
- un quota quotidien par utilisateur borne la dépense.

---

## Conception de l'interface

- **Thème clair et sombre**, le sombre étant *choisi* pas à pas et non déduit par
  inversion. Le choix de l'utilisateur l'emporte sur le réglage du système.
- **Couleurs de matières** : douze teintes, ordonnées pour maximiser leur séparation
  deux à deux, y compris pour les daltonismes courants (pire écart CVD mesuré 10,1 en
  clair et 9,6 en sombre, pour une cible de 8). Elles ne sont jamais le seul support
  d'information : le nom de la matière est toujours affiché.
- **Graphiques** : les séries n'utilisent pas les teintes de matières mais une palette
  dédiée à deux entrées (l'élève / la classe), validée séparément pour les deux thèmes.
  La couleur d'état (charge de travail) provient d'une palette de statut distincte,
  toujours accompagnée d'une légende écrite.
- **Découpage par route** : la bibliothèque de graphiques n'est chargée que sur les
  écrans qui en affichent.
- **Densité maîtrisée** : les chiffres clés tiennent dans une bande compacte plutôt
  qu'une rangée de grandes tuiles, un seul graphique est visible à la fois, et le
  détail chiffré se déplie à la demande. Chaque écran affiche trois ou quatre blocs,
  pas dix.
- **Mouvement au service de l'usage** : un jeu restreint de sept animations, toutes
  entre 120 et 280 ms, qui expliquent d'où vient un élément ou ce qui vient de
  changer — transition de page, entrée échelonnée des listes, chiffres qui défilent
  jusqu'à leur valeur, barres de progression animées, retour tactile sur les
  commandes. L'ensemble est neutralisé par `prefers-reduced-motion`.
- **Aucun cul-de-sac** : chaque écran vide où une action a du sens en propose une, et
  les modules se renvoient la main — un justificatif d'absence ouvre un message
  pré-rempli à la vie scolaire, un cours ouvre le travail lié et un message à
  l'enseignant.

---

## Développement

```bash
npm run dev          # API + interface
npm run dev:api      # API seule (rechargement à chaud)
npm run dev:web      # interface seule
npm run migrate      # applique les migrations en attente
npm test             # tests unitaires du backend
npm run build        # build de production de l'interface
```

### Ajouter une migration

Déposez un fichier `backend/src/db/migrations/NNN_description.sql`. Elles sont
appliquées dans l'ordre alphabétique, chacune dans une transaction, et le suivi est
tenu dans la table `schema_migrations`. Les migrations sont rejouées automatiquement
au démarrage du serveur.

### Ajouter une source de données

1. Créez `backend/src/providers/<nom>/provider.js` respectant le contrat de
   `providers/demo/provider.js`.
2. Déclarez-le dans `providers/index.js`.

Aucun autre fichier n'est à modifier.

---

## API

Toutes les routes sont préfixées par `/api/v1`. Hors `/auth/*`, elles exigent un
en-tête `Authorization: Bearer <jeton>`.

| Méthode | Route | Rôle |
|---|---|---|
| `POST` | `/auth/login` | Connexion (`source` : `ecoledirecte` ou `demo`) |
| `POST` | `/auth/double-auth` | Réponse au QCM de double authentification |
| `POST` | `/auth/refresh` | Rotation du jeton de session |
| `GET` | `/accueil` | Agrégat de l'écran d'accueil |
| `GET` | `/emploi-du-temps` | Semaine, bornes horaires et synthèse |
| `GET` | `/emploi-du-temps/export.ics` | Export iCalendar |
| `GET` | `/emploi-du-temps/creneaux-libres` | Créneaux exploitables pour travailler |
| `GET` | `/notes` · `/notes/synthese` | Notes, moyennes, évolution |
| `POST` | `/notes/simulation` · `/notes/objectif` | Simulateur et calcul inverse |
| `GET` | `/devoirs` · `/devoirs/charge` | Devoirs et charge de travail |
| `PATCH` | `/devoirs/:id` | État local d'un devoir |
| `GET` | `/vie-scolaire` · `/actualites` | Services d'établissement |
| `GET/POST` | `/messagerie` · `/messagerie/destinataires` | Dossiers et rédaction |
| `POST` | `/messagerie/:id/lu` · `/favori` · `/archiver` · `/restaurer` | Actions sur un message |
| `GET` | `/documents` · `/documents/:id/telecharger` | Documents et production du PDF |
| `GET` | `/notifications` | Notifications (détection incluse) |
| `GET/POST` | `/planificateur` · `/planificateur/generer` | Plan de révisions |
| `GET/POST` | `/revisions` · `/revisions/revision` | Paquets et file du jour |
| `POST` | `/revisions/cartes/:id/reviser` | Notation SM-2 |
| `GET/POST` | `/concentration` | Sessions de travail |
| `GET` | `/analyses` | Constats, levier, projection, série et bilan hebdomadaire |
| `GET/PUT/DELETE` | `/objectifs` | Objectifs de moyenne et note nécessaire |
| `GET` | `/recherche?q=` | Recherche transversale |
| `POST` | `/assistant/chat` | Discussion en flux (SSE) |
| `POST` | `/assistant/fiche` · `/quiz` · `/cartes` · `/brief` | Générations structurées |
| `GET` | `/capacites` | Ce que sait faire l'instance |
| `GET` | `/sante` | Sonde de disponibilité |

---

## Compte de démonstration

`demo` / `demo` — Anastasia Moreau, Terminale G2 au lycée Marie Curie.

Les données sont **entièrement fictives et générées de façon déterministe** : une
année scolaire complète — emploi du temps, plus de cent notes réparties sur trois
trimestres, plus de deux cents entrées de cahier de textes, vie scolaire, quinze
messages rédigés, documents téléchargeables et huit actualités.

Le calendrier est calé pour que **la semaine ouverte à la connexion, ainsi que la
suivante, soient entièrement travaillées**, quelle que soit la date réelle — y
compris en pleine période de vacances.

---

## Licence

MIT — voir [LICENSE](LICENSE).
