const express = require('express');
const auth = require('../middleware/auth');
const pregnancyController = require('../controllers/pregnancyController');
const router = express.Router();

// Get pregnancy tracking data for a user
router.get('/:userId', auth, pregnancyController.getPregnancyByUser);
// Create new pregnancy tracking entry
router.post('/', auth, pregnancyController.createPregnancy);
// Update pregnancy tracking entry
router.put('/:id', auth, pregnancyController.updatePregnancy);

module.exports = router; 