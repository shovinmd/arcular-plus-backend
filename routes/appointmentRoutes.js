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

// Cancel appointment
router.delete('/:appointmentId', verifyFirebaseToken, appointmentController.cancelAppointment);

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

// Debug endpoint to check specific appointment
router.get('/debug/:appointmentId', verifyFirebaseToken, async (req, res) => {
  try {
    const Appointment = require('../models/Appointment');
    const { appointmentId } = req.params;
    const firebaseUser = req.user;
    
    console.log('🔍 Debug: Looking for appointment:', appointmentId, 'for user:', firebaseUser.uid);
    
    // Try to find by appointmentId
    const byAppointmentId = await Appointment.findOne({
      appointmentId: appointmentId,
      userId: firebaseUser.uid
    });
    
    // Try to find by _id
    const byMongoId = await Appointment.findOne({
      _id: appointmentId,
      userId: firebaseUser.uid
    });
    
    // Get all appointments for this user
    const allUserAppointments = await Appointment.find({ userId: firebaseUser.uid }).limit(5);
    
    res.json({
      success: true,
      searchedId: appointmentId,
      byAppointmentId: byAppointmentId ? {
        _id: byAppointmentId._id,
        appointmentId: byAppointmentId.appointmentId,
        userId: byAppointmentId.userId
      } : null,
      byMongoId: byMongoId ? {
        _id: byMongoId._id,
        appointmentId: byMongoId.appointmentId,
        userId: byMongoId.userId
      } : null,
      allUserAppointments: allUserAppointments.map(apt => ({
        _id: apt._id,
        appointmentId: apt.appointmentId,
        userId: apt.userId
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;