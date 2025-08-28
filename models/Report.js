const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['pdf', 'image', 'document', 'scan'],
    default: 'document'
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  patientId: {
    type: String,
    required: true,
    index: true
  },
  doctorId: {
    type: String,
    required: false,
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['Blood Test', 'X-Ray', 'MRI', 'CT Scan', 'Ultrasound', 'ECG', 'Other'],
    default: 'Other'
  },
  fileSize: {
    type: Number // in bytes
  },
  mimeType: {
    type: String
  },
  status: {
    type: String,
    enum: ['uploaded', 'processing', 'completed', 'error'],
    default: 'uploaded'
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
reportSchema.index({ patientId: 1, uploadedAt: -1 });
reportSchema.index({ doctorId: 1, uploadedAt: -1 });
reportSchema.index({ category: 1, patientId: 1 });
reportSchema.index({ tags: 1 });

// Virtual for formatted upload date
reportSchema.virtual('formattedUploadDate').get(function() {
  return this.uploadedAt.toLocaleDateString();
});

// Virtual for file size in human readable format
reportSchema.virtual('formattedFileSize').get(function() {
  if (!this.fileSize) return 'Unknown';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(this.fileSize) / Math.log(1024));
  return Math.round(this.fileSize / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// Method to get file extension
reportSchema.methods.getFileExtension = function() {
  const fileName = this.name;
  return fileName.split('.').pop().toLowerCase();
};

// Method to check if file is an image
reportSchema.methods.isImage = function() {
  const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
  return imageTypes.includes(this.getFileExtension());
};

// Method to check if file is a PDF
reportSchema.methods.isPDF = function() {
  return this.getFileExtension() === 'pdf';
};

// Static method to find reports by patient
reportSchema.statics.findByPatient = function(patientId) {
  return this.find({ patientId }).sort({ uploadedAt: -1 });
};

// Static method to find reports by doctor
reportSchema.statics.findByDoctor = function(doctorId) {
  return this.find({ doctorId }).sort({ uploadedAt: -1 });
};

// Static method to find reports by category
reportSchema.statics.findByCategory = function(patientId, category) {
  return this.find({ patientId, category }).sort({ uploadedAt: -1 });
};

// Static method to find recent reports
reportSchema.statics.findRecent = function(patientId, limit = 10) {
  return this.find({ patientId })
    .sort({ uploadedAt: -1 })
    .limit(limit);
};

// Static method to search reports by name or description
reportSchema.statics.search = function(patientId, searchTerm) {
  return this.find({
    patientId,
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
      { tags: { $in: [new RegExp(searchTerm, 'i')] } }
    ]
  }).sort({ uploadedAt: -1 });
};

module.exports = mongoose.model('Report', reportSchema); 