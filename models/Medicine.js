const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  // Basic Information
  medicineId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Medicine Details
  name: {
    type: String,
    required: true,
    index: true
  },
  genericName: {
    type: String,
    required: true
  },
  brand: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['prescription', 'over-the-counter', 'supplement', 'medical-device']
  },
  
  // Medical Information
  dosage: {
    type: String,
    required: true
  },
  form: {
    type: String,
    required: true,
    enum: ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'patch']
  },
  strength: {
    type: String,
    required: true
  },
  composition: {
    type: String,
    required: true
  },
  
  // Usage Information
  indications: {
    type: [String],
    required: true
  },
  contraindications: {
    type: [String],
    default: []
  },
  sideEffects: {
    type: [String],
    default: []
  },
  dosageInstructions: {
    type: String,
    required: true
  },
  
  // Pricing and Availability
  price: {
    type: Number,
    required: true
  },
  discountPrice: {
    type: Number
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  stockQuantity: {
    type: Number,
    default: 0
  },
  
  // Regulatory Information
  manufacturer: {
    type: String,
    required: true
  },
  expiryDate: {
    type: Date
  },
  batchNumber: {
    type: String
  },
  licenseNumber: {
    type: String,
    required: true
  },
  
  // Pharmacy Information
  pharmacyId: {
    type: String,
    ref: 'User',
    required: true
  },
  pharmacyName: {
    type: String,
    required: true
  },
  
  // Images and Documents
  images: {
    type: [String],
    default: []
  },
  prescriptionRequired: {
    type: Boolean,
    default: false
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
});

// Indexes for better performance
medicineSchema.index({ name: 'text', genericName: 'text', brand: 'text' });
medicineSchema.index({ category: 1 });
medicineSchema.index({ pharmacyId: 1 });
medicineSchema.index({ isAvailable: 1 });

// Pre-save middleware to generate medicine ID
medicineSchema.pre('save', function(next) {
  if (this.isNew && !this.medicineId) {
    this.medicineId = `MED-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Medicine', medicineSchema);
