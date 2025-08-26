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
// Note: These use the new approveStakeholder/rejectStakeholder methods that work with all service provider models
router.get('/api/stakeholders/pending', verifyFirebaseToken, verifyStaffRole, staffController.getPendingStakeholders);
router.post('/api/stakeholders/:id/approve', verifyFirebaseToken, verifyStaffRole, staffController.approveStakeholder);
router.post('/api/stakeholders/:id/reject', verifyFirebaseToken, verifyStaffRole, staffController.rejectStakeholder);

// Additional endpoints for future use
// Note: approveUser, rejectUser, and requestDocuments methods were removed and replaced by approveStakeholder/rejectStakeholder
router.get('/pending', verifyFirebaseToken, verifyStaffRole, staffController.getPendingApprovals);
router.get('/pending/:userType', verifyFirebaseToken, verifyStaffRole, staffController.getPendingByType);
router.get('/users/:userType', verifyFirebaseToken, verifyStaffRole, staffController.getUsersByType);
router.get('/users/:userType/:userId', verifyFirebaseToken, verifyStaffRole, staffController.getUserDetails);
router.get('/documents/:userType/:userId', verifyFirebaseToken, verifyStaffRole, staffController.getUserDocuments);
router.post('/documents/:userType/:userId/verify', verifyFirebaseToken, verifyStaffRole, staffController.verifyDocuments);

// Enhanced service provider details endpoint for comprehensive staff review
router.get('/service-provider/:userType/:userId', verifyFirebaseToken, verifyStaffRole, staffController.getServiceProviderDetails);

// Staff profile change routes
router.get('/staff/profile-changes', verifyFirebaseToken, verifyStaffRole, staffController.getPendingProfileChanges);
router.post('/staff/profile-changes/:changeId/approve', verifyFirebaseToken, verifyStaffRole, staffController.approveProfileChange);
router.post('/staff/profile-changes/:changeId/reject', verifyFirebaseToken, verifyStaffRole, staffController.rejectProfileChange);

// Staff profile change submission route
router.post('/staff/profile-changes', verifyFirebaseToken, verifyStaffRole, staffController.submitProfileChange);

module.exports = router;
