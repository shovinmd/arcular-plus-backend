// node_backend/middleware/firebaseAuthMiddleware.js
const { admin } = require('../firebase');

module.exports = async function (req, res, next) {
  console.log('🔐 Firebase auth middleware - URL:', req.url);
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ No authorization header or invalid format');
    return res.status(401).json({ message: 'No token provided' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  console.log('🔑 Token received, length:', idToken ? idToken.length : 0);
  // DEV ONLY: print token if explicitly enabled via env flag
  if (process.env.DEBUG_PRINT_TOKENS === 'true') {
    console.log('🔑 Bearer token (DEV):', idToken);
  }
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log('✅ Token verified for user:', decodedToken.email);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    return res.status(401).json({ message: 'Invalid or expired token', error: error.message });
  }
}; 
