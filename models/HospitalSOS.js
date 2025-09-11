const mongoose = require('mongoose');

const HospitalSOSSchema = new mongoose.Schema({
  // Reference to main SOS request
  sosRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SOSRequest',
    required: true,
    index: true
  },
  
  // Hospital Information
  hospitalId: {
    type: String,
    required: true,
    index: true
  },
  hospitalName: {
    type: String,
    required: true
  },
  hospitalPhone: {
    type: String,
    required: true
  },
  hospitalEmail: {
    type: String,
    required: false
  },
  
  // Hospital Location
  hospitalLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  hospitalAddress: {
    type: String,
    required: true
  },
  
  // Hospital Status for this SOS
  hospitalStatus: {
    type: String,
    enum: ['notified', 'accepted', 'handledByOther', 'cancelled'],
    default: 'notified',
    index: true
  },
  
  // Response Details
  responseDetails: {
    respondedAt: {
      type: Date,
      required: false
    },
    respondedBy: {
      staffId: String,
      staffName: String,
      staffPhone: String,
      staffRole: String
    },
    responseTime: {
      type: Number, // in seconds
      required: false
    },
    distance: {
      type: Number, // in kilometers
      required: false
    }
  },
  
  // Patient Information (only visible after acceptance)
  patientInfo: {
    patientId: String,
    patientName: String,
    patientPhone: String,
    patientEmail: String,
    patientAge: Number,
    patientGender: String,
    emergencyContact: {
      name: String,
      phone: String,
      relation: String
    }
  },
  
  // Emergency Details
  emergencyDetails: {
    emergencyType: String,
    description: String,
    severity: String,
    location: {
      address: String,
      city: String,
      state: String,
      pincode: String,
      coordinates: [Number]
    }
  },
  
  // Actions Taken
  actions: [{
    action: {
      type: String,
      enum: ['notified', 'accepted', 'called_patient', 'dispatched_ambulance', 'marked_admitted', 'cancelled']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    performedBy: {
      staffId: String,
      staffName: String,
      staffRole: String
    },
    notes: String
  }],
  
  // Communication Log
  communications: [{
    type: {
      type: String,
      enum: ['call', 'sms', 'email', 'notification']
    },
    direction: {
      type: String,
      enum: ['incoming', 'outgoing']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    content: String,
    status: {
      type: String,
      enum: ['sent', 'delivered', 'failed']
    }
  }],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Notifications
  notificationsSent: {
    initial: {
      type: Boolean,
      default: false
    },
    acceptance: {
      type: Boolean,
      default: false
    },
    admission: {
      type: Boolean,
      default: false
    }
  },
  
  // Analytics
  metrics: {
    timeToRespond: Number, // in seconds
    timeToAdmit: Number, // in seconds
    totalCalls: {
      type: Number,
      default: 0
    },
    totalSMS: {
      type: Number,
      default: 0
    },
    totalEmails: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
HospitalSOSSchema.index({ hospitalId: 1, hospitalStatus: 1 });
HospitalSOSSchema.index({ sosRequestId: 1, hospitalId: 1 });
HospitalSOSSchema.index({ hospitalStatus: 1, createdAt: -1 });
HospitalSOSSchema.index({ 'responseDetails.respondedAt': -1 });

// Pre-save middleware to update updatedAt
HospitalSOSSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to add action
HospitalSOSSchema.methods.addAction = function(action, performedBy, notes = '') {
  this.actions.push({
    action,
    performedBy,
    notes,
    timestamp: new Date()
  });
  return this.save();
};

// Method to add communication
HospitalSOSSchema.methods.addCommunication = function(type, direction, content, status = 'sent') {
  this.communications.push({
    type,
    direction,
    content,
    status,
    timestamp: new Date()
  });
  return this.save();
};

// Method to calculate response time
HospitalSOSSchema.methods.calculateResponseTime = function() {
  if (this.responseDetails.respondedAt) {
    this.responseDetails.responseTime = Math.floor((this.responseDetails.respondedAt - this.createdAt) / 1000);
  }
  return this.responseDetails.responseTime;
};

// Static method to find by hospital and status
HospitalSOSSchema.statics.findByHospitalAndStatus = function(hospitalId, status) {
  return this.find({ hospitalId, hospitalStatus: status })
    .populate('sosRequestId')
    .sort({ createdAt: -1 });
};

// Static method to find active cases for hospital
HospitalSOSSchema.statics.findActiveCases = function(hospitalId) {
  return this.find({ 
    hospitalId, 
    hospitalStatus: { $in: ['notified', 'accepted'] } 
  })
    .populate('sosRequestId')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('HospitalSOS', HospitalSOSSchema);