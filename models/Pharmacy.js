const mongoose = require('mongoose');

const pharmacySchema = new mongoose.Schema({
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
  drugLicenseNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  gstNumber: {
    type: String,
    trim: true
  },
  
  // Business Details
  pharmacyType: {
    type: String,
    enum: ['Retail', 'Wholesale', 'Both', 'Online', 'Chain'],
    default: 'Retail'
  },
  specialization: {
    type: String,
    trim: true
  },
  experience: {
    type: Number,
    default: 0
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
  landmark: {
    type: String,
    trim: true
  },
  
  // Operating Details
  operatingHours: {
    type: String,
    required: true,
    trim: true
  },
  workingDays: {
    type: [String],
    default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  },
  is24Hours: {
    type: Boolean,
    default: false
  },
  
  // Services
  homeDelivery: {
    type: Boolean,
    default: false
  },
  onlineOrdering: {
    type: Boolean,
    default: false
  },
  prescriptionFilling: {
    type: Boolean,
    default: true
  },
  medicineConsultation: {
    type: Boolean,
    default: false
  },
  
  // Inventory and Specialties
  availableMedicines: {
    type: [String],
    default: []
  },
  specialties: {
    type: [String],
    default: []
  },
  insuranceAccepted: {
    type: [String],
    default: []
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
  drugLicenseUrl: {
    type: String,
    trim: true
  },
  
  // Status and Approval
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'closed'],
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
  description: {
    type: String,
    trim: true
  },
  imageUrl: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  
  // Contact Information
  emergencyContact: {
    name: String,
    phone: String,
    relation: String
  },
  
  // Payment Information
  paymentMethods: {
    type: [String],
    default: ['Cash', 'Card', 'UPI']
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
pharmacySchema.index({ city: 1, status: 1 });
pharmacySchema.index({ status: 1, pharmacyType: 1 });
pharmacySchema.index({ licenseNumber: 1 });
pharmacySchema.index({ registrationNumber: 1 });
pharmacySchema.index({ uid: 1 });

// Virtual for full name
pharmacySchema.virtual('fullName').get(function() {
  return this.name;
});

// Virtual for availability status
pharmacySchema.virtual('isAvailable').get(function() {
  return this.status === 'active' && this.isApproved;
});

// Static method to find pharmacies by city
pharmacySchema.statics.findByCity = function(city) {
  return this.find({ city, status: 'active', isApproved: true }).sort({ name: 1 });
};

// Static method to find pharmacies by type
pharmacySchema.statics.findByType = function(pharmacyType) {
  return this.find({ pharmacyType, status: 'active', isApproved: true }).sort({ name: 1 });
};

// Static method to find active pharmacies
pharmacySchema.statics.findActive = function() {
  return this.find({ status: 'active', isApproved: true }).sort({ name: 1 });
};

// Static method to find pending approvals
pharmacySchema.statics.findPendingApprovals = function() {
  return this.find({ approvalStatus: 'pending' }).sort({ createdAt: 1 });
};

// Static method to find pharmacies with home delivery
pharmacySchema.statics.findWithHomeDelivery = function() {
  return this.find({ homeDelivery: true, status: 'active', isApproved: true }).sort({ name: 1 });
};

// Static method to search pharmacies
pharmacySchema.statics.search = function(searchTerm) {
  return this.find({
    status: 'active',
    isApproved: true,
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { city: { $regex: searchTerm, $options: 'i' } },
      { specialization: { $regex: searchTerm, $options: 'i' } },
      { address: { $regex: searchTerm, $options: 'i' } }
    ]
  }).sort({ name: 1 });
};

// Method to update approval status
pharmacySchema.methods.updateApprovalStatus = function(status) {
  this.approvalStatus = status;
  this.isApproved = status === 'approved';
  return this.save();
};

module.exports = mongoose.model('Pharmacy', pharmacySchema); 