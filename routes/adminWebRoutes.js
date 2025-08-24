const express = require('express');
const adminController = require('../controllers/adminWebController');
const { verifyFirebaseToken, verifyAdminRole } = require('../middleware/firebaseAuth');
const router = express.Router();

// Admin web interface routes
router.get('/login', adminController.getLoginPage);
router.post('/login', adminController.login);
router.get('/dashboard', adminController.getDashboard);

// Protected API endpoints for staff management (matching existing frontend)
router.get('/api/admin/staff', verifyFirebaseToken, verifyAdminRole, adminController.getStaffList);
router.post('/api/admin/staff', verifyFirebaseToken, verifyAdminRole, adminController.createStaff);
router.put('/api/admin/staff/:id', verifyFirebaseToken, verifyAdminRole, adminController.updateStaff);
router.delete('/api/admin/staff/:id', verifyFirebaseToken, verifyAdminRole, adminController.deleteStaff);

// Staff management pages (redirects to dashboard)
router.get('/staff/create', adminController.getCreateStaffPage);
router.get('/staff/:id/edit', adminController.getEditStaffPage);

// System overview
router.get('/overview', verifyFirebaseToken, verifyAdminRole, adminController.getSystemOverview);
router.get('/analytics', verifyFirebaseToken, verifyAdminRole, adminController.getAnalytics);

module.exports = router;
