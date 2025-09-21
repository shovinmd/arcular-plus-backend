const DoctorSchedule = require('../models/DoctorSchedule');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');

// Get doctor schedule for a specific doctor
const getDoctorSchedule = async (req, res) => {
  try {
    const { doctorId } = req.params;
    
    console.log('🔍 Getting schedule for doctor ID:', doctorId);
    
    // Verify doctor exists - try MongoDB ID first, then Firebase UID
    let doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      doctor = await Doctor.findOne({ uid: doctorId });
    }
    
    if (!doctor) {
      console.log('❌ Doctor not found with ID:', doctorId);
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    console.log('✅ Doctor found:', {
      _id: doctor._id,
      uid: doctor.uid,
      fullName: doctor.fullName
    });

    // Get all schedules for the doctor using MongoDB ID
    const schedules = await DoctorSchedule.find({ 
      doctorId: doctor._id.toString(), // Use MongoDB ID
      isActive: true 
    }).sort({ date: 1 });

    console.log(`📅 Found ${schedules.length} schedules for doctor ${doctor.fullName}`);

    res.json({
      success: true,
      data: schedules
    });
  } catch (error) {
    console.error('Error getting doctor schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get doctor schedule',
      error: error.message
    });
  }
};

// Save or update doctor schedule
const saveDoctorSchedule = async (req, res) => {
  try {
    const { doctorId, date, timeSlots } = req.body;

    console.log('💾 Saving schedule for doctor ID:', doctorId, 'date:', date);

    // Verify doctor exists - try MongoDB ID first, then Firebase UID
    let doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      doctor = await Doctor.findOne({ uid: doctorId });
    }
    
    if (!doctor) {
      console.log('❌ Doctor not found with ID:', doctorId);
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    console.log('✅ Doctor found:', {
      _id: doctor._id,
      uid: doctor.uid,
      fullName: doctor.fullName
    });

    // Validate time slots
    if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Time slots are required'
      });
    }

    // Validate each time slot
    for (const slot of timeSlots) {
      if (!slot.startTime || !slot.endTime) {
        return res.status(400).json({
          success: false,
          message: 'Start time and end time are required for each slot'
        });
      }

      // Validate time format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid time format. Use HH:MM format'
        });
      }

      // Validate start time is before end time
      const startMinutes = parseInt(slot.startTime.split(':')[0]) * 60 + parseInt(slot.startTime.split(':')[1]);
      const endMinutes = parseInt(slot.endTime.split(':')[0]) * 60 + parseInt(slot.endTime.split(':')[1]);
      
      if (startMinutes >= endMinutes) {
        return res.status(400).json({
          success: false,
          message: 'Start time must be before end time'
        });
      }
    }

    // Check for overlapping time slots
    for (let i = 0; i < timeSlots.length; i++) {
      for (let j = i + 1; j < timeSlots.length; j++) {
        const slot1 = timeSlots[i];
        const slot2 = timeSlots[j];
        
        const start1 = parseInt(slot1.startTime.split(':')[0]) * 60 + parseInt(slot1.startTime.split(':')[1]);
        const end1 = parseInt(slot1.endTime.split(':')[0]) * 60 + parseInt(slot1.endTime.split(':')[1]);
        const start2 = parseInt(slot2.startTime.split(':')[0]) * 60 + parseInt(slot2.startTime.split(':')[1]);
        const end2 = parseInt(slot2.endTime.split(':')[0]) * 60 + parseInt(slot2.endTime.split(':')[1]);
        
        if ((start1 < end2 && end1 > start2)) {
          return res.status(400).json({
            success: false,
            message: 'Time slots cannot overlap'
          });
        }
      }
    }

    // Update or create schedule using MongoDB ID
    const schedule = await DoctorSchedule.findOneAndUpdate(
      { doctorId: doctor._id.toString(), date },
      {
        doctorId: doctor._id.toString(), // Use MongoDB ID
        date,
        timeSlots: timeSlots.map(slot => ({
          startTime: slot.startTime,
          endTime: slot.endTime,
          isAvailable: slot.isAvailable !== undefined ? slot.isAvailable : true,
          maxBookings: slot.maxBookings || 1,
          currentBookings: 0 // Reset current bookings
        })),
        isActive: true
      },
      { upsert: true, new: true }
    );

    console.log('✅ Schedule saved successfully:', {
      scheduleId: schedule._id,
      doctorId: schedule.doctorId,
      date: schedule.date,
      timeSlotsCount: schedule.timeSlots.length
    });

    res.json({
      success: true,
      message: 'Doctor schedule saved successfully',
      data: schedule
    });
  } catch (error) {
    console.error('Error saving doctor schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save doctor schedule',
      error: error.message
    });
  }
};

// Get available time slots for a specific doctor and date
const getAvailableTimeSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    console.log('🕐 Getting time slots for doctor:', doctorId, 'date:', date);

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID is required'
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required'
      });
    }

    // Get doctor schedule for the specific date
    const schedule = await DoctorSchedule.findOne({
      doctorId,
      date,
      isActive: true
    });

    if (!schedule) {
      // Create default time slots if no schedule exists
      const defaultTimeSlots = [
        { startTime: '09:00', endTime: '09:30', isAvailable: true, maxBookings: 1, currentBookings: 0 },
        { startTime: '09:30', endTime: '10:00', isAvailable: true, maxBookings: 1, currentBookings: 0 },
        { startTime: '10:00', endTime: '10:30', isAvailable: true, maxBookings: 1, currentBookings: 0 },
        { startTime: '10:30', endTime: '11:00', isAvailable: true, maxBookings: 1, currentBookings: 0 },
        { startTime: '11:00', endTime: '11:30', isAvailable: true, maxBookings: 1, currentBookings: 0 },
        { startTime: '11:30', endTime: '12:00', isAvailable: true, maxBookings: 1, currentBookings: 0 },
        { startTime: '14:00', endTime: '14:30', isAvailable: true, maxBookings: 1, currentBookings: 0 },
        { startTime: '14:30', endTime: '15:00', isAvailable: true, maxBookings: 1, currentBookings: 0 },
        { startTime: '15:00', endTime: '15:30', isAvailable: true, maxBookings: 1, currentBookings: 0 },
        { startTime: '15:30', endTime: '16:00', isAvailable: true, maxBookings: 1, currentBookings: 0 },
        { startTime: '16:00', endTime: '16:30', isAvailable: true, maxBookings: 1, currentBookings: 0 },
        { startTime: '16:30', endTime: '17:00', isAvailable: true, maxBookings: 1, currentBookings: 0 },
      ];

      // Create a default schedule for this date
      try {
        const defaultSchedule = new DoctorSchedule({
          doctorId,
          date,
          timeSlots: defaultTimeSlots,
          isActive: true
        });

        await defaultSchedule.save();
        console.log('📅 Created default schedule for doctor', doctorId, 'on', date);

        // Use the default schedule
        schedule = defaultSchedule;
      } catch (scheduleError) {
        console.error('❌ Error creating default schedule:', scheduleError);
        return res.status(500).json({
          success: false,
          message: 'Failed to create default schedule',
          error: scheduleError.message
        });
      }
    }

    // Get existing appointments for this doctor and date
    let appointments = [];
    try {
      appointments = await Appointment.find({
        doctorId,
        appointmentDate: new Date(date),
        status: { $in: ['confirmed', 'scheduled', 'pending'] }
      });
      console.log('📅 Found', appointments.length, 'existing appointments for', date);
    } catch (appointmentError) {
      console.log('⚠️ Error fetching appointments (continuing with empty list):', appointmentError.message);
      appointments = [];
    }

    // Filter available slots and return simple time strings
    let availableSlots = [];
    
    try {
      availableSlots = schedule.timeSlots.filter(slot => {
        if (!slot.isAvailable) return false;
        
        // Check if slot is fully booked
        const slotAppointments = appointments.filter(apt => {
          const aptTime = apt.appointmentTime;
          return aptTime >= slot.startTime && aptTime < slot.endTime;
        });
        
        return slotAppointments.length < slot.maxBookings;
      }).map(slot => slot.startTime); // Return just the start time as string

      console.log('🕐 Available time slots for doctor', doctorId, 'on', date, ':', availableSlots);
    } catch (filterError) {
      console.error('❌ Error filtering time slots:', filterError);
      // Return default time slots as fallback
      availableSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
    }

    res.json({
      success: true,
      data: availableSlots
    });
  } catch (error) {
    console.error('Error getting available time slots:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available time slots',
      error: error.message
    });
  }
};

// Book a time slot (called when appointment is created)
const bookTimeSlot = async (req, res) => {
  try {
    const { doctorId, date, startTime, endTime } = req.body;

    const schedule = await DoctorSchedule.findOne({
      doctorId,
      date,
      isActive: true
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found for this date'
      });
    }

    const success = schedule.bookSlot(startTime, endTime);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        message: 'Time slot is not available or fully booked'
      });
    }

    await schedule.save();

    res.json({
      success: true,
      message: 'Time slot booked successfully'
    });
  } catch (error) {
    console.error('Error booking time slot:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to book time slot',
      error: error.message
    });
  }
};

// Cancel a time slot booking (called when appointment is cancelled)
const cancelTimeSlotBooking = async (req, res) => {
  try {
    const { doctorId, date, startTime, endTime } = req.body;

    const schedule = await DoctorSchedule.findOne({
      doctorId,
      date,
      isActive: true
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found for this date'
      });
    }

    const success = schedule.cancelBooking(startTime, endTime);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        message: 'No booking found for this time slot'
      });
    }

    await schedule.save();

    res.json({
      success: true,
      message: 'Time slot booking cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling time slot booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel time slot booking',
      error: error.message
    });
  }
};

// Delete doctor schedule
const deleteDoctorSchedule = async (req, res) => {
  try {
    const { doctorId, date } = req.params;

    const schedule = await DoctorSchedule.findOneAndUpdate(
      { doctorId, date },
      { isActive: false },
      { new: true }
    );

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    res.json({
      success: true,
      message: 'Doctor schedule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting doctor schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete doctor schedule',
      error: error.message
    });
  }
};

module.exports = {
  getDoctorSchedule,
  saveDoctorSchedule,
  getAvailableTimeSlots,
  bookTimeSlot,
  cancelTimeSlotBooking,
  deleteDoctorSchedule
};
