const express = require('express');
const auth = require('../middleware/auth');
const labReportController = require('../controllers/labReportController');
const router = express.Router();

// Get all lab reports for a user
router.get('/user/:userId', auth, labReportController.getLabReportsByUser);
// Get a single lab report by ID
router.get('/:id', auth, labReportController.getLabReportById);
// Upload a new lab report
router.post('/upload', auth, labReportController.uploadLabReport);
// Update a lab report
router.put('/:id', auth, labReportController.updateLabReport);
// Delete a lab report
router.delete('/:id', auth, labReportController.deleteLabReport);

module.exports = router; 