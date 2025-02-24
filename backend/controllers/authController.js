const apiClient = require("../config/ecoleDirecte");
const { generateToken } = require("../config/jwt");
const {
  createUser,
  getUserById,
  updateEcoleDirecteToken,
  updateUserInfo,
  updateUserPassword
} = require("../models/User");

/**
 * Connexion via École Directe et stockage de l'utilisateur en DB
 */
exports.login = async (req, res) => {
  const { identifiant, motdepasse } = req.body;

  if (!identifiant || !motdepasse) {
    return res.status(400).json({ message: "Identifiant et mot de passe requis." });
  }

  try {
    // Appel à l'API École Directe en version mobile (v3)
    const response = await apiClient.post(
      "/v3/login.awp?verbe=post",
      `data=${encodeURIComponent(JSON.stringify({
        identifiant,
        motdepasse,
        isRelogin: false,
        uuid: ""
      }))}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36"
        }
      }
    );

    // Pour le débogage, affichons la réponse complète
    console.log("Réponse de l'API d'École Directe:", response.data);

    const { token, data } = response.data;

    if (!data) {
      return res.status(401).json({
        message: "Réponse inattendue de l'API.",
        rawResponse: response.data
      });
    }

    // Gérer le cas où l'objet utilisateur peut être dans data.accounts ou directement dans data
    const userData = data.accounts ? data.accounts[0] : data;

    if (!userData || !token) {
      return res.status(401).json({
        message: "Identifiants invalides ou réponse inattendue.",
        rawResponse: response.data
      });
    }

    // Récupérer le téléphone depuis profile.telPortable (s'il existe)
    const phone = userData.profile && userData.profile.telPortable ? userData.profile.telPortable : null;

    // Utilisation de la DB : Création ou mise à jour de l'utilisateur
    // On passe : id, email, prénom, nom, nom d'utilisateur, mot de passe (donné en entrée) et le téléphone
    await createUser(userData.id, userData.email, userData.prenom, userData.nom, userData.identifiant, motdepasse, phone);
    await updateEcoleDirecteToken(userData.id, token);

    // Générer un JWT incluant les infos nécessaires pour la session
    const jwtToken = generateToken({
      id: userData.id,
      email: userData.email,
      ecoleDirecteToken: token,
      uuid: userData.uid,
      typeCompte: userData.typeCompte,
      accesstoken: token
    });

    res.json({ jwtToken, ecoleDirecteToken: token, userData });
  } catch (error) {
    console.error("Erreur de connexion:", error);
    res.status(400).json({ 
      message: "Échec de la connexion.",
      error: error.response?.data || error.message 
    });
  }
};

/**
 * Récupérer les informations du compte
 * Utilise la DB pour récupérer les informations de l'utilisateur
 */
exports.getUserInfo = async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Token invalide." });
  }

  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    res.json({
      username: user.username || `${user.prenom} ${user.nom}`,
      email: user.email,
      phone: user.phone || "Non renseigné"
    });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur.", error: error.message });
  }
};


/**
 * Modifier les informations de l'utilisateur (nom complet, email, téléphone)
 * Utilise la DB pour mettre à jour ces informations
 */
exports.updateUserInfo = async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Token invalide." });
  }

  const { username, email, phone } = req.body;

  try {
    await updateUserInfo(req.user.id, username, email, phone);
    res.json({ message: "Informations mises à jour avec succès." });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la mise à jour.", error: error.message });
  }
};

/**
 * Modifier le mot de passe
 * Utilise la DB pour mettre à jour le mot de passe utilisateur
 */
exports.updatePassword = async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Token invalide." });
  }

  const { newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Les mots de passe ne correspondent pas." });
  }

  try {
    await updateUserPassword(req.user.id, newPassword);
    res.json({ message: "Mot de passe mis à jour avec succès." });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la mise à jour.", error: error.message });
  }
};
