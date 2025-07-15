const express = require('express');
const auth = require('../middleware/auth');
const nurseController = require('../controllers/nurseController');
const router = express.Router();

// Profile
router.get('/:id', auth, nurseController.getNurseProfile);
router.put('/:id', auth, nurseController.updateNurseProfile);

// Assigned Patients
router.get('/:id/assigned-patients', auth, nurseController.getAssignedPatients);

// Vitals Monitoring
router.get('/:id/vitals', auth, nurseController.getVitals);
router.post('/:id/vitals', auth, nurseController.addVitals);

// Medication Log
router.get('/:id/medication-log', auth, nurseController.getMedicationLog);
router.post('/:id/medication-log', auth, nurseController.addMedicationLog);

// Care Reminders
router.get('/:id/care-reminders', auth, nurseController.getCareReminders);
router.post('/:id/care-reminders', auth, nurseController.addCareReminder);

// Chat/Feedback
router.get('/:id/chat', auth, nurseController.getChatMessages);
router.post('/:id/chat', auth, nurseController.sendChatMessage);

// Shift Schedule
router.get('/:id/shifts', auth, nurseController.getShifts);
router.post('/:id/shifts', auth, nurseController.createShift);
router.put('/:id/shifts/:shiftId', auth, nurseController.updateShift);
router.delete('/:id/shifts/:shiftId', auth, nurseController.deleteShift);

// Notifications
router.get('/:id/notifications', auth, nurseController.getNotifications);

// Settings
router.put('/:id/settings', auth, nurseController.updateSettings);

module.exports = router; 