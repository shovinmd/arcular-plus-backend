// node_backend/firebase.js
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

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
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      // Use service account from environment variable
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: 'arcularplus-7e66c.appspot.com'
        });
        console.log('✅ Firebase Admin SDK initialized with environment service account');
      } catch (parseError) {
        console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', parseError);
        throw parseError;
      }
    } else {
      // Use default credentials (for production environments like Render)
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'arcularplus-7e66c'
      });
      console.log('✅ Firebase Admin SDK initialized with default credentials');
    }
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialization failed:', error);
    // Final fallback initialization
    try {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'arcularplus-7e66c'
      });
      console.log('✅ Firebase Admin SDK initialized with final fallback method');
    } catch (fallbackError) {
      console.error('❌ Firebase Admin SDK final fallback initialization also failed:', fallbackError);
      console.error('🚨 Firebase Admin SDK cannot be initialized. Staff creation will fail!');
    }
  }
}

module.exports = admin;
