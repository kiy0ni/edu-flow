const pool = require("../db");
const bcrypt = require("bcrypt");

const saltRounds = 10;

/**
 * Crée ou met à jour un utilisateur en DB.
 * On enregistre : id, email, prénom, nom, username, motdepasse et phone.
 */
async function createUser(id, email, prenom, nom, username, motdepasse, phone) {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT * FROM users WHERE id = $1", [id]);
    const hashedPassword = await bcrypt.hash(motdepasse, saltRounds);
    if (res.rows.length === 0) {
      // Insertion d'un nouvel utilisateur avec le rôle par défaut "eleve"
      await client.query(
        "INSERT INTO users (id, prenom, nom, email, username, motdepasse, role, phone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [id, prenom, nom, email, username, hashedPassword, "eleve", phone]
      );
    } else {
      // Mise à jour de l'utilisateur existant
      await client.query(
        "UPDATE users SET email = $2, prenom = $3, nom = $4, username = $5, motdepasse = $6, phone = $7 WHERE id = $1",
        [id, email, prenom, nom, username, hashedPassword, phone]
      );
    }
  } finally {
    client.release();
  }
}

async function getUserById(id) {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT * FROM users WHERE id = $1", [id]);
    return res.rows[0];
  } finally {
    client.release();
  }
}

async function updateEcoleDirecteToken(id, token) {
  const client = await pool.connect();
  try {
    await client.query('UPDATE users SET "ecoleDirecteToken" = $2 WHERE id = $1', [id, token]);
  } finally {
    client.release();
  }
}

/**
 * Mise à jour des informations utilisateur.
 * On met à jour : prénom, nom, email, phone et username.
 */
async function updateUserInfo(id, name, email, phone, username) {
  // On suppose que "name" est le nom complet ; on le sépare en prénom et nom.
  let prenom = "";
  let nom = "";
  const parts = name.split(" ");
  if (parts.length >= 2) {
    prenom = parts[0];
    nom = parts.slice(1).join(" ");
  } else {
    prenom = name;
  }
  const client = await pool.connect();
  try {
    await client.query(
      "UPDATE users SET prenom = $2, nom = $3, email = $4, phone = $5, username = $6 WHERE id = $1",
      [id, prenom, nom, email, phone, username]
    );
  } finally {
    client.release();
  }
}

async function updateUserPassword(id, newPassword) {
  const client = await pool.connect();
  try {
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    await client.query("UPDATE users SET motdepasse = $2 WHERE id = $1", [id, hashedPassword]);
  } finally {
    client.release();
  }
}

module.exports = {
  createUser,
  getUserById,
  updateEcoleDirecteToken,
  updateUserInfo,
  updateUserPassword
};
