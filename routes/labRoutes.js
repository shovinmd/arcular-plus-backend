const express = require('express');
const auth = require('../middleware/auth');
const labController = require('../controllers/labController');
const router = express.Router();

// Profile
router.get('/:id', auth, labController.getLabProfile);
router.put('/:id', auth, labController.updateLabProfile);

// Test Management
router.get('/:id/tests', auth, labController.getTests);
router.post('/:id/tests', auth, labController.createTest);
router.put('/:id/tests/:testId', auth, labController.updateTest);
router.delete('/:id/tests/:testId', auth, labController.deleteTest);

// Sample Collection
router.get('/:id/samples', auth, labController.getSamples);
router.post('/:id/samples', auth, labController.addSample);

// Test Results
router.get('/:id/results', auth, labController.getResults);
router.post('/:id/results', auth, labController.addResult);

// Patient Communication
router.get('/:id/patient/:patientId', auth, labController.getPatientInfo);
router.post('/:id/patient/:patientId/message', auth, labController.sendPatientMessage);

// Chat
router.get('/:id/chat', auth, labController.getChatMessages);
router.post('/:id/chat', auth, labController.sendChatMessage);

// Notifications
router.get('/:id/notifications', auth, labController.getNotifications);

// Settings
router.put('/:id/settings', auth, labController.updateSettings);

module.exports = router; 