const express = require('express');
const { authenticateToken, requireSuperAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const router = express.Router();
const staffController = require('../controllers/staffController');

// Pending Approvals
router.get('/pending-approvals', authenticateToken, adminController.getPendingApprovals);
router.post('/approve/:userId', authenticateToken, adminController.approveUser);
router.post('/reject/:userId', authenticateToken, adminController.rejectUser);

// User Management
router.get('/users/:type', authenticateToken, adminController.getUsersByType);

// Document Verification
router.get('/documents/:userId', authenticateToken, adminController.getUserDocuments);
router.post('/documents/:userId/verify', authenticateToken, adminController.verifyUserDocument);

// Reports & Analytics
router.get('/reports/registration', authenticateToken, adminController.getRegistrationReport);
router.get('/reports/approval', authenticateToken, adminController.getApprovalReport);
router.get('/reports/activity', authenticateToken, adminController.getActivityReport);

// Notifications
router.get('/notifications', authenticateToken, adminController.getNotifications);

// Settings
router.put('/settings', authenticateToken, adminController.updateSettings);

// Super admin creates ARC staff
router.post('/staff', authenticateToken, requireSuperAdmin, staffController.createStaff);
// Super admin lists all staff
router.get('/staff', authenticateToken, requireSuperAdmin, staffController.listStaff);
// Get staff profile by Firebase UID (super admin or self)
router.get('/staff/:firebaseUid', authenticateToken, staffController.getStaffProfile);
// Update staff profile (name/role)
router.put('/staff/:firebaseUid', authenticateToken, requireSuperAdmin, staffController.updateStaffProfile);
// Delete staff
router.delete('/staff/:firebaseUid', authenticateToken, requireSuperAdmin, staffController.deleteStaff);

module.exports = router; 