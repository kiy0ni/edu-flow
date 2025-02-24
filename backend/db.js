const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://username:password@localhost:5432/eduflow"
});

module.exports = pool;
