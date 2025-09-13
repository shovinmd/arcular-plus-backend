const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  // Basic Information
  appointmentId: {
    type: String,
    required: true,
    unique: true
  },
  
  // User Information
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  userEmail: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userPhone: {
    type: String,
    required: true
  },
  
  // Doctor Information
  doctorId: {
    type: String,
    required: true,
    ref: 'User'
  },
  doctorName: {
    type: String,
    required: true
  },
  doctorEmail: {
    type: String,
    required: true
  },
  doctorPhone: {
    type: String,
    required: true
  },
  doctorSpecialization: {
    type: String,
    required: true
  },
  doctorConsultationFee: {
    type: Number,
    required: true
  },
  
  // Hospital Information
  hospitalId: {
    type: String,
    ref: 'Hospital'
  },
  hospitalName: {
    type: String,
    required: true
  },
  hospitalAddress: {
    type: String,
    required: true
  },
  
  // Appointment Details
  appointmentDate: {
    type: Date,
    required: true
  },
  appointmentTime: {
    type: String,
    required: true
  },
  appointmentType: {
    type: String,
    enum: ['consultation', 'follow-up', 'emergency', 'routine'],
    default: 'consultation'
  },
  appointmentStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'rescheduled'],
    default: 'pending'
  },
  
  // Medical Information
  reason: {
    type: String,
    required: true
  },
  symptoms: {
    type: String
  },
  medicalHistory: {
    type: String
  },
  
  // Payment Information
  consultationFee: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'online', 'insurance'],
    default: 'cash'
  },
  
  // Communication
  emailSent: {
    type: Boolean,
    default: false
  },
  smsSent: {
    type: Boolean,
    default: false
  },
  notificationSent: {
    type: Boolean,
    default: false
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  confirmedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  
  // Additional Information
  notes: {
    type: String
  },
  prescription: {
    type: String
  },
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpDate: {
    type: Date
  }
});

// Indexes for better performance
appointmentSchema.index({ userId: 1, appointmentDate: 1 });
appointmentSchema.index({ doctorId: 1, appointmentDate: 1 });
appointmentSchema.index({ appointmentStatus: 1 });
appointmentSchema.index({ appointmentDate: 1, appointmentTime: 1 });

// Pre-save middleware to generate appointment ID
appointmentSchema.pre('save', function(next) {
  if (this.isNew && !this.appointmentId) {
    this.appointmentId = `APT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Appointment', appointmentSchema);