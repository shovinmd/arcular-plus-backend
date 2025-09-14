const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // Order Identification
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  
  // User Information
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  userName: {
    type: String,
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userPhone: {
    type: String,
    required: true
  },
  userAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true }
  },
  
  // Pharmacy Information
  pharmacyId: {
    type: String,
    required: true,
    ref: 'Pharmacy'
  },
  pharmacyName: {
    type: String,
    required: true
  },
  pharmacyEmail: {
    type: String,
    required: true
  },
  pharmacyPhone: {
    type: String,
    required: true
  },
  pharmacyAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true }
  },
  
  // Order Items
  items: [{
    medicineId: { type: String, required: true },
    medicineName: { type: String, required: true },
    category: { type: String, required: true },
    type: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true }
  }],
  
  // Order Summary
  subtotal: {
    type: Number,
    required: true
  },
  deliveryFee: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  
  // Order Status
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  
  // Delivery Information
  deliveryMethod: {
    type: String,
    enum: ['Home Delivery', 'Pickup'],
    default: 'Home Delivery'
  },
  estimatedDelivery: {
    type: Date
  },
  actualDelivery: {
    type: Date
  },
  
  // Tracking Information
  trackingNumber: {
    type: String
  },
  courierService: {
    type: String
  },
  trackingUrl: {
    type: String
  },
  
  // Payment Information
  paymentMethod: {
    type: String,
    enum: ['Cash on Delivery', 'Online Payment', 'Wallet'],
    default: 'Cash on Delivery'
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
    default: 'Pending'
  },
  
  // Notes and Comments
  userNotes: {
    type: String
  },
  pharmacyNotes: {
    type: String
  },
  adminNotes: {
    type: String
  },
  
  // Timestamps
  orderDate: {
    type: Date,
    default: Date.now
  },
  confirmedAt: {
    type: Date
  },
  shippedAt: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  
  // Status History
  statusHistory: [{
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String },
    updatedBy: { type: String, required: true } // 'user', 'pharmacy', 'admin'
  }]
}, {
  timestamps: true
});

// Indexes for better performance
orderSchema.index({ userId: 1, orderDate: -1 });
orderSchema.index({ pharmacyId: 1, orderDate: -1 });
orderSchema.index({ status: 1 });
// Note: orderId already has unique: true which creates an index automatically

// Pre-save middleware to generate order ID
orderSchema.pre('save', function(next) {
  if (this.isNew && !this.orderId) {
    this.orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
  next();
});

// Method to update status
orderSchema.methods.updateStatus = function(newStatus, updatedBy, note = '') {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    note: note,
    updatedBy: updatedBy
  });
  
  // Set specific timestamps
  switch (newStatus) {
    case 'Confirmed':
      this.confirmedAt = new Date();
      break;
    case 'Shipped':
      this.shippedAt = new Date();
      break;
    case 'Delivered':
      this.deliveredAt = new Date();
      this.actualDelivery = new Date();
      break;
    case 'Cancelled':
      this.cancelledAt = new Date();
      break;
  }
  
  return this.save();
};

module.exports = mongoose.model('Order', orderSchema);