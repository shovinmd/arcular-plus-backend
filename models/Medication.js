const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  dose: {
    type: String,
    required: true,
    trim: true
  },
  frequency: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['tablet', 'syrup', 'drops', 'cream', 'other'],
    default: 'tablet'
  },
  isTaken: {
    type: Boolean,
    default: false
  },
  patientId: {
    type: String,
    required: true,
    index: true
  },
  doctorId: {
    type: String,
    required: false, // Made optional for user-added medicines
    index: true
  },
  prescribedDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  instructions: {
    type: String,
    trim: true
  },
  sideEffects: {
    type: String,
    trim: true
  },
  quantity: {
    type: Number,
    default: 1
  },
  unit: {
    type: String,
    enum: ['tablets', 'bottles', 'tubes', 'pieces'],
    default: 'tablets'
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'discontinued'],
    default: 'active'
  },
  // New fields for enhanced medicine tracking
  dosage: {
    type: String, // e.g., "500mg", "10ml"
    trim: true
  },
  duration: {
    type: String, // e.g., "7 days", "2 weeks"
    trim: true
  },
  times: [{
    type: String // Array of times like ["09:00", "21:00"]
  }],
  startDate: {
    type: Date,
    default: Date.now
  },
  // FCM notification fields
  notificationEnabled: {
    type: Boolean,
    default: true
  },
  lastNotificationSent: {
    type: Date
  },
  nextNotificationTime: {
    type: Date
  },
  // Medicine completion tracking
  completedAt: {
    type: Date
  },
  lastAction: {
    type: String,
    enum: ['taken', 'skipped', 'snoozed'],
    default: null
  },
  actionHistory: [{
    action: {
      type: String,
      enum: ['taken', 'skipped', 'snoozed']
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  // Daily tracking for medicine taken
  dailyTaken: [{
    date: {
      type: Date,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    action: {
      type: String,
      enum: ['taken', 'skipped'],
      default: 'taken'
    }
  }],
  lastTakenAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better query performance
medicationSchema.index({ patientId: 1, status: 1 });
medicationSchema.index({ doctorId: 1, prescribedDate: -1 });
medicationSchema.index({ patientId: 1, isTaken: 1 });

// Virtual for medication status
medicationSchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

// Virtual for formatted prescribed date
medicationSchema.virtual('formattedPrescribedDate').get(function() {
  return this.prescribedDate.toLocaleDateString();
});

// Method to mark as taken
medicationSchema.methods.markAsTaken = function() {
  this.isTaken = true;
  return this.save();
};

// Method to mark as not taken
medicationSchema.methods.markAsNotTaken = function() {
  this.isTaken = false;
  return this.save();
};

// Static method to find medications by patient
medicationSchema.statics.findByPatient = function(patientId) {
  return this.find({ patientId }).sort({ prescribedDate: -1 });
};

// Static method to find active medications by patient
medicationSchema.statics.findActiveByPatient = function(patientId) {
  return this.find({ patientId, status: 'active' }).sort({ prescribedDate: -1 });
};

// Static method to find medications by doctor
medicationSchema.statics.findByDoctor = function(doctorId) {
  return this.find({ doctorId }).sort({ prescribedDate: -1 });
};

// Static method to find medications that need to be taken
medicationSchema.statics.findPendingByPatient = function(patientId) {
  return this.find({ 
    patientId, 
    status: 'active', 
    isTaken: false 
  }).sort({ prescribedDate: -1 });
};

module.exports = mongoose.model('Medication', medicationSchema); 