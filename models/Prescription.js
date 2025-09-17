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
  duration: {
    type: String,
    required: true,
    trim: true
  },
  instructions: {
    type: String,
    trim: true
  }
});

const prescriptionSchema = new mongoose.Schema({
  // Patient Information
  patientArcId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  patientName: {
    type: String,
    trim: true
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
    trim: true
  },
  
  // Doctor Information
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  doctorName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Prescription Details
  diagnosis: {
    type: String,
    required: true,
    trim: true
  },
  medications: [medicationSchema],
  instructions: {
    type: String,
    trim: true
  },
  followUpDate: {
    type: Date
  },
  notes: {
    type: String,
    trim: true
  },
  
  // Status and Dates
  status: {
    type: String,
    enum: ['Active', 'Completed', 'Discontinued', 'Archived'],
    default: 'Active',
    index: true
  },
  prescriptionDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  completionDate: {
    type: Date
  },
  archiveDate: {
    type: Date
  },
  
  // Additional Information
  completionNotes: {
    type: String,
    trim: true
  },
  archiveReason: {
    type: String,
    trim: true
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
prescriptionSchema.index({ patientArcId: 1, status: 1 });
prescriptionSchema.index({ doctorId: 1, status: 1 });
prescriptionSchema.index({ hospitalId: 1, status: 1 });
prescriptionSchema.index({ prescriptionDate: -1 });

// Virtual for prescription ID
prescriptionSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Pre-save middleware to update updatedBy
prescriptionSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedBy = this.createdBy; // For now, using createdBy as updatedBy
  }
  next();
});

// Static method to get prescriptions by patient ARC ID
prescriptionSchema.statics.getByPatientArcId = function(patientArcId, status = null) {
  const query = { patientArcId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('hospitalId', 'fullName')
    .populate('doctorId', 'fullName')
    .sort({ prescriptionDate: -1 });
};

// Static method to get prescriptions by doctor
prescriptionSchema.statics.getByDoctor = function(doctorId, status = null) {
  const query = { doctorId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('hospitalId', 'fullName')
    .populate('doctorId', 'fullName')
    .sort({ prescriptionDate: -1 });
};

// Static method to get prescriptions by hospital
prescriptionSchema.statics.getByHospital = function(hospitalId, status = null) {
  const query = { hospitalId };
  if (status) query.status = status;
  
  return this.find(query)
    .populate('hospitalId', 'fullName')
    .populate('doctorId', 'fullName')
    .sort({ prescriptionDate: -1 });
};

// Instance method to mark as completed
prescriptionSchema.methods.markCompleted = function(completionNotes = '') {
  this.status = 'Completed';
  this.completionDate = new Date();
  this.completionNotes = completionNotes;
  return this.save();
};

// Instance method to archive
prescriptionSchema.methods.archive = function(archiveReason = '') {
  this.status = 'Archived';
  this.archiveDate = new Date();
  this.archiveReason = archiveReason;
  return this.save();
};

module.exports = mongoose.model('Prescription', prescriptionSchema);