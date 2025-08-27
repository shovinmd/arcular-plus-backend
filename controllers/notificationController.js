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

exports.getUnreadNotificationsCount = async (req, res) => {
  try {
    const { userId } = req.params;
    const count = await Notification.countDocuments({ 
      userId, 
      read: false 
    });
    res.json({ count });
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
  const { userId, userType, token } = req.body;
  if (!userId || !userType || !token) {
    return res.status(400).json({ error: 'userId, userType, and token are required' });
  }
  
  // Store token with user type for better organization
  userDeviceTokens[userId] = {
    token,
    userType,
    registeredAt: new Date()
  };
  
  console.log(`✅ FCM: Device token registered for ${userType} user: ${userId}`);
  res.status(200).json({ 
    success: true, 
    message: 'Device token registered', 
    token,
    userType 
  });
};

// Send notification to specific user type
exports.sendNotificationToUserType = async (req, res) => {
  const { userType, title, body, data } = req.body;
  
  if (!userType || !title || !body) {
    return res.status(400).json({ error: 'userType, title, and body are required' });
  }
  
  try {
    // Find all users of the specified type
    const users = Object.entries(userDeviceTokens)
      .filter(([_, userData]) => userData.userType === userType)
      .map(([userId, userData]) => ({ userId, token: userData.token }));
    
    if (users.length === 0) {
      return res.status(404).json({ error: `No ${userType} users found with registered tokens` });
    }
    
    // Send notification to all users of the specified type
    const results = [];
    for (const user of users) {
      try {
        const message = {
          notification: { title, body },
          token: user.token,
          data: data || {},
        };
        
        await admin.messaging().send(message);
        results.push({ userId: user.userId, status: 'sent' });
        
        // Save notification to database
        await Notification.create({
          userId: user.userId,
          title,
          body,
          type: 'system',
          data: data || {},
          read: false
        });
        
      } catch (error) {
        console.error(`❌ FCM: Failed to send notification to user ${user.userId}:`, error);
        results.push({ userId: user.userId, status: 'failed', error: error.message });
      }
    }
    
    console.log(`✅ FCM: Sent notifications to ${userType} users. Results:`, results);
    res.status(200).json({ 
      success: true, 
      message: `Notifications sent to ${userType} users`,
      results 
    });
    
  } catch (error) {
    console.error('❌ FCM: Error sending notifications to user type:', error);
    res.status(500).json({ error: error.message });
  }
}; 