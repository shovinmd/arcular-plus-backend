const express = require('express');
const router = express.Router();
const nurseTalkController = require('../controllers/nurseTalkController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Apply Firebase auth to all routes
router.use(firebaseAuthMiddleware);

// Get nurses in the same hospital
router.get('/nurses', nurseTalkController.getHospitalNurses);

// Send message to another nurse
router.post('/send', nurseTalkController.sendMessage);

// Get messages between two nurses
router.get('/messages/:receiverId', nurseTalkController.getMessages);

// Get handover notes for the hospital
router.get('/handover', nurseTalkController.getHandoverNotes);

// Mark message as read
router.patch('/read/:messageId', nurseTalkController.markAsRead);

// Get unread message count
router.get('/unread-count', nurseTalkController.getUnreadCount);

module.exports = router;
