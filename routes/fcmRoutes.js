const express = require('express');
const router = express.Router();
const fcmService = require('../services/fcmService');
const menstrualReminderService = require('../services/menstrualReminderService');
const cronService = require('../services/cronService');
const { authenticateToken } = require('../middleware/auth');

// Register/Update FCM token for a user
router.post('/register-token', authenticateToken, async (req, res) => {
  try {
    const { fcmToken, notificationPreferences } = req.body;
    const userId = req.user.uid;

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        error: 'FCM token is required'
      });
    }

    // Update user's FCM token and notification preferences
    const success = await fcmService.updateFCMToken(userId, fcmToken);
    
    if (notificationPreferences) {
      // Update notification preferences in User model
      const User = require('../models/User');
      await User.findOneAndUpdate(
        { uid: userId },
        { 
          'notificationPreferences.menstrualReminders': notificationPreferences.menstrualReminders,
          'notificationPreferences.reminderTime': notificationPreferences.reminderTime,
          'notificationPreferences.timezone': notificationPreferences.timezone
        }
      );
    }

    if (success) {
      res.json({
        success: true,
        message: 'FCM token registered successfully',
        data: { userId, fcmToken }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to register FCM token'
      });
    }
  } catch (error) {
    console.error('❌ Error registering FCM token:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Remove FCM token for a user
router.delete('/remove-token', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const success = await fcmService.removeFCMToken(userId);

    if (success) {
      res.json({
        success: true,
        message: 'FCM token removed successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to remove FCM token'
      });
    }
  } catch (error) {
    console.error('❌ Error removing FCM token:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get upcoming reminders for a user
router.get('/upcoming-reminders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const reminders = await menstrualReminderService.getUpcomingReminders(userId);

    res.json({
      success: true,
      data: reminders
    });
  } catch (error) {
    console.error('❌ Error getting upcoming reminders:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Test FCM notification (for testing purposes)
router.post('/test-notification', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { title, body } = req.body;

    const notification = {
      title: title || '🧪 Test Notification',
      body: body || 'This is a test notification from Arcular+',
      type: 'test',
      data: { screen: 'home' }
    };

    const success = await fcmService.sendToUser(userId, notification);

    if (success) {
      res.json({
        success: true,
        message: 'Test notification sent successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to send test notification'
      });
    }
  } catch (error) {
    console.error('❌ Error sending test notification:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Manually trigger reminder processing (for testing/admin purposes)
router.post('/trigger-reminders', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin or staff
    const user = req.user;
    if (user.type !== 'admin' && user.type !== 'staff') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin or staff privileges required.'
      });
    }

    const result = await cronService.triggerMenstrualReminders();

    res.json({
      success: true,
      message: 'Reminder processing triggered manually',
      data: result
    });
  } catch (error) {
    console.error('❌ Error triggering reminders manually:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get cron service status (for admin monitoring)
router.get('/cron-status', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin or staff
    const user = req.user;
    if (user.type !== 'admin' && user.type !== 'staff') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin or staff privileges required.'
      });
    }

    const status = cronService.getJobsStatus();

    res.json({
      success: true,
      data: {
        initialized: cronService.isInitialized,
        activeJobs: Object.keys(status).length,
        jobs: status
      }
    });
  } catch (error) {
    console.error('❌ Error getting cron status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Restart cron service (for admin purposes)
router.post('/restart-cron', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const user = req.user;
    if (user.type !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }

    await cronService.restart();

    res.json({
      success: true,
      message: 'Cron service restarted successfully'
    });
  } catch (error) {
    console.error('❌ Error restarting cron service:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Subscribe user to topic
router.post('/subscribe-topic', authenticateToken, async (req, res) => {
  try {
    const { topic } = req.body;
    const userId = req.user.uid;

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: 'Topic is required'
      });
    }

    // Get user's FCM token
    const User = require('../models/User');
    const user = await User.findOne({ uid: userId });
    
    if (!user || !user.fcmToken) {
      return res.status(400).json({
        success: false,
        error: 'User not found or no FCM token'
      });
    }

    const success = await fcmService.subscribeToTopic([user.fcmToken], topic);

    if (success) {
      res.json({
        success: true,
        message: `Subscribed to topic: ${topic}`
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to subscribe to topic'
      });
    }
  } catch (error) {
    console.error('❌ Error subscribing to topic:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Unsubscribe user from topic
router.post('/unsubscribe-topic', authenticateToken, async (req, res) => {
  try {
    const { topic } = req.body;
    const userId = req.user.uid;

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: 'Topic is required'
      });
    }

    // Get user's FCM token
    const User = require('../models/User');
    const user = await User.findOne({ uid: userId });
    
    if (!user || !user.fcmToken) {
      return res.status(400).json({
        success: false,
        error: 'User not found or no FCM token'
      });
    }

    const success = await fcmService.unsubscribeFromTopic([user.fcmToken], topic);

    if (success) {
      res.json({
        success: true,
        message: `Unsubscribed from topic: ${topic}`
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to unsubscribe from topic'
      });
    }
  } catch (error) {
    console.error('❌ Error unsubscribing from topic:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
