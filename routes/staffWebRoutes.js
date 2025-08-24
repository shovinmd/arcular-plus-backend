const express = require('express');
const staffController = require('../controllers/staffWebController');
const { verifyFirebaseToken, verifyStaffRole } = require('../middleware/firebaseAuth');
const router = express.Router();

// Staff web interface routes
router.get('/login', staffController.getLoginPage);
router.post('/login', staffController.login);
router.get('/dashboard', staffController.getDashboard);

// Pending approvals
router.get('/pending', verifyFirebaseToken, verifyStaffRole, staffController.getPendingApprovals);
router.get('/pending/:userType', verifyFirebaseToken, verifyStaffRole, staffController.getPendingByType);

// Approval actions
router.post('/approve/:userType/:userId', verifyFirebaseToken, verifyStaffRole, staffController.approveUser);
router.post('/reject/:userType/:userId', verifyFirebaseToken, verifyStaffRole, staffController.rejectUser);
router.post('/request-documents/:userType/:userId', verifyFirebaseToken, verifyStaffRole, staffController.requestDocuments);

// User management
router.get('/users/:userType', verifyFirebaseToken, verifyStaffRole, staffController.getUsersByType);
router.get('/users/:userType/:userId', verifyFirebaseToken, verifyStaffRole, staffController.getUserDetails);

// Document review
router.get('/documents/:userType/:userId', verifyFirebaseToken, verifyStaffRole, staffController.getUserDocuments);
router.post('/documents/:userType/:userId/verify', verifyFirebaseToken, verifyStaffRole, staffController.verifyDocuments);

module.exports = router;
