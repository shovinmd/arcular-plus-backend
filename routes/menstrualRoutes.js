const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const menstrualController = require('../controllers/menstrualController');
const router = express.Router();
const cronService = require('../services/cronService');
const fcmService = require('../services/fcmService');

// Get menstrual cycle data for a user
router.get('/user/:userId', authenticateToken, menstrualController.getMenstrualByUser);

// Create or update menstrual cycle data (main method)
router.post('/create', authenticateToken, menstrualController.createMenstrual);

// Update menstrual cycle entry (alternative method)
router.put('/:id', authenticateToken, menstrualController.updateMenstrual);

// Delete individual cycle entry from history
router.delete('/:userId/:entryId', authenticateToken, menstrualController.deleteCycleEntry);

// Get upcoming reminders using stored frontend predictions
router.get('/upcoming-reminders/:userId', authenticateToken, menstrualController.getUpcomingReminders);

// Test endpoints for FCM and cron service
router.post('/test-fcm', async (req, res) => {
  try {
    const { userId, message } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    console.log('🧪 Testing FCM notification...');
    
    const testNotification = {
      title: message?.title || '🧪 Test Notification',
      body: message?.body || 'This is a test FCM notification from the backend',
      type: 'test',
      screen: 'test',
      data: {
        test: true,
        timestamp: new Date().toISOString()
      }
    };

    const success = await fcmService.sendToUser(userId, testNotification);
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Test FCM notification sent successfully',
        notification: testNotification
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to send test FCM notification' 
      });
    }
  } catch (error) {
    console.error('❌ Error in test FCM endpoint:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/test-reminders', async (req, res) => {
  try {
    console.log('🧪 Manually triggering reminder processing...');
    
    const result = await cronService.triggerMenstrualReminders();
    
    res.json({ 
      success: true, 
      message: 'Manual reminder processing completed',
      result: result
    });
  } catch (error) {
    console.error('❌ Error in test reminders endpoint:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.get('/fcm-status', (req, res) => {
  try {
    const status = fcmService.getStatus();
    res.json({ 
      success: true, 
      status: status 
    });
  } catch (error) {
    console.error('❌ Error getting FCM status:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.get('/cron-status', (req, res) => {
  try {
    const status = cronService.getJobsStatus();
    res.json({ 
      success: true, 
      status: status 
    });
  } catch (error) {
    console.error('❌ Error getting cron status:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router; 