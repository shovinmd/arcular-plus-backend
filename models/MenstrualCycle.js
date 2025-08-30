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
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

menstrualCycleSchema.index({ userId: 1, lastPeriodStartDate: -1 });

module.exports = mongoose.model('MenstrualCycle', menstrualCycleSchema); 