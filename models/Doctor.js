const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  specialization: {
    type: String,
    required: true,
    trim: true
  },
  hospitalId: {
    type: String,
    required: true,
    index: true
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
    trim: true
  },
  licenseNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  experience: {
    type: Number,
    default: 0
  },
  education: {
    type: String,
    trim: true
  },
  bio: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on_leave'],
    default: 'active'
  },
  imageUrl: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
doctorSchema.index({ hospitalId: 1, specialization: 1 });
doctorSchema.index({ status: 1, specialization: 1 });
doctorSchema.index({ licenseNumber: 1 });

// Virtual for full name
doctorSchema.virtual('fullName').get(function() {
  return this.name;
});

// Virtual for availability status
doctorSchema.virtual('isAvailable').get(function() {
  return this.status === 'active';
});

// Static method to find doctors by hospital
doctorSchema.statics.findByHospital = function(hospitalId) {
  return this.find({ hospitalId, status: 'active' }).sort({ name: 1 });
};

// Static method to find doctors by specialization
doctorSchema.statics.findBySpecialization = function(specialization) {
  return this.find({ specialization, status: 'active' }).sort({ name: 1 });
};

// Static method to find active doctors
doctorSchema.statics.findActive = function() {
  return this.find({ status: 'active' }).sort({ name: 1 });
};

// Static method to search doctors
doctorSchema.statics.search = function(searchTerm) {
  return this.find({
    status: 'active',
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { specialization: { $regex: searchTerm, $options: 'i' } },
      { education: { $regex: searchTerm, $options: 'i' } }
    ]
  }).sort({ name: 1 });
};

module.exports = mongoose.model('Doctor', doctorSchema); 