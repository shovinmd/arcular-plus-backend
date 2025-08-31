const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

// Schedule medicine reminder notification
router.post('/schedule-medicine', authenticateToken, notificationController.scheduleMedicineReminder);

// Get scheduled notifications for a user
router.get('/user/:userId', authenticateToken, notificationController.getUserNotifications);

// Mark notification as read
router.put('/:notificationId/read', authenticateToken, notificationController.markAsRead);

// Delete notification
router.delete('/:notificationId', authenticateToken, notificationController.deleteNotification);

// Legacy routes for compatibility
router.get('/:userId', authenticateToken, notificationController.getNotificationsByUser);
router.get('/:userId/unread-count', authenticateToken, notificationController.getUnreadNotificationsCount);
router.post('/register-token', notificationController.registerDeviceToken);
router.post('/send-to-user-type', authenticateToken, notificationController.sendNotificationToUserType);

module.exports = router; 