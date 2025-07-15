const express = require('express');
const auth = require('../middleware/auth');
const sosController = require('../controllers/sosController');
const router = express.Router();

// Send SOS
router.post('/', auth, sosController.sendSOS);
// Get all SOS records for a user
router.get('/:userId', auth, sosController.getSOSByUser);

module.exports = router; 