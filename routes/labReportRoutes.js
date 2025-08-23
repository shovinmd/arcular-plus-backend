const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const labReportController = require('../controllers/labReportController');
const router = express.Router();

// Get all lab reports for a user
router.get('/user/:userId', authenticateToken, labReportController.getLabReportsByUser);
// Get a single lab report by ID
router.get('/:id', authenticateToken, labReportController.getLabReportById);
// Upload a new lab report
router.post('/upload', authenticateToken, labReportController.uploadLabReport);
// Update a lab report
router.put('/:id', authenticateToken, labReportController.updateLabReport);
// Delete a lab report
router.delete('/:id', authenticateToken, labReportController.deleteLabReport);

module.exports = router; 