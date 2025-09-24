const mongoose = require('mongoose');

const HospitalSchema = new mongoose.Schema({
  // Firebase UID
  uid: { type: String, required: true, unique: true },
  
  // Basic Information
  hospitalOwnerName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  mobileNumber: { type: String, required: true },
  altPhoneNumber: String,
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: false },
  
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
  // GeoJSON location for spatial queries (used by SOS nearby search)
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere',
    }
  },
  
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
  
  // Rating Fields
  averageRating: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  
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
  // Backfill GeoJSON location if longitude/latitude or geoCoordinates are present
  const hasLonLat = typeof this.longitude === 'number' && typeof this.latitude === 'number';
  const hasGeo = this.geoCoordinates && typeof this.geoCoordinates.lng === 'number' && typeof this.geoCoordinates.lat === 'number';
  const lon = hasLonLat ? this.longitude : (hasGeo ? this.geoCoordinates.lng : undefined);
  const lat = hasLonLat ? this.latitude : (hasGeo ? this.geoCoordinates.lat : undefined);
  if (typeof lon === 'number' && typeof lat === 'number') {
    this.location = this.location || {};
    this.location.type = 'Point';
    this.location.coordinates = [lon, lat];
  }
  next();
});

module.exports = mongoose.model('Hospital', HospitalSchema); 