const mongoose = require('mongoose');

const patientAssignmentSchema = new mongoose.Schema({
  // Assignment Details
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  
  // Doctor Assignment
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctorArcId: {
    type: String,
    required: true
  },
  doctorName: {
    type: String,
    required: true
  },
  
  // Nurse Assignment
  nurseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Nurse',
    required: true
  },
  nurseName: {
    type: String,
    required: true
  },
  
  // Hospital Details
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  },
  hospitalName: {
    type: String,
    required: true
  },
  
  // Assignment Details
  ward: {
    type: String,
    required: true,
    enum: [
      'General Ward',
      'ICU',
      'Emergency Ward',
      'Cardiology Ward',
      'Neurology Ward',
      'Orthopedic Ward',
      'Pediatric Ward',
      'Maternity Ward',
      'Surgery Ward',
      'Oncology Ward',
      'Psychiatric Ward',
      'Dermatology Ward',
      'ENT Ward',
      'Ophthalmology Ward',
      'Urology Ward',
      'Gastroenterology Ward',
      'Pulmonology Ward',
      'Endocrinology Ward',
      'Rheumatology Ward',
      'Hematology Ward'
    ]
  },
  
  shift: {
    type: String,
    required: true,
    enum: [
      'Morning (6 AM - 2 PM)',
      'Evening (2 PM - 10 PM)',
      'Night (10 PM - 6 AM)'
    ]
  },
  
  assignmentDate: {
    type: Date,
    required: true
  },
  
  assignmentTime: {
    type: String,
    required: true
  },
  
  // Status and Tracking
  status: {
    type: String,
    enum: ['assigned', 'active', 'completed', 'cancelled'],
    default: 'assigned'
  },
  
  // Completion Details
  completedAt: {
    type: Date
  },
  
  completedBy: {
    type: String, // 'nurse' or 'doctor'
    enum: ['nurse', 'doctor']
  },
  
  // Notes and Comments
  notes: {
    type: String,
    default: ''
  },
  
  // Prescription Tab (for future use)
  prescription: {
    type: String,
    default: ''
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

// Index for efficient queries
patientAssignmentSchema.index({ patientId: 1, status: 1 });
patientAssignmentSchema.index({ doctorId: 1, status: 1 });
patientAssignmentSchema.index({ nurseId: 1, status: 1 });
patientAssignmentSchema.index({ hospitalId: 1, status: 1 });
patientAssignmentSchema.index({ assignmentDate: 1 });

module.exports = mongoose.model('PatientAssignment', patientAssignmentSchema);
