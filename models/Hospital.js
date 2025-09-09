const mongoose = require('mongoose');

const HospitalSchema = new mongoose.Schema({
  // Firebase UID
  uid: { type: String, required: true, unique: true },
  
  // Basic Information
  hospitalOwnerName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  mobileNumber: { type: String, required: true },
  altPhoneNumber: String,
  
  // Hospital Details
  hospitalName: { type: String, required: true },
  registrationNumber: { type: String, required: true },
  hospitalType: { 
    type: String, 
    required: true,
    enum: ['Public', 'Private', 'Clinic', 'Diagnostic Centre']
  },
  
  // Location Details
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  geoCoordinates: { lat: Number, lng: Number },
  longitude: { type: Number, required: false },
  latitude: { type: Number, required: false },
  
  // Operational Details
  numberOfBeds: { type: Number, required: true },
  departments: [{ type: String }],
  specialFacilities: [{ type: String }],
  hasPharmacy: { type: Boolean, default: false },
  hasLab: { type: Boolean, default: false },
  
  // Documents
  licenseDocumentUrl: { type: String, required: true },
  registrationCertificateUrl: { type: String },
  buildingPermitUrl: { type: String },
  
  // Approval and Status
  status: { type: String, enum: ['active', 'inactive', 'pending'], default: 'pending' },
  isApproved: { type: Boolean, default: false },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvedBy: String,
  approvedAt: Date,
  approvalNotes: String,
  rejectedBy: String,
  rejectedAt: Date,
  rejectionReason: String,
  
  // System Fields
  arcId: { type: String, unique: true },
  qrCode: String,
  profileImageUrl: String,
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Static methods
HospitalSchema.statics.findByUid = function(uid) {
  return this.findOne({ uid });
};

// Instance methods
HospitalSchema.methods.getPublicProfile = function() {
  const hospitalObject = this.toObject();
  delete hospitalObject.__v;
  return hospitalObject;
};

// Pre-save middleware
HospitalSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Hospital', HospitalSchema); 