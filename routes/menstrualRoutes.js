const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const menstrualController = require('../controllers/menstrualController');
const router = express.Router();

// Get menstrual cycle data for a user
router.get('/:userId', authenticateToken, menstrualController.getMenstrualByUser);

// Create or update menstrual cycle data (main method)
router.post('/', authenticateToken, menstrualController.createMenstrual);

// Update menstrual cycle entry (alternative method)
router.put('/:id', authenticateToken, menstrualController.updateMenstrual);

// Delete individual cycle entry from history
router.delete('/:userId/:entryId', authenticateToken, menstrualController.deleteCycleEntry);

// Get upcoming reminders using stored frontend predictions
router.get('/:userId/upcoming-reminders', authenticateToken, menstrualController.getUpcomingReminders);

module.exports = router; 