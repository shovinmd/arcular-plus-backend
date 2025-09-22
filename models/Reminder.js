const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  patientArcId: {
    type: String,
    required: true,
    index: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  nurseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  dueAt: {
    type: Date
  },
  dueTime: {
    type: String
  },
  completedAt: {
    type: Date
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  category: {
    type: String,
    enum: ['medication', 'vitals', 'checkup', 'procedure', 'general'],
    default: 'general'
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringPattern: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'custom']
  },
  recurringInterval: {
    type: Number,
    default: 1
  },
  lastRecurredAt: {
    type: Date
  },
  nextDueAt: {
    type: Date
  },
  tags: [{
    type: String,
    trim: true
  }],
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
reminderSchema.index({ patientArcId: 1, status: 1 });
reminderSchema.index({ patientId: 1, status: 1 });
reminderSchema.index({ doctorId: 1, status: 1 });
reminderSchema.index({ nurseId: 1, status: 1 });
reminderSchema.index({ hospitalId: 1, status: 1 });
reminderSchema.index({ dueAt: 1 });
reminderSchema.index({ status: 1, priority: 1 });

// Virtual for formatted due date
reminderSchema.virtual('formattedDueDate').get(function() {
  if (this.dueAt) {
    return this.dueAt.toLocaleDateString();
  }
  return null;
});

// Virtual for formatted due time
reminderSchema.virtual('formattedDueTime').get(function() {
  if (this.dueTime) {
    return this.dueTime;
  }
  if (this.dueAt) {
    return this.dueAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return null;
});

// Method to check if reminder is overdue
reminderSchema.methods.isOverdue = function() {
  if (this.status === 'completed' || this.status === 'cancelled') {
    return false;
  }
  if (this.dueAt) {
    return new Date() > this.dueAt;
  }
  return false;
};

// Method to check if reminder is due soon (within 1 hour)
reminderSchema.methods.isDueSoon = function() {
  if (this.status === 'completed' || this.status === 'cancelled') {
    return false;
  }
  if (this.dueAt) {
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    return this.dueAt <= oneHourFromNow && this.dueAt > new Date();
  }
  return false;
};

module.exports = mongoose.model('Reminder', reminderSchema);
