const mongoose = require('mongoose');

const healthRecordSchema = new mongoose.Schema({
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
  doctorId: {
    type: String,
    required: true
  },
  doctorName: {
    type: String,
    required: true
  },
  hospitalId: {
    type: String,
    required: true
  },
  appointmentId: {
    type: String,
    required: true
  },
  visitDate: {
    type: Date,
    required: true
  },
  consultationFee: {
    type: Number,
    default: 0
  },
  diagnosis: {
    type: String,
    default: ''
  },
  treatment: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['completed', 'pending', 'cancelled'],
    default: 'completed'
  },
  visitType: {
    type: String,
    enum: ['consultation', 'follow-up', 'emergency'],
    default: 'consultation'
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('HealthRecord', healthRecordSchema);
