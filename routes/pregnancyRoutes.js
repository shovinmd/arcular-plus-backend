const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');
const pregnancyController = require('../controllers/pregnancyController');
const router = express.Router();

// Get pregnancy tracking data for a user
router.get('/:userId', firebaseAuthMiddleware, pregnancyController.getPregnancyByUser);
// Create new pregnancy tracking entry
router.post('/', firebaseAuthMiddleware, pregnancyController.createPregnancy);
// Update pregnancy tracking entry
router.put('/:id', firebaseAuthMiddleware, pregnancyController.updatePregnancy);

// Weekly doctor notes
router.get('/:userId/weekly-notes', firebaseAuthMiddleware, pregnancyController.getWeeklyNotes);
router.post('/:userId/weekly-notes', firebaseAuthMiddleware, pregnancyController.upsertWeeklyNote);

module.exports = router; 