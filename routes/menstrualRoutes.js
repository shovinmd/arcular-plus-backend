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



// Get upcoming reminders based on standardized calculations
router.get('/:userId/upcoming-reminders', authenticateToken, menstrualController.getUpcomingReminders);



module.exports = router; 