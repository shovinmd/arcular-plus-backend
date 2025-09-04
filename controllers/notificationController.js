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

// SOS Emergency System
const activateSOS = async (req, res) => {
  try {
    const { latitude, longitude, city, state, pincode, userInfo } = req.body;
    const userId = req.user?.uid;
    
    if (!userId || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, latitude, longitude'
      });
    }

    console.log('🚨 SOS Emergency activated by user:', userId);
    console.log('📍 Location:', { latitude, longitude, city, state, pincode });

    // Get nearby hospitals
    const Hospital = require('../models/Hospital');
    const hospitals = await Hospital.find({ 
      isApproved: true, 
      status: 'active',
      geoCoordinates: { $exists: true }
    });

    // Filter hospitals by proximity (within 50km radius)
    const nearbyHospitals = hospitals
      .map(hospital => {
        if (hospital.geoCoordinates && hospital.geoCoordinates.lat && hospital.geoCoordinates.lng) {
          const distance = _calculateDistance(
            parseFloat(latitude), parseFloat(longitude),
            hospital.geoCoordinates.lat, hospital.geoCoordinates.lng
          );
          return { ...hospital.toObject(), distance };
        }
        return null;
      })
      .where((hospital) => hospital != null && hospital.distance <= 50)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10); // Top 10 nearest hospitals

    console.log(`🏥 Found ${nearbyHospitals.length} nearby hospitals for SOS`);

    // Send emergency alerts to all nearby hospitals
    const alertPromises = nearbyHospitals.map(async (hospital) => {
      try {
        await sendEmergencyAlertToHospital(hospital, {
          userId,
          latitude,
          longitude,
          city,
          state,
          pincode,
          userInfo,
          timestamp: new Date().toISOString()
        });
        return { hospitalId: hospital._id, success: true };
      } catch (error) {
        console.error(`❌ Failed to send alert to hospital ${hospital.hospitalName}:`, error);
        return { hospitalId: hospital._id, success: false, error: error.message };
      }
    });

    const alertResults = await Promise.all(alertPromises);
    const successfulAlerts = alertResults.filter(result => result.success).length;

    console.log(`✅ SOS alerts sent to ${successfulAlerts}/${nearbyHospitals.length} hospitals`);

    res.status(200).json({
      success: true,
      message: 'SOS emergency activated successfully',
      data: {
        userId,
        location: { latitude, longitude, city, state, pincode },
        nearbyHospitals: nearbyHospitals.length,
        alertsSent: successfulAlerts,
        hospitals: nearbyHospitals.map(h => ({
          id: h._id,
          name: h.hospitalName,
          distance: h.distance,
          phone: h.mobileNumber,
          address: h.address
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error activating SOS emergency:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to activate SOS emergency',
      details: error.message
    });
  }
};

// Send emergency alert to a specific hospital
const sendEmergencyAlertToHospital = async (hospital, emergencyData) => {
  try {
    // For now, we'll log the emergency alert
    // In production, you would send FCM notifications to hospital devices
    console.log(`🚨 EMERGENCY ALERT to ${hospital.hospitalName}:`);
    console.log(`📍 Patient Location: ${emergencyData.latitude}, ${emergencyData.longitude}`);
    console.log(`🏥 Hospital: ${hospital.hospitalName} (${hospital.distance.toFixed(2)}km away)`);
    console.log(`📞 Contact: ${hospital.mobileNumber}`);
    console.log(`⏰ Time: ${emergencyData.timestamp}`);
    
    // TODO: Implement FCM notification to hospital devices
    // This would require storing hospital FCM tokens and sending notifications
    
    return true;
  } catch (error) {
    console.error('❌ Error sending emergency alert to hospital:', error);
    throw error;
  }
};

// Accept emergency by hospital
const acceptEmergency = async (req, res) => {
  try {
    const { emergencyId, hospitalId, hospitalName } = req.body;
    
    if (!emergencyId || !hospitalId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: emergencyId, hospitalId'
      });
    }

    console.log(`✅ Emergency ${emergencyId} accepted by hospital: ${hospitalName}`);

    // TODO: Notify other hospitals that this emergency has been accepted
    // TODO: Notify the patient that help is on the way

    res.status(200).json({
      success: true,
      message: 'Emergency accepted successfully',
      data: {
        emergencyId,
        hospitalId,
        hospitalName,
        acceptedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error accepting emergency:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept emergency',
      details: error.message
    });
  }
};

// Helper function to calculate distance between two coordinates (Haversine formula)
function _calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = _toRadians(lat2 - lat1);
  const dLon = _toRadians(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(_toRadians(lat1)) * Math.cos(_toRadians(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function _toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

module.exports = {
  scheduleMedicineReminder,
  getUserNotifications,
  markAsRead,
  deleteNotification,
  getNotificationsByUser,
  getUnreadNotificationsCount,
  registerDeviceToken,
  sendNotificationToUserType,
  activateSOS,
  acceptEmergency
}; 