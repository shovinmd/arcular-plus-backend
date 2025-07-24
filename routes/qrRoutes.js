const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const qrController = require('../controllers/qrController');
const router = express.Router();

// Get user by QR code
router.get('/:qrId', authenticateToken, qrController.getUserByQrId);

module.exports = router; 