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

    // Get schedules for the doctor using MongoDB ID, optionally filtered by hospital
    const query = { 
      doctorId: doctor._id.toString(), // Use MongoDB ID
      isActive: true 
    };
    
    // Add hospital filter if provided
    if (req.query.hospitalId) {
      query.hospitalId = req.query.hospitalId;
    }
    
    const schedules = await DoctorSchedule.find(query).sort({ date: 1 });

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

    // Generate individual 30-minute slots from time ranges
    const generatedSlots = [];
    
    for (const slot of timeSlots) {
      if (!slot.startTime || !slot.endTime) {
        return res.status(400).json({
          success: false,
          message: 'Start time and end time are required for each slot'
        });
      }

      // Convert 12-hour format to 24-hour format if needed
      const startTime24 = convertTo24Hour(slot.startTime);
      const endTime24 = convertTo24Hour(slot.endTime);

      // Validate time format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(startTime24) || !timeRegex.test(endTime24)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid time format. Use HH:MM format'
        });
      }

      // Generate individual 30-minute slots
      const slots = generateTimeSlots(startTime24, endTime24);
      generatedSlots.push(...slots);
    }

    console.log('🕐 Generated', generatedSlots.length, 'individual time slots from', timeSlots.length, 'ranges');

    // If a schedule exists for this doctor/date/hospital, MERGE new slots instead of overwriting
    const query = {
      doctorId: doctor._id.toString(),
      date,
      hospitalId: req.body.hospitalId || null,
    };

    let schedule = await DoctorSchedule.findOne(query);

    if (schedule) {
      const existingByKey = new Map();
      for (const s of schedule.timeSlots) {
        existingByKey.set(`${s.startTime}-${s.endTime}`, s);
      }

      for (const ns of generatedSlots) {
        const key = `${ns.startTime}-${ns.endTime}`;
        const found = existingByKey.get(key);
        if (found) {
          // Update configurables but keep currentBookings intact
          found.isAvailable = ns.isAvailable !== undefined ? ns.isAvailable : true;
          found.maxBookings = ns.maxBookings || found.maxBookings || 1;
          // do not reset found.currentBookings
        } else {
          schedule.timeSlots.push({
            startTime: ns.startTime,
            endTime: ns.endTime,
            isAvailable: ns.isAvailable !== undefined ? ns.isAvailable : true,
            maxBookings: ns.maxBookings || 1,
            currentBookings: 0,
          });
        }
      }

      // Ensure schedule meta fields are set
      schedule.isActive = true;
      schedule.hospitalName = req.body.hospitalName || schedule.hospitalName || null;
      await schedule.save();
    } else {
      // Create fresh schedule
      schedule = await DoctorSchedule.findOneAndUpdate(
        query,
        {
          doctorId: doctor._id.toString(),
          date,
          hospitalId: req.body.hospitalId || null,
          hospitalName: req.body.hospitalName || null,
          timeSlots: generatedSlots.map(slot => ({
            startTime: slot.startTime,
            endTime: slot.endTime,
            isAvailable: slot.isAvailable !== undefined ? slot.isAvailable : true,
            maxBookings: slot.maxBookings || 1,
            currentBookings: 0,
          })),
          isActive: true,
        },
        { upsert: true, new: true }
      );
    }

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
    console.log('🔍 Query params:', req.query);

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

    // Optional hospital filter so slots are hospital-specific
    const { hospitalId } = req.query || {};
    const hospitalIdNorm = hospitalId ? String(hospitalId).trim() : null;
    console.log('🏥 Hospital filter (normalized):', hospitalIdNorm);

    // Resolve both Mongo doctorId and Firebase UID for cross-collection matching
    let doctorDoc = null;
    try {
      doctorDoc = await Doctor.findById(doctorId);
      if (!doctorDoc) {
        doctorDoc = await Doctor.findOne({ uid: doctorId });
      }
    } catch (_) {}
    const doctorUid = doctorDoc?.uid ? String(doctorDoc.uid) : undefined;

    // Choose the correct identifier used in schedules (Mongo _id string)
    const scheduleDoctorId = doctorDoc ? String(doctorDoc._id) : String(doctorId);
    console.log('👨‍⚕️ Doctor resolved:', {
      originalId: doctorId,
      mongoId: doctorDoc?._id,
      scheduleDoctorId: scheduleDoctorId,
      doctorName: doctorDoc?.fullName
    });

    // Get doctor schedule for the specific date (and hospital when provided)
    let schedule = await DoctorSchedule.findOne({
      doctorId: scheduleDoctorId,
      date,
      isActive: true,
      ...(hospitalIdNorm ? { hospitalId: hospitalIdNorm } : {})
    });
    
    console.log('📅 Schedule query result:', {
      found: !!schedule,
      scheduleId: schedule?._id,
      timeSlotsCount: schedule?.timeSlots?.length || 0,
      hospitalId: schedule?.hospitalId
    });

    // STRICT HOSPITAL SCOPING: If hospitalId is provided but no schedule is
    // found for that hospital, do NOT fall back to unscoped. This prevents
    // showing slots from a different hospital when a specific hospital is
    // selected.

    if (!schedule) {
      if (hospitalIdNorm) {
        // When a hospital is explicitly selected, do NOT fallback. Return no slots.
        console.log('❌ No schedule for selected hospital. Not falling back.');
        // Debug: list schedules available for this doctor/date
        const candidates = await DoctorSchedule.find({ doctorId: scheduleDoctorId, date, isActive: true }).select('hospitalId timeSlots.length');
        console.log('🧪 Candidate schedules for doctor/date:', candidates);
        return res.json({ success: true, data: [], message: 'No slots available for this date at the selected hospital' });
      } else {
        console.log('🔄 No hospital specified; trying broad fallback (any hospital)...');
        schedule = await DoctorSchedule.findOne({
          doctorId: scheduleDoctorId,
          date,
          isActive: true,
        });

        console.log('📅 Broad fallback schedule query result:', {
          found: !!schedule,
          scheduleId: schedule?._id,
          timeSlotsCount: schedule?.timeSlots?.length || 0,
          hospitalIdFound: schedule?.hospitalId || null
        });

        if (!schedule) {
          console.log('❌ No schedule found for doctor', scheduleDoctorId, 'on date', date);
          return res.json({ success: true, data: [] });
        }
      }
    }

    // Get existing appointments for this doctor and date
    let appointments = [];
    try {
      const appointmentQuery = {
        // Appointments may store doctorId as Mongo ID or Firebase UID. Match both.
        doctorId: doctorUid ? { $in: [doctorId, doctorUid] } : doctorId,
        appointmentDate: new Date(date),
        // Use correct field name from schema: appointmentStatus
        appointmentStatus: { $in: ['confirmed', 'scheduled', 'pending'] }
      };
      if (hospitalId) {
        appointmentQuery.hospitalId = hospitalId;
      }
      appointments = await Appointment.find(appointmentQuery);
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

    console.log('✅ Final result:', {
      availableSlotsCount: availableSlots.length,
      availableSlots: availableSlots
    });

    // If no slots available, return explicit message and empty list (frontend can show acknowledgement)
    if (!availableSlots || availableSlots.length === 0) {
      console.log('⚠️ No slots available, returning empty array');
      return res.json({ success: true, data: [], message: 'No slots available for this date at the selected hospital' });
    }

    res.json({ success: true, data: availableSlots });
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

// Delete a specific time slot from a day's schedule
const deleteTimeSlot = async (req, res) => {
  try {
    const { doctorId, date } = req.params;
    const { startTime, endTime, hospitalId } = req.body || {};

    if (!startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'startTime and endTime are required' });
    }

    // When multiple hospital-scoped schedules exist for same date, we must
    // target the correct schedule. If hospitalId is not provided and more than
    // one schedule exists, return a clear error instead of deleting from the
    // wrong schedule.
    let schedule = null;
    if (hospitalId) {
      schedule = await DoctorSchedule.findOne({
        doctorId,
        date,
        isActive: true,
        hospitalId,
      });
    } else {
      const schedules = await DoctorSchedule.find({ doctorId, date, isActive: true });
      if (schedules.length > 1) {
        return res.status(400).json({
          success: false,
          message: 'Multiple hospital schedules exist for this date. Provide hospitalId to delete a specific slot.',
        });
      }
      schedule = schedules[0] || null;
    }

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    const before = schedule.timeSlots.length;
    schedule.timeSlots = schedule.timeSlots.filter(
      s => !(s.startTime === startTime && s.endTime === endTime)
    );
    const after = schedule.timeSlots.length;

    if (after === 0) {
      // If no slots left for this date/hospital, delete the schedule doc so UI won't show "Active" section
      await DoctorSchedule.deleteOne({ _id: schedule._id });
      return res.json({ success: true, removed: before, remaining: 0, scheduleDeleted: true });
    }

    await schedule.save();
    return res.json({ success: true, removed: before - after, remaining: after, scheduleDeleted: false });
  } catch (e) {
    console.error('❌ Error deleting time slot:', e);
    return res.status(500).json({ success: false, message: 'Failed to delete time slot' });
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

// Helper function to convert 12-hour format to 24-hour format
function convertTo24Hour(time12Hour) {
  // If already in 24-hour format, return as is
  if (!time12Hour.includes('AM') && !time12Hour.includes('PM')) {
    return time12Hour;
  }
  
  const parts = time12Hour.split(' ');
  const timePart = parts[0];
  const period = parts.length > 1 ? parts[1] : '';
  
  const timeComponents = timePart.split(':');
  let hour = parseInt(timeComponents[0]);
  const minute = timeComponents[1];
  
  if (period.toUpperCase() === 'PM' && hour !== 12) {
    hour += 12;
  } else if (period.toUpperCase() === 'AM' && hour === 12) {
    hour = 0;
  }
  
  return `${hour.toString().padStart(2, '0')}:${minute}`;
}

// Helper function to generate individual 30-minute slots from time range
function generateTimeSlots(startTime, endTime) {
  const slots = [];
  
  // Parse start and end times
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  // Convert to minutes for easier calculation
  let currentMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  
  // Generate 30-minute slots
  while (currentMinutes < endMinutes) {
    const slotStartMinutes = currentMinutes;
    const slotEndMinutes = Math.min(currentMinutes + 30, endMinutes);
    
    // Convert back to HH:MM format
    const slotStartHour = Math.floor(slotStartMinutes / 60);
    const slotStartMin = slotStartMinutes % 60;
    const slotEndHour = Math.floor(slotEndMinutes / 60);
    const slotEndMin = slotEndMinutes % 60;
    
    const slotStartTime = `${slotStartHour.toString().padStart(2, '0')}:${slotStartMin.toString().padStart(2, '0')}`;
    const slotEndTime = `${slotEndHour.toString().padStart(2, '0')}:${slotEndMin.toString().padStart(2, '0')}`;
    
    slots.push({
      startTime: slotStartTime,
      endTime: slotEndTime,
      isAvailable: true,
      maxBookings: 1,
      currentBookings: 0
    });
    
    currentMinutes += 30;
  }
  
  return slots;
}

module.exports = {
  getDoctorSchedule,
  saveDoctorSchedule,
  getAvailableTimeSlots,
  bookTimeSlot,
  cancelTimeSlotBooking,
  deleteDoctorSchedule,
  deleteTimeSlot
};
