const mongoose = require('mongoose');

const DoctorSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  mobileNumber: { type: String, required: true },
  altPhoneNumber: String,
  gender: { type: String, required: true, enum: ['Male', 'Female', 'Other'] },
  dateOfBirth: { type: Date, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  geoCoordinates: { lat: Number, lng: Number },
  longitude: { type: Number, required: false },
  latitude: { type: Number, required: false },
  
  // Professional Information
  medicalRegistrationNumber: { type: String, required: true, unique: true },
  licenseNumber: { type: String, required: true, unique: true },
  // Primary specialization kept for backward compatibility
  specialization: { type: String, required: true },
  // New: support multiple specializations without breaking existing logic
  specializations: { type: [String], default: [] },
  experienceYears: { type: Number, required: true },
  consultationFee: { type: Number, required: true },
  education: String,
  qualification: String, // Single qualification for backward compatibility
  qualifications: [String], // Multiple qualifications
  bio: String,
  
  // Employment Details
  affiliatedHospitals: [{
    hospitalId: { type: String, ref: 'Hospital' },
    hospitalName: { type: String, required: true },
    role: { type: String, enum: ['Primary', 'Secondary', 'Consultant', 'Visiting', 'Emergency'], default: 'Consultant' },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: false },
    isActive: { type: Boolean, default: true }
  }],
  currentHospital: String,
  workingHours: {
    start: String,
    end: String,
    days: [String]
  },
  
  // Certificates and Documents
  licenseDocumentUrl: { type: String, required: true },
  profileImageUrl: String,
  
  // System Fields
  status: { type: String, enum: ['active', 'inactive', 'pending'], default: 'pending' },
  isApproved: { type: Boolean, default: false },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvedBy: String,
  approvedAt: Date,
  approvalNotes: String,
  rejectedBy: String,
  rejectedAt: Date,
  rejectionReason: String,
  
  // QR Code and Arc ID
  arcId: { type: String, unique: true },
  qrCode: String,
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save hook to generate arcId if not provided
DoctorSchema.pre('save', function(next) {
  if (!this.arcId) {
    this.arcId = 'DOC' + Date.now().toString().slice(-8);
  }
  this.updatedAt = new Date();
  next();
});

// Static method to find doctors by hospital
DoctorSchema.statics.findByHospital = function(hospitalId) {
  return this.find({ 
    $or: [
      { currentHospital: hospitalId },
      { affiliatedHospitals: hospitalId }
    ],
    status: 'active',
    isApproved: true 
  }).sort({ fullName: 1 });
};

// Static method to find doctors by specialization
DoctorSchema.statics.findBySpecialization = function(specialization) {
  return this.find({ 
    $or: [
      { specialization },
      { specializations: specialization }
    ],
    status: 'active',
    isApproved: true 
  }).sort({ fullName: 1 });
};

// Static method to find active doctors
DoctorSchema.statics.findActive = function() {
  return this.find({ 
    status: 'active',
    isApproved: true 
  }).sort({ fullName: 1 });
};

// Static method to search doctors
DoctorSchema.statics.search = function(searchTerm) {
  return this.find({
    status: 'active',
    isApproved: true,
    $or: [
      { fullName: { $regex: searchTerm, $options: 'i' } },
      { specialization: { $regex: searchTerm, $options: 'i' } },
      { specializations: { $regex: searchTerm, $options: 'i' } },
      { education: { $regex: searchTerm, $options: 'i' } }
    ]
  }).sort({ fullName: 1 });
};

// Static method to get pending approvals
DoctorSchema.statics.getPendingApprovals = function() {
  return this.find({ 
    approvalStatus: 'pending' 
  }).sort({ createdAt: 1 });
};

// Static method to approve doctor
DoctorSchema.statics.approveDoctor = function(doctorId, approvedBy, notes = '') {
  return this.findByIdAndUpdate(doctorId, {
    isApproved: true,
    approvalStatus: 'approved',
    approvedBy,
    approvedAt: new Date(),
    approvalNotes: notes,
    status: 'active'
  }, { new: true });
};

// Static method to reject doctor
DoctorSchema.statics.rejectDoctor = function(doctorId, rejectedBy, reason = '') {
  return this.findByIdAndUpdate(doctorId, {
    isApproved: false,
    approvalStatus: 'rejected',
    rejectedBy,
    rejectedAt: new Date(),
    rejectionReason: reason
  }, { new: true });
};

module.exports = mongoose.model('Doctor', DoctorSchema); 