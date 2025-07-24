// node_backend/middleware/auth.js
const admin = require('../firebase');
const Staff = require('../models/Staff');

// Middleware: Authenticate Firebase ID token
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ error: 'No token provided' });
  }
  const idToken = authHeader.split(' ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).send({ error: 'Invalid token', details: error.message });
  }
}

// Middleware: Require superadmin role
async function requireSuperAdmin(req, res, next) {
  try {
    const firebaseUid = req.user.uid;
    const staff = await Staff.findOne({ firebaseUid });
    if (!staff || staff.role !== 'superadmin') {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { authenticateToken, requireSuperAdmin };
