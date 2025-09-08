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

// Update appointment status
router.put('/:appointmentId/status', verifyFirebaseToken, appointmentController.updateAppointmentStatus);

// Get available time slots
router.get('/available-slots', verifyFirebaseToken, appointmentController.getAvailableTimeSlots);

// Test endpoint to check all appointments (for debugging)
router.get('/test-all', verifyFirebaseToken, async (req, res) => {
  try {
    const Appointment = require('../models/Appointment');
    const allAppointments = await Appointment.find({});
    console.log('🔍 Test: All appointments in database:', allAppointments.length);
    res.json({
      success: true,
      total: allAppointments.length,
      appointments: allAppointments
    });
  } catch (error) {
    console.error('❌ Test: Error fetching all appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointments'
    });
  }
});

module.exports = router;