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
      try {
        const serviceAccount = require('./serviceAccountKey.json');
        
        // Validate service account structure
        if (!serviceAccount.type || !serviceAccount.project_id || !serviceAccount.private_key_id) {
          throw new Error('Invalid service account structure');
        }
        
        // Check if private key is valid
        if (!serviceAccount.private_key || serviceAccount.private_key.length < 100) {
          throw new Error('Invalid private key in service account');
        }
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: 'arcularplus-7e66c.appspot.com'
        });
        console.log('✅ Firebase Admin SDK initialized with service account');
        
        // Test the credentials by trying to list users
        admin.auth().listUsers(1).then(() => {
          console.log('✅ Firebase Admin credentials verified successfully');
        }).catch((credError) => {
          console.error('❌ Firebase Admin credentials verification failed:', credError.message);
          console.log('🔄 Attempting to reinitialize with default credentials...');
          
          // Remove the failed app and try default credentials
          admin.app().delete();
          admin.initializeApp({
            projectId: 'arcularplus-7e66c'
          });
          console.log('✅ Firebase Admin SDK reinitialized with default credentials');
        });
        
      } catch (serviceAccountError) {
        console.error('❌ Service account key error:', serviceAccountError.message);
        console.log('🔄 Falling back to default credentials...');
        
        // Fallback to default credentials
        admin.initializeApp({
          projectId: 'arcularplus-7e66c'
        });
        console.log('✅ Firebase Admin SDK initialized with default credentials (fallback)');
      }
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

// Test Firebase Admin connectivity
async function testFirebaseConnection() {
  try {
    if (admin.apps.length === 0) {
      return { success: false, error: 'Firebase Admin not initialized' };
    }
    
    // Try to list users (this will test the credentials)
    const result = await admin.auth().listUsers(1);
    
    // Test Firebase Storage if available
    let storageAvailable = false;
    try {
      const bucket = admin.storage().bucket();
      storageAvailable = true;
    } catch (storageError) {
      console.warn('⚠️ Firebase Storage not available:', storageError.message);
    }
    
    return { 
      success: true, 
      message: 'Firebase Admin working correctly',
      userCount: result.users.length,
      storageAvailable
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      code: error.code,
      suggestion: getSuggestionForError(error)
    };
  }
}

// Get helpful suggestions based on error codes
function getSuggestionForError(error) {
  if (error.code === 'app/no-app') {
    return 'Firebase Admin not initialized. Check server logs.';
  } else if (error.code === 'auth/invalid-credential') {
    return 'Service account credentials are invalid. Generate a new service account key from Firebase Console.';
  } else if (error.code === 'auth/network-error') {
    return 'Network error. Check internet connection and Firebase project settings.';
  } else if (error.message.includes('Invalid JWT Signature')) {
    return 'Service account key is expired or revoked. Generate a new key from Firebase Console > Project Settings > Service Accounts.';
  } else if (error.message.includes('invalid_grant')) {
    return 'Service account key is invalid. Generate a new key from Firebase Console > Project Settings > Service Accounts.';
  } else if (error.message.includes('storage is not a function')) {
    return 'Firebase Storage not available. Check if Firebase Storage is enabled in your project.';
  }
  return 'Unknown error. Check Firebase project configuration.';
}

// Check if Firebase Storage is available
function isStorageAvailable() {
  try {
    if (admin.apps.length === 0) return false;
    const bucket = admin.storage().bucket();
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = { admin, testFirebaseConnection, isStorageAvailable };
