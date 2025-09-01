const mongoose = require('mongoose');

const menstrualCycleSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  lastPeriodStartDate: { type: Date },
  cycleLength: { type: Number, default: 28 },
  periodDuration: { type: Number, default: 5 },
  cycleHistory: [{
    startDate: Date,
    endDate: Date,
    flow: {
      type: String,
      enum: ['light', 'medium', 'heavy'],
      default: 'medium'
    },
    symptoms: [String],
    notes: String,
    mood: String,
    energy: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  }],
  // Frontend calculated predictions stored in backend
  nextPeriod: { type: Date },
  ovulationDay: { type: Date },
  fertileWindow: [{ type: Date }],
  periodEnd: { type: Date },
  // Reminder preferences
  remindNextPeriod: { type: Boolean, default: false },
  remindFertileWindow: { type: Boolean, default: false },
  remindOvulation: { type: Boolean, default: false },
  reminderTime: { type: String },
  // Additional tracking fields
  ovulationData: [{
    date: Date,
    cervicalMucus: String,
    basalTemperature: Number,
    lhSurge: Boolean,
    notes: String
  }],
  symptoms: [{
    date: Date,
    type: {
      type: String,
      enum: ['pms', 'period', 'ovulation', 'other']
    },
    symptoms: [String],
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe'],
      default: 'mild'
    },
    notes: String
  }],
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

menstrualCycleSchema.index({ userId: 1, lastPeriodStartDate: -1 });

// Static methods
menstrualCycleSchema.statics.findByUser = function(userId) {
  return this.findOne({ userId });
};

menstrualCycleSchema.statics.getCycleHistory = function(userId, limit = 10) {
  return this.findOne({ userId }).select('cycleHistory ovulationData symptoms').lean();
};

// Instance methods
menstrualCycleSchema.methods.addCycleEntry = function(cycleData) {
  this.cycleHistory.push(cycleData);
  return this.save();
};

menstrualCycleSchema.methods.addOvulationData = function(ovulationData) {
  this.ovulationData.push(ovulationData);
  return this.save();
};

menstrualCycleSchema.methods.addSymptom = function(symptomData) {
  this.symptoms.push(symptomData);
  return this.save();
};

module.exports = mongoose.model('MenstrualCycle', menstrualCycleSchema); 