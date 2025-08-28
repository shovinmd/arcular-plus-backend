const admin = require('firebase-admin');
const User = require('../models/User');
const MenstrualCycle = require('../models/MenstrualCycle');

class FCMService {
  constructor() {
    this.messaging = admin.messaging();
  }

  // Send notification to a single user
  async sendToUser(userId, notification) {
    try {
      const user = await User.findOne({ uid: userId });
      if (!user || !user.fcmToken) {
        console.log(`❌ User ${userId} not found or no FCM token`);
        return false;
      }

      const message = {
        token: user.fcmToken,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          type: notification.type || 'general',
          screen: notification.screen || 'home',
          ...notification.data
        },
        android: {
          notification: {
            channelId: 'menstrual-reminders',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await this.messaging.send(message);
      console.log(`✅ FCM notification sent to user ${userId}: ${response}`);
      return true;
    } catch (error) {
      console.error(`❌ Error sending FCM to user ${userId}:`, error);
      return false;
    }
  }

  // Send notification to multiple users
  async sendToMultipleUsers(userIds, notification) {
    try {
      const users = await User.find({ uid: { $in: userIds } });
      const validTokens = users
        .filter(user => user.fcmToken)
        .map(user => user.fcmToken);

      if (validTokens.length === 0) {
        console.log('❌ No valid FCM tokens found');
        return false;
      }

      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          type: notification.type || 'general',
          screen: notification.screen || 'home',
          ...notification.data
        },
        android: {
          notification: {
            channelId: 'menstrual-reminders',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await this.messaging.sendMulticast({
        tokens: validTokens,
        ...message,
      });

      console.log(`✅ FCM multicast sent: ${response.successCount}/${validTokens.length} successful`);
      return response.successCount > 0;
    } catch (error) {
      console.error('❌ Error sending FCM multicast:', error);
      return false;
    }
  }

  // Send topic-based notification
  async sendToTopic(topic, notification) {
    try {
      const message = {
        topic: topic,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          type: notification.type || 'general',
          screen: notification.screen || 'home',
          ...notification.data
        },
        android: {
          notification: {
            channelId: 'menstrual-reminders',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await this.messaging.send(message);
      console.log(`✅ FCM topic notification sent to ${topic}: ${response}`);
      return true;
    } catch (error) {
      console.error(`❌ Error sending FCM topic to ${topic}:`, error);
      return false;
    }
  }

  // Subscribe user to topic
  async subscribeToTopic(tokens, topic) {
    try {
      const response = await this.messaging.subscribeToTopic(tokens, topic);
      console.log(`✅ Subscribed ${tokens.length} tokens to topic ${topic}: ${response.successCount} successful`);
      return response.successCount > 0;
    } catch (error) {
      console.error(`❌ Error subscribing to topic ${topic}:`, error);
      return false;
    }
  }

  // Unsubscribe user from topic
  async unsubscribeFromTopic(tokens, topic) {
    try {
      const response = await this.messaging.unsubscribeFromTopic(tokens, topic);
      console.log(`✅ Unsubscribed ${tokens.length} tokens from topic ${topic}: ${response.successCount} successful`);
      return response.successCount > 0;
    } catch (error) {
      console.error(`❌ Error unsubscribing from topic ${topic}:`, error);
      return false;
    }
  }

  // Update user's FCM token
  async updateFCMToken(userId, fcmToken) {
    try {
      const result = await User.findOneAndUpdate(
        { uid: userId },
        { fcmToken: fcmToken },
        { new: true }
      );
      
      if (result) {
        console.log(`✅ FCM token updated for user ${userId}`);
        return true;
      } else {
        console.log(`❌ User ${userId} not found for FCM token update`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error updating FCM token for user ${userId}:`, error);
      return false;
    }
  }

  // Remove user's FCM token
  async removeFCMToken(userId) {
    try {
      const result = await User.findOneAndUpdate(
        { uid: userId },
        { $unset: { fcmToken: 1 } },
        { new: true }
      );
      
      if (result) {
        console.log(`✅ FCM token removed for user ${userId}`);
        return true;
      } else {
        console.log(`❌ User ${userId} not found for FCM token removal`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error removing FCM token for user ${userId}:`, error);
      return false;
    }
  }
}

module.exports = new FCMService();
