const express = require('express');
const auth = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');
const router = express.Router();

// Get notifications for a user
router.get('/:userId', auth, notificationController.getNotificationsByUser);
router.post('/register-token', notificationController.registerDeviceToken);

module.exports = router; 