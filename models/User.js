const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true }, // Firebase UID
  fullName: String,
  email: { type: String, required: true, unique: true },
  mobileNumber: String,
  alternateMobile: String, // Added missing field
  gender: String,
  dateOfBirth: Date,
  address: String,
  pincode: String,
  city: String,
  state: String,
  aadhaarNumber: String, // Added missing field
  aadhaarFrontImageUrl: String, // Aadhaar front image URL
  aadhaarBackImageUrl: String, // Aadhaar back image URL
  type: { type: String, default: 'patient' },
  role: String, // Added for ARC Staff/Superadmin support
  organization: String, // Added for admin users
  designation: String, // Added for admin users
  createdAt: { type: Date, default: Date.now },
  height: Number,
  weight: Number,
  bloodGroup: String,
  bmi: Number,
  bmiCategory: String,
  isPregnant: Boolean,
  pregnancyTrackingEnabled: Boolean, // Added missing field
  babyName: String, // Added missing field
  dueDate: Date, // Added missing field
  babyWeightAtBirth: Number, // Added missing field
  numberOfPreviousPregnancies: Number, // New field for pregnancy history
  lastPregnancyYear: Number, // New field for last pregnancy year
  pregnancyHealthNotes: String, // New field for pregnancy health notes
  pregnancyPrivacyConsent: Boolean, // New field for privacy consent
  knownAllergies: [String],
  chronicConditions: [String],
  emergencyContactName: String,
  emergencyContactNumber: String,
  emergencyContactRelation: String,
  healthInsuranceId: String, // Added missing field
  policyNumber: String, // Health insurance policy number
  policyExpiryDate: Date, // Health insurance expiry date
  lastPeriodStartDate: Date, // Added missing field
  cycleLength: Number, // Added missing field
  periodDuration: Number, // Added missing field
  cycleHistory: [Object], // Added missing field
  healthQrId: String, // for QR code
  arcId: { type: String, unique: true }, // Arcular ID
  qrCode: String, // QR code data (base64 or URL)
  profileImageUrl: String, // URL to user's profile image
  
  // FCM Notification fields
  fcmToken: String, // FCM token for push notifications
  notificationPreferences: {
    menstrualReminders: { type: Boolean, default: true }, // Enable/disable menstrual reminders
    reminderTime: { type: String, default: '09:00' }, // Default reminder time (HH:MM)
    timezone: { type: String, default: 'Asia/Kolkata' }, // User's timezone
  },
  
  // Hospital-specific fields
  hospitalName: String,
  registrationNumber: String,
  hospitalType: String,
  hospitalAddress: String,
  hospitalEmail: String,
  hospitalPhone: String,
  numberOfBeds: Number,
  hasPharmacy: Boolean,
  hasLab: Boolean,
  departments: [String],
  
  // Doctor-specific fields
  medicalRegistrationNumber: String,
  specialization: String,
  experienceYears: Number,
  affiliatedHospitals: [String],
  consultationFee: Number,
  certificateUrl: String,
  
  // Lab-specific fields
  labName: String,
  labLicenseNumber: String,
  associatedHospital: String,
  availableTests: [String],
  labAddress: String,
  homeSampleCollection: Boolean,
  
  // Pharmacy-specific fields
  pharmacyName: String,
  pharmacyLicenseNumber: String,
  pharmacyAddress: String,
  operatingHours: String,
  homeDelivery: Boolean,
  drugLicenseUrl: String,
});

// Add static method to find user by UID
UserSchema.statics.findByUid = function(uid) {
  return this.findOne({ uid });
};

// Add method to get public profile
UserSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.__v;
  return userObject;
};

module.exports = mongoose.model('User', UserSchema); 
