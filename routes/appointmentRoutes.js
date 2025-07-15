const express = require('express');
const { body } = require('express-validator');
const appointmentController = require('../controllers/appointmentController');

const router = express.Router();

// Validation middleware
const validateAppointment = [
  body('doctorName').notEmpty().withMessage('Doctor name is required'),
  body('doctorId').notEmpty().withMessage('Doctor ID is required'),
  body('patientId').notEmpty().withMessage('Patient ID is required'),
  body('dateTime').isISO8601().withMessage('Valid date and time is required'),
  body('status').optional().isIn(['Scheduled', 'Confirmed', 'Cancelled', 'Rescheduled', 'Completed']).withMessage('Invalid status'),
  body('duration').optional().isInt({ min: 15, max: 480 }).withMessage('Duration must be between 15 and 480 minutes'),
  body('type').optional().isIn(['Consultation', 'Follow-up', 'Emergency', 'Routine']).withMessage('Invalid appointment type')
];

const validateAppointmentUpdate = [
  body('doctorName').optional().notEmpty().withMessage('Doctor name cannot be empty'),
  body('dateTime').optional().isISO8601().withMessage('Valid date and time is required'),
  body('status').optional().isIn(['Scheduled', 'Confirmed', 'Cancelled', 'Rescheduled', 'Completed']).withMessage('Invalid status'),
  body('duration').optional().isInt({ min: 15, max: 480 }).withMessage('Duration must be between 15 and 480 minutes'),
  body('type').optional().isIn(['Consultation', 'Follow-up', 'Emergency', 'Routine']).withMessage('Invalid appointment type')
];

// Routes
router.get('/user/:userId', appointmentController.getAppointmentsByUser);
router.get('/upcoming/:userId', appointmentController.getUpcomingAppointments);
router.get('/:id', appointmentController.getAppointmentById);
router.post('/', validateAppointment, appointmentController.createAppointment);
router.put('/:id', validateAppointmentUpdate, appointmentController.updateAppointment);
router.delete('/:id', appointmentController.deleteAppointment);

module.exports = router; 