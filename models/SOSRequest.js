const mongoose = require('mongoose');

const SOSRequestSchema = new mongoose.Schema({
  // Patient Information
  patientId: {
    type: String,
    required: true,
    index: true
  },
  patientName: {
    type: String,
    required: true
  },
  patientPhone: {
    type: String,
    required: true
  },
  patientEmail: {
    type: String,
    required: false
  },
  patientAge: {
    type: Number,
    required: false
  },
  patientGender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: false
  },
  emergencyContact: {
    name: String,
    phone: String,
    relation: String
  },
  
  // Location Information
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      index: '2dsphere'
    }
  },
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: false
  },
  pincode: {
    type: String,
    required: false
  },
  
  // Emergency Details
  emergencyType: {
    type: String,
    enum: ['Medical', 'Accident', 'Cardiac', 'Respiratory', 'Trauma', 'Other'],
    default: 'Medical'
  },
  description: {
    type: String,
    required: false
  },
  severity: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'High'
  },
  
  // Status Tracking
  status: {
    type: String,
    enum: ['pending', 'accepted', 'admitted', 'cancelled', 'timeout'],
    default: 'pending',
    index: true
  },
  
  // Hospital Information
  acceptedBy: {
    hospitalId: {
      type: String,
      required: false
    },
    hospitalName: {
      type: String,
      required: false
    },
    acceptedAt: {
      type: Date,
      required: false
    },
    acceptedByStaff: {
      name: String,
      phone: String,
      role: String
    }
  },
  
  // Admission Details
  admissionDetails: {
    admittedAt: {
      type: Date,
      required: false
    },
    admittedByStaff: {
      name: String,
      phone: String,
      role: String
    },
    wardNumber: String,
    bedNumber: String,
    notes: String
  },
  
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
  
  // Timeout and Retry
  timeoutAt: {
    type: Date,
    required: false
  },
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  
  // Notifications
  notificationsSent: {
    hospitals: {
      type: Boolean,
      default: false
    },
    patient: {
      type: Boolean,
      default: false
    },
    emergencyContact: {
      type: Boolean,
      default: false
    }
  },
  
  // Analytics
  responseTime: {
    type: Number, // in seconds
    required: false
  },
  distanceToHospital: {
    type: Number, // in kilometers
    required: false
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
SOSRequestSchema.index({ status: 1, createdAt: -1 });
SOSRequestSchema.index({ 'acceptedBy.hospitalId': 1 });
SOSRequestSchema.index({ patientId: 1, createdAt: -1 });
SOSRequestSchema.index({ location: '2dsphere' });

// Pre-save middleware to update updatedAt
SOSRequestSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to check if request is still active
SOSRequestSchema.methods.isActive = function() {
  return ['pending', 'accepted'].includes(this.status);
};

// Method to check if request has timed out
SOSRequestSchema.methods.hasTimedOut = function() {
  if (this.timeoutAt) {
    return new Date() > this.timeoutAt;
  }
  return false;
};

// Method to calculate response time
SOSRequestSchema.methods.calculateResponseTime = function() {
  if (this.acceptedBy && this.acceptedBy.acceptedAt) {
    this.responseTime = Math.floor((this.acceptedBy.acceptedAt - this.createdAt) / 1000);
  }
  return this.responseTime;
};

// Static method to find nearby hospitals
SOSRequestSchema.statics.findNearbyHospitals = async function(longitude, latitude, maxDistance = 15) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance * 1000 // Convert km to meters
      }
    }
  });
};

module.exports = mongoose.model('SOSRequest', SOSRequestSchema);