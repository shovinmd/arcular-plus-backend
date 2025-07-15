const express = require('express');
const auth = require('../middleware/auth');
const qrController = require('../controllers/qrController');
const router = express.Router();

// Get user by QR code
router.get('/:qrId', auth, qrController.getUserByQrId);

module.exports = router; 