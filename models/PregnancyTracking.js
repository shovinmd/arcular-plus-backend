const mongoose = require('mongoose');

const pregnancyTrackingSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  dueDate: { type: Date },
  currentWeek: { type: Number },
  babyName: { type: String },
  babyWeightAtBirth: { type: Number },
  notes: { type: String },
  // Doctor posted weekly tips/notes keyed by week number
  weeklyNotes: [{
    week: { type: Number, required: true },
    title: String,
    content: String,
    postedBy: String,
    postedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

pregnancyTrackingSchema.index({ userId: 1, dueDate: -1 });

module.exports = mongoose.model('PregnancyTracking', pregnancyTrackingSchema); 