const express = require('express');
const auth = require('../middleware/auth');
const menstrualController = require('../controllers/menstrualController');
const router = express.Router();

// Get menstrual cycle data for a user
router.get('/:userId', auth, menstrualController.getMenstrualByUser);
// Create new menstrual cycle entry
router.post('/', auth, menstrualController.createMenstrual);
// Update menstrual cycle entry
router.put('/:id', auth, menstrualController.updateMenstrual);

module.exports = router; 