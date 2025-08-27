const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');
const router = express.Router();

// Get notifications for a user
router.get('/:userId', authenticateToken, notificationController.getNotificationsByUser);
// Get unread notifications count for a user
router.get('/:userId/unread-count', authenticateToken, notificationController.getUnreadNotificationsCount);
router.post('/register-token', notificationController.registerDeviceToken);
// Send notification to specific user type
router.post('/send-to-user-type', authenticateToken, notificationController.sendNotificationToUserType);

module.exports = router; 