const mongoose = require('mongoose');

const labSchema = new mongoose.Schema({
  // Basic Information
  uid: {
    type: String,
    required: true,
    unique: true
  },
  labName: {
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
  
  // License Information
  licenseNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  licenseDocumentUrl: {
    type: String,
    required: true
  },
  
  // Services and Owner
  servicesProvided: [{
    type: String,
    required: true
  }],
  ownerName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Additional Lab Fields
  homeSampleCollection: {
    type: Boolean,
    default: false
  },
  alternateMobile: {
    type: String,
    trim: true
  },
  associatedHospital: {
    type: String,
    trim: true
  },
  accreditationCertificateUrl: {
    type: String
  },
  equipmentCertificateUrl: {
    type: String
  },
  
  // Hospital Affiliations
  affiliatedHospitals: [{
    hospitalId: { type: String, ref: 'Hospital' },
    hospitalName: { type: String, required: true },
    role: { type: String, enum: ['Primary', 'Secondary', 'Consultant', 'Partner', 'Emergency'], default: 'Partner' },
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
labSchema.pre('save', function(next) {
  if (!this.arcId) {
    this.arcId = 'LAB' + Date.now().toString().slice(-8);
  }
  this.updatedAt = new Date();
  next();
});

// Static methods
labSchema.statics.findByCity = function(city) {
  return this.find({ city: new RegExp(city, 'i'), isApproved: true });
};

labSchema.statics.findByService = function(service) {
  return this.find({ 
    servicesProvided: { $in: [new RegExp(service, 'i')] },
    isApproved: true 
  });
};

labSchema.statics.getPendingApprovals = function() {
  return this.find({ approvalStatus: 'pending' });
};

labSchema.statics.approveLab = function(labId, approvedBy, notes = '') {
  return this.findByIdAndUpdate(labId, {
    isApproved: true,
    approvalStatus: 'approved',
    approvedBy,
    approvedAt: new Date(),
    approvalNotes: notes
  });
};

labSchema.statics.rejectLab = function(labId, rejectedBy, reason = '') {
  return this.findByIdAndUpdate(labId, {
    isApproved: false,
    approvalStatus: 'rejected',
    rejectedBy,
    rejectedAt: new Date(),
    rejectionReason: reason
  });
};

module.exports = mongoose.model('Lab', labSchema); 