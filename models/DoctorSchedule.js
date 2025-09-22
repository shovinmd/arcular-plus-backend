const mongoose = require('mongoose');

const doctorScheduleSchema = new mongoose.Schema({
  doctorId: {
    type: String,
    required: true,
    index: true
  },
  // Hospital context (optional for backward compatibility)
  hospitalId: {
    type: String,
    default: null,
    index: true
  },
  hospitalName: {
    type: String,
    default: null
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true,
    index: true
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

// Compound index for efficient queries and hospital isolation
// Unique per doctor, date, and hospital (hospitalId may be null)
doctorScheduleSchema.index({ doctorId: 1, date: 1, hospitalId: 1 }, { unique: true });

// Method to get available time slots for a specific date
doctorScheduleSchema.methods.getAvailableSlots = function() {
  return this.timeSlots.filter(slot => 
    slot.isAvailable && slot.currentBookings < slot.maxBookings
  );
};

// Method to book a time slot
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

// Method to cancel a booking
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

const DoctorSchedule = mongoose.model('DoctorSchedule', doctorScheduleSchema);

// One-time safe migration: drop legacy unique index (doctorId+date) if present
(async () => {
  try {
    if (!DoctorSchedule.collection?.indexExists) return; // older drivers fallback
    const indexes = await DoctorSchedule.collection.indexes();
    const legacy = indexes.find(i => i.name === 'doctorId_1_date_1');
    if (legacy) {
      await DoctorSchedule.collection.dropIndex('doctorId_1_date_1');
      // Recreate the new composite index explicitly to be safe
      await DoctorSchedule.collection.createIndex(
        { doctorId: 1, date: 1, hospitalId: 1 },
        { unique: true, name: 'doctorId_1_date_1_hospitalId_1' }
      );
      console.log('🛠️ Migrated DoctorSchedule index to include hospitalId');
    }
  } catch (e) {
    // Non-fatal: log and continue
    console.log('ℹ️ DoctorSchedule index check:', e.message);
  }
})();

module.exports = DoctorSchedule;
