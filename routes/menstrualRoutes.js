const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const menstrualController = require('../controllers/menstrualController');
const router = express.Router();

// Get menstrual cycle data for a user
router.get('/:userId', authenticateToken, menstrualController.getMenstrualByUser);
// Create new menstrual cycle entry
router.post('/', authenticateToken, menstrualController.createMenstrual);
// Update menstrual cycle entry
router.put('/:id', authenticateToken, menstrualController.updateMenstrual);
// Delete individual cycle entry
router.delete('/:userId/:entryId', authenticateToken, menstrualController.deleteCycleEntry);

// REMOVED: calculate-predictions route - using frontend calculations only

// Get upcoming reminders using frontend-calculated predictions
router.get('/:userId/upcoming-reminders', authenticateToken, menstrualController.getUpcomingReminders);

// Add new cycle entry to history
router.post('/add-cycle-entry', authenticateToken, menstrualController.addCycleEntry);

module.exports = router; 