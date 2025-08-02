// node_backend/firebase.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Download from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'arcularplus-7e66c.appspot.com'
});

module.exports = admin;
