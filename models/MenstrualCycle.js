const mongoose = require('mongoose');

const menstrualCycleSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  lastPeriodStartDate: { type: Date },
  cycleLength: { type: Number, default: 28 },
  periodDuration: { type: Number, default: 5 },
  cycleHistory: [{
    startDate: Date,
    endDate: Date,
    notes: String
  }],
  reminders: {
    nextPeriod: { type: Boolean, default: false },
    fertileWindow: { type: Boolean, default: false },
    ovulation: { type: Boolean, default: false }
  },
  reminderTime: { type: String },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

menstrualCycleSchema.index({ userId: 1, lastPeriodStartDate: -1 });

module.exports = mongoose.model('MenstrualCycle', menstrualCycleSchema); 