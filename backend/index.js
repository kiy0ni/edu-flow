require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const initDB = require("./initDB");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Monter les routes d'authentification
app.use("/api", authRoutes);

// Page d'accueil
app.get("/", (req, res) => {
  res.send("Bienvenue sur l'API EduFlow");
});

// Initialiser la DB avant de démarrer le serveur
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
  });
});
