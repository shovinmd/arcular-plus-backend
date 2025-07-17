const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true }, // Firebase UID
  fullName: String,
  email: { type: String, required: true, unique: true },
  mobileNumber: String,
  gender: String,
  dateOfBirth: Date,
  address: String,
  pincode: String,
  city: String,
  state: String,
  type: { type: String, default: 'patient' },
  createdAt: { type: Date, default: Date.now },
  height: Number,
  weight: Number,
  bloodGroup: String,
  bmi: Number,
  bmiCategory: String,
  isPregnant: Boolean,
  knownAllergies: [String],
  chronicConditions: [String],
  emergencyContactName: String,
  emergencyContactNumber: String,
  emergencyContactRelation: String,
  healthQrId: String, // for QR code
  arcId: { type: String, unique: true }, // Arcular ID
  qrCode: String, // QR code data (base64 or URL)
  // Add more fields as needed
});

module.exports = mongoose.model('User', UserSchema); 