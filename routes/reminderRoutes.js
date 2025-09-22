const express = require('express');
const router = express.Router();
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');
const reminderController = require('../controllers/reminderController');

// Create a new reminder
router.post('/create', firebaseAuthMiddleware, reminderController.createReminder);

// Get reminders by patient ARC ID
router.get('/patient/:arcId', firebaseAuthMiddleware, reminderController.getRemindersByPatientArcId);

// Get reminders by patient ID
router.get('/patient-id/:patientId', firebaseAuthMiddleware, reminderController.getRemindersByPatientId);

// Get reminder by ID
router.get('/:id', firebaseAuthMiddleware, reminderController.getReminderById);

// Update reminder status
router.patch('/:id/status', firebaseAuthMiddleware, reminderController.updateReminderStatus);
// Alias to support client calling PATCH /api/reminders/:id
router.patch('/:id', firebaseAuthMiddleware, reminderController.updateReminderStatus);

// Update reminder
router.put('/:id', firebaseAuthMiddleware, reminderController.updateReminder);

// Delete reminder
router.delete('/:id', firebaseAuthMiddleware, reminderController.deleteReminder);

module.exports = router;
