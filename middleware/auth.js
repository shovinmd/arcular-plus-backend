// node_backend/middleware/auth.js
const admin = require('../firebase'); // <-- use the initialized admin

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

module.exports = authenticateToken;
