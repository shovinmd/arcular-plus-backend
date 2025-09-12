const mongoose = require('mongoose');

const labReportSchema = new mongoose.Schema({
  labId: {
    type: String,
    required: true,
    ref: 'User'
  },
  patientId: {
    type: String,
    required: true,
    ref: 'User'
  },
  patientName: {
    type: String,
    required: true
  },
  patientEmail: {
    type: String,
    default: ''
  },
  testName: {
    type: String,
    required: true
  },
  doctorId: {
    type: String,
    required: true,
    ref: 'User'
  },
  doctorName: {
    type: String,
    required: true
  },
  hospitalId: {
    type: String,
    required: true,
    ref: 'Hospital'
  },
  prescription: {
    type: String,
    required: true
  },
  urgency: {
    type: String,
    enum: ['normal', 'urgent', 'emergency'],
    default: 'normal'
  },
  notes: {
    type: String,
    default: ''
  },
  results: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('LabReport', labReportSchema);