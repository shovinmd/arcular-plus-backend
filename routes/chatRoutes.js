const express = require('express');
const router = express.Router();
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');
const chatController = require('../controllers/chatController');

router.post('/send', firebaseAuthMiddleware, chatController.sendMessage);
router.get('/patient/:arcId', firebaseAuthMiddleware, chatController.getByPatientArcId);
router.patch('/:id/read', firebaseAuthMiddleware, chatController.markRead);

module.exports = router;
