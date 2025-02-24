const jwt = require("jsonwebtoken");
const secret = process.env.JWT_SECRET || "ton_jwt_secret";

function generateToken(payload) {
  return jwt.sign(payload, secret, { expiresIn: "1h" });
}

function verifyToken(token) {
  return jwt.verify(token, secret);
}

module.exports = { generateToken, verifyToken };
