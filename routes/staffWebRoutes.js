const express = require('express');
const staffController = require('../controllers/staffWebController');
const { verifyFirebaseToken, verifyStaffRole } = require('../middleware/firebaseAuth');
const router = express.Router();

// Staff web interface routes
router.get('/login', staffController.getLoginPage);
router.post('/login', staffController.login);
router.get('/dashboard', staffController.getDashboard);

// Staff verification endpoint (for login)
router.post('/api/staff/verify', verifyFirebaseToken, staffController.verifyStaff);

// Staff profile endpoint (for dashboard)
router.get('/api/staff/profile/:uid', verifyFirebaseToken, staffController.getStaffProfile);

// Test endpoint to check staff accounts (remove in production)
router.get('/api/staff/test', staffController.testStaffAccounts);

// Create test staff account (remove in production)
router.post('/api/staff/create-test', staffController.createTestStaffAccount);

// Stakeholder management endpoints (matching existing frontend)
router.get('/api/stakeholders/pending', verifyFirebaseToken, verifyStaffRole, staffController.getPendingStakeholders);
router.post('/api/stakeholders/:id/approve', verifyFirebaseToken, verifyStaffRole, staffController.approveStakeholder);
router.post('/api/stakeholders/:id/reject', verifyFirebaseToken, verifyStaffRole, staffController.rejectStakeholder);

// Additional endpoints for future use
router.get('/pending', verifyFirebaseToken, verifyStaffRole, staffController.getPendingApprovals);
router.get('/pending/:userType', verifyFirebaseToken, verifyStaffRole, staffController.getPendingByType);
router.post('/approve/:userType/:userId', verifyFirebaseToken, verifyStaffRole, staffController.approveUser);
router.post('/reject/:userType/:userId', verifyFirebaseToken, verifyStaffRole, staffController.rejectUser);
router.post('/request-documents/:userType/:userId', verifyFirebaseToken, verifyStaffRole, staffController.requestDocuments);
router.get('/users/:userType', verifyFirebaseToken, verifyStaffRole, staffController.getUsersByType);
router.get('/users/:userType/:userId', verifyFirebaseToken, verifyStaffRole, staffController.getUserDetails);
router.get('/documents/:userType/:userId', verifyFirebaseToken, verifyStaffRole, staffController.getUserDocuments);
router.post('/documents/:userType/:userId/verify', verifyFirebaseToken, verifyStaffRole, staffController.verifyDocuments);

module.exports = router;
