const express = require('express');
const auth = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const router = express.Router();

// Pending Approvals
router.get('/pending-approvals', auth, adminController.getPendingApprovals);
router.post('/approve/:userId', auth, adminController.approveUser);
router.post('/reject/:userId', auth, adminController.rejectUser);

// User Management
router.get('/users/:type', auth, adminController.getUsersByType);

// Document Verification
router.get('/documents/:userId', auth, adminController.getUserDocuments);
router.post('/documents/:userId/verify', auth, adminController.verifyUserDocument);

// Reports & Analytics
router.get('/reports/registration', auth, adminController.getRegistrationReport);
router.get('/reports/approval', auth, adminController.getApprovalReport);
router.get('/reports/activity', auth, adminController.getActivityReport);

// Notifications
router.get('/notifications', auth, adminController.getNotifications);

// Settings
router.put('/settings', auth, adminController.updateSettings);

module.exports = router; 