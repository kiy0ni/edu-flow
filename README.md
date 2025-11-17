# EduFlow (Back-End)

API back-end pour un projet (non-terminé) de refonte de l'interface et des fonctionnalités de la plateforme "Ecole Directe".

Ce dépôt contient uniquement le code de l'API (Node.js).

---

## 🛠️ Technologies Utilisées

* **Serveur :** Node.js, Express.js
* **Base de données :** PostgreSQL (via `node-postgres` - *à confirmer*)
* **Authentification :** JSON Web Tokens (JWT)
* **Conteneurisation :** Docker, Docker Compose
* **Autres :** `cors`, `bcrypt` (probable), `dotenv`

---

## Installation et Lancement

Ce projet utilise `docker-compose` pour simplifier le lancement de l'API et de la base de données.

### 1. Prérequis

* [Node.js](https://nodejs.org/) (v18+)
* [Docker](https://www.docker.com/products/docker-desktop/)

### 2. Configuration

1.  Clonez le dépôt :
    ```bash
    git clone [https://github.com/KiyOni/EduFlow.git](https://github.com/KiyOni/EduFlow.git)
    cd EduFlow/backend
    ```

2.  Créez votre fichier d'environnement local. Copiez le modèle :
    ```bash
    cp .env.example .env
    ```

3.  **Modifiez le fichier `.env`** et remplissez les variables (mots de passe de la DB, clé JWT, etc.).

### 3. Lancement (Méthode Docker - Recommandée)

1.  À la racine du dossier `backend` :
    ```bash
    docker-compose up --build
    ```
2.  L'API sera accessible sur `http://localhost:3000` (ou le port défini dans votre `.env`).

### 4. Lancement (Méthode Locale/Classique)

1.  Assurez-vous d'avoir une base de données PostgreSQL qui tourne localement.
2.  Installez les dépendances :
    ```bash
    npm install
    ```
3.  Lancez le serveur :
    ```bash
    npm start
    ```

---

## API Endpoints (Exemples)

* `POST /api/login` : Connexion de l'utilisateur.
* `GET /api/user` : Récupère les informations de l'utilisateur (protégé).
* `PUT /api/user` : Met à jour les informations.