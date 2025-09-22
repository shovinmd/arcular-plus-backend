const mongoose = require('mongoose');

const nurseTalkSchema = new mongoose.Schema({
  // Message details
  message: { type: String, required: true, trim: true },
  messageType: { 
    type: String, 
    enum: ['chat', 'handover'], 
    default: 'chat' 
  },
  
  // Participants
  senderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  receiverId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  
  // Hospital context
  hospitalId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Hospital', 
    required: true 
  },
  
  // Patient reference (optional)
  patientArcId: { 
    type: String, 
    index: true 
  },
  patientName: { type: String },
  
  // Handover specific fields
  shiftType: { 
    type: String, 
    enum: ['morning', 'evening', 'night', 'day'] 
  },
  handoverDate: { type: Date },
  isUrgent: { type: Boolean, default: false },
  
  // Message status
  status: { 
    type: String, 
    enum: ['sent', 'delivered', 'read'], 
    default: 'sent' 
  },
  
  // Timestamps
  readAt: { type: Date },
  deliveredAt: { type: Date }
}, { timestamps: true });

// Indexes for better query performance
nurseTalkSchema.index({ hospitalId: 1, createdAt: -1 });
nurseTalkSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
nurseTalkSchema.index({ messageType: 1, hospitalId: 1 });
nurseTalkSchema.index({ patientArcId: 1, createdAt: -1 });

// Virtual for formatted handover date
nurseTalkSchema.virtual('formattedHandoverDate').get(function() {
  if (this.handoverDate) {
    return this.handoverDate.toLocaleDateString();
  }
  return null;
});

// Method to check if message is recent (within last hour)
nurseTalkSchema.methods.isRecent = function() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return this.createdAt > oneHourAgo;
};

module.exports = mongoose.model('NurseTalk', nurseTalkSchema);
