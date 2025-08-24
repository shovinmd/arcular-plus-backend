const express = require('express');
const staffController = require('../controllers/staffWebController');
const router = express.Router();

// Staff web interface routes
router.get('/login', staffController.getLoginPage);
router.post('/login', staffController.login);
router.get('/dashboard', staffController.getDashboard);

// Pending approvals
router.get('/pending', staffController.getPendingApprovals);
router.get('/pending/:userType', staffController.getPendingByType);

// Approval actions
router.post('/approve/:userType/:userId', staffController.approveUser);
router.post('/reject/:userType/:userId', staffController.rejectUser);
router.post('/request-documents/:userType/:userId', staffController.requestDocuments);

// User management
router.get('/users/:userType', staffController.getUsersByType);
router.get('/users/:userType/:userId', staffController.getUserDetails);

// Document review
router.get('/documents/:userType/:userId', staffController.getUserDocuments);
router.post('/documents/:userType/:userId/verify', staffController.verifyDocuments);

module.exports = router;
