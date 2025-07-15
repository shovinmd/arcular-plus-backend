const mongoose = require('mongoose');

const labReportSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  url: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  patientId: { type: String, required: true, index: true },
  doctorId: { type: String, index: true },
  description: { type: String, trim: true },
  category: { type: String, trim: true },
  fileSize: { type: Number },
  mimeType: { type: String },
  status: { type: String, enum: ['uploaded', 'processing', 'completed', 'error'], default: 'uploaded' },
  tags: [{ type: String, trim: true }]
}, { timestamps: true });

labReportSchema.index({ patientId: 1, uploadedAt: -1 });
labReportSchema.index({ doctorId: 1, uploadedAt: -1 });

module.exports = mongoose.model('LabReport', labReportSchema); 