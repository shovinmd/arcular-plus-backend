const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const sosController = require('../controllers/sosController');
const router = express.Router();

// Send SOS
router.post('/', authenticateToken, sosController.sendSOS);
// Get all SOS records for a user
router.get('/:userId', authenticateToken, sosController.getSOSByUser);

module.exports = router; 