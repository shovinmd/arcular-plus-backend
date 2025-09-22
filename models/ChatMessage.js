const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  message: { type: String, required: true, trim: true },
  patientArcId: { type: String, required: true, index: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  nurseId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  senderRole: { type: String, enum: ['doctor', 'nurse'], required: true },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Low' },
  status: { type: String, enum: ['sent', 'read'], default: 'sent' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

chatMessageSchema.index({ patientArcId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
