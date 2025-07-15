const mongoose = require('mongoose');

const sosSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  location: {
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String }
  },
  time: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'resolved'], default: 'active' },
  nearbyHospitals: [{
    name: String,
    address: String,
    phone: String,
    distance: Number
  }]
}, { timestamps: true });

sosSchema.index({ userId: 1, time: -1 });

module.exports = mongoose.model('SOS', sosSchema); 