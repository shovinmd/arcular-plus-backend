const express = require('express');
const adminController = require('../controllers/adminWebController');
const router = express.Router();

// Admin web interface routes
router.get('/login', adminController.getLoginPage);
router.post('/login', adminController.login);
router.get('/dashboard', adminController.getDashboard);

// API endpoints for staff management (matching existing frontend)
router.get('/api/admin/staff', adminController.getStaffList);
router.post('/api/admin/staff', adminController.createStaff);
router.put('/api/admin/staff/:id', adminController.updateStaff);
router.delete('/api/admin/staff/:id', adminController.deleteStaff);

// Staff management pages (redirects to dashboard)
router.get('/staff/create', adminController.getCreateStaffPage);
router.get('/staff/:id/edit', adminController.getEditStaffPage);

// System overview
router.get('/overview', adminController.getSystemOverview);
router.get('/analytics', adminController.getAnalytics);

module.exports = router;
