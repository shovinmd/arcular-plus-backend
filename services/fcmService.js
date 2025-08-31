const admin = require('firebase-admin');
const User = require('../models/User');
const MenstrualCycle = require('../models/MenstrualCycle');

class FCMService {
  constructor() {
    this.messaging = null;
    this.isInitialized = false;
    this.initialize();
  }

  // Initialize Firebase Admin for FCM
  async initialize() {
    try {
      if (this.isInitialized) {
        console.log('✅ FCM Service already initialized');
        return;
      }

      // Check if Firebase Admin is properly initialized
      if (!admin.apps.length) {
        console.log('⚠️ Firebase Admin not initialized, waiting...');
        // Wait a bit for Firebase Admin to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (admin.apps.length > 0) {
        this.messaging = admin.messaging();
        this.isInitialized = true;
        console.log('✅ FCM Service initialized successfully');
        
        // Test FCM connectivity
        await this.testFCMConnection();
      } else {
        console.error('❌ Firebase Admin not available for FCM');
        this.isInitialized = false;
      }
    } catch (error) {
      console.error('❌ Error initializing FCM Service:', error);
      this.isInitialized = false;
    }
  }

  // Test FCM connection
  async testFCMConnection() {
    try {
      if (!this.messaging) {
        console.log('⚠️ FCM messaging not available');
        return false;
      }

      // Try to get FCM app info
      const app = admin.app();
      console.log(`✅ FCM connected to project: ${app.options.projectId}`);
      return true;
    } catch (error) {
      console.error('❌ FCM connection test failed:', error);
      return false;
    }
  }

  // Send notification to a single user
  async sendToUser(userId, notification) {
    try {
      // Ensure FCM is initialized
      if (!this.isInitialized || !this.messaging) {
        console.log('⚠️ FCM not initialized, attempting to initialize...');
        await this.initialize();
        
        if (!this.isInitialized || !this.messaging) {
          console.error('❌ FCM still not available after initialization attempt');
          return false;
        }
      }

      const user = await User.findOne({ uid: userId });
      if (!user || !user.fcmToken) {
        console.log(`❌ User ${userId} not found or no FCM token`);
        return false;
      }

      console.log(`📱 Sending FCM to user ${userId} with token: ${user.fcmToken.substring(0, 20)}...`);

      const message = {
        token: user.fcmToken,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          type: notification.type || 'general',
          screen: notification.screen || 'home',
          userId: userId,
          timestamp: new Date().toISOString(),
          ...notification.data
        },
        android: {
          notification: {
            channelId: 'menstrual-reminders',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
            icon: 'notify_icon',
            color: '#FF69B4',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              alert: {
                title: notification.title,
                body: notification.body,
              },
            },
          },
        },
        webpush: {
          notification: {
            title: notification.title,
            body: notification.body,
            icon: '/notify_icon.jpg',
            badge: '/notify_icon.jpg',
            tag: 'menstrual-reminder',
            requireInteraction: true,
          },
        },
      };

      const response = await this.messaging.send(message);
      console.log(`✅ FCM notification sent to user ${userId}: ${response}`);
      
      // Log successful notification
      await this.logNotification(userId, notification, true, response);
      
      return true;
    } catch (error) {
      console.error(`❌ Error sending FCM to user ${userId}:`, error);
      
      // Log failed notification
      await this.logNotification(userId, notification, false, error.message);
      
      // If it's an FCM token error, remove the invalid token
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered') {
        console.log(`🔄 Removing invalid FCM token for user ${userId}`);
        await this.removeFCMToken(userId);
      }
      
      return false;
    }
  }

  // Send notification to multiple users
  async sendToMultipleUsers(userIds, notification) {
    try {
      if (!this.isInitialized || !this.messaging) {
        console.log('⚠️ FCM not initialized, attempting to initialize...');
        await this.initialize();
        
        if (!this.isInitialized || !this.messaging) {
          console.error('❌ FCM still not available after initialization attempt');
          return false;
        }
      }

      const users = await User.find({ uid: { $in: userIds } });
      const validTokens = users
        .filter(user => user.fcmToken)
        .map(user => user.fcmToken);

      if (validTokens.length === 0) {
        console.log('❌ No valid FCM tokens found');
        return false;
      }

      console.log(`📱 Sending FCM multicast to ${validTokens.length} users`);

      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          type: notification.type || 'general',
          screen: notification.screen || 'home',
          timestamp: new Date().toISOString(),
          ...notification.data
        },
        android: {
          notification: {
            channelId: 'menstrual-reminders',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
            icon: 'notify_icon',
            color: '#FF69B4',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              alert: {
                title: notification.title,
                body: notification.body,
              },
            },
          },
        },
        webpush: {
          notification: {
            title: notification.title,
            body: notification.body,
            icon: '/notify_icon.jpg',
            badge: '/notify_icon.jpg',
            tag: 'menstrual-reminder',
            requireInteraction: true,
          },
        },
      };

      const response = await this.messaging.sendMulticast({
        tokens: validTokens,
        ...message,
      });

      console.log(`✅ FCM multicast sent: ${response.successCount}/${validTokens.length} successful`);
      
      // Log results
      if (response.failureCount > 0) {
        console.log(`⚠️ FCM failures: ${response.failureCount} tokens failed`);
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.log(`❌ Token ${idx} failed: ${resp.error?.message}`);
          }
        });
      }
      
      return response.successCount > 0;
    } catch (error) {
      console.error('❌ Error sending FCM multicast:', error);
      return false;
    }
  }

  // Send topic-based notification
  async sendToTopic(topic, notification) {
    try {
      if (!this.isInitialized || !this.messaging) {
        console.log('⚠️ FCM not initialized, attempting to initialize...');
        await this.initialize();
        
        if (!this.isInitialized || !this.messaging) {
          console.error('❌ FCM still not available after initialization attempt');
          return false;
        }
      }

      const message = {
        topic: topic,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          type: notification.type || 'general',
          screen: notification.screen || 'home',
          timestamp: new Date().toISOString(),
          ...notification.data
        },
        android: {
          notification: {
            channelId: 'menstrual-reminders',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
            icon: 'notify_icon',
            color: '#FF69B4',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              alert: {
                title: notification.title,
                body: notification.body,
              },
            },
          },
        },
        webpush: {
          notification: {
            title: notification.title,
            body: notification.body,
            icon: '/notify_icon.jpg',
            badge: '/notify_icon.jpg',
            tag: 'menstrual-reminder',
            requireInteraction: true,
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
      if (!this.isInitialized || !this.messaging) {
        console.log('⚠️ FCM not initialized, attempting to initialize...');
        await this.initialize();
        
        if (!this.isInitialized || !this.messaging) {
          console.error('❌ FCM still not available after initialization attempt');
          return false;
        }
      }

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
      if (!this.isInitialized || !this.messaging) {
        console.log('⚠️ FCM not initialized, attempting to initialize...');
        await this.initialize();
        
        if (!this.isInitialized || !this.messaging) {
          console.error('❌ FCM still not available after initialization attempt');
          return false;
        }
      }

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

  // Log notification attempts
  async logNotification(userId, notification, success, result) {
    try {
      const logEntry = {
        userId: userId,
        type: notification.type || 'general',
        title: notification.title,
        body: notification.body,
        success: success,
        result: result,
        timestamp: new Date(),
        data: notification.data || {}
      };

      // For now, just console log. You can extend this to save to database
      console.log(`📝 Notification Log: ${JSON.stringify(logEntry, null, 2)}`);
    } catch (error) {
      console.error('❌ Error logging notification:', error);
    }
  }

  // Get FCM service status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasMessaging: !!this.messaging,
      firebaseApps: admin.apps.length,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new FCMService();
