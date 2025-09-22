const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const firebaseAuthMiddleware = require('../middleware/firebaseAuthMiddleware');

// Place a new order (requires authentication)
router.post('/place', firebaseAuthMiddleware, orderController.placeOrder);

// Place hospital order to pharmacy (requires authentication)
router.post('/hospital-order', firebaseAuthMiddleware, orderController.placeHospitalOrder);

// Get orders by user (requires authentication)
router.get('/user/:userId', firebaseAuthMiddleware, orderController.getOrdersByUser);

// Get orders by pharmacy (requires authentication)
router.get('/pharmacy/:pharmacyId', firebaseAuthMiddleware, orderController.getOrdersByPharmacy);

// Get orders by hospital (requires authentication)
router.get('/hospital/:hospitalId', firebaseAuthMiddleware, orderController.getOrdersByHospital);

// Update order status (requires authentication)
router.put('/:orderId/status', firebaseAuthMiddleware, orderController.updateOrderStatus);

// Get order by ID (requires authentication)
router.get('/:orderId', firebaseAuthMiddleware, orderController.getOrderById);

// Get order statistics for pharmacy (requires authentication)
router.get('/pharmacy/:pharmacyId/stats', firebaseAuthMiddleware, orderController.getOrderStats);

module.exports = router;