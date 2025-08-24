// node_backend/firebase.js
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Check if Firebase Admin is already initialized
if (!admin.apps.length) {
  try {
    // Try to use service account key if it exists
    const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require('./serviceAccountKey.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: 'arcularplus-7e66c.appspot.com'
      });
      console.log('✅ Firebase Admin SDK initialized with service account');
    } else {
      // Use default credentials (for production environments like Render)
      admin.initializeApp({
        projectId: 'arcularplus-7e66c'
      });
      console.log('✅ Firebase Admin SDK initialized with default credentials');
    }
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialization failed:', error);
    // Fallback initialization
    try {
      admin.initializeApp({
        projectId: 'arcularplus-7e66c'
      });
      console.log('✅ Firebase Admin SDK initialized with fallback method');
    } catch (fallbackError) {
      console.error('❌ Firebase Admin SDK fallback initialization also failed:', fallbackError);
    }
  }
}

module.exports = admin;
