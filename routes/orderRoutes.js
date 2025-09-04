const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyFirebaseToken } = require('../middleware/firebaseAuth');

// Create order (support both "/" and "/create" for compatibility)
router.post('/', verifyFirebaseToken, orderController.createOrder);
router.post('/create', verifyFirebaseToken, orderController.createOrder);

// Get user orders
router.get('/user/:userId', verifyFirebaseToken, orderController.getUserOrders);

// Get pharmacy orders
router.get('/pharmacy/:pharmacyId', verifyFirebaseToken, orderController.getPharmacyOrders);

// Update order status
router.put('/:orderId/status', verifyFirebaseToken, orderController.updateOrderStatus);

// Cancel order
router.put('/:orderId/cancel', verifyFirebaseToken, orderController.cancelOrder);

module.exports = router;