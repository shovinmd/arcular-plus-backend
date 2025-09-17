const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctorName: {
    type: String,
    required: true,
    trim: true
  },
  appointmentDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Scheduled', 'Completed', 'Cancelled', 'No Show'],
    default: 'Scheduled'
  },
  notes: {
    type: String,
    trim: true
  }
});

const labReportSchema = new mongoose.Schema({
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabReport',
    required: true
  },
  testName: {
    type: String,
    required: true,
    trim: true
  },
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true
  },
  labName: {
    type: String,
    required: true,
    trim: true
  },
  testDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  results: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  }
});

const billingSchema = new mongoose.Schema({
  billId: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Paid', 'Overdue', 'Cancelled'],
    default: 'Pending'
  },
  paymentDate: {
    type: Date
  },
  paymentMethod: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  }
});

const patientRecordSchema = new mongoose.Schema({
  // Patient Information
  patientArcId: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true
  },
  patientName: {
    type: String,
    required: true,
    trim: true
  },
  patientId: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  
  // Hospital Information
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
    index: true
  },
  hospitalName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Doctor Assignment
  assignedDoctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  assignedDoctorName: {
    type: String,
    trim: true
  },
  
  // Admission Information
  admissionDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  dischargeDate: {
    type: Date
  },
  admissionReason: {
    type: String,
    required: true,
    trim: true
  },
  
  // Medical Information
  diagnosis: {
    type: String,
    trim: true
  },
  treatmentPlan: {
    type: String,
    trim: true
  },
  medicalHistory: {
    type: String,
    trim: true
  },
  allergies: [{
    type: String,
    trim: true
  }],
  
  // Records
  prescriptions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription'
  }],
  appointments: [appointmentSchema],
  labReports: [labReportSchema],
  billingHistory: [billingSchema],
  
  // Status
  status: {
    type: String,
    enum: ['Active', 'Discharged', 'Transferred', 'Archived'],
    default: 'Active',
    index: true
  },
  
  // Additional Information
  notes: {
    type: String,
    trim: true
  },
  emergencyContact: {
    name: {
      type: String,
      trim: true
    },
    relationship: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    }
  },
  
  // System Fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
patientRecordSchema.index({ patientArcId: 1, status: 1 });
patientRecordSchema.index({ hospitalId: 1, status: 1 });
patientRecordSchema.index({ assignedDoctorId: 1, status: 1 });
patientRecordSchema.index({ admissionDate: -1 });

// Virtual for patient record ID
patientRecordSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Virtual for total billing amount
patientRecordSchema.virtual('totalBilling').get(function() {
  return this.billingHistory.reduce((total, bill) => total + bill.amount, 0);
});

// Virtual for active prescriptions count
patientRecordSchema.virtual('activePrescriptionsCount').get(function() {
  return this.prescriptions.filter(prescription => prescription.status === 'Active').length;
});

// Pre-save middleware to update updatedBy
patientRecordSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedBy = this.createdBy; // For now, using createdBy as updatedBy
  }
  next();
});

// Static method to get patient records by hospital
patientRecordSchema.statics.getByHospital = function(hospitalId, status = null) {
  const query = { hospitalId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('assignedDoctorId', 'fullName')
    .populate('prescriptions')
    .sort({ admissionDate: -1 });
};

// Static method to get patient records by doctor
patientRecordSchema.statics.getByDoctor = function(doctorId, status = null) {
  const query = { assignedDoctorId: doctorId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('hospitalId', 'fullName')
    .populate('prescriptions')
    .sort({ admissionDate: -1 });
};

// Instance method to add prescription
patientRecordSchema.methods.addPrescription = function(prescriptionId) {
  if (!this.prescriptions.includes(prescriptionId)) {
    this.prescriptions.push(prescriptionId);
  }
  return this.save();
};

// Instance method to add appointment
patientRecordSchema.methods.addAppointment = function(appointmentData) {
  this.appointments.push(appointmentData);
  return this.save();
};

// Instance method to add lab report
patientRecordSchema.methods.addLabReport = function(labReportData) {
  this.labReports.push(labReportData);
  return this.save();
};

// Instance method to add billing
patientRecordSchema.methods.addBilling = function(billingData) {
  this.billingHistory.push(billingData);
  return this.save();
};

// Instance method to discharge patient
patientRecordSchema.methods.discharge = function(dischargeNotes = '') {
  this.status = 'Discharged';
  this.dischargeDate = new Date();
  this.notes = dischargeNotes;
  return this.save();
};

// Instance method to archive record
patientRecordSchema.methods.archive = function(archiveReason = '') {
  this.status = 'Archived';
  this.notes = archiveReason;
  return this.save();
};

module.exports = mongoose.model('PatientRecord', patientRecordSchema);
