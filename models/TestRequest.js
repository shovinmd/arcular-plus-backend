const mongoose = require('mongoose');

const TestRequestSchema = new mongoose.Schema({
  // Request details
  requestId: {
    type: String,
    required: true,
    unique: true,
  },
  
  // Hospital information
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
  },
  hospitalName: {
    type: String,
    required: true,
  },
  hospitalUid: {
    type: String,
    required: true,
  },
  
  // Lab information
  labId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lab',
    required: true,
  },
  labName: {
    type: String,
    required: true,
  },
  labUid: {
    type: String,
    required: true,
  },
  
  // Patient information
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  patientArcId: {
    type: String,
    required: true,
  },
  patientName: {
    type: String,
    required: true,
  },
  patientEmail: {
    type: String,
    required: true,
  },
  patientMobile: {
    type: String,
    required: true,
  },
  
  // Test details
  testName: {
    type: String,
    required: true,
  },
  testType: {
    type: String,
    enum: ['Blood Test', 'Urine Test', 'X-Ray', 'CT Scan', 'MRI', 'Ultrasound', 'ECG', 'Other'],
    required: true,
  },
  testDescription: {
    type: String,
  },
  urgency: {
    type: String,
    enum: ['Low', 'Normal', 'High', 'Emergency'],
    default: 'Normal',
  },
  
  // Request status
  status: {
    type: String,
    enum: ['Pending', 'Admitted', 'Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Rejected'],
    default: 'Pending',
  },
  
  // Scheduling information
  requestedDate: {
    type: Date,
    default: Date.now,
  },
  scheduledDate: {
    type: Date,
  },
  scheduledTime: {
    type: String, // e.g., "09:00 AM"
  },
  appointmentSlot: {
    type: String, // e.g., "Morning", "Afternoon", "Evening"
  },
  
  // Lab response
  labNotes: {
    type: String,
  },
  estimatedDuration: {
    type: String, // e.g., "2 hours", "30 minutes"
  },
  preparationInstructions: {
    type: String,
  },
  
  // Billing information
  billAmount: {
    type: Number,
    default: 0,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  paymentOptions: [{
    type: String,
    enum: ['Cash', 'Card', 'Insurance', 'Online Payment', 'Bank Transfer', 'UPI', 'Wallet'],
  }],
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Partial', 'Refunded'],
    default: 'Pending',
  },
  paidAmount: {
    type: Number,
    default: 0,
  },
  
  // Completion details
  completedAt: {
    type: Date,
  },
  reportUrl: {
    type: String,
  },
  reportFileName: {
    type: String,
  },
  
  // Communication
  emailNotifications: {
    requestSent: { type: Boolean, default: false },
    requestAdmitted: { type: Boolean, default: false },
    appointmentScheduled: { type: Boolean, default: false },
    reportReady: { type: Boolean, default: false },
  },
  
  // Additional information
  notes: {
    type: String,
  },
  doctorNotes: {
    type: String,
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
TestRequestSchema.index({ hospitalId: 1, status: 1 });
TestRequestSchema.index({ labId: 1, status: 1 });
TestRequestSchema.index({ patientArcId: 1 });
TestRequestSchema.index({ createdAt: -1 });

// Pre-save middleware to update updatedAt
TestRequestSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Generate unique request ID
TestRequestSchema.pre('save', function(next) {
  if (!this.requestId) {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 5);
    this.requestId = `TR-${timestamp}-${random}`.toUpperCase();
  }
  next();
});

module.exports = mongoose.model('TestRequest', TestRequestSchema);
