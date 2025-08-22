const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  doctorId: {
    type: String,
    required: true
  },
  doctorName: {
    type: String,
    required: true
  },
  doctorSpecialty: {
    type: String,
    required: true
  },
  prescriptionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  diagnosis: {
    type: String,
    required: true
  },
  medications: [{
    name: {
      type: String,
      required: true
    },
    dose: {
      type: String,
      required: true
    },
    frequency: {
      type: String,
      required: true
    },
    duration: {
      type: String,
      required: true
    },
    instructions: String,
    beforeMeal: {
      type: Boolean,
      default: false
    },
    afterMeal: {
      type: Boolean,
      default: false
    }
  }],
  instructions: {
    type: String,
    required: true
  },
  followUpDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['Active', 'Completed', 'Discontinued', 'Archived'],
    default: 'Active'
  },
  notes: String,
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
prescriptionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static methods
prescriptionSchema.statics.findByUser = function(userId) {
  return this.find({ userId }).sort({ prescriptionDate: -1 });
};

prescriptionSchema.statics.findByDoctor = function(doctorId) {
  return this.find({ doctorId }).sort({ prescriptionDate: -1 });
};

prescriptionSchema.statics.findActive = function(userId) {
  return this.find({ userId, status: 'Active' }).sort({ prescriptionDate: -1 });
};

prescriptionSchema.statics.findByStatus = function(userId, status) {
  return this.find({ userId, status }).sort({ prescriptionDate: -1 });
};

// Instance methods
prescriptionSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  this.updatedAt = new Date();
  return this.save();
};

prescriptionSchema.methods.addMedication = function(medication) {
  this.medications.push(medication);
  this.updatedAt = new Date();
  return this.save();
};

prescriptionSchema.methods.addAttachment = function(attachment) {
  this.attachments.push(attachment);
  this.updatedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Prescription', prescriptionSchema);
