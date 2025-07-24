const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const pregnancyController = require('../controllers/pregnancyController');
const router = express.Router();

// Get pregnancy tracking data for a user
router.get('/:userId', authenticateToken, pregnancyController.getPregnancyByUser);
// Create new pregnancy tracking entry
router.post('/', authenticateToken, pregnancyController.createPregnancy);
// Update pregnancy tracking entry
router.put('/:id', authenticateToken, pregnancyController.updatePregnancy);

module.exports = router; 