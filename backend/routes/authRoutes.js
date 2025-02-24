const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/auth");

// Endpoint de connexion (login)
router.post("/login", authController.login);

// Endpoint pour récupérer les infos de l'utilisateur (protégé par JWT)
router.get("/user", authMiddleware, authController.getUserInfo);

// Endpoint pour mettre à jour les infos de l'utilisateur
router.put("/user", authMiddleware, authController.updateUserInfo);

// Endpoint pour changer le mot de passe
router.put("/user/password", authMiddleware, authController.updatePassword);

module.exports = router;
