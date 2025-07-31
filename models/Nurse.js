const mongoose = require('mongoose');

const nurseSchema = new mongoose.Schema({
  // Basic Information
  name: {
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
  phone: {
    type: String,
    required: true,
    trim: true
  },
  alternatePhone: {
    type: String,
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: true
  },
  
  // Professional Information
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
  specialization: {
    type: String,
    required: true,
    trim: true
  },
  experience: {
    type: Number,
    default: 0
  },
  education: {
    type: String,
    required: true,
    trim: true
  },
  qualification: {
    type: String,
    required: true,
    trim: true
  },
  
  // Employment Details
  hospitalId: {
    type: String,
    required: true,
    index: true
  },
  department: {
    type: String,
    required: true,
    trim: true
  },
  designation: {
    type: String,
    required: true,
    trim: true
  },
  joiningDate: {
    type: Date,
    default: Date.now
  },
  shift: {
    type: String,
    enum: ['Morning', 'Evening', 'Night', 'Flexible'],
    default: 'Morning'
  },
  
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
  
  // Professional Certificates
  certificateUrl: {
    type: String,
    trim: true
  },
  licenseDocumentUrl: {
    type: String,
    trim: true
  },
  
  // Status and Approval
  status: {
    type: String,
    enum: ['active', 'inactive', 'on_leave', 'suspended'],
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
  
  // Additional Information
  bio: {
    type: String,
    trim: true
  },
  imageUrl: {
    type: String,
    trim: true
  },
  emergencyContact: {
    name: String,
    phone: String,
    relation: String
  },
  
  // Firebase Integration
  uid: {
    type: String,
    required: true,
    unique: true
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
nurseSchema.index({ hospitalId: 1, department: 1 });
nurseSchema.index({ status: 1, specialization: 1 });
nurseSchema.index({ licenseNumber: 1 });
nurseSchema.index({ registrationNumber: 1 });
nurseSchema.index({ uid: 1 });

// Virtual for full name
nurseSchema.virtual('fullName').get(function() {
  return this.name;
});

// Virtual for availability status
nurseSchema.virtual('isAvailable').get(function() {
  return this.status === 'active' && this.isApproved;
});

// Static method to find nurses by hospital
nurseSchema.statics.findByHospital = function(hospitalId) {
  return this.find({ hospitalId, status: 'active', isApproved: true }).sort({ name: 1 });
};

// Static method to find nurses by department
nurseSchema.statics.findByDepartment = function(department) {
  return this.find({ department, status: 'active', isApproved: true }).sort({ name: 1 });
};

// Static method to find active nurses
nurseSchema.statics.findActive = function() {
  return this.find({ status: 'active', isApproved: true }).sort({ name: 1 });
};

// Static method to find pending approvals
nurseSchema.statics.findPendingApprovals = function() {
  return this.find({ approvalStatus: 'pending' }).sort({ createdAt: 1 });
};

// Static method to search nurses
nurseSchema.statics.search = function(searchTerm) {
  return this.find({
    status: 'active',
    isApproved: true,
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { specialization: { $regex: searchTerm, $options: 'i' } },
      { department: { $regex: searchTerm, $options: 'i' } },
      { education: { $regex: searchTerm, $options: 'i' } }
    ]
  }).sort({ name: 1 });
};

// Method to update approval status
nurseSchema.methods.updateApprovalStatus = function(status) {
  this.approvalStatus = status;
  this.isApproved = status === 'approved';
  return this.save();
};

module.exports = mongoose.model('Nurse', nurseSchema); 