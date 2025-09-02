const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrdersByUser,
  getOrdersByPharmacy,
  updateOrderStatus,
  addTracking,
  markDelivered
} = require('../controllers/orderController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Create new order (user)
router.post('/', firebaseAuthMiddleware, createOrder);

// Get orders by user
router.get('/user/:userId', firebaseAuthMiddleware, getOrdersByUser);

// Get orders by pharmacy
router.get('/pharmacy/:pharmacyId', firebaseAuthMiddleware, getOrdersByPharmacy);

// Update order status (pharmacy)
router.put('/:orderId/status', firebaseAuthMiddleware, updateOrderStatus);

// Add tracking information (pharmacy)
router.put('/:orderId/tracking', firebaseAuthMiddleware, addTracking);

// Mark order as delivered (pharmacy)
router.put('/:orderId/delivered', firebaseAuthMiddleware, markDelivered);

module.exports = router;
