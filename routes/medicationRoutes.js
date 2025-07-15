const express = require('express');
const { body } = require('express-validator');
const medicationController = require('../controllers/medicationController');

const router = express.Router();

// Validation middleware
const validateMedication = [
  body('name').notEmpty().withMessage('Medication name is required'),
  body('dose').notEmpty().withMessage('Dose is required'),
  body('frequency').notEmpty().withMessage('Frequency is required'),
  body('patientId').notEmpty().withMessage('Patient ID is required'),
  body('doctorId').notEmpty().withMessage('Doctor ID is required'),
  body('type').optional().isIn(['tablet', 'syrup', 'injection', 'drops', 'cream', 'other']).withMessage('Invalid medication type'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('unit').optional().isIn(['tablets', 'bottles', 'tubes', 'pieces']).withMessage('Invalid unit'),
  body('endDate').optional().isISO8601().withMessage('Valid end date is required')
];

// Routes
router.get('/user/:userId', medicationController.getMedicationsByUser);
router.get('/pending/:userId', medicationController.getPendingMedications);
router.get('/:id', medicationController.getMedicationById);
router.post('/', validateMedication, medicationController.createMedication);
router.put('/:id', medicationController.updateMedication);
router.delete('/:id', medicationController.deleteMedication);
router.patch('/:id/taken', medicationController.markAsTaken);
router.patch('/:id/not-taken', medicationController.markAsNotTaken);

module.exports = router; 