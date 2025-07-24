const mongoose = require('mongoose');

const StaffSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['arcstaff', 'superadmin'], default: 'arcstaff' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Staff', StaffSchema); 