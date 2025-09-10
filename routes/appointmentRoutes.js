const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { verifyFirebaseToken } = require('../middleware/firebaseAuth');

// Create appointment
router.post('/create', verifyFirebaseToken, appointmentController.createAppointment);
// Additional compatible endpoints (no removals)
router.post('/', verifyFirebaseToken, appointmentController.createAppointment);
router.post('/book', verifyFirebaseToken, appointmentController.createAppointment);

// Get user appointments
router.get('/user', verifyFirebaseToken, appointmentController.getUserAppointments);
// Get user appointments by userId (for health summary and calendar)
router.get('/user/:userId', verifyFirebaseToken, appointmentController.getUserAppointmentsById);

// Get doctor appointments
router.get('/doctor', verifyFirebaseToken, appointmentController.getDoctorAppointments);

// Get hospital appointments
router.get('/hospital/:hospitalId', verifyFirebaseToken, appointmentController.getHospitalAppointments);

// Update appointment status
router.put('/:appointmentId/status', verifyFirebaseToken, appointmentController.updateAppointmentStatus);

// Cancel appointment
router.delete('/:appointmentId', verifyFirebaseToken, appointmentController.cancelAppointment);

// Get available time slots
router.get('/available-slots', verifyFirebaseToken, appointmentController.getAvailableTimeSlots);


module.exports = router;