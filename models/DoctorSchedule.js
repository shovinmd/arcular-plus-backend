const mongoose = require('mongoose');

const doctorScheduleSchema = new mongoose.Schema({
  doctorId: {
    type: String,
    required: true,
    index: true
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true,
    index: true
  },
  // Hospital-specific schedules
  hospitalSchedules: [{
    hospitalId: {
      type: String,
      required: true
    },
    hospitalName: {
      type: String,
      required: true
    },
    timeSlots: [{
      startTime: {
        type: String, // Format: HH:MM
        required: true
      },
      endTime: {
        type: String, // Format: HH:MM
        required: true
      },
      isAvailable: {
        type: Boolean,
        default: true
      },
      maxBookings: {
        type: Number,
        default: 1
      },
      currentBookings: {
        type: Number,
        default: 0
      },
      bookingType: {
        type: String,
        enum: ['consultation', 'follow-up', 'emergency'],
        default: 'consultation'
      }
    }],
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  // General time slots (for backward compatibility)
  timeSlots: [{
    startTime: {
      type: String, // Format: HH:MM
      required: true
    },
    endTime: {
      type: String, // Format: HH:MM
      required: true
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    maxBookings: {
      type: Number,
      default: 1
    },
    currentBookings: {
      type: Number,
      default: 0
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
doctorScheduleSchema.index({ doctorId: 1, date: 1 }, { unique: true });

// Method to get available time slots for a specific date
doctorScheduleSchema.methods.getAvailableSlots = function() {
  return this.timeSlots.filter(slot => 
    slot.isAvailable && slot.currentBookings < slot.maxBookings
  );
};

// Method to get available time slots for a specific hospital
doctorScheduleSchema.methods.getAvailableSlotsForHospital = function(hospitalId) {
  const hospitalSchedule = this.hospitalSchedules.find(hs => hs.hospitalId === hospitalId);
  if (!hospitalSchedule || !hospitalSchedule.isActive) {
    return [];
  }
  
  return hospitalSchedule.timeSlots.filter(slot => 
    slot.isAvailable && slot.currentBookings < slot.maxBookings
  );
};

// Method to get all hospital schedules with availability
doctorScheduleSchema.methods.getHospitalSchedulesWithAvailability = function() {
  return this.hospitalSchedules.map(hospitalSchedule => ({
    hospitalId: hospitalSchedule.hospitalId,
    hospitalName: hospitalSchedule.hospitalName,
    isActive: hospitalSchedule.isActive,
    availableSlots: hospitalSchedule.timeSlots.filter(slot => 
      slot.isAvailable && slot.currentBookings < slot.maxBookings
    ),
    totalSlots: hospitalSchedule.timeSlots.length,
    bookedSlots: hospitalSchedule.timeSlots.reduce((sum, slot) => sum + slot.currentBookings, 0)
  }));
};

// Method to book a time slot (general)
doctorScheduleSchema.methods.bookSlot = function(startTime, endTime) {
  const slot = this.timeSlots.find(s => 
    s.startTime === startTime && s.endTime === endTime
  );
  
  if (slot && slot.isAvailable && slot.currentBookings < slot.maxBookings) {
    slot.currentBookings += 1;
    return true;
  }
  return false;
};

// Method to book a time slot for a specific hospital
doctorScheduleSchema.methods.bookSlotForHospital = function(hospitalId, startTime, endTime, bookingType = 'consultation') {
  const hospitalSchedule = this.hospitalSchedules.find(hs => hs.hospitalId === hospitalId);
  if (!hospitalSchedule || !hospitalSchedule.isActive) {
    return false;
  }
  
  const slot = hospitalSchedule.timeSlots.find(s => 
    s.startTime === startTime && s.endTime === endTime
  );
  
  if (slot && slot.isAvailable && slot.currentBookings < slot.maxBookings) {
    slot.currentBookings += 1;
    slot.bookingType = bookingType;
    return true;
  }
  return false;
};

// Method to cancel a booking (general)
doctorScheduleSchema.methods.cancelBooking = function(startTime, endTime) {
  const slot = this.timeSlots.find(s => 
    s.startTime === startTime && s.endTime === endTime
  );
  
  if (slot && slot.currentBookings > 0) {
    slot.currentBookings -= 1;
    return true;
  }
  return false;
};

// Method to cancel a booking for a specific hospital
doctorScheduleSchema.methods.cancelBookingForHospital = function(hospitalId, startTime, endTime) {
  const hospitalSchedule = this.hospitalSchedules.find(hs => hs.hospitalId === hospitalId);
  if (!hospitalSchedule) {
    return false;
  }
  
  const slot = hospitalSchedule.timeSlots.find(s => 
    s.startTime === startTime && s.endTime === endTime
  );
  
  if (slot && slot.currentBookings > 0) {
    slot.currentBookings -= 1;
    return true;
  }
  return false;
};

module.exports = mongoose.model('DoctorSchedule', doctorScheduleSchema);
