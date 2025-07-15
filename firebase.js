// node_backend/firebase.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // <-- update path if needed

if (!admin.apps.length) { // Prevent re-initialization in dev/hot-reload
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
     databaseURL: "https://arcularplus-7e66c.firebaseio.com" 
  });
}

module.exports = admin;
