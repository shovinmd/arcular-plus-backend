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

// Book a time slot
router.post('/book', authenticateToken, doctorScheduleController.bookTimeSlot);

// Cancel a time slot booking
router.post('/cancel-booking', authenticateToken, doctorScheduleController.cancelTimeSlotBooking);

// Delete doctor schedule
router.delete('/:doctorId/:date', authenticateToken, doctorScheduleController.deleteDoctorSchedule);

module.exports = router;
