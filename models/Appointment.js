const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  doctorName: {
    type: String,
    required: true,
    trim: true
  },
  doctorId: {
    type: String,
    required: true,
    index: true
  },
  patientId: {
    type: String,
    required: true,
    index: true
  },
  dateTime: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['Scheduled', 'Confirmed', 'Cancelled', 'Rescheduled', 'Completed'],
    default: 'Scheduled'
  },
  notes: {
    type: String,
    trim: true
  },
  duration: {
    type: Number, // in minutes
    default: 30
  },
  location: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['Consultation', 'Follow-up', 'Emergency', 'Routine'],
    default: 'Consultation'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
appointmentSchema.index({ patientId: 1, dateTime: -1 });
appointmentSchema.index({ doctorId: 1, dateTime: -1 });
appointmentSchema.index({ status: 1, dateTime: 1 });

// Virtual for formatted date
appointmentSchema.virtual('formattedDate').get(function() {
  return this.dateTime.toLocaleDateString();
});

// Virtual for formatted time
appointmentSchema.virtual('formattedTime').get(function() {
  return this.dateTime.toLocaleTimeString();
});

// Method to check if appointment is in the past
appointmentSchema.methods.isPast = function() {
  return this.dateTime < new Date();
};

// Method to check if appointment is today
appointmentSchema.methods.isToday = function() {
  const today = new Date();
  const appointmentDate = new Date(this.dateTime);
  return appointmentDate.toDateString() === today.toDateString();
};

// Static method to find appointments by patient
appointmentSchema.statics.findByPatient = function(patientId) {
  return this.find({ patientId }).sort({ dateTime: -1 });
};

// Static method to find appointments by doctor
appointmentSchema.statics.findByDoctor = function(doctorId) {
  return this.find({ doctorId }).sort({ dateTime: -1 });
};

// Static method to find upcoming appointments
appointmentSchema.statics.findUpcoming = function(userId, userType = 'patient') {
  const query = userType === 'doctor' ? { doctorId: userId } : { patientId: userId };
  return this.find({
    ...query,
    dateTime: { $gte: new Date() },
    status: { $nin: ['Cancelled', 'Completed'] }
  }).sort({ dateTime: 1 });
};

module.exports = mongoose.model('Appointment', appointmentSchema); 