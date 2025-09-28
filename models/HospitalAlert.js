const mongoose = require('mongoose');

const hospitalAlertSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  },
  hospitalName: {
    type: String,
    required: true
  },
  patientId: {
    type: String,
    required: true
  },
  patientName: {
    type: String,
    required: true
  },
  patientPhone: {
    type: String,
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  address: {
    type: String,
    required: true
  },
  alertType: {
    type: String,
    enum: ['direct_hospital_alert', 'sos_request', 'emergency_call'],
    default: 'direct_hospital_alert'
  },
  status: {
    type: String,
    enum: ['pending', 'acknowledged', 'responded', 'completed', 'cancelled'],
    default: 'pending'
  },
  timestamp: {
    type: Date,
    required: true
  },
  acknowledgedAt: {
    type: Date
  },
  respondedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  responseDetails: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for geospatial queries
hospitalAlertSchema.index({ location: '2dsphere' });

// Index for hospital queries
hospitalAlertSchema.index({ hospitalId: 1, status: 1 });

// Index for patient queries
hospitalAlertSchema.index({ patientId: 1, createdAt: -1 });

// Update the updatedAt field before saving
hospitalAlertSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('HospitalAlert', hospitalAlertSchema);
