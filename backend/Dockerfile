# Utilise l'image Node.js officielle
FROM node:18

# Crée le dossier de l'app
WORKDIR /usr/src/app

# Copie le package.json et package-lock.json
COPY package*.json ./

# Installe les dépendances
RUN npm install

# Copie le reste du code
COPY . .

# Expose le port (celui défini dans index.js)
EXPOSE 3000

# Démarre l'application
CMD [ "npm", "start" ]
