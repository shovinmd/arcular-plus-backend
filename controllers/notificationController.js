const Notification = require('../models/Notification');
const { admin } = require('../firebase');

// In-memory store for demo; replace with DB in production
const userDeviceTokens = {};

exports.getNotificationsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await Notification.find({ userId });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.sendNotification = async (req, res) => {
  const { token, title, body } = req.body;
  const message = {
    notification: { title, body },
    token,
  };
  try {
    await admin.messaging().send(message);
    res.status(200).send('Notification sent');
  } catch (err) {
    res.status(500).send(err);
  }
};

exports.verifyFirebaseToken = async (req, res) => {
  const { idToken } = req.body;
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    res.status(200).json({ uid: decodedToken.uid });
  } catch (err) {
    res.status(401).send('Invalid token');
  }
};

exports.registerDeviceToken = async (req, res) => {
  const { userId, token } = req.body;
  if (!userId || !token) {
    return res.status(400).json({ error: 'userId and token are required' });
  }
  userDeviceTokens[userId] = token;
  res.status(200).json({ success: true, message: 'Device token registered', token });
}; 