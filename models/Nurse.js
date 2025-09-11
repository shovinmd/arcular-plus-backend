const mongoose = require('mongoose');

const nurseSchema = new mongoose.Schema({
  // Basic Information
  uid: {
    type: String,
    required: true,
    unique: true
  },
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  mobileNumber: {
    type: String,
    required: true,
    trim: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  
  // Professional Information
  qualification: {
    type: String,
    required: true,
    trim: true
  },
  experienceYears: {
    type: Number,
    required: true,
    min: 0
  },
  licenseNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  registrationNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  licenseDocumentUrl: {
    type: String,
    required: true
  },
  hospitalAffiliation: {
    type: String,
    required: true,
    trim: true
  },
  
  // Enhanced Hospital Affiliations
  affiliatedHospitals: [{
    hospitalId: { type: String, ref: 'Hospital' },
    hospitalName: { type: String, required: true },
    role: { type: String, enum: ['Primary', 'Secondary', 'Staff', 'Senior', 'Emergency', 'ICU'], default: 'Staff' },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: false },
    isActive: { type: Boolean, default: true }
  }],
  
  // Address Information
  address: {
    type: String,
    required: true,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  pincode: {
    type: String,
    required: true,
    trim: true
  },
  longitude: { type: Number, required: false },
  latitude: { type: Number, required: false },
  
  // Profile and System
  profileImageUrl: {
    type: String,
    required: true
  },
  
  // Additional Professional Fields
  currentHospital: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['Primary', 'Secondary', 'Staff', 'Senior', 'Emergency', 'ICU'],
    default: 'Staff'
  },
  bio: {
    type: String,
    trim: true
  },
  education: {
    type: String,
    trim: true
  },
  workingHours: {
    type: Map,
    of: String
  },
  nursingDegreeUrl: {
    type: String
  },
  identityProofUrl: {
    type: String
  },
  
  // Shift Management
  shifts: [{
    hospitalId: { type: String, ref: 'Hospital' },
    hospitalName: { type: String },
    shiftType: { 
      type: String, 
      enum: ['morning', 'evening', 'night', 'custom'],
      default: 'morning'
    },
    startTime: { type: String },
    endTime: { type: String },
    isActive: { type: Boolean, default: true },
    updatedAt: { type: Date, default: Date.now }
  }],
  
  // Approval Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: String,
    ref: 'ArcStaff'
  },
  approvedAt: {
    type: Date
  },
  approvalNotes: {
    type: String
  },
  rejectedBy: {
    type: String,
    ref: 'ArcStaff'
  },
  rejectedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  
  // System Fields
  arcId: {
    type: String,
    unique: true,
    sparse: true
  },
  qrCode: {
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

// Pre-save hook to generate arcId and update timestamp
nurseSchema.pre('save', function(next) {
  if (!this.arcId) {
    this.arcId = 'NUR' + Date.now().toString().slice(-8);
  }
  this.updatedAt = new Date();
  next();
});

// Static methods
nurseSchema.statics.findByHospital = function(hospitalName) {
  return this.find({ 
    hospitalAffiliation: new RegExp(hospitalName, 'i'),
    isApproved: true 
  });
};

nurseSchema.statics.findByQualification = function(qualification) {
  return this.find({ 
    qualification: new RegExp(qualification, 'i'),
    isApproved: true 
  });
};

nurseSchema.statics.getPendingApprovals = function() {
  return this.find({ approvalStatus: 'pending' });
};

nurseSchema.statics.approveNurse = function(nurseId, approvedBy, notes = '') {
  return this.findByIdAndUpdate(nurseId, {
    isApproved: true,
    approvalStatus: 'approved',
    approvedBy,
    approvedAt: new Date(),
    approvalNotes: notes
  });
};

nurseSchema.statics.rejectNurse = function(nurseId, rejectedBy, reason = '') {
  return this.findByIdAndUpdate(nurseId, {
    isApproved: false,
    approvalStatus: 'rejected',
    rejectedBy,
    rejectedAt: new Date(),
    rejectionReason: reason
  });
};

module.exports = mongoose.model('Nurse', nurseSchema); 