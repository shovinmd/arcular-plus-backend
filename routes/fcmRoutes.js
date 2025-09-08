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

// Send appointment reminder email
router.post('/send-appointment-reminder', authenticateToken, async (req, res) => {
  try {
    const { appointmentId, doctorName, hospitalName, appointmentDate, appointmentTime, reason } = req.body;
    const userId = req.user.uid;

    if (!appointmentId || !doctorName || !hospitalName || !appointmentDate || !appointmentTime) {
      return res.status(400).json({
        success: false,
        error: 'Missing required appointment details'
      });
    }

    // Get user details
    const User = require('../models/User');
    const user = await User.findOne({ uid: userId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Send appointment reminder email
    const nodemailer = require('nodemailer');
    
    // Skip if email credentials not configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('⚠️ Skipping appointment reminder email: EMAIL_USER or EMAIL_PASS not configured');
      return res.json({
        success: true,
        message: 'Appointment reminder email skipped (email not configured)'
      });
    }

    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const appointmentDateFormatted = new Date(appointmentDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Appointment Reminder - Arcular Plus',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #32CCBC;">Appointment Reminder</h2>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>You have an appointment today!</h3>
            <p><strong>Appointment ID:</strong> ${appointmentId}</p>
            <p><strong>Doctor:</strong> Dr. ${doctorName}</p>
            <p><strong>Hospital:</strong> ${hospitalName}</p>
            <p><strong>Date:</strong> ${appointmentDateFormatted}</p>
            <p><strong>Time:</strong> ${appointmentTime}</p>
            <p><strong>Reason:</strong> ${reason}</p>
          </div>
          
          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4>Important Reminders:</h4>
            <ul>
              <li>Please arrive 15 minutes before your appointment time</li>
              <li>Bring a valid ID and any relevant medical documents</li>
              <li>Contact the hospital if you need to reschedule or cancel</li>
              <li>Payment can be made at the hospital reception</li>
            </ul>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            This is an automated reminder. Please do not reply to this email.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Appointment reminder email sent to:', user.email);

    res.json({
      success: true,
      message: 'Appointment reminder email sent successfully'
    });

  } catch (error) {
    console.error('❌ Error sending appointment reminder email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send appointment reminder email'
    });
  }
});

module.exports = router;
