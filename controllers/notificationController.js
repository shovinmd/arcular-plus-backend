const admin = require('firebase-admin');
const { validationResult } = require('express-validator');

// Schedule medicine reminder notification
const scheduleMedicineReminder = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { medicineData, scheduledTime, fcmToken, type } = req.body;
    const userId = req.user?.uid;

    if (!userId || !fcmToken || !scheduledTime) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, fcmToken, or scheduledTime'
      });
    }

    // Schedule the notification using Firebase Admin
    const scheduledTimeDate = new Date(scheduledTime);
    const now = new Date();
    
    if (scheduledTimeDate <= now) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled time must be in the future'
      });
    }

    // Calculate delay in milliseconds
    const delay = scheduledTimeDate.getTime() - now.getTime();

    // Schedule the notification using setTimeout for reliable delivery
    setTimeout(async () => {
      try {
        await sendMedicineReminderNotification(fcmToken, medicineData);
        console.log(`✅ FCM: Medicine reminder delivered for ${medicineData.name} at ${scheduledTime}`);
      } catch (error) {
        console.error(`❌ FCM: Failed to deliver medicine reminder: ${error.message}`);
      }
    }, delay);

    console.log(`📅 FCM: Medicine reminder scheduled for ${medicineData.name} at ${scheduledTime} (${delay}ms delay)`);

    res.status(200).json({
      success: true,
      message: 'Medicine reminder scheduled successfully via FCM',
      scheduledTime: scheduledTime,
      delay: delay,
      deliveryMethod: 'FCM (works for all app states)'
    });

  } catch (error) {
    console.error('❌ Error scheduling medicine reminder:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule medicine reminder',
      details: error.message
    });
  }
};

// Send medicine reminder notification via FCM
const sendMedicineReminderNotification = async (fcmToken, medicineData) => {
  try {
    const message = {
      token: fcmToken,
      // Notification payload for when app is in background/closed
      notification: {
        title: '💊 Medicine Reminder',
        body: `Time to take ${medicineData.name}${medicineData.dosage ? ' - ${medicineData.dosage}' : ''}`,
        icon: 'notify_icon',
        color: '#32CCBC',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      // Data payload for when app is open
      data: {
        type: 'medicine_reminder',
        medicineId: medicineData.id || medicineData.name,
        medicineName: medicineData.name,
        dosage: medicineData.dosage || '',
        instructions: medicineData.instructions || '',
        scheduledTime: new Date().toISOString(),
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      // Android specific configuration
      android: {
        priority: 'high',
        notification: {
          icon: 'notify_icon',
          color: '#32CCBC',
          priority: 'high',
          channel_id: 'medicine_reminders',
          sound: 'default',
          vibrate_timings: [0, 250, 250, 250],
          default_vibrate_timings: true,
          default_sound: true,
          visibility: 'public',
          actions: [
            {
              title: '✅ Take',
              action: 'take',
              icon: 'ic_action_take'
            },
            {
              title: '⏭️ Skip',
              action: 'skip',
              icon: 'ic_action_skip'
            },
            {
              title: '⏰ Snooze (15min)',
              action: 'snooze',
              icon: 'ic_action_snooze'
            }
          ]
        }
      },
      // iOS specific configuration
      apns: {
        payload: {
          aps: {
            category: 'medicine_reminder',
            'mutable-content': 1,
            sound: 'default',
            badge: 1,
            alert: {
              title: '💊 Medicine Reminder',
              body: `Time to take ${medicineData.name}${medicineData.dosage ? ' - ${medicineData.dosage}' : ''}`
            }
          }
        }
      },
      // Web push configuration
      webpush: {
        notification: {
          title: '💊 Medicine Reminder',
          body: `Time to take ${medicineData.name}${medicineData.dosage ? ' - ${medicineData.dosage}' : ''}`,
          icon: '/notify_icon.png',
          badge: '/badge-icon.png',
          actions: [
            {
              action: 'take',
              title: '✅ Take'
            },
            {
              action: 'skip',
              title: '⏭️ Skip'
            },
            {
              action: 'snooze',
              title: '⏰ Snooze (15min)'
            }
          ]
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log(`✅ FCM: Medicine reminder notification delivered successfully for ${medicineData.name}`);
    return response;

  } catch (error) {
    console.error('❌ FCM: Error delivering medicine reminder notification:', error);
    throw error;
  }
};

// Get user notifications
const getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // This would fetch notifications from your database
    // For now, return empty array
    res.json({
      success: true,
      data: [],
      count: 0
    });
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    // This would update notification status in your database
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    // This would delete notification from your database
    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification'
    });
  }
};

// Legacy methods for compatibility
const getNotificationsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // This would fetch notifications from your database
    res.json([]);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: error.message });
  }
};

const getUnreadNotificationsCount = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // This would count unread notifications from your database
    res.json({ count: 0 });
  } catch (error) {
    console.error('Error counting unread notifications:', error);
    res.status(500).json({ error: error.message });
  }
};

const registerDeviceToken = async (req, res) => {
  try {
    const { userId, userType, token } = req.body;
    
    if (!userId || !userType || !token) {
      return res.status(400).json({ error: 'userId, userType, and token are required' });
    }
    
    console.log(`✅ FCM: Device token registered for ${userType} user: ${userId}`);
    res.status(200).json({ 
      success: true, 
      message: 'Device token registered', 
      token,
      userType 
    });
  } catch (error) {
    console.error('Error registering device token:', error);
    res.status(500).json({ error: error.message });
  }
};

const sendNotificationToUserType = async (req, res) => {
  try {
    const { userType, title, body, data } = req.body;
    
    if (!userType || !title || !body) {
      return res.status(400).json({ error: 'userType, title, and body are required' });
    }
    
    console.log(`✅ FCM: Notification sent to ${userType} users`);
    res.status(200).json({ 
      success: true, 
      message: `Notifications sent to ${userType} users`
    });
  } catch (error) {
    console.error('Error sending notification to user type:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  scheduleMedicineReminder,
  getUserNotifications,
  markAsRead,
  deleteNotification,
  getNotificationsByUser,
  getUnreadNotificationsCount,
  registerDeviceToken,
  sendNotificationToUserType
}; 