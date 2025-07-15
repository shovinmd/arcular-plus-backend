const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  date: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
  type: { type: String },
  data: { type: Object }
}, { timestamps: true });

notificationSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('Notification', notificationSchema); 