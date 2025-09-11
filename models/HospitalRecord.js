const mongoose = require('mongoose');

const hospitalRecordSchema = new mongoose.Schema({
  // Hospital information
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  },
  hospitalName: {
    type: String,
    required: true
  },
  
  // Patient information
  patientId: {
    type: String, // Firebase UID
    required: true
  },
  patientArcId: {
    type: String,
    required: true
  },
  patientName: {
    type: String,
    required: true
  },
  patientEmail: {
    type: String,
    required: true
  },
  patientPhone: {
    type: String,
    required: true
  },
  patientDateOfBirth: {
    type: Date,
    required: true
  },
  patientGender: {
    type: String,
    required: true
  },
  
  // Visit information
  visitDate: {
    type: Date,
    default: Date.now
  },
  visitType: {
    type: String,
    enum: ['appointment', 'emergency', 'walk-in', 'follow-up'],
    required: true
  },
  
  // Medical information
  chiefComplaint: {
    type: String,
    required: true
  },
  diagnosis: {
    type: String,
    required: false
  },
  treatment: {
    type: String,
    required: false
  },
  prescription: [{
    medicineName: String,
    dosage: String,
    frequency: String,
    duration: String,
    instructions: String
  }],
  
  // Vital signs
  vitalSigns: {
    bloodPressure: String,
    heartRate: String,
    temperature: String,
    respiratoryRate: String,
    oxygenSaturation: String,
    weight: String,
    height: String
  },
  
  // Doctor information
  doctorId: {
    type: String, // Firebase UID
    required: false
  },
  doctorName: {
    type: String,
    required: false
  },
  doctorSpecialization: {
    type: String,
    required: false
  },
  
  // Additional information
  notes: {
    type: String,
    required: false
  },
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpDate: {
    type: Date,
    required: false
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  
  // Timestamps
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

// Indexes for better query performance
hospitalRecordSchema.index({ hospitalId: 1, visitDate: -1 });
hospitalRecordSchema.index({ patientArcId: 1 });
hospitalRecordSchema.index({ patientId: 1 });
hospitalRecordSchema.index({ doctorId: 1 });

module.exports = mongoose.model('HospitalRecord', hospitalRecordSchema);
