const express = require('express');
const { body } = require('express-validator');
const reportController = require('../controllers/reportController');

const router = express.Router();

// Validation middleware
const validateReportUpdate = [
  body('name').optional().notEmpty().withMessage('Report name cannot be empty'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('category').optional().isIn(['Blood Test', 'X-Ray', 'MRI', 'CT Scan', 'Ultrasound', 'ECG', 'Other']).withMessage('Invalid category'),
  body('tags').optional().isArray().withMessage('Tags must be an array')
];

// Routes
router.get('/user/:userId', reportController.getReportsByUser);
router.get('/search/:userId', reportController.searchReports);
router.get('/:id', reportController.getReportById);
router.post('/upload', reportController.uploadReport);
router.post('/save-metadata', reportController.saveReportMetadata);
router.put('/:id', validateReportUpdate, reportController.updateReport);
router.delete('/:id', reportController.deleteReport);

module.exports = router; 