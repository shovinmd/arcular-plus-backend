const express = require('express');
const router = express.Router();
const doctorScheduleController = require('../controllers/doctorScheduleController');
const { authenticateToken } = require('../middleware/auth');

// Get doctor schedule
router.get('/:doctorId', authenticateToken, doctorScheduleController.getDoctorSchedule);

// Save or update doctor schedule
router.post('/', authenticateToken, doctorScheduleController.saveDoctorSchedule);

// Get available time slots for booking
router.get('/:doctorId/available-slots', authenticateToken, doctorScheduleController.getAvailableTimeSlots);

// Test endpoint for time slots (no auth required for testing)
router.get('/test/:doctorId/available-slots', (req, res) => {
  const { doctorId } = req.params;
  const { date } = req.query;
  
  console.log('🧪 Test endpoint called for doctor:', doctorId, 'date:', date);
  
  // Return hardcoded time slots for testing
  const testSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
  
  res.json({
    success: true,
    data: testSlots,
    message: 'Test time slots'
  });
});

// Book a time slot
router.post('/book', authenticateToken, doctorScheduleController.bookTimeSlot);

// Cancel a time slot booking
router.post('/cancel-booking', authenticateToken, doctorScheduleController.cancelTimeSlotBooking);

// Delete doctor schedule
router.delete('/:doctorId/:date', authenticateToken, doctorScheduleController.deleteDoctorSchedule);

module.exports = router;
