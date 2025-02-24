const { verifyToken } = require("../config/jwt");

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const decoded = verifyToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ message: "Token invalide." });
    }
  } else {
    return res.status(401).json({ message: "Token manquant." });
  }
}

module.exports = authMiddleware;
