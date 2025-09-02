const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // Order Information
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  pharmacyId: {
    type: String,
    required: true,
    ref: 'Pharmacy'
  },
  
  // Order Items
  items: [{
    medicineId: {
      type: String,
      required: true
    },
    medicineName: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    requiresPrescription: {
      type: Boolean,
      default: false
    },
    prescriptionId: {
      type: String,
      ref: 'Prescription'
    }
  }],
  
  // Order Details
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  
  // Delivery Information
  deliveryAddress: {
    type: String,
    required: true
  },
  deliveryCity: {
    type: String,
    required: true
  },
  deliveryState: {
    type: String,
    required: true
  },
  deliveryPincode: {
    type: String,
    required: true
  },
  deliveryPhone: {
    type: String,
    required: true
  },
  
  // Payment Information
  paymentMethod: {
    type: String,
    enum: ['cod', 'online', 'card'],
    default: 'cod'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentDetails: {
    transactionId: String,
    paymentDate: Date,
    amount: Number
  },
  
  // Tracking Information
  trackingNumber: {
    type: String
  },
  estimatedDelivery: {
    type: Date
  },
  actualDelivery: {
    type: Date
  },
  
  // Notes and Comments
  notes: {
    type: String
  },
  pharmacyNotes: {
    type: String
  },
  
  // System Fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to generate orderId and update timestamp
orderSchema.pre('save', function(next) {
  if (!this.orderId) {
    this.orderId = 'ORD' + Date.now().toString().slice(-8);
  }
  this.updatedAt = new Date();
  next();
});

// Static methods
orderSchema.statics.findByUser = function(userId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

orderSchema.statics.findByPharmacy = function(pharmacyId) {
  return this.find({ pharmacyId }).sort({ createdAt: -1 });
};

orderSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

orderSchema.statics.updateStatus = function(orderId, status, notes = '') {
  return this.findOneAndUpdate(
    { orderId },
    { 
      status,
      updatedAt: new Date(),
      ...(notes && { pharmacyNotes: notes })
    },
    { new: true }
  );
};

orderSchema.statics.addTracking = function(orderId, trackingNumber, estimatedDelivery) {
  return this.findOneAndUpdate(
    { orderId },
    { 
      trackingNumber,
      estimatedDelivery,
      status: 'shipped',
      updatedAt: new Date()
    },
    { new: true }
  );
};

orderSchema.statics.markDelivered = function(orderId) {
  return this.findOneAndUpdate(
    { orderId },
    { 
      status: 'delivered',
      actualDelivery: new Date(),
      paymentStatus: 'paid',
      updatedAt: new Date()
    },
    { new: true }
  );
};

module.exports = mongoose.model('Order', orderSchema);
