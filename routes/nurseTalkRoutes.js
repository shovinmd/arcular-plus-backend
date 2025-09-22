const express = require('express');
const router = express.Router();
const nurseTalkController = require('../controllers/nurseTalkController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Test route without auth
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'NurseTalk routes are working!' });
});

// Apply Firebase auth to all routes
router.use(firebaseAuthMiddleware);

// Get nurses in the same hospital
router.get('/nurses', (req, res, next) => {
  console.log('🏥 NurseTalk: GET /nurses route hit');
  next();
}, nurseTalkController.getHospitalNurses);

// Fallback route for nurses if controller fails
router.get('/nurses-fallback', (req, res) => {
  console.log('🏥 NurseTalk: GET /nurses-fallback route hit');
  res.json({
    success: true,
    message: 'Nurses fallback route working',
    data: [],
    timestamp: new Date().toISOString()
  });
});

// Send message to another nurse
router.post('/send', nurseTalkController.sendMessage);

// Get messages between two nurses
router.get('/messages/:receiverId', nurseTalkController.getMessages);

// Get handover notes for the hospital
router.get('/handover', (req, res, next) => {
  console.log('📝 NurseTalk: GET /handover route hit');
  next();
}, nurseTalkController.getHandoverNotes);

// Mark message as read
router.patch('/read/:messageId', nurseTalkController.markAsRead);

// Get unread message count
router.get('/unread-count', nurseTalkController.getUnreadCount);

module.exports = router;
