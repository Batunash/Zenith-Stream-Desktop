const authConfig = require('../config/auth');
const db = require('../config/database');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = authConfig.verifyToken(token);
    const user = db.getUserById(decoded.userId);

    if (!user) return res.status(401).json({ error: 'Invalid token' });

    req.user = { id: user.ID, username: user.USERNAME };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = authConfig.verifyToken(token);
      const user = db.getUserById(decoded.userId);
      if (user) {
        req.user = { id: user.ID, username: user.USERNAME };
      }
    } catch (error) {}
  }
  next();
}

module.exports = { authenticateToken, optionalAuth };
