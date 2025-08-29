const mongoose = require('mongoose');

const ProfileChangesSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ArcStaff',
    required: true
  },
  uid: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
  mobileNumber: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  address: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: ''
  },
  emailNotifications: {
    type: Boolean,
    default: true
  },
  dashboardNotifications: {
    type: Boolean,
    default: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  requiresApproval: {
    type: Boolean,
    default: true
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ArcStaff'
  },
  reviewedAt: {
    type: Date
  },
  reviewNotes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for efficient queries
ProfileChangesSchema.index({ staffId: 1, status: 1 });
ProfileChangesSchema.index({ uid: 1 });
ProfileChangesSchema.index({ status: 1, submittedAt: -1 });

module.exports = mongoose.model('ProfileChanges', ProfileChangesSchema);
