const pool = require('./db');

const createUsersTableQuery = `
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) UNIQUE,
  prenom VARCHAR(255) NOT NULL,
  nom VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  motdepasse VARCHAR(255),
  role VARCHAR(50) NOT NULL,
  date_inscription TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  phone VARCHAR(20),
  "ecoleDirecteToken" VARCHAR(255)
);
`;

async function initDB() {
  try {
    await pool.query(createUsersTableQuery);
    console.log("Table 'users' est prête.");
  } catch (err) {
    console.error("Erreur lors de l'initialisation de la DB:", err);
  }
}

module.exports = initDB;
