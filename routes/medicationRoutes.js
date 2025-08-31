const express = require('express');
const { body } = require('express-validator');
const medicationController = require('../controllers/medicationController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validation middleware for doctor-assigned medications
const validateMedication = [
  body('name').notEmpty().withMessage('Medication name is required'),
  body('dose').notEmpty().withMessage('Dose is required'),
  body('frequency').notEmpty().withMessage('Frequency is required'),
  body('patientId').notEmpty().withMessage('Patient ID is required'),
  body('doctorId').notEmpty().withMessage('Doctor ID is required'),
  body('type').optional().isIn(['tablet', 'syrup', 'drops', 'cream', 'other']).withMessage('Invalid medication type'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('unit').optional().isIn(['tablets', 'bottles', 'tubes', 'pieces']).withMessage('Invalid unit'),
  body('endDate').optional().isISO8601().withMessage('Valid end date is required')
];

// Validation middleware for user-added medicines
const validateUserMedication = [
  body('name').notEmpty().withMessage('Medication name is required'),
  body('dosage').notEmpty().withMessage('Dosage is required'),
  body('frequency').notEmpty().withMessage('Frequency is required'),
  body('type').isIn(['tablet', 'syrup', 'drops']).withMessage('Invalid medication type'),
  body('duration').notEmpty().withMessage('Duration is required'),
  body('times').isArray().withMessage('Times must be an array'),
  body('times.*').isString().withMessage('Each time must be a string'),
  body('startDate').optional().isISO8601().withMessage('Valid start date is required'),
  body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
  body('patientId').notEmpty().withMessage('Patient ID is required')
];

// Routes
router.get('/user/:userId', medicationController.getMedicationsByUser);
router.get('/pending/:userId', medicationController.getPendingMedications);
router.get('/:id', medicationController.getMedicationById);
router.post('/', validateMedication, medicationController.createMedication);
router.post('/user-add', authenticateToken, validateUserMedication, medicationController.createUserMedication);
router.put('/:id', medicationController.updateMedication);
router.delete('/:id', medicationController.deleteMedication);
router.patch('/:id/taken', medicationController.markAsTaken);
router.patch('/:id/not-taken', medicationController.markAsNotTaken);

module.exports = router; 