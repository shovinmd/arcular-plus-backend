const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { verifyFirebaseToken } = require('../middleware/firebaseAuth');

// Create appointment
router.post('/create', verifyFirebaseToken, appointmentController.createAppointment);

// Get user appointments
router.get('/user', verifyFirebaseToken, appointmentController.getUserAppointments);

// Get doctor appointments
router.get('/doctor', verifyFirebaseToken, appointmentController.getDoctorAppointments);

// Update appointment status
router.put('/:appointmentId/status', verifyFirebaseToken, appointmentController.updateAppointmentStatus);

// Get available time slots
router.get('/available-slots', verifyFirebaseToken, appointmentController.getAvailableTimeSlots);

module.exports = router;